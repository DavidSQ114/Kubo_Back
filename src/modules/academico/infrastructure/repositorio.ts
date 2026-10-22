// academico/infrastructure: único lugar que consulta anio_academico y periodo_evaluacion (dueño de ambas tablas).
// Las columnas DATE se convierten aquí a texto "AAAA-MM-DD": el resto del módulo no ve objetos Date.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { AnioExistente, PeriodoGuardado } from "../domain/reglas";
import type { EstadoAnio, EstadoPeriodo } from "../domain/tipos";

type Db = Tx | typeof prisma;

// Clave del candado que serializa las altas y cambios de fechas de años (evita dos años solapados a la vez).
const CANDADO_ANIOS = 2026_06;

const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);
const aFecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);

export interface AnioFila extends AnioExistente {
  anio: number;
}

export interface PeriodoFila extends PeriodoGuardado {
  id: string;
  anioAcademicoId: string;
  nombre: string;
}

const selectAnio = { id: true, anio: true, fechaInicio: true, fechaFin: true, estado: true } as const;
const selectPeriodo = {
  id: true,
  anioAcademicoId: true,
  numero: true,
  nombre: true,
  fechaInicio: true,
  fechaFin: true,
  estado: true,
} as const;

function filaAnio(a: { id: string; anio: number; fechaInicio: Date; fechaFin: Date; estado: string }): AnioFila {
  return {
    id: a.id,
    anio: a.anio,
    fechaInicio: aTexto(a.fechaInicio),
    fechaFin: aTexto(a.fechaFin),
    estado: a.estado as EstadoAnio,
  };
}

function filaPeriodo(p: {
  id: string;
  anioAcademicoId: string;
  numero: number;
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
}): PeriodoFila {
  return {
    ...p,
    fechaInicio: aTexto(p.fechaInicio),
    fechaFin: aTexto(p.fechaFin),
    estado: p.estado as EstadoPeriodo,
  };
}

export const anios = {
  async listar(db: Db = prisma): Promise<AnioFila[]> {
    const filas = await db.anioAcademico.findMany({ orderBy: { anio: "desc" }, select: selectAnio });
    return filas.map(filaAnio);
  },

  async porId(id: string, db: Db = prisma): Promise<AnioFila | null> {
    const a = await db.anioAcademico.findUnique({ where: { id }, select: selectAnio });
    return a ? filaAnio(a) : null;
  },

  async enCurso(db: Db = prisma): Promise<AnioFila | null> {
    const a = await db.anioAcademico.findFirst({ where: { estado: "EN_CURSO" }, select: selectAnio });
    return a ? filaAnio(a) : null;
  },

  async crear(datos: { anio: number; fechaInicio: string; fechaFin: string }, db: Db = prisma) {
    const a = await db.anioAcademico.create({
      data: { anio: datos.anio, fechaInicio: aFecha(datos.fechaInicio), fechaFin: aFecha(datos.fechaFin) },
      select: selectAnio,
    });
    return filaAnio(a);
  },

  async actualizar(
    id: string,
    datos: { anio?: number; fechaInicio?: string; fechaFin?: string; estado?: EstadoAnio },
    db: Db = prisma,
  ) {
    const a = await db.anioAcademico.update({
      where: { id },
      data: {
        anio: datos.anio,
        estado: datos.estado,
        fechaInicio: datos.fechaInicio ? aFecha(datos.fechaInicio) : undefined,
        fechaFin: datos.fechaFin ? aFecha(datos.fechaFin) : undefined,
      },
      select: selectAnio,
    });
    return filaAnio(a);
  },

  /** Bloquea la fila del año hasta el fin de la transacción (cambios de estado concurrentes). */
  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM anio_academico WHERE id = ${id}::uuid FOR UPDATE`;
  },

  /** Serializa las operaciones que validan solapamiento entre años (dos altas simultáneas). */
  async bloquearCalendario(tx: Tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CANDADO_ANIOS})`;
  },
};

export const periodos = {
  async delAnio(anioAcademicoId: string, db: Db = prisma): Promise<PeriodoFila[]> {
    const filas = await db.periodoEvaluacion.findMany({
      where: { anioAcademicoId },
      orderBy: { numero: "asc" },
      select: selectPeriodo,
    });
    return filas.map(filaPeriodo);
  },

  async deAnios(ids: string[], db: Db = prisma): Promise<PeriodoFila[]> {
    const filas = await db.periodoEvaluacion.findMany({
      where: { anioAcademicoId: { in: ids } },
      orderBy: [{ anioAcademicoId: "asc" }, { numero: "asc" }],
      select: selectPeriodo,
    });
    return filas.map(filaPeriodo);
  },

  /** Crea o actualiza el bimestre (único por año y número). Un bimestre nuevo nace INACTIVO. */
  async guardar(
    anioAcademicoId: string,
    p: { numero: number; nombre: string; fechaInicio: string; fechaFin: string },
    tx: Tx,
  ) {
    const fechas = { nombre: p.nombre, fechaInicio: aFecha(p.fechaInicio), fechaFin: aFecha(p.fechaFin) };
    await tx.periodoEvaluacion.upsert({
      where: { anioAcademicoId_numero: { anioAcademicoId, numero: p.numero } },
      create: { anioAcademicoId, numero: p.numero, ...fechas },
      update: fechas,
      select: { id: true },
    });
  },
};
