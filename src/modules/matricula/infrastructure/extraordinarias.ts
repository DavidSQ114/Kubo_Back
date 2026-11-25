// matricula/infrastructure: consultas de los lotes de cuotas extraordinarias (bloque M4) sobre
// lote_cuota_extraordinaria y concepto_cobro, tablas del módulo. Fechas DATE como «AAAA-MM-DD» y Decimal como «50.00».
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { DestinoLote } from "../domain/extraordinarias";
import { decimalDeCentimos } from "./pagos";

type Db = Tx | typeof prisma;

const aFecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);
const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);

const selectLote = {
  id: true,
  anioAcademicoId: true,
  concepto: true,
  monto: true,
  fechaVencimiento: true,
  destino: true,
  destinoId: true,
  destinoNombre: true,
  estado: true,
  creadoPorId: true,
  anuladoPorId: true,
  anuladoEn: true,
  motivoAnulacion: true,
  createdAt: true,
  cuotas: { select: { id: true, matriculaId: true, estado: true, monto: true } },
} as const;

export interface LoteFila {
  id: string;
  anioAcademicoId: string;
  concepto: string;
  monto: string;
  fechaVencimiento: string;
  destino: DestinoLote;
  destinoId: string | null;
  destinoNombre: string;
  estado: "ACTIVO" | "ANULADO";
  creadoPorId: string;
  anuladoPorId: string | null;
  anuladoEn: Date | null;
  motivoAnulacion: string | null;
  createdAt: Date;
  cuotas: { id: string; matriculaId: string; estado: "PENDIENTE" | "PAGADO" | "ANULADO"; monto: string }[];
}

type LotePrisma = Omit<LoteFila, "monto" | "fechaVencimiento" | "cuotas"> & {
  monto: { toFixed: (n: number) => string };
  fechaVencimiento: Date;
  cuotas: {
    id: string;
    matriculaId: string;
    estado: "PENDIENTE" | "PAGADO" | "ANULADO";
    monto: { toFixed: (n: number) => string };
  }[];
};

const fila = (l: LotePrisma): LoteFila => ({
  ...l,
  monto: l.monto.toFixed(2),
  fechaVencimiento: aTexto(l.fechaVencimiento),
  cuotas: l.cuotas.map((c) => ({ ...c, monto: c.monto.toFixed(2) })),
});

export const lotes = {
  /** Crea el lote y una cuota EXTRAORDINARIA (Pendiente) por cada matrícula. Devuelve el id del lote. */
  async crear(
    tx: Tx,
    datos: {
      anioAcademicoId: string;
      concepto: string;
      montoCentimos: number;
      fechaVencimiento: string;
      destino: DestinoLote;
      destinoId: string | null;
      destinoNombre: string;
      creadoPorId: string;
    },
    matriculaIds: string[],
  ): Promise<string> {
    const { montoCentimos, ...resto } = datos;
    const monto = decimalDeCentimos(montoCentimos);
    const lote = await tx.loteCuotaExtraordinaria.create({
      data: { ...resto, monto, fechaVencimiento: aFecha(datos.fechaVencimiento) },
      select: { id: true },
    });
    await tx.conceptoCobro.createMany({
      data: matriculaIds.map((matriculaId) => ({
        matriculaId,
        tipo: "EXTRAORDINARIA" as const,
        mes: null,
        concepto: datos.concepto,
        monto,
        fechaVencimiento: aFecha(datos.fechaVencimiento),
        estado: "PENDIENTE" as const,
        loteId: lote.id,
      })),
    });
    return lote.id;
  },

  async bloquear(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM lote_cuota_extraordinaria WHERE id = ${id}::uuid FOR UPDATE`;
  },

  async porId(id: string, db: Db = prisma): Promise<LoteFila | null> {
    const l = await db.loteCuotaExtraordinaria.findUnique({ where: { id }, select: selectLote });
    return l && fila(l);
  },

  async delAnio(anioAcademicoId: string, db: Db = prisma): Promise<LoteFila[]> {
    const filas = await db.loteCuotaExtraordinaria.findMany({
      where: { anioAcademicoId },
      orderBy: { createdAt: "desc" },
      select: selectLote,
    });
    return filas.map(fila);
  },

  anular: (tx: Tx, id: string, datos: { anuladoPorId: string; anuladoEn: Date; motivoAnulacion: string }) =>
    tx.loteCuotaExtraordinaria.update({ where: { id }, data: { ...datos, estado: "ANULADO" }, select: { id: true } }),

  /** Ids de las cuotas Pendiente del lote, bloqueadas (en orden de id) hasta el fin de la transacción. */
  async pendientesBloqueadas(tx: Tx, loteId: string): Promise<string[]> {
    const filas = await tx.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM concepto_cobro
      WHERE lote_id = ${loteId}::uuid AND estado = 'PENDIENTE' ORDER BY id FOR UPDATE`;
    return filas.map((f) => f.id);
  },
};
