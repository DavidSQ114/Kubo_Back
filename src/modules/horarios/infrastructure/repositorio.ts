// horarios/infrastructure: único lugar que consulta bloque_horario, horario y detalle_horario (el módulo es su
// dueño). Una «clase» es una fila de detalle_horario. Las columnas TIME se convierten aquí a texto "HH:MM".
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { Ocupacion } from "../domain/reglas";
import type { Bloque, BloqueNuevo, Dia, EstadoHorario } from "../domain/tipos";

type Db = Tx | typeof prisma;

// Primera clave del candado que serializa los cambios de horarios de un mismo año (la segunda es el año).
const CANDADO_HORARIOS = 2026_11;

const aTexto = (hora: Date) => hora.toISOString().slice(11, 16);
const aHora = (texto: string) => new Date(`1970-01-01T${texto}:00.000Z`);

const selectBloque = {
  id: true,
  anioAcademicoId: true,
  orden: true,
  horaInicio: true,
  horaFin: true,
  tipo: true,
  etiqueta: true,
} as const;

export interface BloqueFila extends Bloque {
  anioAcademicoId: string;
}

function filaBloque(b: {
  id: string;
  anioAcademicoId: string;
  orden: number;
  horaInicio: Date;
  horaFin: Date;
  tipo: Bloque["tipo"];
  etiqueta: string;
}): BloqueFila {
  return { ...b, horaInicio: aTexto(b.horaInicio), horaFin: aTexto(b.horaFin) };
}

export const bloques = {
  /** Catálogo de bloques del año, en orden. */
  async delAnio(anioAcademicoId: string, db: Db = prisma): Promise<BloqueFila[]> {
    const filas = await db.bloqueHorario.findMany({
      where: { anioAcademicoId },
      orderBy: { orden: "asc" },
      select: selectBloque,
    });
    return filas.map(filaBloque);
  },

  async porId(id: string, db: Db = prisma): Promise<BloqueFila | null> {
    const b = await db.bloqueHorario.findUnique({ where: { id }, select: selectBloque });
    return b && filaBloque(b);
  },

  /** Crea el catálogo del año. Si otra solicitud lo creó a la vez, no duplica (índice único año + orden). */
  crearVarios: (anioAcademicoId: string, nuevos: BloqueNuevo[], db: Db = prisma) =>
    db.bloqueHorario.createMany({
      data: nuevos.map((b) => ({
        anioAcademicoId,
        orden: b.orden,
        horaInicio: aHora(b.horaInicio),
        horaFin: aHora(b.horaFin),
        tipo: b.tipo,
        etiqueta: b.etiqueta,
      })),
      skipDuplicates: true,
    }),
};

export interface HorarioFila {
  id: string;
  seccionId: string;
  version: number;
  estado: EstadoHorario;
  publicadoEn: Date | null;
}

const selectHorario = { id: true, seccionId: true, version: true, estadoPublicacion: true, publicadoEn: true } as const;

function filaHorario(h: {
  id: string;
  seccionId: string;
  version: number;
  estadoPublicacion: string;
  publicadoEn: Date | null;
}): HorarioFila {
  const { estadoPublicacion, ...resto } = h;
  return { ...resto, estado: estadoPublicacion as EstadoHorario };
}

export const horarios = {
  /** Versiones del horario de la sección, de la más antigua a la más reciente. */
  async deSeccion(seccionId: string, db: Db = prisma): Promise<HorarioFila[]> {
    const filas = await db.horario.findMany({
      where: { seccionId },
      orderBy: { version: "asc" },
      select: selectHorario,
    });
    return filas.map(filaHorario);
  },

  /** Versión PUBLICADA de cada sección indicada (a lo más una por sección: uq_horario_publicado_por_seccion). */
  async publicados(seccionIds: string[], db: Db = prisma): Promise<HorarioFila[]> {
    const filas = await db.horario.findMany({
      where: { seccionId: { in: seccionIds }, estadoPublicacion: "PUBLICADO" },
      select: selectHorario,
    });
    return filas.map(filaHorario);
  },

  async crear(data: { seccionId: string; version: number }, db: Db = prisma): Promise<HorarioFila> {
    return filaHorario(await db.horario.create({ data, select: selectHorario }));
  },

  /** Cambia el estado de una versión. El trigger tg_horario_en_vigor libera sus clases al archivarla. */
  async cambiarEstado(
    id: string,
    datos: { estado: EstadoHorario; publicadoPorId?: string; publicadoEn?: Date },
    db: Db = prisma,
  ): Promise<HorarioFila> {
    const { estado, ...resto } = datos;
    return filaHorario(
      await db.horario.update({ where: { id }, data: { estadoPublicacion: estado, ...resto }, select: selectHorario }),
    );
  },

  /** Bloquea la versión hasta el fin de la transacción (cambios de estado concurrentes). */
  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM horario WHERE id = ${id}::uuid FOR UPDATE`;
  },

  /**
   * Serializa los cambios de horarios de un año: quien valida un cruce ve las clases que otro administrador acaba
   * de guardar (US29, US30). La base lo garantiza además con uq_detalle_cruce_docente y uq_detalle_cruce_aula.
   */
  async bloquearAnio(tx: Tx, anioAcademicoId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CANDADO_HORARIOS}::int, hashtext(${anioAcademicoId}))`;
  },
};

export interface ClaseFila {
  id: string;
  horarioId: string;
  seccionId: string;
  dia: Dia;
  bloqueId: string;
  aulaId: string;
  asignacionDocenteId: string;
  docenteId: string;
}

const selectClase = {
  id: true,
  horarioId: true,
  seccionId: true,
  dia: true,
  bloqueId: true,
  aulaId: true,
  asignacionDocenteId: true,
  docenteId: true,
} as const;

interface DatosClase {
  aulaId: string;
  asignacionDocenteId: string;
  docenteId: string;
}

export const clases = {
  /** La clase con el estado de la versión del horario a la que pertenece (la asistencia exige que esté PUBLICADO). */
  async porId(id: string, db: Db = prisma): Promise<(ClaseFila & { estadoHorario: EstadoHorario }) | null> {
    const c = await db.detalleHorario.findUnique({
      where: { id },
      select: { ...selectClase, horario: { select: { estadoPublicacion: true } } },
    });
    if (!c) return null;
    const { horario, ...clase } = c;
    return { ...clase, estadoHorario: horario.estadoPublicacion as EstadoHorario };
  },

  delHorario: (horarioId: string, db: Db = prisma): Promise<ClaseFila[]> =>
    db.detalleHorario.findMany({ where: { horarioId }, select: selectClase }),

  deHorarios: (horarioIds: string[], db: Db = prisma): Promise<ClaseFila[]> =>
    db.detalleHorario.findMany({ where: { horarioId: { in: horarioIds } }, select: selectClase }),

  enCelda: (horarioId: string, dia: Dia, bloqueId: string, db: Db = prisma): Promise<ClaseFila | null> =>
    db.detalleHorario.findUnique({
      where: { horarioId_dia_bloqueId: { horarioId, dia, bloqueId } },
      select: selectClase,
    }),

  crear: (
    data: DatosClase & { horarioId: string; seccionId: string; dia: Dia; bloqueId: string },
    db: Db = prisma,
  ): Promise<ClaseFila> => db.detalleHorario.create({ data, select: selectClase }),

  actualizar: (id: string, data: DatosClase, db: Db = prisma): Promise<ClaseFila> =>
    db.detalleHorario.update({ where: { id }, data, select: selectClase }),

  eliminar: (id: string, db: Db = prisma) => db.detalleHorario.delete({ where: { id }, select: { id: true } }),

  /** Copia las clases de una versión a otra de la misma sección (el borrador nace del horario publicado, US31). */
  async copiar(origenHorarioId: string, destinoHorarioId: string, tx: Tx) {
    const origen = await tx.detalleHorario.findMany({ where: { horarioId: origenHorarioId }, select: selectClase });
    if (origen.length === 0) return;
    await tx.detalleHorario.createMany({
      data: origen.map(({ seccionId, dia, bloqueId, aulaId, asignacionDocenteId, docenteId }) => ({
        horarioId: destinoHorarioId,
        seccionId,
        dia,
        bloqueId,
        aulaId,
        asignacionDocenteId,
        docenteId,
      })),
    });
  },

  /**
   * Clases vigentes (de borradores y de versiones publicadas) de TODAS las secciones en un día y bloque: con ellas
   * se validan los cruces de docente y de aula (US29, US30).
   */
  async ocupacionesDelBloque(dia: Dia, bloqueId: string, db: Db = prisma): Promise<Ocupacion[]> {
    const filas = await db.detalleHorario.findMany({
      where: { dia, bloqueId, enVigor: true },
      select: {
        seccionId: true,
        dia: true,
        bloqueId: true,
        docenteId: true,
        aulaId: true,
        horario: { select: { estadoPublicacion: true } },
      },
    });
    return filas.map(({ horario, ...o }) => ({ ...o, estadoHorario: horario.estadoPublicacion as EstadoHorario }));
  },

  /** Clases del docente en los horarios PUBLICADOS de un año (US31: «Mi horario» del docente). */
  publicadasDelDocente: (docenteId: string, anioAcademicoId: string, db: Db = prisma): Promise<ClaseFila[]> =>
    db.detalleHorario.findMany({
      where: { docenteId, bloque: { anioAcademicoId }, horario: { estadoPublicacion: "PUBLICADO" } },
      select: selectClase,
    }),
};

/**
 * La base rechazó la clase por una de las exclusiones de cruce (uq_detalle_cruce_docente, uq_detalle_cruce_aula):
 * otra solicitud guardó a la vez una clase con el mismo docente o la misma aula en ese día y bloque.
 */
export function esCruceEnBase(e: unknown): boolean {
  const err = e as { message?: unknown; meta?: unknown; cause?: unknown };
  const texto = [err?.message, JSON.stringify(err?.meta ?? null), JSON.stringify(err?.cause ?? null)].join(" ");
  return /uq_detalle_cruce_(docente|aula)|23P01/.test(texto);
}
