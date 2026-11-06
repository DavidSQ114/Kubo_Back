// matricula/infrastructure: único lugar que consulta las tablas del módulo: matricula, historial_seccion,
// concepto_cobro y pago (estos dos los usará también Tesorería, US22). Las columnas DATE se convierten aquí a texto
// «AAAA-MM-DD» y los Decimal a texto «450.00»: el resto del módulo no ve objetos Date ni Decimal.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { CuotaCronograma } from "../domain/cronograma";
import type { MotivoRetiro, TramoSeccion } from "../domain/cambios";
import type { EstadoMatricula, ModalidadPago } from "../domain/matriculas";

type Db = Tx | typeof prisma;

const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);
const aFecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);
const ESTADOS_VIGENTES: EstadoMatricula[] = ["EN_PROCESO", "MATRICULADO"];

const selectMatricula = {
  id: true,
  estudianteId: true,
  anioAcademicoId: true,
  seccionId: true,
  vinculoResponsableId: true,
  fechaMatricula: true,
  estado: true,
  modalidadPago: true,
  anuladoEn: true,
  motivoAnulacion: true,
  retiradoEn: true,
  motivoRetiro: true,
  detalleRetiro: true,
  createdAt: true,
} satisfies Prisma.MatriculaSelect;

type FilaPrisma = Prisma.MatriculaGetPayload<{ select: typeof selectMatricula }>;

export interface MatriculaFila {
  id: string;
  estudianteId: string;
  anioAcademicoId: string;
  seccionId: string | null;
  vinculoResponsableId: string | null;
  fechaMatricula: string;
  estado: EstadoMatricula;
  modalidadPago: ModalidadPago;
  anuladoEn: Date | null;
  motivoAnulacion: string | null;
  retiradoEn: Date | null;
  motivoRetiro: MotivoRetiro | null;
  detalleRetiro: string | null;
  createdAt: Date;
}

const fila = (m: FilaPrisma): MatriculaFila => ({ ...m, fechaMatricula: aTexto(m.fechaMatricula) });

export interface CuotaFila {
  id: string;
  tipo: "MATRICULA" | "PENSION";
  mes: number | null;
  concepto: string;
  monto: string;
  fechaVencimiento: string;
  estado: "PENDIENTE" | "PAGADO" | "ANULADO";
}

export const matriculas = {
  /** Bloquea y devuelve la matrícula vigente (En proceso o Matriculado) del estudiante en el año. */
  async vigenteBloqueada(tx: Tx, estudianteId: string, anioAcademicoId: string): Promise<MatriculaFila | null> {
    await tx.$queryRaw`SELECT id FROM matricula
      WHERE estudiante_id = ${estudianteId}::uuid AND anio_academico_id = ${anioAcademicoId}::uuid
        AND estado IN ('EN_PROCESO', 'MATRICULADO') FOR UPDATE`;
    const m = await tx.matricula.findFirst({
      where: { estudianteId, anioAcademicoId, estado: { in: ESTADOS_VIGENTES } },
      select: selectMatricula,
    });
    return m && fila(m);
  },

  async vigente(estudianteId: string, anioAcademicoId: string, db: Db = prisma): Promise<MatriculaFila | null> {
    const m = await db.matricula.findFirst({
      where: { estudianteId, anioAcademicoId, estado: { in: ESTADOS_VIGENTES } },
      select: selectMatricula,
    });
    return m && fila(m);
  },

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM matricula WHERE id = ${id}::uuid FOR UPDATE`;
  },

  async porId(id: string, db: Db = prisma): Promise<MatriculaFila | null> {
    const m = await db.matricula.findUnique({ where: { id }, select: selectMatricula });
    return m && fila(m);
  },

  /** Matrículas Matriculado de la sección: se cuenta con la fila de la sección ya bloqueada. */
  contarMatriculados: (seccionId: string, db: Db = prisma) =>
    db.matricula.count({ where: { seccionId, estado: "MATRICULADO" } }),

  async delAnio(anioAcademicoId: string, estado?: EstadoMatricula, db: Db = prisma): Promise<MatriculaFila[]> {
    const filas = await db.matricula.findMany({
      where: { anioAcademicoId, ...(estado ? { estado } : {}) },
      orderBy: [{ createdAt: "desc" }],
      select: selectMatricula,
    });
    return filas.map(fila);
  },

  crear: (
    data: {
      estudianteId: string;
      anioAcademicoId: string;
      seccionId: string;
      vinculoResponsableId: string;
      modalidadPago: ModalidadPago;
      fechaMatricula: string;
      registradoPorId: string;
    },
    tx: Tx,
  ) =>
    tx.matricula.create({
      data: { ...data, estado: "MATRICULADO", fechaMatricula: aFecha(data.fechaMatricula) },
      select: { id: true },
    }),

  confirmar: (
    id: string,
    data: { seccionId: string; vinculoResponsableId: string; modalidadPago: ModalidadPago; fechaMatricula: string },
    tx: Tx,
  ) =>
    tx.matricula.update({
      where: { id },
      data: { ...data, estado: "MATRICULADO", fechaMatricula: aFecha(data.fechaMatricula) },
      select: { id: true },
    }),

  anular: (id: string, data: { anuladoPorId: string; anuladoEn: Date; motivoAnulacion: string }, tx: Tx) =>
    tx.matricula.update({ where: { id }, data: { ...data, estado: "ANULADO" }, select: { id: true } }),

  /** US19: la matrícula pasa a la sección destino (el historial guarda la anterior). */
  trasladar: (id: string, seccionId: string, tx: Tx) =>
    tx.matricula.update({ where: { id }, data: { seccionId }, select: { id: true } }),

  /** US57: Retirado. La matrícula conserva su sección; la vacante se libera porque solo cuentan las Matriculado. */
  retirar: (id: string, data: { retiradoEn: Date; motivoRetiro: MotivoRetiro; detalleRetiro: string | null }, tx: Tx) =>
    tx.matricula.update({ where: { id }, data: { ...data, estado: "RETIRADO" }, select: { id: true } }),
};

export const historial = {
  abrir: (
    data: { matriculaId: string; seccionId: string; fechaInicio: string; registradoPorId: string; motivo: string },
    tx: Tx,
  ) => tx.historialSeccion.create({ data: { ...data, fechaInicio: aFecha(data.fechaInicio) }, select: { id: true } }),

  cerrar: (matriculaId: string, fechaFin: string, tx: Tx) =>
    tx.historialSeccion.updateMany({ where: { matriculaId, fechaFin: null }, data: { fechaFin: aFecha(fechaFin) } }),

  /** Tramo abierto (la sección actual) de la matrícula, o null. */
  async vigente(matriculaId: string, db: Db = prisma) {
    const h = await db.historialSeccion.findFirst({
      where: { matriculaId, fechaFin: null },
      orderBy: { fechaInicio: "desc" },
      select: { id: true, seccionId: true, fechaInicio: true },
    });
    return h && { ...h, fechaInicio: aTexto(h.fechaInicio) };
  },

  /** Todos los tramos de la matrícula, del más antiguo al más reciente. */
  async deMatricula(matriculaId: string, db: Db = prisma): Promise<(TramoSeccion & { motivo: string | null })[]> {
    const filas = await db.historialSeccion.findMany({
      where: { matriculaId },
      orderBy: [{ fechaInicio: "asc" }, { createdAt: "asc" }],
      select: { seccionId: true, fechaInicio: true, fechaFin: true, motivo: true },
    });
    return filas.map((h) => ({
      ...h,
      fechaInicio: aTexto(h.fechaInicio),
      fechaFin: h.fechaFin ? aTexto(h.fechaFin) : null,
    }));
  },

  /** Matrículas que estaban en la sección en esa fecha (fechaInicio <= fecha < fechaFin), para asistencia y notas. */
  async matriculasDeSeccionEnFecha(seccionId: string, fecha: string, db: Db = prisma) {
    const dia = aFecha(fecha);
    const filas = await db.historialSeccion.findMany({
      where: {
        seccionId,
        fechaInicio: { lte: dia },
        OR: [{ fechaFin: null }, { fechaFin: { gt: dia } }],
        // una matrícula anulada se trata como si no hubiera existido
        matricula: { estado: { not: "ANULADO" } },
      },
      select: { matriculaId: true },
      distinct: ["matriculaId"],
    });
    return filas.map((f) => f.matriculaId);
  },
};

/** «45000» céntimos → «450.00» para la columna Decimal(10, 2), sin pasar por float. */
const decimal = (centimos: number) => `${Math.trunc(centimos / 100)}.${String(centimos % 100).padStart(2, "0")}`;

export const cuotas = {
  crear: (matriculaId: string, lista: CuotaCronograma[], tx: Tx) =>
    tx.conceptoCobro.createMany({
      data: lista.map((c) => ({
        matriculaId,
        tipo: c.tipo,
        mes: c.mes,
        concepto: c.concepto,
        monto: decimal(c.montoCentimos),
        fechaVencimiento: aFecha(c.fechaVencimiento),
        estado: "PENDIENTE" as const,
      })),
    }),

  /** US21: al anular la matrícula, las cuotas pendientes pasan a Anulado. Devuelve cuántas cambiaron. */
  async anularPendientes(matriculaId: string, tx: Tx) {
    const r = await tx.conceptoCobro.updateMany({
      where: { matriculaId, estado: "PENDIENTE" },
      data: { estado: "ANULADO" },
    });
    return r.count;
  },

  /** Cuotas con la cantidad de pagos no anulados aplicados a cada una (para el retiro, US57). */
  async conPagos(matriculaId: string, db: Db = prisma) {
    const filas = await db.conceptoCobro.findMany({
      where: { matriculaId },
      select: {
        id: true,
        concepto: true,
        monto: true,
        fechaVencimiento: true,
        estado: true,
        _count: { select: { pagos: { where: { operacionPago: { estado: { not: "ANULADO" } } } } } },
      },
    });
    return filas.map((c) => ({
      id: c.id,
      concepto: c.concepto,
      monto: c.monto.toFixed(2),
      fechaVencimiento: aTexto(c.fechaVencimiento),
      estado: c.estado,
      pagos: c._count.pagos,
    }));
  },

  /** Pasa a Anulado las cuotas indicadas, solo si siguen Pendiente. Devuelve cuántas cambiaron. */
  async anularPorIds(ids: string[], tx: Tx) {
    if (!ids.length) return 0;
    const r = await tx.conceptoCobro.updateMany({
      where: { id: { in: ids }, estado: "PENDIENTE" },
      data: { estado: "ANULADO" },
    });
    return r.count;
  },

  async deMatricula(matriculaId: string, db: Db = prisma): Promise<CuotaFila[]> {
    const filas = await db.conceptoCobro.findMany({
      where: { matriculaId },
      orderBy: [{ fechaVencimiento: "asc" }, { tipo: "asc" }],
      select: { id: true, tipo: true, mes: true, concepto: true, monto: true, fechaVencimiento: true, estado: true },
    });
    return filas.map((c) => ({ ...c, monto: c.monto.toFixed(2), fechaVencimiento: aTexto(c.fechaVencimiento) }));
  },
};

/** Pagos no anulados aplicados a las cuotas de la matrícula: con alguno, la matrícula no se anula. */
export const contarPagosVigentes = (matriculaId: string, db: Db = prisma) =>
  db.pago.count({ where: { conceptoCobro: { matriculaId }, operacionPago: { estado: { not: "ANULADO" } } } });
