// matricula/infrastructure: consultas de los pagos (US22, US23, US04, US25) sobre concepto_cobro, operacion_pago, pago
// y comprobante, tablas del módulo. Las fechas DATE se devuelven como «AAAA-MM-DD» y los Decimal como «450.00».
// Los candados de PostgreSQL (pg_advisory_xact_lock) se liberan solos al terminar la transacción.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { fechaEnLima } from "@/modules/academico";
import type { EstadoPago, MedioPago, MotivoAnulacionPago } from "../domain/pagos";

type Db = Tx | typeof prisma;

const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);

/** «45000» céntimos → «450.00» para una columna Decimal(10, 2), sin pasar por float. */
export const decimalDeCentimos = (centimos: number) =>
  `${Math.trunc(centimos / 100)}.${String(centimos % 100).padStart(2, "0")}`;

const selectCuota = {
  id: true,
  matriculaId: true,
  tipo: true,
  mes: true,
  concepto: true,
  monto: true,
  fechaVencimiento: true,
  estado: true,
  matricula: { select: { estudianteId: true } },
  pagos: {
    where: { operacionPago: { estado: "CONFIRMADO" } },
    select: { operacionPago: { select: { fechaPago: true } } },
  },
} satisfies Prisma.ConceptoCobroSelect;

type CuotaPrisma = Prisma.ConceptoCobroGetPayload<{ select: typeof selectCuota }>;

export interface CuotaDePago {
  id: string;
  matriculaId: string;
  estudianteId: string;
  tipo: "MATRICULA" | "PENSION";
  mes: number | null;
  concepto: string;
  monto: string;
  fechaVencimiento: string;
  estado: "PENDIENTE" | "PAGADO" | "ANULADO";
  /** Fecha de pago de la operación confirmada que la canceló. */
  pagadaEl: string | null;
}

const cuota = (c: CuotaPrisma): CuotaDePago => ({
  id: c.id,
  matriculaId: c.matriculaId,
  estudianteId: c.matricula.estudianteId,
  tipo: c.tipo,
  mes: c.mes,
  concepto: c.concepto,
  monto: c.monto.toFixed(2),
  fechaVencimiento: aTexto(c.fechaVencimiento),
  estado: c.estado,
  pagadaEl: c.pagos[0] ? aTexto(c.pagos[0].operacionPago.fechaPago) : null,
});

export const cuotasDePago = {
  /** Sin bloqueo: para preparar los datos del recibo antes de la transacción. */
  async porIds(ids: string[], db: Db = prisma): Promise<CuotaDePago[]> {
    const filas = await db.conceptoCobro.findMany({ where: { id: { in: ids } }, select: selectCuota });
    return filas.map(cuota);
  },

  /**
   * Bloquea las filas de las cuotas (en orden de id, para que dos pagos no se esperen en cruz) y las devuelve. Dos
   * solicitudes simultáneas sobre la misma cuota se atienden una tras otra: la segunda ya la ve Pagado (US23).
   */
  async bloqueadas(tx: Tx, ids: string[]): Promise<CuotaDePago[]> {
    await tx.$queryRaw`SELECT id FROM concepto_cobro WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
    return cuotasDePago.porIds(ids, tx);
  },

  /** US58: bloquea y devuelve los ids de las cuotas Pendiente de la matrícula (en orden de id). */
  async pendientesBloqueadas(tx: Tx, matriculaId: string): Promise<string[]> {
    const filas = await tx.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM concepto_cobro
      WHERE matricula_id = ${matriculaId}::uuid AND estado = 'PENDIENTE' ORDER BY id FOR UPDATE`;
    return filas.map((f) => f.id);
  },

  async marcar(tx: Tx, ids: string[], desde: "PENDIENTE" | "PAGADO", hacia: "PENDIENTE" | "PAGADO") {
    const r = await tx.conceptoCobro.updateMany({ where: { id: { in: ids }, estado: desde }, data: { estado: hacia } });
    return r.count;
  },
};

const selectOperacion = {
  id: true,
  numeroOperacion: true,
  medioPago: true,
  fechaPago: true,
  montoTotal: true,
  estado: true,
  registradoPorId: true,
  confirmadoPorId: true,
  anuladoPorId: true,
  anuladoEn: true,
  motivoAnulacion: true,
  observacionAnulacion: true,
  createdAt: true,
  pagos: {
    orderBy: { conceptoCobro: { fechaVencimiento: "asc" } },
    select: {
      montoAplicado: true,
      conceptoCobro: {
        select: {
          id: true,
          concepto: true,
          fechaVencimiento: true,
          matriculaId: true,
          matricula: { select: { estudianteId: true } },
        },
      },
    },
  },
  comprobante: {
    select: {
      id: true,
      numeroComprobante: true,
      nombreArchivo: true,
      checksumSha256: true,
      enviadoEn: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OperacionPagoSelect;

type OperacionPrisma = Prisma.OperacionPagoGetPayload<{ select: typeof selectOperacion }>;

export interface OperacionFila {
  id: string;
  numeroOperacion: string;
  medioPago: MedioPago;
  /** «AAAA-MM-DD» en Lima. */
  fechaPago: string;
  monto: string;
  estado: EstadoPago;
  registradoPorId: string;
  confirmadoPorId: string | null;
  anuladoPorId: string | null;
  anuladoEn: Date | null;
  motivoAnulacion: MotivoAnulacionPago | null;
  observacionAnulacion: string | null;
  registradoEn: Date;
  estudianteId: string;
  matriculaId: string;
  cuotas: { id: string; concepto: string; fechaVencimiento: string; monto: string }[];
  comprobante: {
    id: string;
    numero: string;
    nombreArchivo: string;
    checksumSha256: string | null;
    enviadoEn: Date | null;
    emitidoEn: Date;
  } | null;
}

/** fecha_pago es timestamptz: guarda la medianoche de Lima del día de pago (se lee como ese mismo día). */
export const instanteDePago = (fecha: string) => new Date(`${fecha}T05:00:00.000Z`);

const operacion = (o: OperacionPrisma): OperacionFila => ({
  id: o.id,
  numeroOperacion: o.numeroOperacion,
  medioPago: o.medioPago,
  fechaPago: fechaEnLima(o.fechaPago),
  monto: o.montoTotal.toFixed(2),
  estado: o.estado,
  registradoPorId: o.registradoPorId,
  confirmadoPorId: o.confirmadoPorId,
  anuladoPorId: o.anuladoPorId,
  anuladoEn: o.anuladoEn,
  motivoAnulacion: o.motivoAnulacion,
  observacionAnulacion: o.observacionAnulacion,
  registradoEn: o.createdAt,
  estudianteId: o.pagos[0]?.conceptoCobro.matricula.estudianteId ?? "",
  matriculaId: o.pagos[0]?.conceptoCobro.matriculaId ?? "",
  cuotas: o.pagos.map((p) => ({
    id: p.conceptoCobro.id,
    concepto: p.conceptoCobro.concepto,
    fechaVencimiento: aTexto(p.conceptoCobro.fechaVencimiento),
    monto: p.montoAplicado.toFixed(2),
  })),
  comprobante: o.comprobante && {
    id: o.comprobante.id,
    numero: o.comprobante.numeroComprobante,
    nombreArchivo: o.comprobante.nombreArchivo,
    checksumSha256: o.comprobante.checksumSha256,
    enviadoEn: o.comprobante.enviadoEn,
    emitidoEn: o.comprobante.createdAt,
  },
});

export const operaciones = {
  /**
   * Candado por número de operación: dos registros simultáneos con el mismo número se atienden uno tras otro, así
   * el segundo ve al primero y queda Observado (US23).
   */
  async bloquearNumero(tx: Tx, numero: string) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`kubo:operacion:${numero}`}))::text`;
  },

  /** ¿Hay otra operación no anulada con ese número? */
  async numeroUsado(tx: Tx, numero: string, excluirId?: string) {
    const n = await tx.operacionPago.count({
      where: { numeroOperacion: numero, estado: { not: "ANULADO" }, ...(excluirId ? { id: { not: excluirId } } : {}) },
    });
    return n > 0;
  },

  /** Números de las otras operaciones no anuladas con el mismo número (para el aviso de una Observado). */
  async conMismoNumero(numero: string, excluirId: string, db: Db = prisma) {
    const filas = await db.operacionPago.findMany({
      where: { numeroOperacion: numero, estado: { not: "ANULADO" }, id: { not: excluirId } },
      select: { id: true, comprobante: { select: { numeroComprobante: true } } },
    });
    return filas.map((f) => ({ operacionId: f.id, comprobante: f.comprobante?.numeroComprobante ?? null }));
  },

  async crear(
    tx: Tx,
    data: {
      numeroOperacion: string;
      medioPago: MedioPago;
      fechaPago: string;
      montoCentimos: number;
      estado: EstadoPago;
      registradoPorId: string;
      confirmadoPorId: string | null;
      cuotas: { id: string; montoCentimos: number }[];
    },
  ) {
    const o = await tx.operacionPago.create({
      data: {
        numeroOperacion: data.numeroOperacion,
        medioPago: data.medioPago,
        fechaPago: instanteDePago(data.fechaPago),
        montoTotal: decimalDeCentimos(data.montoCentimos),
        estado: data.estado,
        registradoPorId: data.registradoPorId,
        confirmadoPorId: data.confirmadoPorId,
        pagos: {
          create: data.cuotas.map((c) => ({
            conceptoCobroId: c.id,
            montoAplicado: decimalDeCentimos(c.montoCentimos),
          })),
        },
      },
      select: { id: true },
    });
    return o.id;
  },

  async bloquear(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM operacion_pago WHERE id = ${id}::uuid FOR UPDATE`;
  },

  async porId(id: string, db: Db = prisma): Promise<OperacionFila | null> {
    const o = await db.operacionPago.findUnique({ where: { id }, select: selectOperacion });
    return o && operacion(o);
  },

  /** Operaciones que cubren cuotas del estudiante, de la más reciente a la más antigua. */
  async deEstudiante(estudianteId: string, db: Db = prisma): Promise<OperacionFila[]> {
    const filas = await db.operacionPago.findMany({
      where: { pagos: { some: { conceptoCobro: { matricula: { estudianteId } } } } },
      orderBy: { createdAt: "desc" },
      select: selectOperacion,
    });
    return filas.map(operacion);
  },

  confirmar: (tx: Tx, id: string, confirmadoPorId: string) =>
    tx.operacionPago.update({ where: { id }, data: { estado: "CONFIRMADO", confirmadoPorId }, select: { id: true } }),

  anular: (
    tx: Tx,
    id: string,
    data: { anuladoPorId: string; anuladoEn: Date; motivoAnulacion: MotivoAnulacionPago; observacion: string | null },
  ) =>
    tx.operacionPago.update({
      where: { id },
      data: {
        estado: "ANULADO",
        anuladoPorId: data.anuladoPorId,
        anuladoEn: data.anuladoEn,
        motivoAnulacion: data.motivoAnulacion,
        observacionAnulacion: data.observacion,
      },
      select: { id: true },
    }),
};

export const comprobantes = {
  /** Candado por año: el correlativo se calcula y se inserta sin que otra transacción tome el mismo número. */
  async bloquearCorrelativo(tx: Tx, anio: number) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`kubo:comprobante:${anio}`}))::text`;
  },

  async ultimoDelAnio(tx: Tx, prefijo: string): Promise<string | null> {
    const c = await tx.comprobante.findFirst({
      where: { numeroComprobante: { startsWith: prefijo } },
      orderBy: { numeroComprobante: "desc" },
      select: { numeroComprobante: true },
    });
    return c?.numeroComprobante ?? null;
  },

  crear: (
    tx: Tx,
    data: {
      operacionPagoId: string;
      numeroComprobante: string;
      nombreArchivo: string;
      archivoUrl: string;
      tamanoBytes: number;
      checksumSha256: string;
      montoCentimos: number;
    },
  ) =>
    tx.comprobante.create({
      data: {
        operacionPagoId: data.operacionPagoId,
        numeroComprobante: data.numeroComprobante,
        nombreArchivo: data.nombreArchivo,
        archivoUrl: data.archivoUrl,
        mimeType: "application/pdf",
        tamanoBytes: data.tamanoBytes,
        checksumSha256: data.checksumSha256,
        montoTotal: decimalDeCentimos(data.montoCentimos),
      },
      select: { id: true },
    }),

  marcarEnviado: (id: string, enviadoEn: Date) =>
    prisma.comprobante.update({ where: { id }, data: { enviadoEn }, select: { id: true } }),
};

/** Matrículas del estudiante (todas las de sus años), de la más reciente a la más antigua. */
export async function matriculasDeEstudiante(estudianteId: string, db: Db = prisma) {
  const filas = await db.matricula.findMany({
    where: { estudianteId },
    orderBy: [{ fechaMatricula: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      anioAcademicoId: true,
      seccionId: true,
      vinculoResponsableId: true,
      estado: true,
      modalidadPago: true,
      fechaMatricula: true,
    },
  });
  return filas.map((m) => ({ ...m, fechaMatricula: aTexto(m.fechaMatricula) }));
}
