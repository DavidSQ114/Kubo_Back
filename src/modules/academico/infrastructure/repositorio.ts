// academico/infrastructure: único lugar que consulta las tablas de académico: anio_academico, periodo_evaluacion,
// grado, seccion y aula (el módulo es su dueño).
// Las columnas DATE se convierten aquí a texto "AAAA-MM-DD": el resto del módulo no ve objetos Date.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { AnioExistente, PeriodoGuardado } from "../domain/reglas";
import type { EstadoSeccion } from "../domain/secciones";
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

// ---------- Grados, secciones y aulas (US08, US09) ----------

export interface GradoFila {
  id: string;
  numero: number;
  nombre: string;
}

export interface AulaFila {
  id: string;
  nombre: string;
  ubicacion: string | null;
  aforo: number;
  activo: boolean;
}

export interface SeccionFila {
  id: string;
  anioAcademicoId: string;
  nombre: string;
  aforoMaximo: number;
  estado: EstadoSeccion;
  tutorId: string | null;
  grado: GradoFila;
  aula: AulaFila | null;
}

const selectAula = { id: true, nombre: true, ubicacion: true, aforo: true, activo: true } as const;
const selectSeccion = {
  id: true,
  anioAcademicoId: true,
  nombre: true,
  aforoMaximo: true,
  estado: true,
  tutorId: true,
  grado: { select: { id: true, numero: true, nombre: true } },
  aula: { select: selectAula },
} as const;

export const grados = {
  activos: (db: Db = prisma): Promise<GradoFila[]> =>
    db.grado.findMany({
      where: { activo: true },
      orderBy: { numero: "asc" },
      select: { id: true, numero: true, nombre: true },
    }),

  porId: (id: string, db: Db = prisma) =>
    db.grado.findUnique({ where: { id }, select: { id: true, numero: true, nombre: true, activo: true } }),
};

export const secciones = {
  delAnio: (anioAcademicoId: string, db: Db = prisma) =>
    db.seccion.findMany({
      where: { anioAcademicoId },
      orderBy: [{ grado: { numero: "asc" } }, { nombre: "asc" }],
      select: selectSeccion,
    }) as Promise<SeccionFila[]>,

  porId: (id: string, db: Db = prisma) =>
    db.seccion.findUnique({ where: { id }, select: selectSeccion }) as Promise<SeccionFila | null>,

  /** Secciones activas de años no cerrados que usan el aula (para su aforo y para inactivarla). */
  vigentesDelAula: (aulaId: string, db: Db = prisma) =>
    db.seccion.findMany({
      where: { aulaId, estado: "ACTIVA", anioAcademico: { estado: { not: "CERRADO" } } },
      select: { id: true, nombre: true, aforoMaximo: true, grado: { select: { numero: true } } },
    }),

  crear: (
    data: {
      anioAcademicoId: string;
      gradoId: string;
      nombre: string;
      aforoMaximo: number;
      aulaId: string | null;
      tutorId: string | null;
    },
    db: Db = prisma,
  ) => db.seccion.create({ data, select: selectSeccion }) as Promise<SeccionFila>,

  actualizar: (
    id: string,
    data: {
      gradoId?: string;
      nombre?: string;
      aforoMaximo?: number;
      aulaId?: string | null;
      tutorId?: string | null;
      estado?: EstadoSeccion;
    },
    db: Db = prisma,
  ) => db.seccion.update({ where: { id }, data, select: selectSeccion }) as Promise<SeccionFila>,

  eliminar: (id: string, db: Db = prisma) => db.seccion.delete({ where: { id }, select: { id: true } }),

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM seccion WHERE id = ${id}::uuid FOR UPDATE`;
  },
};

export const aulas = {
  todas: (db: Db = prisma): Promise<AulaFila[]> =>
    db.aula.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], select: selectAula }),

  porId: (id: string, db: Db = prisma): Promise<AulaFila | null> =>
    db.aula.findUnique({ where: { id }, select: selectAula }),

  crear: (data: { nombre: string; ubicacion: string | null; aforo: number }, db: Db = prisma) =>
    db.aula.create({ data, select: selectAula }),

  actualizar: (
    id: string,
    data: { nombre?: string; ubicacion?: string | null; aforo?: number; activo?: boolean },
    db: Db = prisma,
  ) => db.aula.update({ where: { id }, data, select: selectAula }),

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM aula WHERE id = ${id}::uuid FOR UPDATE`;
  },
};
