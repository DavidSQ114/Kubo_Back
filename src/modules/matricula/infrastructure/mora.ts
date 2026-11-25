// matricula/infrastructure: consultas de la mora (bloque M4) sobre concepto_cobro y matricula, tablas del módulo. La
// generación toma un candado de PostgreSQL (se libera solo al terminar la transacción): dos corridas simultáneas de la
// tarea programada se atienden una tras otra, y el índice único uq_concepto_cobro_cuota_origen evita duplicados.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { MoraNueva, PensionParaMora } from "../domain/mora";
import { decimalDeCentimos } from "./pagos";

type Db = Tx | typeof prisma;

const aFecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);
const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);

/** Clave del candado de la generación de moras (pg_advisory_xact_lock). */
const CANDADO_MORA = "kubo_generar_moras";

export type PensionVencidaFila = PensionParaMora & { anioAcademicoId: string };

export const mora = {
  bloquearGeneracion: async (tx: Tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CANDADO_MORA}))`;
  },

  /**
   * Pensiones Pendiente vencidas (vencimiento anterior a `hoy`) sin mora, de matrículas que no están Retirado ni
   * Anulado (mismo criterio del panel de morosidad, US24).
   */
  pensionesVencidasSinMora: async (tx: Tx, hoy: string): Promise<PensionVencidaFila[]> => {
    const filas = await tx.$queryRaw<(Omit<PensionVencidaFila, "fechaVencimiento"> & { fechaVencimiento: Date })[]>`
      SELECT c.id::text AS "id",
             c.matricula_id::text AS "matriculaId",
             m.anio_academico_id::text AS "anioAcademicoId",
             c.tipo::text AS "tipo",
             c.mes,
             c.concepto,
             c.estado::text AS "estado",
             c.fecha_vencimiento AS "fechaVencimiento",
             false AS "tieneMora"
        FROM concepto_cobro c
        JOIN matricula m ON m.id = c.matricula_id
       WHERE c.tipo = 'PENSION'
         AND c.estado = 'PENDIENTE'
         AND c.fecha_vencimiento < ${hoy}::date
         AND m.estado NOT IN ('RETIRADO', 'ANULADO')
         AND NOT EXISTS (SELECT 1 FROM concepto_cobro x WHERE x.cuota_origen_id = c.id)
       ORDER BY c.matricula_id, c.fecha_vencimiento`;
    return filas.map((f) => ({ ...f, fechaVencimiento: aTexto(f.fechaVencimiento) }));
  },

  /** Crea las moras; una pensión que ya tiene la suya se salta (ON CONFLICT DO NOTHING). Devuelve cuántas creó. */
  crear: async (tx: Tx, lista: MoraNueva[]) => {
    if (!lista.length) return 0;
    const r = await tx.conceptoCobro.createMany({
      data: lista.map((c) => ({
        matriculaId: c.matriculaId,
        tipo: "MORA" as const,
        mes: c.mes,
        concepto: c.concepto,
        monto: decimalDeCentimos(c.montoCentimos),
        fechaVencimiento: aFecha(c.fechaVencimiento),
        estado: "PENDIENTE" as const,
        cuotaOrigenId: c.cuotaOrigenId,
      })),
      skipDuplicates: true,
    });
    return r.count;
  },
};

export interface CuotaParaAnular {
  id: string;
  matriculaId: string;
  estudianteId: string;
  anioAcademicoId: string;
  tipo: string;
  concepto: string;
  monto: string;
  estado: "PENDIENTE" | "PAGADO" | "ANULADO";
  cuotaOrigenId: string | null;
  loteId: string | null;
}

export const cuotasAnulables = {
  /** Bloquea la fila de la cuota y la devuelve, o null si no existe. */
  async bloqueada(tx: Tx, id: string): Promise<CuotaParaAnular | null> {
    await tx.$queryRaw`SELECT id FROM concepto_cobro WHERE id = ${id}::uuid FOR UPDATE`;
    return cuotasAnulables.porId(id, tx);
  },

  async porId(id: string, db: Db = prisma): Promise<CuotaParaAnular | null> {
    const c = await db.conceptoCobro.findUnique({
      where: { id },
      select: {
        id: true,
        matriculaId: true,
        tipo: true,
        concepto: true,
        monto: true,
        estado: true,
        cuotaOrigenId: true,
        matricula: { select: { estudianteId: true, anioAcademicoId: true } },
      },
    });
    if (!c) return null;
    return {
      id: c.id,
      matriculaId: c.matriculaId,
      estudianteId: c.matricula.estudianteId,
      anioAcademicoId: c.matricula.anioAcademicoId,
      tipo: c.tipo,
      concepto: c.concepto,
      monto: c.monto.toFixed(2),
      estado: c.estado,
      cuotaOrigenId: c.cuotaOrigenId,
      loteId: null,
    };
  },

  /** Pasa la cuota a Anulado con quién, cuándo y por qué, solo si sigue Pendiente. Devuelve cuántas cambiaron. */
  async anular(tx: Tx, ids: string[], datos: { anuladoPorId: string; anuladoEn: Date; motivoAnulacion: string }) {
    if (!ids.length) return 0;
    const r = await tx.conceptoCobro.updateMany({
      where: { id: { in: ids }, estado: "PENDIENTE" },
      data: { ...datos, estado: "ANULADO" },
    });
    return r.count;
  },
};
