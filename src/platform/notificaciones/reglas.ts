// platform/notificaciones: reglas puras de las notificaciones internas (US55, M-11 a M-14) y de la bandeja de salida
// de correos: textos acotados, ventana de 30 días del panel, notificaciones propias y reintentos con espera creciente.
import { ErrorApp } from "@/platform/http/errores";

export const TIPOS_NOTIFICACION = [
  "HORARIO",
  "NOTAS",
  "PAGO",
  "RECTIFICACION",
  "MATERIAL",
  "TRABAJO",
  "ASISTENCIA",
  "RECORDATORIO",
  "SISTEMA",
] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

/** El panel muestra los avisos de los últimos 30 días (pie de M-11 a M-14). */
export const DIAS_VISIBLES = 30;
/** Notificaciones que trae el panel como máximo: las más recientes primero. */
export const LIMITE_PANEL = 50;
export const LARGO_MAXIMO_TITULO = 120;
export const LARGO_MAXIMO_MENSAJE = 300;
/** «Marcar como leídas» con ids explícitos: como máximo el tamaño del panel. */
export const MAXIMO_IDS_POR_MARCADO = LIMITE_PANEL;

/** Intentos de envío de un correo de la bandeja antes de quedar FALLIDO (US55, criterio 3). */
export const MAX_INTENTOS_CORREO = 5;
/** Espera tras el primer fallo; se duplica en cada intento (5, 10, 20 y 40 minutos). */
const MINUTOS_PRIMERA_ESPERA = 5;
/** Un correo tomado para enviar queda reservado este tiempo: si el proceso muere, otro lo reintenta después. */
export const MINUTOS_RESERVA_ENVIO = 10;
const MS_POR_MINUTO = 60_000;
const MS_POR_DIA = 86_400_000;

export const erroresNotificaciones = {
  noEncontrada: () => new ErrorApp("NOTIFICACION_NO_ENCONTRADA", "La notificación no existe.", 404),
};

/** Recorta un texto al largo indicado, con «…» al final si no entra. */
export function recortar(texto: string, largo: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length <= largo ? limpio : `${limpio.slice(0, largo - 1).trimEnd()}…`;
}

/** Instante desde el que se muestran las notificaciones en el panel. */
export const inicioVentana = (ahora: Date) => new Date(ahora.getTime() - DIAS_VISIBLES * MS_POR_DIA);

export interface AvisoInterno {
  usuarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  /** Ruta de la pantalla del portal («/apoderado/notas»); null si no hay una. */
  enlace: string | null;
}

/** Enlace interno seguro: solo rutas del propio sitio («/apoderado/pagos»), nunca una URL externa. */
export const esEnlaceInterno = (enlace: string) => /^\/(?!\/)[\w\-/?=&.%]*$/.test(enlace);

/**
 * Notificaciones listas para guardar: textos recortados, solo enlaces internos y una sola por usuario y contenido (una
 * persona con dos hijos en el mismo registro, o un administrador que también es docente, no recibe el mismo aviso dos
 * veces).
 */
export function normalizarAvisos(avisos: AvisoInterno[]): AvisoInterno[] {
  const vistos = new Set<string>();
  const unicos: AvisoInterno[] = [];
  for (const a of avisos) {
    const aviso = {
      ...a,
      titulo: recortar(a.titulo, LARGO_MAXIMO_TITULO),
      mensaje: recortar(a.mensaje, LARGO_MAXIMO_MENSAJE),
      // el panel solo navega dentro de Kubo: un enlace externo se descarta
      enlace: a.enlace && esEnlaceInterno(a.enlace) ? a.enlace : null,
    };
    const clave = JSON.stringify([aviso.usuarioId, aviso.tipo, aviso.titulo, aviso.mensaje, aviso.enlace]);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    unicos.push(aviso);
  }
  return unicos;
}

/**
 * Solo el destinatario marca sus notificaciones (US55): si alguno de los ids pedidos no es suyo (o no existe), se
 * responde 404 sin revelar de quién es y no se marca ninguna.
 */
export function verificarPropias(pedidas: string[], propias: string[]) {
  const suyas = new Set(propias);
  if (pedidas.some((id) => !suyas.has(id))) throw erroresNotificaciones.noEncontrada();
}

export type EstadoCorreo = "PENDIENTE" | "PROCESADO" | "FALLIDO";

export interface ResultadoIntento {
  estado: EstadoCorreo;
  intentos: number;
  /** Cuándo se puede volver a intentar; null si ya no se reintenta. */
  proximoIntento: Date | null;
}

/** Minutos de espera después del intento fallido número `intento` (1 → 5, 2 → 10, 3 → 20, 4 → 40). */
export const minutosDeEspera = (intento: number) => MINUTOS_PRIMERA_ESPERA * 2 ** Math.max(0, intento - 1);

/**
 * Estado del correo después de un intento de envío (US55, criterio 3). Enviado: PROCESADO. Si falla, sigue PENDIENTE
 * con una espera creciente hasta el quinto intento, en que queda FALLIDO. La operación que lo originó nunca se toca.
 */
export function resultadoDelIntento(intentosPrevios: number, enviado: boolean, ahora: Date): ResultadoIntento {
  const intentos = intentosPrevios + 1;
  if (enviado) return { estado: "PROCESADO", intentos, proximoIntento: null };
  if (intentos >= MAX_INTENTOS_CORREO) return { estado: "FALLIDO", intentos, proximoIntento: null };
  return {
    estado: "PENDIENTE",
    intentos,
    proximoIntento: new Date(ahora.getTime() + minutosDeEspera(intentos) * MS_POR_MINUTO),
  };
}

/** Hasta cuándo queda reservado un correo que se acaba de tomar para enviarlo. */
export const finDeReserva = (ahora: Date) => new Date(ahora.getTime() + MINUTOS_RESERVA_ENVIO * MS_POR_MINUTO);
