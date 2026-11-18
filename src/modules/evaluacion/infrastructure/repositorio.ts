// evaluacion/infrastructure: consultas de cierre_calificacion, nota y resultado_consolidado (dueño: evaluacion) para
// el registro de notas (US37), el cierre y la publicación del bimestre (US39), su bloqueo (US40) y la libreta del
// apoderado y del alumno (US46, US51), que solo lee notas de registros PUBLICADOS.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { EstadoRegistro, LogroNota } from "../domain/notas";

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

  crear: (
    tx: Tx,
    cierreId: string,
    filas: { matriculaId: string; competenciaPlanId: string; logro: LogroNota }[],
    registradoPorId: string,
  ) => tx.nota.createMany({ data: filas.map((f) => ({ ...f, cierreId, registradoPorId })) }),

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
};
