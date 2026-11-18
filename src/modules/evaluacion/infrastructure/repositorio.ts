// evaluacion/infrastructure: consultas de cierre_calificacion, nota y resultado_consolidado (dueño: evaluacion) para
// el registro de notas (US37), el cierre de bimestre (US39) y su bloqueo (US40).
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
};
