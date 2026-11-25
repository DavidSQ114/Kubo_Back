// evaluacion/application: destinatarios y contenido de los avisos del cierre de notas (US39) y de la rectificación
// (US41): notificación interna a quien tiene cuenta (US55) y correo a quien tiene correo, como hasta ahora. Se preparan
// antes de la transacción; si la consulta falla, la operación sigue sin avisos (nunca se bloquea).
import type { MetaSolicitud } from "@/platform/http/ruta";
import { logger } from "@/platform/logger";
import type { AvisoInterno, CorreoSaliente, TipoNotificacion } from "@/platform/notificaciones";
import {
  contactosDeCoordinadores,
  contactosDeDocentes,
  personasDeCoordinadores,
  personasDeDocentes,
} from "@/modules/comunidad";
import { usuariosDePersonas } from "@/modules/identidad";

export interface Destinatarios {
  usuarioIds: string[];
  contactos: { email: string; nombres: string }[];
}

const NADIE: Destinatarios = { usuarioIds: [], contactos: [] };

async function seguro(consulta: () => Promise<Destinatarios>, que: string, meta: MetaSolicitud) {
  try {
    return await consulta();
  } catch (e) {
    logger.warn(`No se pudo preparar el aviso a ${que}`, { requestId: meta.requestId, error: (e as Error).message });
    return NADIE;
  }
}

/** Coordinadores académicos activos: cuentas para la notificación y correos (bloque M1: los avisos académicos ya no
 * van a los administradores). */
export const coordinadoresDestinatarios = (meta: MetaSolicitud) =>
  seguro(
    async () => {
      const [personas, contactos] = await Promise.all([personasDeCoordinadores(), contactosDeCoordinadores()]);
      return { usuarioIds: Object.values(await usuariosDePersonas(personas)), contactos };
    },
    "los coordinadores académicos",
    meta,
  );

/** Un docente activo: su cuenta para la notificación y su correo. */
export const docenteDestinatario = (docenteId: string, meta: MetaSolicitud) =>
  seguro(
    async () => {
      const [personas, contactos] = await Promise.all([
        personasDeDocentes([docenteId]),
        contactosDeDocentes([docenteId]),
      ]);
      return { usuarioIds: Object.values(await usuariosDePersonas(Object.values(personas))), contactos };
    },
    "el docente",
    meta,
  );

export interface ContenidoAviso {
  tipo: TipoNotificacion;
  /** Notificación interna (panel de la campana). */
  titulo: string;
  mensaje: string;
  enlace: string;
  /** Correo: asunto y cuerpo (el saludo y el pie se agregan aquí). */
  asunto: string;
  cuerpo: string;
}

/** Notificaciones y correos de un mismo aviso para los destinatarios. */
export function avisosPara(
  d: Destinatarios,
  c: ContenidoAviso,
): { notificaciones: AvisoInterno[]; correos: CorreoSaliente[] } {
  return {
    notificaciones: d.usuarioIds.map((usuarioId) => ({
      usuarioId,
      tipo: c.tipo,
      titulo: c.titulo,
      mensaje: c.mensaje,
      enlace: c.enlace,
    })),
    correos: d.contactos.map((x) => ({
      para: x.email,
      asunto: c.asunto,
      texto: `Hola, ${x.nombres}:\n\n${c.cuerpo}\n\nEste es un mensaje automático: no lo respondas.`,
    })),
  };
}
