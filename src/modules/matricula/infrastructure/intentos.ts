// matricula/infrastructure: consultas de intento_pago (US70, US71), tabla del módulo. Los montos se devuelven en
// céntimos enteros y las cuotas como lista de ids de concepto_cobro.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { aCentimos } from "@/modules/academico";
import type { EstadoIntento } from "../domain/pasarela";
import { decimalDeCentimos } from "./pagos";

type Db = Tx | typeof prisma;

const selectIntento = {
  id: true,
  matriculaId: true,
  creadoPorId: true,
  conceptoIds: true,
  monto: true,
  estado: true,
  referenciaExterna: true,
  pasarela: true,
  ordenExternaId: true,
  urlCheckout: true,
  estadoExterno: true,
  detalle: true,
  expiraEn: true,
  conciliadoEn: true,
  operacionPagoId: true,
  createdAt: true,
  matricula: { select: { estudianteId: true } },
  operacionPago: { select: { estado: true, comprobante: { select: { numeroComprobante: true } } } },
} satisfies Prisma.IntentoPagoSelect;

type IntentoPrisma = Prisma.IntentoPagoGetPayload<{ select: typeof selectIntento }>;

export interface IntentoFila {
  id: string;
  matriculaId: string;
  estudianteId: string;
  creadoPorId: string;
  conceptoIds: string[];
  montoCentimos: number;
  estado: EstadoIntento;
  referencia: string;
  pasarela: string;
  ordenExternaId: string | null;
  urlCheckout: string | null;
  estadoExterno: string | null;
  detalle: string | null;
  expiraEn: Date;
  conciliadoEn: Date | null;
  creadoEn: Date;
  operacion: { id: string; estado: string; comprobante: string | null } | null;
}

const intento = (i: IntentoPrisma): IntentoFila => ({
  id: i.id,
  matriculaId: i.matriculaId,
  estudianteId: i.matricula.estudianteId,
  creadoPorId: i.creadoPorId,
  conceptoIds: i.conceptoIds,
  montoCentimos: aCentimos(i.monto.toFixed(2)),
  estado: i.estado,
  referencia: i.referenciaExterna,
  pasarela: i.pasarela,
  ordenExternaId: i.ordenExternaId,
  urlCheckout: i.urlCheckout,
  estadoExterno: i.estadoExterno,
  detalle: i.detalle,
  expiraEn: i.expiraEn,
  conciliadoEn: i.conciliadoEn,
  creadoEn: i.createdAt,
  operacion:
    i.operacionPagoId && i.operacionPago
      ? {
          id: i.operacionPagoId,
          estado: i.operacionPago.estado,
          comprobante: i.operacionPago.comprobante?.numeroComprobante ?? null,
        }
      : null,
});

export const intentos = {
  async crear(data: {
    matriculaId: string;
    creadoPorId: string;
    conceptoIds: string[];
    montoCentimos: number;
    referencia: string;
    pasarela: string;
    expiraEn: Date;
  }) {
    const i = await prisma.intentoPago.create({
      data: {
        matriculaId: data.matriculaId,
        creadoPorId: data.creadoPorId,
        conceptoIds: data.conceptoIds,
        monto: decimalDeCentimos(data.montoCentimos),
        referenciaExterna: data.referencia,
        pasarela: data.pasarela,
        expiraEn: data.expiraEn,
      },
      select: { id: true },
    });
    return i.id;
  },

  async porId(id: string, db: Db = prisma): Promise<IntentoFila | null> {
    const i = await db.intentoPago.findUnique({ where: { id }, select: selectIntento });
    return i && intento(i);
  },

  async porOrden(ordenId: string, db: Db = prisma): Promise<IntentoFila | null> {
    const i = await db.intentoPago.findUnique({ where: { ordenExternaId: ordenId }, select: selectIntento });
    return i && intento(i);
  },

  async bloquear(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM intento_pago WHERE id = ${id}::uuid FOR UPDATE`;
  },

  guardarOrden: (id: string, data: { ordenId: string; urlCheckout: string }) =>
    prisma.intentoPago.update({
      where: { id },
      data: { ordenExternaId: data.ordenId, urlCheckout: data.urlCheckout },
      select: { id: true },
    }),

  /** Resultado del pago (Aprobado u Observado) y su operación, dentro de la transacción que la registra. */
  marcarResultado: (
    tx: Tx,
    id: string,
    data: {
      estado: "APROBADO" | "OBSERVADO";
      operacionPagoId: string | null;
      detalle: string | null;
      estadoExterno: string;
    },
  ) =>
    tx.intentoPago.update({
      where: { id },
      data: { ...data, conciliadoEn: new Date() },
      select: { id: true },
    }),

  /** Actualiza el estado solo si sigue en uno de `desde` (un aviso tardío no pisa un resultado ya registrado). */
  async actualizarEstado(
    id: string,
    desde: EstadoIntento[],
    data: { estado?: EstadoIntento; estadoExterno?: string | null; detalle?: string | null },
  ) {
    const r = await prisma.intentoPago.updateMany({
      where: { id, estado: { in: desde } },
      data: { ...data, conciliadoEn: new Date() },
    });
    return r.count;
  },

  /** US71: intentos Pendiente creados antes de `limite`, del más antiguo al más reciente. */
  async pendientesHasta(limite: Date, maximo: number) {
    const filas = await prisma.intentoPago.findMany({
      where: { estado: "PENDIENTE", createdAt: { lte: limite } },
      orderBy: { createdAt: "asc" },
      take: maximo,
      select: selectIntento,
    });
    return filas.map(intento);
  },
};
