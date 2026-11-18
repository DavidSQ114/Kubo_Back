// matricula/domain: reglas puras de los recordatorios de pago a apoderados morosos (US59, AD-12, M-24): a quién se
// omite y el texto de la notificación interna y del correo con el detalle de la deuda (cuotas vencidas, montos y días
// de atraso). Fechas «AAAA-MM-DD» con el día de Lima; montos como texto «450.00».
import { diasAtraso } from "./morosidad";

/** Estudiantes que se pueden seleccionar en un mismo envío. */
export const MAXIMO_RECORDATORIOS = 200;

export const MOTIVOS_OMISION = ["SIN_CUOTAS_VENCIDAS", "SIN_DESTINATARIO"] as const;
export type MotivoOmision = (typeof MOTIVOS_OMISION)[number];

export const NOMBRE_MOTIVO_OMISION: Record<MotivoOmision, string> = {
  SIN_CUOTAS_VENCIDAS: "Ya no tiene cuotas vencidas",
  SIN_DESTINATARIO: "El apoderado responsable no tiene cuenta ni correo",
};

/**
 * ¿Se omite el recordatorio? Sin cuotas vencidas al momento del envío no se envía (US59, criterio 3). Si el apoderado
 * responsable no tiene cuenta ni correo, no hay a quién enviarlo.
 */
export function motivoDeOmision(d: { cuotasVencidas: number; tieneCuenta: boolean; tieneCorreo: boolean }) {
  if (d.cuotasVencidas === 0) return "SIN_CUOTAS_VENCIDAS" as const;
  if (!d.tieneCuenta && !d.tieneCorreo) return "SIN_DESTINATARIO" as const;
  return null;
}

export interface CuotaVencida {
  concepto: string;
  /** «450.00». */
  monto: string;
  fechaVencimiento: string;
}

export interface DatosRecordatorio {
  /** Nombre de pila del apoderado responsable, para el saludo. */
  apoderado: string;
  /** Nombre completo del estudiante. */
  estudiante: string;
  cuotas: CuotaVencida[];
  /** Suma de las cuotas vencidas, «900.00». */
  total: string;
  hoy: string;
}

export interface TextoRecordatorio {
  titulo: string;
  mensaje: string;
  asunto: string;
  cuerpo: string;
  /** Días desde el primer vencimiento impago. */
  diasAtraso: number;
}

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Notificación interna y correo del recordatorio, con cada cuota vencida, su monto y sus días de atraso (US59). */
export function textoRecordatorio(d: DatosRecordatorio): TextoRecordatorio {
  const cuotas = [...d.cuotas].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
  const atraso = cuotas.length ? diasAtraso(cuotas[0].fechaVencimiento, d.hoy) : 0;
  const cantidad = plural(cuotas.length, "cuota vencida", "cuotas vencidas");
  const dias = plural(atraso, "día", "días");
  const lineas = cuotas.map((c) => {
    const diasCuota = plural(diasAtraso(c.fechaVencimiento, d.hoy), "día", "días");
    return `- ${c.concepto} · venció el ${fechaCorta(c.fechaVencimiento)} · S/ ${c.monto} · ${diasCuota} de atraso`;
  });
  return {
    titulo: "Recordatorio de pago",
    mensaje: `${d.estudiante.split(" ")[0]}: ${cantidad} · S/ ${d.total} · ${dias} de atraso`,
    asunto: `Kubo · Recordatorio de pago de ${d.estudiante}`,
    cuerpo:
      `Hola, ${d.apoderado}:\n\n` +
      `${d.estudiante} tiene ${cantidad} por un total de S/ ${d.total}:\n${lineas.join("\n")}\n\n` +
      "Te pedimos regularizar el pago en tesorería o desde «Pagos» en Kubo. Si ya pagaste, no tomes en cuenta " +
      "este mensaje.\n\nEste es un mensaje automático: no lo respondas.",
    diasAtraso: atraso,
  };
}
