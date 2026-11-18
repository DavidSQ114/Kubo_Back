// matricula/infrastructure: consulta del panel de morosidad (US24). Una sola consulta agregada sobre concepto_cobro y
// matricula (tablas del módulo), agrupada por matrícula: sin N+1. Usa el índice (estado, fecha_vencimiento).
// También las consultas de los recordatorios de pago (US59): cuotas vencidas de las matrículas elegidas y la fecha
// del último recordatorio (matricula.ultimo_recordatorio_en).
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";

type Db = Tx | typeof prisma;

export interface DeudaMatricula {
  matriculaId: string;
  estudianteId: string;
  seccionId: string | null;
  vinculoId: string | null;
  cuotasVencidas: number;
  /** Suma exacta como texto «900.00» (Decimal, nunca float). */
  deuda: string;
  primerVencimiento: string;
  tipos: string[];
  meses: (number | null)[];
  /** Último recordatorio de pago enviado (US59); null si nunca se envió. */
  ultimoRecordatorioEn: Date | null;
}

/**
 * Matrículas del año con cuotas Pendiente vencidas (vencimiento anterior a `hoy`, el día de Lima). No cuenta las
 * matrículas Retirado ni Anulado ni las cuotas Anulado o Pagado. Sin caché: quien paga sale en la siguiente consulta.
 */
export async function deudasVencidas(filtro: {
  anioId: string;
  hoy: string;
  seccionIds?: string[] | null;
}): Promise<DeudaMatricula[]> {
  const porSeccion = filtro.seccionIds
    ? Prisma.sql`AND m.seccion_id = ANY(${filtro.seccionIds}::uuid[])`
    : Prisma.empty;
  return prisma.$queryRaw<DeudaMatricula[]>`
    SELECT m.id::text AS "matriculaId",
           m.estudiante_id::text AS "estudianteId",
           m.seccion_id::text AS "seccionId",
           m.vinculo_responsable_id::text AS "vinculoId",
           COUNT(*)::int AS "cuotasVencidas",
           SUM(c.monto)::text AS "deuda",
           MIN(c.fecha_vencimiento)::text AS "primerVencimiento",
           array_agg(c.tipo::text ORDER BY c.fecha_vencimiento) AS "tipos",
           array_agg(c.mes ORDER BY c.fecha_vencimiento) AS "meses",
           m.ultimo_recordatorio_en AS "ultimoRecordatorioEn"
      FROM concepto_cobro c
      JOIN matricula m ON m.id = c.matricula_id
     WHERE m.anio_academico_id = ${filtro.anioId}::uuid
       AND m.estado NOT IN ('RETIRADO', 'ANULADO')
       AND c.estado = 'PENDIENTE'
       AND c.fecha_vencimiento < ${filtro.hoy}::date
       ${porSeccion}
     GROUP BY m.id`;
}

// ---------- US59 · Recordatorios de pago ----------

export interface MatriculaParaRecordatorio {
  id: string;
  estudianteId: string;
  vinculoResponsableId: string | null;
  ultimoRecordatorioEn: Date | null;
}

export interface CuotaVencidaFila {
  matriculaId: string;
  concepto: string;
  /** «450.00». */
  monto: string;
  fechaVencimiento: string;
}

export const recordatorios = {
  /** Bloquea las matrículas (en orden de id, sin interbloqueos) hasta el fin de la transacción del envío. */
  async bloquear(tx: Tx, ids: string[]) {
    await tx.$queryRaw`SELECT id FROM matricula WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
  },

  matriculas: (ids: string[], db: Db = prisma): Promise<MatriculaParaRecordatorio[]> =>
    db.matricula.findMany({
      where: { id: { in: ids } },
      select: { id: true, estudianteId: true, vinculoResponsableId: true, ultimoRecordatorioEn: true },
    }),

  /**
   * Cuotas Pendiente vencidas (vencimiento anterior a `hoy`) de las matrículas, con el mismo criterio del panel de
   * morosidad: no cuentan las matrículas Retirado ni Anulado.
   */
  cuotasVencidas: (ids: string[], hoy: string, db: Db = prisma) =>
    db.$queryRaw<CuotaVencidaFila[]>`
      SELECT c.matricula_id::text AS "matriculaId",
             c.concepto,
             c.monto::text AS "monto",
             c.fecha_vencimiento::text AS "fechaVencimiento"
        FROM concepto_cobro c
        JOIN matricula m ON m.id = c.matricula_id
       WHERE c.matricula_id = ANY(${ids}::uuid[])
         AND m.estado NOT IN ('RETIRADO', 'ANULADO')
         AND c.estado = 'PENDIENTE'
         AND c.fecha_vencimiento < ${hoy}::date
       ORDER BY c.fecha_vencimiento, c.concepto`,

  /** Guarda la fecha del último recordatorio de cada matrícula (US59, criterio 2). */
  marcar: (tx: Tx, ids: string[], fecha: Date) =>
    tx.matricula.updateMany({ where: { id: { in: ids } }, data: { ultimoRecordatorioEn: fecha } }),
};
