// platform/notificaciones: notificaciones internas de la campana (US55, M-11 a M-14) y bandeja de salida de los
// correos que las acompañan. Los módulos registran los avisos DENTRO de la transacción de la operación (como la
// auditoría) y, después de confirmarla, intentan el envío de los correos; si el envío falla, el correo queda en la
// bandeja (outbox_evento, tipo CORREO) y lo reintenta el job de cada 15 minutos (máximo 5 intentos) sin revertir ni
// bloquear la operación. Solo el destinatario lee y marca sus notificaciones.
import { enviarCorreo } from "@/platform/correo";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { logger } from "@/platform/logger";
import {
  finDeReserva,
  inicioVentana,
  LIMITE_PANEL,
  normalizarAvisos,
  resultadoDelIntento,
  verificarPropias,
  type AvisoInterno,
  type TipoNotificacion,
} from "./reglas";

export {
  TIPOS_NOTIFICACION,
  DIAS_VISIBLES,
  MAX_INTENTOS_CORREO,
  type AvisoInterno,
  type TipoNotificacion,
} from "./reglas";

/** Tipo de evento de la bandeja de salida para los correos. */
const EVENTO_CORREO = "CORREO";
/** Correos que se envían a la vez al despachar (no se satura el servidor SMTP). */
const ENVIOS_SIMULTANEOS = 5;
/** Correos que procesa el job en cada ejecución. */
const LOTE_JOB = 100;
/** Mensaje guardado en ultimo_error: el detalle (sin datos personales) queda en el log de la aplicación. */
const ERROR_ENVIO = "El servidor de correo no aceptó el envío (detalle en el log de la aplicación).";

export interface CorreoSaliente {
  para: string;
  asunto: string;
  texto: string;
}

export interface Avisos {
  /** Notificaciones internas, por usuario destinatario. */
  notificaciones: AvisoInterno[];
  /** Correos que acompañan el aviso (pueden ir a personas sin cuenta, como hasta ahora). */
  correos: CorreoSaliente[];
  /** Entidad que originó el aviso, para rastrear el correo en la bandeja («cierre_calificacion», id). */
  origen: { entidad: string; id: string };
}

/**
 * Registra los avisos dentro de la transacción de la operación: las notificaciones internas y los correos en la
 * bandeja de salida (PENDIENTE). Devuelve los ids de los correos, que se despachan con `despacharCorreos` después de
 * confirmar la transacción.
 */
export async function registrarAvisos(tx: Tx, avisos: Avisos): Promise<string[]> {
  const notificaciones = normalizarAvisos(avisos.notificaciones);
  if (notificaciones.length) {
    await tx.notificacion.createMany({
      data: notificaciones.map((n) => ({
        usuarioId: n.usuarioId,
        tipo: n.tipo,
        titulo: n.titulo,
        mensaje: n.mensaje,
        enlace: n.enlace,
      })),
    });
  }
  if (!avisos.correos.length) return [];
  const creados = await tx.outboxEvento.createManyAndReturn({
    data: avisos.correos.map((c) => ({
      tipoEvento: EVENTO_CORREO,
      agregadoTipo: avisos.origen.entidad,
      agregadoId: avisos.origen.id,
      payload: { para: c.para, asunto: c.asunto, texto: c.texto },
    })),
    select: { id: true },
  });
  return creados.map((c) => c.id);
}

// ---------- Bandeja de salida de correos (US55, criterio 3) ----------

interface CorreoReservado {
  id: string;
  payload: unknown;
  intentos: number;
}

/**
 * Toma correos PENDIENTE listos para enviar y los reserva unos minutos (FOR UPDATE SKIP LOCKED): el despacho
 * inmediato y el job nunca envían el mismo correo a la vez.
 */
function reservar(ahora: Date, filtro: { ids: string[] } | { limite: number }): Promise<CorreoReservado[]> {
  const reserva = finDeReserva(ahora);
  if ("ids" in filtro) {
    return prisma.$queryRaw<CorreoReservado[]>`
      UPDATE outbox_evento o SET proximo_intento = ${reserva}, updated_at = now()
       WHERE o.id IN (SELECT id FROM outbox_evento
                       WHERE tipo_evento = ${EVENTO_CORREO} AND estado = 'PENDIENTE'
                         AND (proximo_intento IS NULL OR proximo_intento <= ${ahora})
                         AND id = ANY(${filtro.ids}::uuid[])
                       FOR UPDATE SKIP LOCKED)
      RETURNING o.id::text AS id, o.payload, o.intentos`;
  }
  return prisma.$queryRaw<CorreoReservado[]>`
    UPDATE outbox_evento o SET proximo_intento = ${reserva}, updated_at = now()
     WHERE o.id IN (SELECT id FROM outbox_evento
                     WHERE tipo_evento = ${EVENTO_CORREO} AND estado = 'PENDIENTE'
                       AND (proximo_intento IS NULL OR proximo_intento <= ${ahora})
                     ORDER BY created_at
                     LIMIT ${filtro.limite}
                     FOR UPDATE SKIP LOCKED)
    RETURNING o.id::text AS id, o.payload, o.intentos`;
}

const esCorreo = (p: unknown): p is CorreoSaliente => {
  const c = p as Partial<CorreoSaliente> | null;
  return typeof c?.para === "string" && typeof c.asunto === "string" && typeof c.texto === "string";
};

/** Intenta enviar un correo reservado y guarda el resultado. Nunca lanza. Devuelve true si se envió. */
async function intentar(c: CorreoReservado): Promise<boolean> {
  const ahora = new Date();
  try {
    // un payload que no es un correo no se reintenta: queda FALLIDO de inmediato
    const enviado = esCorreo(c.payload) ? await enviarCorreo(c.payload) : false;
    const r = esCorreo(c.payload)
      ? resultadoDelIntento(c.intentos, enviado, ahora)
      : { estado: "FALLIDO" as const, intentos: c.intentos + 1, proximoIntento: null };
    await prisma.outboxEvento.update({
      where: { id: c.id },
      data: {
        estado: r.estado,
        intentos: r.intentos,
        proximoIntento: r.proximoIntento,
        procesadoEn: r.estado === "PROCESADO" ? ahora : null,
        ultimoError: enviado ? null : esCorreo(c.payload) ? ERROR_ENVIO : "El contenido del correo no es válido.",
      },
    });
    if (r.estado === "FALLIDO") {
      logger.error("Un correo de la bandeja de salida agotó sus intentos", { correoId: c.id, intentos: r.intentos });
    }
    return enviado;
  } catch (e) {
    // si no se pudo guardar el resultado, la reserva vence y el job lo vuelve a intentar
    logger.error("No se pudo procesar un correo de la bandeja de salida", {
      correoId: c.id,
      error: (e as Error).message,
    });
    return false;
  }
}

async function enviarReservados(reservados: CorreoReservado[]): Promise<number> {
  let enviados = 0;
  for (let i = 0; i < reservados.length; i += ENVIOS_SIMULTANEOS) {
    const lote = await Promise.all(reservados.slice(i, i + ENVIOS_SIMULTANEOS).map(intentar));
    enviados += lote.filter(Boolean).length;
  }
  return enviados;
}

/**
 * Primer intento de envío de los correos registrados con `registrarAvisos`, después de confirmar la transacción.
 * Nunca lanza: la operación ya está confirmada. Devuelve cuántos se enviaron; los demás quedan para el job.
 */
export async function despacharCorreos(ids: string[], requestId?: string): Promise<number> {
  if (!ids.length) return 0;
  try {
    return await enviarReservados(await reservar(new Date(), { ids }));
  } catch (e) {
    logger.warn("No se pudieron despachar los correos: quedan en la bandeja de salida", {
      requestId,
      correos: ids.length,
      error: (e as Error).message,
    });
    return 0;
  }
}

export interface ResumenBandeja {
  procesados: number;
  enviados: number;
  /** Siguen PENDIENTE para otro intento. */
  pendientes: number;
  /** Agotaron sus intentos en esta ejecución o antes (total en la bandeja). */
  fallidos: number;
}

/**
 * Reintenta los correos PENDIENTE cuyo próximo intento ya llegó (job de cada 15 minutos, kubo-conciliar-pagos.timer).
 * Procesa por lotes hasta vaciar lo que estaba listo al empezar.
 */
export async function procesarBandeja(ahora: Date = new Date()): Promise<ResumenBandeja> {
  let procesados = 0;
  let enviados = 0;
  for (;;) {
    const lote = await reservar(ahora, { limite: LOTE_JOB });
    if (!lote.length) break;
    procesados += lote.length;
    enviados += await enviarReservados(lote);
    if (lote.length < LOTE_JOB) break;
  }
  const [pendientes, fallidos] = await Promise.all([
    prisma.outboxEvento.count({ where: { tipoEvento: EVENTO_CORREO, estado: "PENDIENTE" } }),
    prisma.outboxEvento.count({ where: { tipoEvento: EVENTO_CORREO, estado: "FALLIDO" } }),
  ]);
  return { procesados, enviados, pendientes, fallidos };
}

// ---------- Consulta y marcado (US55) ----------

export interface NotificacionVista {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  leida: boolean;
  creadaEn: string;
  leidaEn: string | null;
}

export interface PanelNotificaciones {
  /** No leídas de los últimos 30 días (el número de la campana). */
  noLeidas: number;
  items: NotificacionVista[];
}

const vista = (n: {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  leidaEn: Date | null;
  createdAt: Date;
}): NotificacionVista => ({
  id: n.id,
  tipo: n.tipo as TipoNotificacion,
  titulo: n.titulo,
  mensaje: n.mensaje,
  enlace: n.enlace,
  leida: n.leidaEn !== null,
  creadaEn: n.createdAt.toISOString(),
  leidaEn: n.leidaEn?.toISOString() ?? null,
});

/** Cantidad de no leídas del usuario en los últimos 30 días (indicador de la campana). */
export function contarNoLeidas(usuarioId: string, ahora: Date = new Date()): Promise<number> {
  return prisma.notificacion.count({
    where: { usuarioId, leidaEn: null, createdAt: { gte: inicioVentana(ahora) } },
  });
}

/** Últimas notificaciones del usuario (30 días, máximo 50), las más recientes primero; o solo las no leídas. */
export async function notificacionesDe(
  usuarioId: string,
  opciones: { soloNoLeidas?: boolean } = {},
  ahora: Date = new Date(),
): Promise<PanelNotificaciones> {
  const [filas, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({
      where: {
        usuarioId,
        createdAt: { gte: inicioVentana(ahora) },
        ...(opciones.soloNoLeidas ? { leidaEn: null } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: LIMITE_PANEL,
      select: { id: true, tipo: true, titulo: true, mensaje: true, enlace: true, leidaEn: true, createdAt: true },
    }),
    contarNoLeidas(usuarioId, ahora),
  ]);
  return { noLeidas, items: filas.map(vista) };
}

/**
 * «Marcar como leídas» (US55, criterio 2): las indicadas o, sin ids, todas las no leídas del usuario. Solo marca las
 * del propio usuario: un id ajeno responde 404 y no se marca nada. Devuelve cuántas se marcaron y el nuevo indicador.
 */
export async function marcarLeidas(
  usuarioId: string,
  ids: string[] | undefined,
  ahora: Date = new Date(),
): Promise<{ marcadas: number; noLeidas: number }> {
  const marcadas = await prisma.$transaction(async (tx) => {
    if (ids?.length) {
      const unicos = [...new Set(ids)];
      const propias = await tx.notificacion.findMany({
        where: { id: { in: unicos }, usuarioId },
        select: { id: true },
      });
      verificarPropias(
        unicos,
        propias.map((p) => p.id),
      );
    }
    const r = await tx.notificacion.updateMany({
      where: { usuarioId, leidaEn: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { leidaEn: ahora },
    });
    return r.count;
  });
  return { marcadas, noLeidas: await contarNoLeidas(usuarioId, ahora) };
}
