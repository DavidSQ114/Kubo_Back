// evaluacion/infrastructure: único lugar que consulta nota_conducta (dueño: evaluacion; bloque M3). El trigger
// tg_nota_conducta_periodo_finalizado rechaza escribir en un periodo FINALIZADO (PERIODO_FINALIZADO).
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { ConductaGuardada, ConductaNueva } from "../domain/conducta";
import type { LogroNota } from "../domain/notas";

type Db = typeof prisma | Tx;

export interface ConductaFila extends ConductaGuardada {
  periodoEvaluacionId: string;
  registradoPorId: string;
  modificadoPorId: string | null;
  createdAt: Date;
  modificadoEn: Date | null;
}

const select = {
  id: true,
  matriculaId: true,
  periodoEvaluacionId: true,
  valor: true,
  comentario: true,
  registradoPorId: true,
  modificadoPorId: true,
  createdAt: true,
  modificadoEn: true,
} as const;

const fila = (f: Omit<ConductaFila, "valor"> & { valor: string }): ConductaFila => ({
  ...f,
  valor: f.valor as LogroNota,
});

export const conductas = {
  /** Notas de conducta de varias matrículas en un bimestre. */
  async delPeriodo(periodoEvaluacionId: string, matriculaIds: string[], db: Db = prisma): Promise<ConductaFila[]> {
    if (!matriculaIds.length) return [];
    const filas = await db.notaConducta.findMany({
      where: { periodoEvaluacionId, matriculaId: { in: matriculaIds } },
      select,
    });
    return filas.map(fila);
  },

  /** Todas las notas de conducta de una matrícula (una por bimestre). */
  async deMatricula(matriculaId: string, db: Db = prisma): Promise<ConductaFila[]> {
    const filas = await db.notaConducta.findMany({ where: { matriculaId }, select });
    return filas.map(fila);
  },

  /** Notas de conducta de varias matrículas en todos los bimestres (consolidado de la sección). */
  async deMatriculas(matriculaIds: string[], db: Db = prisma): Promise<ConductaFila[]> {
    if (!matriculaIds.length) return [];
    const filas = await db.notaConducta.findMany({ where: { matriculaId: { in: matriculaIds } }, select });
    return filas.map(fila);
  },

  crear: (tx: Tx, datos: ConductaNueva & { periodoEvaluacionId: string; registradoPorId: string }) =>
    tx.notaConducta.create({ data: datos, select: { id: true } }),

  cambiar: (tx: Tx, id: string, datos: { valor: LogroNota; comentario: string | null; modificadoPorId: string }) =>
    tx.notaConducta.update({ where: { id }, data: { ...datos, modificadoEn: new Date() }, select: { id: true } }),

  /** Bloquea el periodo para leer su estado: no se finaliza a la vez que se guarda la conducta. */
  async bloquearPeriodo(tx: Tx, periodoEvaluacionId: string): Promise<string | null> {
    const filas = await tx.$queryRaw<{ estado: string }[]>`
      SELECT estado::text AS estado FROM periodo_evaluacion WHERE id = ${periodoEvaluacionId}::uuid FOR SHARE`;
    return filas[0]?.estado ?? null;
  },
};
