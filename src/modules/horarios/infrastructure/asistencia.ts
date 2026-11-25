// horarios/infrastructure: único lugar que consulta sesion_clase, asistencia_estudiante y aviso_asistencia (el módulo
// es su dueño; US35, US36, US45, US52). Las columnas DATE y TIME se convierten aquí a texto «AAAA-MM-DD» y «HH:MM».
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { Aviso, EstadoAsistencia, Rango, TipoAviso } from "../domain/asistencia";
import type { Dia } from "../domain/tipos";
import type { ClaseFila } from "./repositorio";

type Db = Tx | typeof prisma;

const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);
const aFecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);
const aHora = (hora: Date) => hora.toISOString().slice(11, 16);
const entre = (rango: Rango) => ({ gte: aFecha(rango.fechaInicio), lte: aFecha(rango.fechaFin) });

const selectSesion = {
  id: true,
  docenteId: true,
  fecha: true,
  iniciadaEn: true,
  cerradaEn: true,
  detalleHorario: {
    select: {
      id: true,
      horarioId: true,
      seccionId: true,
      dia: true,
      bloqueId: true,
      aulaId: true,
      asignacionDocenteId: true,
      docenteId: true,
    },
  },
} as const;

export interface SesionFila {
  id: string;
  /** Docente que abrió la sesión: el único que puede registrar y corregir su asistencia. */
  docenteId: string;
  fecha: string;
  iniciadaEn: Date | null;
  /** Instante en que se guardó la lista por primera vez; null si la sesión está abierta sin registro. */
  cerradaEn: Date | null;
  clase: ClaseFila;
}

function filaSesion(s: {
  id: string;
  docenteId: string;
  fecha: Date;
  iniciadaEn: Date | null;
  cerradaEn: Date | null;
  detalleHorario: ClaseFila;
}): SesionFila {
  const { detalleHorario, fecha, ...resto } = s;
  return { ...resto, fecha: aTexto(fecha), clase: detalleHorario };
}

export const sesiones = {
  async porId(id: string, db: Db = prisma): Promise<SesionFila | null> {
    const s = await db.sesionClase.findUnique({ where: { id }, select: selectSesion });
    return s && filaSesion(s);
  },

  /**
   * Sesiones de una fecha en los bloques de las secciones indicadas. Se busca por sección y bloque, no por la clase:
   * si el horario se volvió a publicar ese día, la clase es otra fila pero la sesión ya abierta sigue siendo la misma.
   */
  async enFecha(fecha: string, seccionIds: string[], db: Db = prisma): Promise<SesionFila[]> {
    if (!seccionIds.length) return [];
    const filas = await db.sesionClase.findMany({
      where: { fecha: aFecha(fecha), detalleHorario: { seccionId: { in: seccionIds } } },
      select: selectSesion,
    });
    return filas.map(filaSesion);
  },

  /** Todas las sesiones de una fecha (módulo de asistencia de alumnos del administrador). */
  async deFecha(fecha: string, db: Db = prisma): Promise<SesionFila[]> {
    const filas = await db.sesionClase.findMany({ where: { fecha: aFecha(fecha) }, select: selectSesion });
    return filas.map(filaSesion);
  },

  /** Sesiones que abrió el docente en un rango de fechas. */
  async delDocente(docenteId: string, rango: Rango, db: Db = prisma): Promise<SesionFila[]> {
    const filas = await db.sesionClase.findMany({
      where: { docenteId, fecha: entre(rango) },
      select: selectSesion,
    });
    return filas.map(filaSesion);
  },

  /** Abre la sesión de la clase en la fecha. Si otra solicitud la abrió a la vez, devuelve esa (clase + fecha). */
  async abrir(
    datos: { detalleHorarioId: string; docenteId: string; fecha: string; iniciadaEn: Date },
    db: Db = prisma,
  ): Promise<SesionFila> {
    const { detalleHorarioId, docenteId, iniciadaEn } = datos;
    const fecha = aFecha(datos.fecha);
    const s = await db.sesionClase.upsert({
      where: { detalleHorarioId_fecha: { detalleHorarioId, fecha } },
      create: { detalleHorarioId, docenteId, fecha, iniciadaEn },
      update: {},
      select: selectSesion,
    });
    return filaSesion(s);
  },

  /** Marca la sesión como registrada: desde este instante corre el plazo de corrección (US36). */
  marcarRegistrada: (id: string, cerradaEn: Date, tx: Tx) =>
    tx.sesionClase.update({ where: { id }, data: { cerradaEn }, select: { id: true } }),

  /** Bloquea la sesión hasta el fin de la transacción: dos guardados a la vez no duplican ni pisan registros. */
  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM sesion_clase WHERE id = ${id}::uuid FOR UPDATE`;
  },
};

const selectRegistro = {
  id: true,
  sesionClaseId: true,
  matriculaId: true,
  estado: true,
  estadoAnterior: true,
  observacion: true,
  registradoPorId: true,
  registradoEn: true,
  modificadoPorId: true,
  modificadoEn: true,
  motivoCambio: true,
} as const;

export interface RegistroFila {
  id: string;
  sesionClaseId: string;
  matriculaId: string;
  estado: EstadoAsistencia;
  /** Estado anterior a la última corrección; null si nunca se corrigió. */
  estadoAnterior: EstadoAsistencia | null;
  observacion: string | null;
  registradoPorId: string;
  registradoEn: Date;
  modificadoPorId: string | null;
  modificadoEn: Date | null;
  motivoCambio: string | null;
}

export interface RegistroConClase {
  fecha: string;
  estado: EstadoAsistencia;
  observacion: string | null;
  horaInicio: string;
  asignacionDocenteId: string;
  docenteId: string;
}

export interface RegistroDeSeccion {
  id: string;
  matriculaId: string;
  estado: EstadoAsistencia;
  motivoCambio: string | null;
  sesionClaseId: string;
  fecha: string;
  docenteId: string;
  asignacionDocenteId: string;
  horaInicio: string;
}

export const asistencias = {
  deSesion: (sesionClaseId: string, db: Db = prisma): Promise<RegistroFila[]> =>
    db.asistenciaEstudiante.findMany({ where: { sesionClaseId }, select: selectRegistro }),

  porId: (id: string, db: Db = prisma): Promise<RegistroFila | null> =>
    db.asistenciaEstudiante.findUnique({ where: { id }, select: selectRegistro }),

  /** Estados registrados en cada sesión, para sus contadores (presentes, tardanzas, ausentes y justificados). */
  async estadosDeSesiones(sesionIds: string[], db: Db = prisma): Promise<Map<string, EstadoAsistencia[]>> {
    const porSesion = new Map<string, EstadoAsistencia[]>();
    if (!sesionIds.length) return porSesion;
    const filas = await db.asistenciaEstudiante.findMany({
      where: { sesionClaseId: { in: sesionIds } },
      select: { sesionClaseId: true, estado: true },
    });
    for (const f of filas) porSesion.set(f.sesionClaseId, [...(porSesion.get(f.sesionClaseId) ?? []), f.estado]);
    return porSesion;
  },

  crearVarias: (
    tx: Tx,
    registros: {
      sesionClaseId: string;
      matriculaId: string;
      estado: EstadoAsistencia;
      observacion: string | null;
      registradoPorId: string;
      registradoEn: Date;
    }[],
  ) => tx.asistenciaEstudiante.createMany({ data: registros }),

  /** Corrige un registro: guarda quién y cuándo lo cambió y, si cambia el estado, el que tenía antes (US36). */
  corregir: (
    tx: Tx,
    id: string,
    datos: {
      estado: EstadoAsistencia;
      observacion: string | null;
      estadoAnterior?: EstadoAsistencia;
      modificadoPorId: string;
      modificadoEn: Date;
      motivoCambio?: string;
    },
  ) => tx.asistenciaEstudiante.update({ where: { id }, data: datos, select: { id: true } }),

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM asistencia_estudiante WHERE id = ${id}::uuid FOR UPDATE`;
  },

  /** Asistencia de una matrícula en un rango de fechas, con la hora y la clase de cada registro. */
  async deMatricula(matriculaId: string, rango: Rango, db: Db = prisma): Promise<RegistroConClase[]> {
    const filas = await db.asistenciaEstudiante.findMany({
      where: { matriculaId, sesionClase: { fecha: entre(rango) } },
      select: {
        estado: true,
        observacion: true,
        sesionClase: {
          select: {
            fecha: true,
            docenteId: true,
            detalleHorario: { select: { asignacionDocenteId: true, bloque: { select: { horaInicio: true } } } },
          },
        },
      },
    });
    return filas.map((f) => ({
      fecha: aTexto(f.sesionClase.fecha),
      estado: f.estado,
      observacion: f.observacion,
      horaInicio: aHora(f.sesionClase.detalleHorario.bloque.horaInicio),
      asignacionDocenteId: f.sesionClase.detalleHorario.asignacionDocenteId,
      docenteId: f.sesionClase.docenteId,
    }));
  },

  /** Estados de varias matrículas en un rango, en cualquier sección (bloque M3: avisos por umbral de la tutoría). */
  async deMatriculas(
    matriculaIds: string[],
    rango: Rango,
    db: Db = prisma,
  ): Promise<{ matriculaId: string; fecha: string; estado: EstadoAsistencia }[]> {
    if (!matriculaIds.length) return [];
    const filas = await db.asistenciaEstudiante.findMany({
      where: { matriculaId: { in: matriculaIds }, sesionClase: { fecha: entre(rango) } },
      select: { matriculaId: true, estado: true, sesionClase: { select: { fecha: true } } },
    });
    return filas.map((f) => ({ matriculaId: f.matriculaId, fecha: aTexto(f.sesionClase.fecha), estado: f.estado }));
  },

  /**
   * Registros de las clases de una sección en un rango, con la clase de cada uno (bloque M3: faltas de hoy y reporte
   * del tutor). Incluye a quienes después se trasladaron o retiraron: sus clases en la sección cuentan.
   */
  async deSeccion(seccionId: string, rango: Rango, db: Db = prisma): Promise<RegistroDeSeccion[]> {
    const filas = await db.asistenciaEstudiante.findMany({
      where: { sesionClase: { fecha: entre(rango), detalleHorario: { seccionId } } },
      select: {
        id: true,
        matriculaId: true,
        estado: true,
        motivoCambio: true,
        sesionClase: {
          select: {
            id: true,
            fecha: true,
            docenteId: true,
            detalleHorario: { select: { asignacionDocenteId: true, bloque: { select: { horaInicio: true } } } },
          },
        },
      },
    });
    return filas.map((f) => ({
      id: f.id,
      matriculaId: f.matriculaId,
      estado: f.estado,
      motivoCambio: f.motivoCambio,
      sesionClaseId: f.sesionClase.id,
      fecha: aTexto(f.sesionClase.fecha),
      docenteId: f.sesionClase.docenteId,
      asignacionDocenteId: f.sesionClase.detalleHorario.asignacionDocenteId,
      horaInicio: aHora(f.sesionClase.detalleHorario.bloque.horaInicio),
    }));
  },

  /** Faltas (sin justificar) y tardanzas de cada matrícula en las sesiones de las clases indicadas (DO-03). */
  async contadores(
    detalleHorarioIds: string[],
    matriculaIds: string[],
    rango: Rango,
    db: Db = prisma,
  ): Promise<Map<string, { faltas: number; tardanzas: number }>> {
    const contadores = new Map<string, { faltas: number; tardanzas: number }>();
    if (!detalleHorarioIds.length || !matriculaIds.length) return contadores;
    const grupos = await db.asistenciaEstudiante.groupBy({
      by: ["matriculaId", "estado"],
      where: {
        matriculaId: { in: matriculaIds },
        estado: { in: ["FALTA", "TARDANZA"] },
        sesionClase: { detalleHorarioId: { in: detalleHorarioIds }, fecha: entre(rango) },
      },
      _count: { _all: true },
    });
    for (const g of grupos) {
      const c = contadores.get(g.matriculaId) ?? { faltas: 0, tardanzas: 0 };
      if (g.estado === "FALTA") c.faltas = g._count._all;
      else c.tardanzas = g._count._all;
      contadores.set(g.matriculaId, c);
    }
    return contadores;
  },
};

export interface ClaseDeSeccion {
  id: string;
  dia: Dia;
  asignacionDocenteId: string;
}

/** Clases de la sección en todas las versiones de su horario: las sesiones antiguas apuntan a versiones archivadas. */
export const clasesDeSeccion = (seccionId: string, db: Db = prisma): Promise<ClaseDeSeccion[]> =>
  db.detalleHorario.findMany({ where: { seccionId }, select: { id: true, dia: true, asignacionDocenteId: true } });

export const avisos = {
  /** Avisos por umbral ya enviados de la matrícula. */
  deMatricula: (matriculaId: string, db: Db = prisma): Promise<{ tipo: TipoAviso; periodo: string }[]> =>
    db.avisoAsistencia.findMany({ where: { matriculaId }, select: { tipo: true, periodo: true } }),

  /**
   * Deja constancia del aviso antes de enviarlo. Devuelve su id, o null si ya existía: la clave única (matrícula,
   * tipo, periodo) garantiza que dos registros simultáneos no avisen dos veces (US52).
   */
  /**
   * Deja constancia del aviso; null si ya estaba (ON CONFLICT DO NOTHING: dentro de una transacción no la aborta,
   * y de dos registros a la vez solo uno lo crea).
   */
  async registrar(matriculaId: string, aviso: Aviso, db: Db = prisma): Promise<string | null> {
    const [creado] = await db.avisoAsistencia.createManyAndReturn({
      data: [{ matriculaId, ...aviso }],
      skipDuplicates: true,
      select: { id: true },
    });
    return creado?.id ?? null;
  },

  marcarCorreos: (id: string, correosEnviados: number, db: Db = prisma) =>
    db.avisoAsistencia.update({ where: { id }, data: { correosEnviados }, select: { id: true } }),
};
