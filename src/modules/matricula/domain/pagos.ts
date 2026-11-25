// matricula/domain: reglas puras de los pagos manuales (US22), la validación de duplicados (US23), la anulación
// auditada (US04) y el correlativo del comprobante (US25). Montos en céntimos enteros; fechas «AAAA-MM-DD».
import type { TipoConcepto } from "./cronograma";
import { erroresMatricula as E } from "./errores";

/** Medios que tesorería registra a mano (US22). PASARELA solo lo asigna el pago en línea (US70). */
export const MEDIOS_PAGO = ["EFECTIVO", "TRANSFERENCIA", "DEPOSITO", "TARJETA"] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number] | "PASARELA";

export const NOMBRE_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DEPOSITO: "Depósito",
  TARJETA: "Tarjeta",
  PASARELA: "Pago en línea",
};

export const ESTADOS_PAGO = ["OBSERVADO", "CONFIRMADO", "ANULADO"] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export const NOMBRE_ESTADO_PAGO: Record<EstadoPago, string> = {
  OBSERVADO: "Observado",
  CONFIRMADO: "Confirmado",
  ANULADO: "Anulado",
};

/** Motivos de MotivoAnulacion para un pago (US04). */
export const MOTIVOS_ANULACION_PAGO = ["ERROR_DIGITACION", "PAGO_DUPLICADO", "SOLICITUD_APODERADO", "OTRO"] as const;
/** Motivos que elige el Administrador en M-02. DEVUELTO solo lo asigna «Registrar devolución» (US71). */
export type MotivoAnulacionElegible = (typeof MOTIVOS_ANULACION_PAGO)[number];
export type MotivoAnulacionPago = MotivoAnulacionElegible | "DEVUELTO";

export const NOMBRE_MOTIVO_ANULACION_PAGO: Record<MotivoAnulacionPago, string> = {
  ERROR_DIGITACION: "Error de digitación",
  PAGO_DUPLICADO: "Pago duplicado",
  SOLICITUD_APODERADO: "Solicitud del apoderado",
  OTRO: "Otro",
  DEVUELTO: "Devuelto",
};

/** Largo máximo del número de operación bancaria. */
export const LARGO_MAXIMO_NUMERO_OPERACION = 40;

/**
 * Número de operación sin espacios sobrantes y en mayúsculas («  op-561207 » → «OP-561207»), para comparar
 * duplicados sin que cuente cómo se escribió. Vacío: «El número de operación es obligatorio».
 */
export function normalizarNumeroOperacion(numero: string | null | undefined): string {
  const limpio = (numero ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!limpio) throw E.numeroOperacionRequerido();
  return limpio;
}

export interface CuotaParaPago {
  id: string;
  estudianteId: string;
  estado: "PENDIENTE" | "PAGADO" | "ANULADO";
  montoCentimos: number;
  /** Fecha «AAAA-MM-DD» del pago confirmado que la canceló, si está Pagado. */
  pagadaEl?: string | null;
}

/**
 * US22 y US23: las cuotas elegidas deben existir, ser del mismo estudiante y estar Pendiente. Una ya pagada:
 * «Esta pensión ya fue cancelada el [fecha]». Devuelve la suma en céntimos.
 */
export function verificarCuotasPagables(idsElegidos: string[], cuotas: CuotaParaPago[]): number {
  if (!idsElegidos.length) throw E.sinCuotas();
  if (new Set(idsElegidos).size !== idsElegidos.length) throw E.cuotaRepetida();
  const porId = new Map(cuotas.map((c) => [c.id, c]));
  const elegidas = idsElegidos.map((id) => porId.get(id));
  if (elegidas.some((c) => !c)) throw E.cuotaNoEncontrada();
  const lista = elegidas as CuotaParaPago[];
  if (new Set(lista.map((c) => c.estudianteId)).size > 1) throw E.cuotasDeVariosEstudiantes();
  for (const c of lista) {
    if (c.estado === "PAGADO") throw E.cuotaYaPagada(c.pagadaEl ?? null);
    if (c.estado === "ANULADO") throw E.cuotaAnulada();
  }
  return lista.reduce((suma, c) => suma + c.montoCentimos, 0);
}

export interface CuotaParaOrden {
  id: string;
  tipo: TipoConcepto;
  concepto: string;
  /** «AAAA-MM-DD». */
  fechaVencimiento: string;
  estado: "PENDIENTE" | "PAGADO" | "ANULADO";
  /** Bloque M4: en una MORA, la pensión que la originó. */
  cuotaOrigenId?: string | null;
}

/** Cuotas del inicio del año: la matrícula y la cuota de ingreso van juntas y antes que las pensiones (bloque M4). */
const esInicio = (c: { tipo: TipoConcepto }) => c.tipo === "MATRICULA" || c.tipo === "INGRESO";

/**
 * D-14 (US22, US58, US70), extendido en el bloque M4: orden de pago de las cuotas de UNA matrícula. `cuotas` son todas
 * las de esa matrícula; los ids elegidos de otras matrículas se ignoran. Solo cuentan las Pendiente.
 * 1. La matrícula y la cuota de ingreso pendientes van en la misma operación (si se elige una, va la otra).
 * 2. Con alguna de ellas Pendiente no se paga ninguna pensión salvo que vayan en la misma operación.
 * 3. Si se elige una pensión, todas las pensiones Pendiente con vencimiento anterior deben ir en la misma operación.
 * 4. Cada mora va en la misma operación que su pensión Pendiente, y la pensión con su mora Pendiente. Si la pensión ya
 *    no está Pendiente (pagada o anulada), la mora se paga sola.
 * 5. Las cuotas extraordinarias no entran en el orden: se pagan cuando se quiera (siempre completas).
 * Ejemplo: matrícula pagada, setiembre y octubre pendientes; elegir solo octubre → «Primero deben pagarse las cuotas
 * anteriores: Pensión setiembre.»
 */
export function verificarOrdenDePago(idsElegidos: string[], cuotas: CuotaParaOrden[], anioMatricula: number) {
  const elegidas = new Set(idsElegidos);
  const pendientes = cuotas.filter((c) => c.estado === "PENDIENTE");
  if (!pendientes.some((c) => elegidas.has(c.id))) return;

  const inicio = pendientes.filter(esInicio);
  const inicioElegido = inicio.some((c) => elegidas.has(c.id));
  const faltaInicio = inicio.find((c) => !elegidas.has(c.id));
  if (inicioElegido && faltaInicio) throw E.inicioJunto(faltaInicio.concepto);

  const pensionesElegidas = pendientes.filter((c) => c.tipo === "PENSION" && elegidas.has(c.id));
  if (pensionesElegidas.length) {
    if (inicio.length && !inicioElegido) {
      throw E.matriculaPendiente(
        anioMatricula,
        inicio.some((c) => c.tipo === "INGRESO"),
      );
    }
    const ultimoVencimiento = pensionesElegidas.reduce(
      (max, c) => (c.fechaVencimiento > max ? c.fechaVencimiento : max),
      "",
    );
    const faltan = pendientes
      .filter((c) => c.tipo === "PENSION" && !elegidas.has(c.id) && c.fechaVencimiento < ultimoVencimiento)
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
    if (faltan.length) throw E.cuotasAnterioresPendientes(faltan.map((c) => c.concepto));
  }

  const pendientePorId = new Map(pendientes.map((c) => [c.id, c]));
  for (const mora of pendientes.filter((c) => c.tipo === "MORA" && c.cuotaOrigenId)) {
    const pension = pendientePorId.get(mora.cuotaOrigenId!);
    if (pension && elegidas.has(mora.id) !== elegidas.has(pension.id)) {
      throw E.moraConPension(mora.concepto, pension.concepto);
    }
  }
}

/** US22: no hay pagos parciales; el monto debe ser exactamente la suma de las cuotas elegidas. */
export function verificarMontoExacto(montoCentimos: number, sumaCentimos: number) {
  if (montoCentimos !== sumaCentimos) throw E.montoNoCoincide(sumaCentimos);
}

/** La fecha de pago no puede ser futura. */
export function verificarFechaPago(fechaPago: string, hoy: string) {
  if (fechaPago > hoy) throw E.fechaPagoFutura();
}

/**
 * US23: si el número de operación ya está en otra operación no anulada, la nueva queda Observado (no descuenta la
 * deuda hasta que el Administrador la confirme o la descarte). Si no, Confirmado.
 */
export const estadoInicialPago = (numeroUsadoEnOtra: boolean): EstadoPago =>
  numeroUsadoEnOtra ? "OBSERVADO" : "CONFIRMADO";

/** Solo una operación Observado se confirma o se descarta. */
export function verificarObservado(estado: EstadoPago) {
  if (estado !== "OBSERVADO") throw E.pagoNoObservado(NOMBRE_ESTADO_PAGO[estado]);
}

/** Se anula una operación Confirmado u Observado; una Anulado no se anula otra vez. */
export function verificarPagoAnulable(estado: EstadoPago) {
  if (estado === "ANULADO") throw E.pagoYaAnulado();
}

/** US04: con «Otro» el detalle pasa a ser obligatorio (M-02). */
export function verificarMotivoAnulacionPago(
  motivo: MotivoAnulacionElegible | null | undefined,
  detalle?: string | null,
) {
  if (!motivo) throw E.motivoAnulacionPagoRequerido();
  if (motivo === "OTRO" && !detalle?.trim()) throw E.detalleAnulacionRequerido();
  return motivo;
}

/** US25: solo una operación Confirmado (o Anulado que llegó a tener comprobante) tiene recibo. */
export function verificarReciboDisponible(estado: EstadoPago, tieneComprobante: boolean) {
  if (estado === "OBSERVADO" || !tieneComprobante) throw E.reciboNoConfirmado();
}

// ---------- Correlativo del comprobante (US25) ----------

const DIGITOS_CORRELATIVO = 6;

/** «R-2026-000001». */
export const numeroComprobante = (anio: number, correlativo: number) =>
  `R-${anio}-${String(correlativo).padStart(DIGITOS_CORRELATIVO, "0")}`;

/** Prefijo de los comprobantes del año: «R-2026-». */
export const prefijoComprobante = (anio: number) => `R-${anio}-`;

/**
 * Siguiente número a partir del último emitido en el año (o null si no hay ninguno). Se calcula dentro de la
 * transacción con un candado por año, así no hay huecos ni repetidos aunque dos pagos se confirmen a la vez.
 */
export function siguienteComprobante(anio: number, ultimo: string | null): string {
  if (!ultimo) return numeroComprobante(anio, 1);
  const prefijo = prefijoComprobante(anio);
  const n = ultimo.startsWith(prefijo) ? Number(ultimo.slice(prefijo.length)) : NaN;
  if (!Number.isInteger(n) || n < 1) throw new Error("Correlativo de comprobante con formato inesperado");
  return numeroComprobante(anio, n + 1);
}

// ---------- Pago anual adelantado (US58) ----------

/** El pago anual es de una matrícula «Matriculado» con al menos una cuota pendiente. */
export function verificarPagoAnualPosible(estadoMatricula: string, nombreEstado: string, pendientes: number) {
  if (estadoMatricula !== "MATRICULADO") throw E.pagoAnualNoPermitido(nombreEstado);
  if (pendientes < 1) throw E.sinCuotasPendientes();
}

/** US58: el monto debe ser exactamente el total pendiente (sin descuento): «El monto no coincide con el total pendiente». */
export function verificarMontoAnual(montoCentimos: number, totalPendienteCentimos: number) {
  if (montoCentimos !== totalPendienteCentimos) throw E.montoNoCoincidePendiente(totalPendienteCentimos);
}

/** Total pendiente del año: suma de las cuotas Pendiente (vencidas o no), sin las pagadas ni las anuladas. */
export const totalPendienteCentimos = (cuotas: { estado: string; montoCentimos: number }[]) =>
  cuotas.filter((c) => c.estado === "PENDIENTE").reduce((t, c) => t + c.montoCentimos, 0);
