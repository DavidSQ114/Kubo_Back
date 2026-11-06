// matricula/infrastructure: consulta del panel de morosidad (US24). Una sola consulta agregada sobre concepto_cobro y
// matricula (tablas del módulo), agrupada por matrícula: sin N+1. Usa el índice (estado, fecha_vencimiento).
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";

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
           array_agg(c.mes ORDER BY c.fecha_vencimiento) AS "meses"
      FROM concepto_cobro c
      JOIN matricula m ON m.id = c.matricula_id
     WHERE m.anio_academico_id = ${filtro.anioId}::uuid
       AND m.estado NOT IN ('RETIRADO', 'ANULADO')
       AND c.estado = 'PENDIENTE'
       AND c.fecha_vencimiento < ${filtro.hoy}::date
       ${porSeccion}
     GROUP BY m.id`;
}
