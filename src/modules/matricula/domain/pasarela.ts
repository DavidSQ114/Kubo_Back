// matricula/domain: pago en línea desde el portal del apoderado (US70) y su conciliación (US71). Puerto PasarelaPagos
// (Mercado Pago Checkout Pro con Orders o la pasarela falsa) y reglas puras: monto del intento, cuándo un cobro cuenta
// como pagado, qué hacer si una cuota ya se pagó por otro medio y cuándo conciliar. Montos en céntimos enteros.
import { erroresMatricula as E } from "./errores";
import { verificarCuotasPagables, type CuotaParaPago, type EstadoPago } from "./pagos";

/** Minutos que vive un intento de pago (y la order en la pasarela) antes de expirar. */
export const MINUTOS_EXPIRACION_INTENTO = 30;
/** La conciliación (US71) revisa los intentos Pendiente con más de estos minutos. */
export const MINUTOS_ANTES_DE_CONCILIAR = 10;
const MS_POR_MINUTO = 60_000;

export const ORIGENES_PAGO = ["TESORERIA", "PASARELA"] as const;
export type OrigenPago = (typeof ORIGENES_PAGO)[number];

export const NOMBRE_ORIGEN_PAGO: Record<OrigenPago, string> = {
  TESORERIA: "Tesorería",
  PASARELA: "Pasarela",
};

export const ESTADOS_INTENTO = ["PENDIENTE", "APROBADO", "RECHAZADO", "EXPIRADO", "OBSERVADO"] as const;
export type EstadoIntento = (typeof ESTADOS_INTENTO)[number];

/** Textos de la pantalla de retorno del portal. */
export const NOMBRE_ESTADO_INTENTO: Record<EstadoIntento, string> = {
  PENDIENTE: "En proceso",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  EXPIRADO: "Expirado",
  OBSERVADO: "En revisión",
};

/** Motivos con que un pago aprobado en la pasarela queda Observado. */
export const MOTIVO_CUOTA_PAGADA = "Cuota pagada por otro medio";
export const MOTIVO_CUOTA_ANULADA = "Cuota anulada";
export const MOTIVO_MONTO_DISTINTO = "El monto pagado no coincide con las cuotas";
/** Observación de la anulación al registrar la devolución de un pago en línea Observado (US71). */
export const MOTIVO_DEVOLUCION = "Devuelto";

// ---------- Puerto PasarelaPagos ----------

/** Resultado normalizado de un cobro en la pasarela. */
export type ResultadoCobro = "PAGADO" | "SIN_PAGO" | "EN_PROCESO" | "RECHAZADO" | "EXPIRADO" | "DEVUELTO";

export interface DatosCobro {
  /** Clave de idempotencia (el id del intento): reintentar la creación no crea dos cobros. */
  idempotencia: string;
  /** external_reference: código del intento. */
  referencia: string;
  montoCentimos: number;
  items: { titulo: string; montoCentimos: number }[];
  /** A dónde vuelve el apoderado (aprobado, rechazado o pendiente). Nunca confirma un pago. */
  urlRetorno: string;
  expiraEnMinutos: number;
}

export interface CobroCreado {
  ordenId: string;
  urlCheckout: string;
}

export interface CobroConsultado {
  ordenId: string;
  resultado: ResultadoCobro;
  /** «processed/accredited»: lo que respondió la pasarela, para la bitácora (sin datos de tarjeta). */
  estadoExterno: string;
  /** null si la pasarela no informó el monto o no tenía el formato esperado. */
  montoCentimos: number | null;
  montoPagadoCentimos: number | null;
  referencia: string | null;
}

/**
 * Lo que la tesorería necesita de una pasarela de pagos. Implementaciones en infrastructure/pasarela: Mercado Pago
 * (API de Orders de Checkout Pro) y una falsa para pruebas y desarrollo local.
 */
export interface PasarelaPagos {
  readonly nombre: "mercadopago" | "falsa";
  crearCobro(datos: DatosCobro): Promise<CobroCreado>;
  /** null si la pasarela no conoce la order. */
  consultarPago(ordenId: string): Promise<CobroConsultado | null>;
}

// ---------- Reglas ----------

/**
 * US70: el monto lo calcula el servidor. Las cuotas elegidas deben estar Pendiente y ser del mismo estudiante (las
 * mismas reglas que el pago manual) y de la misma matrícula. Devuelve la suma en céntimos.
 */
export function montoDelIntento(
  idsElegidos: string[],
  cuotas: (CuotaParaPago & { matriculaId: string })[],
  estudianteId: string,
): number {
  const suma = verificarCuotasPagables(idsElegidos, cuotas);
  if (cuotas.some((c) => c.estudianteId !== estudianteId)) throw E.cuotaNoEncontrada();
  if (new Set(cuotas.map((c) => c.matriculaId)).size > 1) throw E.cuotasDeVariasMatriculas();
  return suma;
}

export const expiracionIntento = (ahora: Date) =>
  new Date(ahora.getTime() + MINUTOS_EXPIRACION_INTENTO * MS_POR_MINUTO);

/** «PT30M»: duración ISO 8601 de la order en la pasarela. */
export const duracionIso = (minutos: number) => `PT${minutos}M`;

/** Qué hacer con un intento según lo que responde la pasarela. */
export type Decision =
  | { tipo: "REGISTRAR" }
  | { tipo: "OBSERVAR"; motivo: string }
  | { tipo: "ACTUALIZAR"; estado: "PENDIENTE" | "RECHAZADO" | "EXPIRADO" };

/**
 * US70: un cobro cuenta como pagado solo si la pasarela lo da por acreditado, lo pagado es igual al total de la order,
 * el total es el monto del intento y la referencia es la del intento. Acreditado pero con otro monto o referencia:
 * se observa y no se registra. Sin pago y con el intento vencido: expirado.
 */
export function decidirCobro(
  intento: { montoCentimos: number; referencia: string; expiraEn: Date },
  cobro: CobroConsultado,
  ahora: Date,
): Decision {
  switch (cobro.resultado) {
    case "PAGADO": {
      const coincide =
        cobro.montoPagadoCentimos !== null &&
        cobro.montoPagadoCentimos === cobro.montoCentimos &&
        cobro.montoCentimos === intento.montoCentimos &&
        cobro.referencia === intento.referencia;
      return coincide ? { tipo: "REGISTRAR" } : { tipo: "OBSERVAR", motivo: MOTIVO_MONTO_DISTINTO };
    }
    case "RECHAZADO":
      return { tipo: "ACTUALIZAR", estado: "RECHAZADO" };
    case "EXPIRADO":
      return { tipo: "ACTUALIZAR", estado: "EXPIRADO" };
    case "DEVUELTO":
      // devuelto en la pasarela antes de registrarse en Kubo: no hay nada que cobrar
      return { tipo: "ACTUALIZAR", estado: "RECHAZADO" };
    case "SIN_PAGO":
      return { tipo: "ACTUALIZAR", estado: ahora > intento.expiraEn ? "EXPIRADO" : "PENDIENTE" };
    default:
      return { tipo: "ACTUALIZAR", estado: "PENDIENTE" };
  }
}

/**
 * Un aviso no retrocede un intento ya resuelto: Aprobado y Observado son finales; un Rechazado o Expirado solo
 * cambia si después llega un pago (la persona reintentó con otra tarjeta en la misma order).
 */
export function puedeActualizarIntento(actual: EstadoIntento, nuevo: "PENDIENTE" | "RECHAZADO" | "EXPIRADO") {
  if (actual === "APROBADO" || actual === "OBSERVADO") return false;
  if (actual === "PENDIENTE") return nuevo !== "PENDIENTE";
  return false;
}

/** US71: se concilian los intentos Pendiente creados hace más de diez minutos. */
export const limiteConciliacion = (ahora: Date) =>
  new Date(ahora.getTime() - MINUTOS_ANTES_DE_CONCILIAR * MS_POR_MINUTO);

/**
 * US70: al confirmar un pago aprobado se vuelven a validar las cuotas (no se reservaron). Si una ya está pagada (o
 * anulada) o el monto no cuadra, la operación queda Observado con el motivo y no toca las cuotas; tesorería decide
 * si la confirma o registra la devolución (US71).
 */
export function estadoPagoPasarela(
  idsElegidos: string[],
  cuotas: CuotaParaPago[],
  montoCentimos: number,
): { estado: EstadoPago; motivo: string | null } {
  let suma: number;
  try {
    suma = verificarCuotasPagables(idsElegidos, cuotas);
  } catch (e) {
    const codigo = (e as { codigo?: string }).codigo;
    if (codigo === "CUOTA_YA_PAGADA") return { estado: "OBSERVADO", motivo: MOTIVO_CUOTA_PAGADA };
    if (codigo === "CUOTA_ANULADA") return { estado: "OBSERVADO", motivo: MOTIVO_CUOTA_ANULADA };
    throw e;
  }
  if (suma !== montoCentimos) return { estado: "OBSERVADO", motivo: MOTIVO_MONTO_DISTINTO };
  return { estado: "CONFIRMADO", motivo: null };
}

/** US71: solo un pago en línea Observado admite «Registrar devolución». */
export function verificarDevolucionPosible(op: { origen: OrigenPago; estado: EstadoPago }) {
  if (op.origen !== "PASARELA" || op.estado !== "OBSERVADO") throw E.devolucionNoPermitida();
}

/** Un pago en línea Observado no se descarta como duplicado: el dinero se devuelve (US71). */
export function verificarDescartable(origen: OrigenPago) {
  if (origen === "PASARELA") throw E.usarDevolucion();
}
