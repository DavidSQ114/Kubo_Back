// identidad/application: cambio de contraseña (RF43) y recuperación por enlace de un solo uso (RF02).
import { prisma } from "@/platform/db/prisma";
import { firmarAcceso } from "@/platform/auth/jwt";
import { generarTokenOpaco, hashPassword, hashToken, verificarPassword } from "@/platform/auth/tokens";
import { enviarCorreo } from "@/platform/correo";
import { logger } from "@/platform/logger";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { erroresIdentidad as E } from "../domain/errores";
import {
  MINUTOS_ENLACE_RECUPERACION,
  incumplimientosPassword,
  minutosRestantes,
  normalizarEmail,
  puedeIniciarSesion,
} from "../domain/reglas";
import { sesiones, tokensRecuperacion, usuarios } from "../infrastructure/repositorio";
import type { Autenticado } from "./sesion";

function validarPolitica(nueva: string) {
  const fallas = incumplimientosPassword(nueva);
  if (fallas.length) throw E.passwordDebil(fallas);
}

/**
 * Cambio voluntario u obligatorio (primer ingreso). Cierra las demás sesiones del usuario
 * y mantiene abierta la actual con un token de acceso nuevo.
 */
export async function cambiarPassword(
  auth: Autenticado,
  datos: { actual: string; nueva: string },
  meta: MetaSolicitud,
): Promise<{ acceso: string }> {
  const u = await usuarios.porId(auth.usuarioId);
  if (!u) throw E.sesionInvalida();
  if (!(await verificarPassword(datos.actual, u.passwordHash))) throw E.passwordActualIncorrecta();
  validarPolitica(datos.nueva);
  if (await verificarPassword(datos.nueva, u.passwordHash)) throw E.passwordRepetida();

  const passwordHash = await hashPassword(datos.nueva);
  await prisma.$transaction(async (tx) => {
    const actualizado = await usuarios.actualizar(
      u.id,
      {
        passwordHash,
        debeCambiarPassword: false,
        estado: u.estado === "PENDIENTE_ACTIVACION" ? "ACTIVO" : u.estado,
        versionSesion: { increment: 1 },
      },
      tx,
    );
    await sesiones.revocarTodas(u.id, auth.sesionId, tx);
    await sesiones.actualizar(auth.sesionId, { versionSesion: actualizado.versionSesion }, tx);
  });
  logger.info("Contraseña cambiada", { requestId: meta.requestId, usuarioId: u.id });
  return { acceso: await firmarAcceso({ sub: u.id, sid: auth.sesionId, rol: auth.rol }) };
}

/**
 * Envía el enlace de recuperación. Responde igual exista o no el correo (pantalla AC-04),
 * para no revelar qué correos están registrados.
 */
export async function solicitarRecuperacion(email: string, urlBase: string, meta: MetaSolicitud): Promise<void> {
  const u = await usuarios.porEmail(normalizarEmail(email));
  if (!u || !puedeIniciarSesion(u.estado)) return;

  const token = generarTokenOpaco();
  const expiraEn = new Date(Date.now() + MINUTOS_ENLACE_RECUPERACION * 60_000);
  await prisma.$transaction(async (tx) => {
    await tokensRecuperacion.revocarPendientes(u.id, tx);
    await tokensRecuperacion.crear({ usuarioId: u.id, tokenHash: hashToken(token), expiraEn }, tx);
  });

  const enlace = `${urlBase.replace(/\/$/, "")}/restablecer?token=${token}`;
  await enviarCorreo({
    para: u.email,
    asunto: "Kubo · Recupera tu contraseña",
    texto:
      `Recibimos una solicitud para restablecer tu contraseña de Kubo.\n\n` +
      `Ingresa a este enlace para crear una nueva (vence en ${MINUTOS_ENLACE_RECUPERACION} minutos y solo se puede usar una vez):\n${enlace}\n\n` +
      `Si no fuiste tú, ignora este correo: tu contraseña no cambiará.`,
  });
  logger.info("Enlace de recuperación generado", { requestId: meta.requestId, usuarioId: u.id });
}

/** Verifica el enlace antes de mostrar el formulario (AC-06: "Enlace válido · vence en N min"). */
export async function validarEnlace(token: string) {
  const t = await tokensRecuperacion.vigente(hashToken(token), new Date());
  if (!t || !puedeIniciarSesion(t.usuario.estado)) throw E.enlaceExpirado();
  return { email: t.usuario.email, expiraEn: t.expiraEn, minutosRestantes: minutosRestantes(t.expiraEn, new Date()) };
}

/** Define la nueva contraseña, consume el enlace y cierra todas las sesiones del usuario. */
export async function restablecerPassword(datos: { token: string; nueva: string }, meta: MetaSolicitud): Promise<void> {
  validarPolitica(datos.nueva);
  const t = await tokensRecuperacion.vigente(hashToken(datos.token), new Date());
  if (!t || !puedeIniciarSesion(t.usuario.estado)) throw E.enlaceExpirado();

  const passwordHash = await hashPassword(datos.nueva);
  const consumido = await prisma.$transaction(async (tx) => {
    const marcado = await tokensRecuperacion.marcarUsado(t.id, tx);
    if (marcado.count !== 1) return false; // otro uso simultáneo del mismo enlace
    await usuarios.actualizar(
      t.usuarioId,
      {
        passwordHash,
        debeCambiarPassword: false,
        estado: "ACTIVO",
        versionSesion: { increment: 1 },
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
      tx,
    );
    await sesiones.revocarTodas(t.usuarioId, null, tx);
    await tokensRecuperacion.revocarPendientes(t.usuarioId, tx);
    return true;
  });
  if (!consumido) throw E.enlaceExpirado();
  logger.info("Contraseña restablecida por enlace", { requestId: meta.requestId, usuarioId: t.usuarioId });
}
