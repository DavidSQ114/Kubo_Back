// evaluacion/infrastructure: consultas de cierre_calificacion, nota, resultado_consolidado, solicitud_rectificacion,
// bitacora_nota y evidencia_pedagogica (dueño: evaluacion) para el registro de notas (US37), el cierre y la publicación
// del bimestre (US39), su bloqueo (US40), la libreta del apoderado y del alumno (US46, US51), que solo lee notas y
// evidencias de registros PUBLICADOS, la rectificación de nota (US41), la bitácora de notas (US03) y las evidencias
// pedagógicas (US38, US47).
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { EstadoRegistro, LogroNota } from "../domain/notas";
import type { EstadoSolicitud, OrigenCambio } from "../domain/rectificacion";

type Db = typeof prisma | Tx;

export interface CierreFila {
  id: string;
  asignacionDocenteId: string;
  periodoEvaluacionId: string;
  reglaConsolidacionId: string;
  estado: string;
  cerradoPorId: string | null;
  cerradoEn: Date | null;
  publicadoPorId: string | null;
  publicadoEn: Date | null;
}

const selectCierre = {
  id: true,
  asignacionDocenteId: true,
  periodoEvaluacionId: true,
  reglaConsolidacionId: true,
  estado: true,
  cerradoPorId: true,
  cerradoEn: true,
  publicadoPorId: true,
  publicadoEn: true,
} as const;

/** Estado del registro para la pantalla: los estados previos al cierre son todos ABIERTO. */
export function estadoDeRegistro(cierre: Pick<CierreFila, "estado"> | null): EstadoRegistro {
  if (cierre?.estado === "CERRADO" || cierre?.estado === "PUBLICADO") return cierre.estado;
  return "ABIERTO";
}

export const cierres = {
  de: (asignacionDocenteId: string, periodoEvaluacionId: string, db: Db = prisma): Promise<CierreFila | null> =>
    db.cierreCalificacion.findUnique({
      where: { asignacionDocenteId_periodoEvaluacionId: { asignacionDocenteId, periodoEvaluacionId } },
      select: selectCierre,
    }),

  /** Cierres de varias asignaciones (estado de cada bimestre en las pestañas de DO-04). */
  deAsignaciones: (asignacionIds: string[], db: Db = prisma): Promise<CierreFila[]> =>
    db.cierreCalificacion.findMany({ where: { asignacionDocenteId: { in: asignacionIds } }, select: selectCierre }),

  /**
   * Crea el registro (ABIERTO) si aún no existe y lo bloquea hasta el fin de la transacción: dos guardados o un
   * guardado y un cierre del mismo registro se esperan uno al otro (US40).
   */
  async asegurarYBloquear(
    tx: Tx,
    datos: { asignacionDocenteId: string; periodoEvaluacionId: string; reglaConsolidacionId: string },
  ): Promise<CierreFila> {
    // ON CONFLICT DO NOTHING: dos docentes (o dos pestañas) creando el mismo registro a la vez no chocan
    await tx.cierreCalificacion.createMany({ data: [{ ...datos, estado: "ABIERTO" }], skipDuplicates: true });
    const cierre = (await cierres.de(datos.asignacionDocenteId, datos.periodoEvaluacionId, tx))!;
    await cierres.bloquearFila(tx, cierre.id);
    return (await cierres.de(datos.asignacionDocenteId, datos.periodoEvaluacionId, tx))!;
  },

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM cierre_calificacion WHERE id = ${id}::uuid FOR UPDATE`;
  },

  /** Registros CERRADOS y PUBLICADOS de los bimestres de un año (publicación de notas, AD-15). */
  cerradosDelAnio: (anioAcademicoId: string, db: Db = prisma): Promise<CierreFila[]> =>
    db.cierreCalificacion.findMany({
      where: { periodoEvaluacion: { anioAcademicoId }, estado: { in: ["CERRADO", "PUBLICADO"] } },
      select: selectCierre,
    }),

  porId: (id: string, db: Db = prisma): Promise<CierreFila | null> =>
    db.cierreCalificacion.findUnique({ where: { id }, select: selectCierre }),

  porIds: (ids: string[], db: Db = prisma): Promise<CierreFila[]> =>
    db.cierreCalificacion.findMany({ where: { id: { in: ids } }, select: selectCierre }),

  /** CERRADO → PUBLICADO: desde aquí el apoderado y el alumno ven las notas (US39, criterio 4). */
  publicar: (tx: Tx, id: string, datos: { publicadoPorId: string; publicadoEn: Date }): Promise<CierreFila> =>
    tx.cierreCalificacion.update({ where: { id }, data: { ...datos, estado: "PUBLICADO" }, select: selectCierre }),

  cerrar: (
    tx: Tx,
    id: string,
    datos: { reglaConsolidacionId: string; cerradoPorId: string; cerradoEn: Date },
  ): Promise<CierreFila> =>
    tx.cierreCalificacion.update({ where: { id }, data: { ...datos, estado: "CERRADO" }, select: selectCierre }),
};

export interface NotaFila {
  id: string;
  matriculaId: string;
  competenciaPlanId: string;
  logro: LogroNota;
  logroAnterior: LogroNota | null;
  registradoPorId: string;
  modificadoPorId: string | null;
  modificadoEn: Date | null;
  createdAt: Date;
}

export const notas = {
  delCierre: (cierreId: string, db: Db = prisma): Promise<NotaFila[]> =>
    db.nota.findMany({
      where: { cierreId },
      select: {
        id: true,
        matriculaId: true,
        competenciaPlanId: true,
        logro: true,
        logroAnterior: true,
        registradoPorId: true,
        modificadoPorId: true,
        modificadoEn: true,
        createdAt: true,
      },
    }),

  /** Crea las notas y devuelve sus ids: la bitácora guarda el id de cada nota (US03). */
  crear: (
    tx: Tx,
    cierreId: string,
    filas: { matriculaId: string; competenciaPlanId: string; logro: LogroNota }[],
    registradoPorId: string,
  ) =>
    tx.nota.createManyAndReturn({
      data: filas.map((f) => ({ ...f, cierreId, registradoPorId })),
      select: { id: true, matriculaId: true, competenciaPlanId: true, logro: true },
    }),

  porId: (id: string, db: Db = prisma) =>
    db.nota.findUnique({
      where: { id },
      select: { id: true, cierreId: true, matriculaId: true, competenciaPlanId: true, logro: true },
    }),

  porIds: (ids: string[], db: Db = prisma) =>
    db.nota.findMany({
      where: { id: { in: ids } },
      select: { id: true, cierreId: true, matriculaId: true, competenciaPlanId: true, logro: true },
    }),

  /** Nota de un alumno en una competencia del registro; null si aún no se calificó. */
  deCelda: (cierreId: string, matriculaId: string, competenciaPlanId: string, db: Db = prisma) =>
    db.nota.findUnique({
      where: { cierreId_matriculaId_competenciaPlanId: { cierreId, matriculaId, competenciaPlanId } },
      select: { id: true, cierreId: true, matriculaId: true, competenciaPlanId: true, logro: true },
    }),

  /** Cambia el logro y guarda el anterior, quién lo cambió y cuándo (US37). */
  cambiar: (tx: Tx, id: string, datos: { logro: LogroNota; logroAnterior: LogroNota; modificadoPorId: string }) =>
    tx.nota.update({ where: { id }, data: { ...datos, modificadoEn: new Date() } }),
};

export interface ResultadoFila {
  matriculaId: string;
  logroConsolidado: LogroNota | null;
  detalleCalculo: unknown;
}

export const resultados = {
  delCierre: (cierreId: string, db: Db = prisma): Promise<ResultadoFila[]> =>
    db.resultadoConsolidado.findMany({
      where: { cierreId },
      select: { matriculaId: true, logroConsolidado: true, detalleCalculo: true },
    }),

  guardar: (
    tx: Tx,
    cierreId: string,
    filas: { matriculaId: string; logroConsolidado: LogroNota; detalleCalculo: Prisma.InputJsonValue }[],
  ) => tx.resultadoConsolidado.createMany({ data: filas.map((f) => ({ ...f, cierreId })) }),

  deMatricula: (cierreId: string, matriculaId: string, db: Db = prisma): Promise<ResultadoFila | null> =>
    db.resultadoConsolidado.findUnique({
      where: { cierreId_matriculaId: { cierreId, matriculaId } },
      select: { matriculaId: true, logroConsolidado: true, detalleCalculo: true },
    }),

  /** Consolidado del alumno recalculado tras una rectificación aprobada (US41). */
  actualizar: (
    tx: Tx,
    cierreId: string,
    matriculaId: string,
    datos: { logroConsolidado: LogroNota; detalleCalculo: Prisma.InputJsonValue },
  ) =>
    tx.resultadoConsolidado.update({
      where: { cierreId_matriculaId: { cierreId, matriculaId } },
      data: { ...datos, calculadoEn: new Date() },
    }),

  /** Estudiantes consolidados por registro (columna «Estudiantes» de AD-15). */
  async conteoPorCierre(cierreIds: string[], db: Db = prisma): Promise<Record<string, number>> {
    if (!cierreIds.length) return {};
    const filas = await db.resultadoConsolidado.groupBy({
      by: ["cierreId"],
      where: { cierreId: { in: cierreIds } },
      _count: { _all: true },
    });
    return Object.fromEntries(filas.map((f) => [f.cierreId, f._count._all]));
  },

  /** Matrículas consolidadas de varios registros (a quién avisar al publicar, US39). */
  matriculasDeCierres: (cierreIds: string[], db: Db = prisma) =>
    db.resultadoConsolidado.findMany({
      where: { cierreId: { in: cierreIds } },
      select: { cierreId: true, matriculaId: true },
    }),
};

// ---------- Libreta (US46, US51): solo registros PUBLICADOS ----------

export interface ResultadoPublicado {
  cierreId: string;
  asignacionDocenteId: string;
  periodoEvaluacionId: string;
  publicadoEn: Date;
  logroConsolidado: LogroNota | null;
}

export interface NotaPublicada {
  cierreId: string;
  competenciaPlanId: string;
  logro: LogroNota;
}

/**
 * Lo único que la libreta lee de las notas. El filtro `estado: "PUBLICADO"` está en la consulta: un registro abierto
 * o solo cerrado nunca sale de la base hacia el apoderado o el alumno, la pantalla no decide qué ocultar.
 */
export const publicados = {
  async resultadosDeMatricula(matriculaId: string, db: Db = prisma): Promise<ResultadoPublicado[]> {
    const filas = await db.resultadoConsolidado.findMany({
      where: { matriculaId, cierre: { estado: "PUBLICADO" } },
      select: {
        cierreId: true,
        logroConsolidado: true,
        cierre: { select: { asignacionDocenteId: true, periodoEvaluacionId: true, publicadoEn: true } },
      },
    });
    return filas.map((f) => ({
      cierreId: f.cierreId,
      asignacionDocenteId: f.cierre.asignacionDocenteId,
      periodoEvaluacionId: f.cierre.periodoEvaluacionId,
      // un registro PUBLICADO siempre tiene fecha de publicación; la de creación es solo un respaldo
      publicadoEn: f.cierre.publicadoEn ?? new Date(0),
      logroConsolidado: f.logroConsolidado,
    }));
  },

  notasDeMatricula: (matriculaId: string, db: Db = prisma): Promise<NotaPublicada[]> =>
    db.nota.findMany({
      where: { matriculaId, cierre: { estado: "PUBLICADO" } },
      select: { cierreId: true, competenciaPlanId: true, logro: true },
    }),

  /** Evidencias de las notas publicadas de una matrícula (US47): las de un registro sin publicar nunca salen. */
  async evidenciasDeMatricula(matriculaId: string, db: Db = prisma): Promise<EvidenciaPublicada[]> {
    const filas = await db.evidenciaPedagogica.findMany({
      where: { nota: { matriculaId, cierre: { estado: "PUBLICADO" } } },
      select: { ...selectEvidencia, nota: { select: { cierreId: true, competenciaPlanId: true } } },
      orderBy: { createdAt: "asc" },
    });
    return filas.map(({ nota, ...e }) => ({
      ...e,
      cierreId: nota.cierreId,
      competenciaPlanId: nota.competenciaPlanId,
    }));
  },
};

// ---------- Evidencias pedagógicas (US38, US47) ----------

export interface EvidenciaFila {
  id: string;
  notaId: string;
  entregaTrabajoId: string | null;
  comentario: string | null;
  /** Clave interna del almacén (<area>/<uuid>): nunca sale hacia el navegador. */
  archivoClave: string | null;
  nombreArchivo: string | null;
  mimeType: string | null;
  tamanoBytes: number | null;
  subidoPorId: string;
  createdAt: Date;
}

export interface EvidenciaPublicada extends EvidenciaFila {
  cierreId: string;
  competenciaPlanId: string;
}

/** La evidencia con la nota y el registro a los que pertenece: con esto se decide quién puede verla. */
export interface EvidenciaConRegistro extends EvidenciaFila {
  matriculaId: string;
  competenciaPlanId: string;
  cierreId: string;
  estadoCierre: string;
  asignacionDocenteId: string;
}

const selectEvidencia = {
  id: true,
  notaId: true,
  entregaTrabajoId: true,
  comentario: true,
  archivoClave: true,
  nombreArchivo: true,
  mimeType: true,
  tamanoBytes: true,
  subidoPorId: true,
  createdAt: true,
} as const;

export const evidencias = {
  /** Evidencias de todas las notas de un registro (ícono con el número de evidencias en DO-04). */
  delCierre: (cierreId: string, db: Db = prisma): Promise<EvidenciaFila[]> =>
    db.evidenciaPedagogica.findMany({
      where: { nota: { cierreId } },
      select: selectEvidencia,
      orderBy: { createdAt: "asc" },
    }),

  crear: (
    tx: Tx,
    datos: {
      notaId: string;
      comentario: string | null;
      archivoClave: string | null;
      nombreArchivo: string | null;
      mimeType: string | null;
      tamanoBytes: number | null;
      subidoPorId: string;
      entregaTrabajoId?: string | null;
    },
  ): Promise<EvidenciaFila> => tx.evidenciaPedagogica.create({ data: datos, select: selectEvidencia }),

  eliminar: async (tx: Tx, id: string) => {
    await tx.evidenciaPedagogica.delete({ where: { id } });
  },

  async conRegistro(id: string, db: Db = prisma): Promise<EvidenciaConRegistro | null> {
    const fila = await db.evidenciaPedagogica.findUnique({
      where: { id },
      select: {
        ...selectEvidencia,
        nota: {
          select: {
            matriculaId: true,
            competenciaPlanId: true,
            cierreId: true,
            cierre: { select: { estado: true, asignacionDocenteId: true } },
          },
        },
      },
    });
    if (!fila) return null;
    const { nota, ...e } = fila;
    return {
      ...e,
      matriculaId: nota.matriculaId,
      competenciaPlanId: nota.competenciaPlanId,
      cierreId: nota.cierreId,
      estadoCierre: nota.cierre.estado,
      asignacionDocenteId: nota.cierre.asignacionDocenteId,
    };
  },
};

// ---------- Solicitudes de rectificación (US41) ----------

export interface SolicitudFila {
  id: string;
  notaId: string;
  valorAnterior: LogroNota;
  valorSolicitado: LogroNota;
  motivo: string;
  estado: EstadoSolicitud;
  solicitadoPorId: string;
  motivoRechazo: string | null;
  resueltoPorId: string | null;
  resueltoEn: Date | null;
  createdAt: Date;
}

const selectSolicitud = {
  id: true,
  notaId: true,
  valorAnterior: true,
  valorSolicitado: true,
  motivo: true,
  estado: true,
  solicitadoPorId: true,
  motivoRechazo: true,
  resueltoPorId: true,
  resueltoEn: true,
  createdAt: true,
} as const;

const PENDIENTES: EstadoSolicitud[] = ["PENDIENTE", "EN_REVISION"];

export interface FiltroSolicitudes {
  /** Pendientes o ya resueltas (aprobadas, rechazadas o canceladas). */
  pendientes: boolean;
  pagina: number;
  tamano: number;
}

export const solicitudes = {
  crear: (
    datos: {
      notaId: string;
      valorAnterior: LogroNota;
      valorSolicitado: LogroNota;
      motivo: string;
      solicitadoPorId: string;
    },
    db: Db = prisma,
  ): Promise<SolicitudFila> => db.solicitudRectificacion.create({ data: datos, select: selectSolicitud }),

  porId: (id: string, db: Db = prisma): Promise<SolicitudFila | null> =>
    db.solicitudRectificacion.findUnique({ where: { id }, select: selectSolicitud }),

  /** ¿La nota ya tiene una solicitud sin resolver? Una sola pendiente por nota (uq_solicitud_rectificacion_…). */
  async hayPendiente(notaId: string, db: Db = prisma): Promise<boolean> {
    return (await db.solicitudRectificacion.count({ where: { notaId, estado: { in: PENDIENTES } } })) > 0;
  },

  /** Dos administradores resolviendo la misma solicitud se esperan: el segundo la encuentra ya resuelta. */
  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM solicitud_rectificacion WHERE id = ${id}::uuid FOR UPDATE`;
  },

  resolver: (
    tx: Tx,
    id: string,
    datos: { estado: "APROBADA" | "RECHAZADA"; motivoRechazo: string | null; resueltoPorId: string; resueltoEn: Date },
  ): Promise<SolicitudFila> =>
    tx.solicitudRectificacion.update({ where: { id }, data: datos, select: selectSolicitud }),

  /** Bandeja de AD-15: pendientes de la más antigua a la más reciente; resueltas, de la más reciente a la más antigua. */
  async listar(f: FiltroSolicitudes, db: Db = prisma): Promise<{ items: SolicitudFila[]; total: number }> {
    const where: Prisma.SolicitudRectificacionWhereInput = {
      estado: f.pendientes ? { in: PENDIENTES } : { notIn: PENDIENTES },
    };
    const [items, total] = await Promise.all([
      db.solicitudRectificacion.findMany({
        where,
        orderBy: f.pendientes ? [{ createdAt: "asc" }] : [{ resueltoEn: "desc" }, { createdAt: "desc" }],
        skip: (f.pagina - 1) * f.tamano,
        take: f.tamano,
        select: selectSolicitud,
      }),
      db.solicitudRectificacion.count({ where }),
    ]);
    return { items, total };
  },

  /** Solicitudes de un docente (DO-04), de la más reciente a la más antigua. */
  delSolicitante: (solicitadoPorId: string, limite: number, db: Db = prisma): Promise<SolicitudFila[]> =>
    db.solicitudRectificacion.findMany({
      where: { solicitadoPorId },
      orderBy: { createdAt: "desc" },
      take: limite,
      select: selectSolicitud,
    }),

  contarPendientes: (db: Db = prisma) => db.solicitudRectificacion.count({ where: { estado: { in: PENDIENTES } } }),
};

/**
 * Habilita, solo dentro de esta transacción, el cambio de la nota de una rectificación ya APROBADA: el trigger
 * tg_nota_registro_cerrado (US40) lo comprueba contra la solicitud y rechaza cualquier otra escritura. Con null se
 * deshabilita de nuevo.
 */
export async function habilitarRectificacion(tx: Tx, solicitudId: string | null) {
  await tx.$queryRaw`SELECT set_config('kubo.rectificacion_id', ${solicitudId ?? ""}, true)`;
}

// ---------- Bitácora de notas (US03): solo se inserta y se lee ----------

export interface EntradaBitacora {
  notaId: string;
  cierreId: string;
  matriculaId: string;
  competenciaPlanId: string;
  origen: OrigenCambio;
  solicitudId: string | null;
  logroAnterior: LogroNota | null;
  logroNuevo: LogroNota;
  usuarioId: string;
  usuarioNombre: string;
  docenteId: string;
  docenteNombre: string;
  anio: number;
  cursoCodigo: string;
  cursoNombre: string;
  seccion: string;
  bimestreNumero: number;
  bimestreNombre: string;
  estudianteNombre: string;
  competenciaColumna: number;
  competenciaCodigo: string;
  competenciaNombre: string;
}

export interface FilaBitacora extends EntradaBitacora {
  id: string;
  createdAt: Date;
}

export interface FiltroBitacora {
  desde?: Date;
  /** Exclusivo: el inicio del día siguiente al último día pedido. */
  hasta?: Date;
  docenteId?: string;
  pagina: number;
  tamano: number;
}

export const bitacora = {
  /** Se llama dentro de la transacción que crea o cambia las notas (US03). */
  async registrar(tx: Tx, entradas: EntradaBitacora[]) {
    if (entradas.length) await tx.bitacoraNota.createMany({ data: entradas });
  },

  /** Del más reciente al más antiguo; el rango y el docente se cumplen a la vez (US03, criterio 2). */
  async listar(f: FiltroBitacora, db: Db = prisma): Promise<{ items: FilaBitacora[]; total: number }> {
    const fecha = f.desde || f.hasta ? { createdAt: { gte: f.desde, lt: f.hasta } } : {};
    const where: Prisma.BitacoraNotaWhereInput = { ...fecha, ...(f.docenteId ? { docenteId: f.docenteId } : {}) };
    const [items, total] = await Promise.all([
      db.bitacoraNota.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (f.pagina - 1) * f.tamano,
        take: f.tamano,
      }),
      db.bitacoraNota.count({ where }),
    ]);
    return { items, total };
  },

  /** Docentes que aparecen en la bitácora (filtro «Docente» de AD-16), con el nombre de su último cambio. */
  docentes: (db: Db = prisma): Promise<{ docenteId: string; docenteNombre: string }[]> =>
    db.bitacoraNota.findMany({
      distinct: ["docenteId"],
      orderBy: [{ docenteId: "asc" }, { createdAt: "desc" }],
      select: { docenteId: true, docenteNombre: true },
    }),
};
