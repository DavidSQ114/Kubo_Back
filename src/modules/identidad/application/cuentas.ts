// identidad/application: gestión de cuentas por el Administrador.
// Suspender y reactivar (RF05, pantalla M-04) y crear la cuenta de una persona (RF43).
import { randomInt } from "node:crypto";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { hashPassword } from "@/platform/auth/tokens";
import { registrarAuditoria } from "@/platform/auditoria";
import { enviarCorreo } from "@/platform/correo";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { erroresIdentidad as E } from "../domain/errores";
import { generarPasswordTemporal, normalizarEmail, type EstadoUsuario } from "../domain/reglas";
import { sesiones, usuarios } from "../infrastructure/repositorio";
import type { Autenticado } from "./sesion";

export async function suspenderUsuario(
  admin: Autenticado,
  usuarioId: string,
  datos: { motivo: string; detalle?: string | null; notificar: boolean },
  meta: MetaSolicitud,
): Promise<{ usuarioId: string; estado: EstadoUsuario }> {
  if (usuarioId === admin.usuarioId) throw E.noPuedeSuspenderse();

  const u = await prisma.$transaction(async (tx) => {
    await usuarios.bloquearFila(tx, usuarioId);
    const actual = await usuarios.porId(usuarioId, tx);
    if (!actual || actual.estado === "DADO_DE_BAJA") throw errores.noEncontrado("El usuario");
    if (actual.estado === "SUSPENDIDO") throw E.yaSuspendido();

    await usuarios.actualizar(usuarioId, { estado: "SUSPENDIDO", versionSesion: { increment: 1 } }, tx);
    await sesiones.revocarTodas(usuarioId, null, tx); // cierra de inmediato todas sus sesiones (RF05)
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "usuario",
        entidadId: usuarioId,
        accion: "SUSPENDER_USUARIO",
        anterior: { estado: actual.estado },
        nuevo: { estado: "SUSPENDIDO" },
        motivo: datos.detalle ? `${datos.motivo}. ${datos.detalle}` : datos.motivo,
      },
      meta,
    );
    return actual;
  });

  if (datos.notificar) {
    await enviarCorreo({
      para: u.email,
      asunto: "Kubo · Tu acceso fue suspendido",
      texto: `Tu acceso a Kubo fue suspendido.\nMotivo: ${datos.motivo}.\n\nSi crees que es un error, comunícate con la administración del colegio.`,
    });
  }
  return { usuarioId, estado: "SUSPENDIDO" };
}

export async function reactivarUsuario(
  admin: Autenticado,
  usuarioId: string,
  datos: { motivo?: string | null },
  meta: MetaSolicitud,
): Promise<{ usuarioId: string; estado: EstadoUsuario }> {
  return prisma.$transaction(async (tx) => {
    await usuarios.bloquearFila(tx, usuarioId);
    const actual = await usuarios.porId(usuarioId, tx);
    if (!actual || actual.estado === "DADO_DE_BAJA") throw errores.noEncontrado("El usuario");
    if (actual.estado !== "SUSPENDIDO") throw E.noSuspendido();

    const estado: EstadoUsuario = actual.debeCambiarPassword ? "PENDIENTE_ACTIVACION" : "ACTIVO";
    await usuarios.actualizar(usuarioId, { estado, intentosFallidos: 0, bloqueadoHasta: null }, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "usuario",
        entidadId: usuarioId,
        accion: "REACTIVAR_USUARIO",
        anterior: { estado: "SUSPENDIDO" },
        nuevo: { estado },
        motivo: datos.motivo ?? null,
      },
      meta,
    );
    return { usuarioId, estado };
  });
}

/**
 * Garantiza que la persona tenga una cuenta. Si no existe, la crea con una contraseña temporal
 * que debe cambiarse en el primer ingreso (RF43). Se usa dentro de la transacción del módulo que registra a la persona.
 */
export async function asegurarCuenta(
  tx: Tx,
  datos: { personaId: string; email: string },
): Promise<{ usuarioId: string; email: string; creada: boolean; passwordTemporal: string | null }> {
  const existente = await usuarios.porPersona(datos.personaId, tx);
  if (existente) return { usuarioId: existente.id, email: existente.email, creada: false, passwordTemporal: null };

  const email = normalizarEmail(datos.email);
  if (await usuarios.porEmail(email, tx)) throw E.emailEnUso();

  const passwordTemporal = generarPasswordTemporal(randomInt);
  const u = await usuarios.crear(
    {
      personaId: datos.personaId,
      email,
      passwordHash: await hashPassword(passwordTemporal),
      estado: "PENDIENTE_ACTIVACION",
      debeCambiarPassword: true,
    },
    tx,
  );
  return { usuarioId: u.id, email, creada: true, passwordTemporal };
}

/** Correo de bienvenida con la contraseña temporal. Se envía después de confirmar la transacción. */
export async function enviarBienvenida(datos: { email: string; nombres: string; passwordTemporal: string; urlBase: string }) {
  return enviarCorreo({
    para: datos.email,
    asunto: "Kubo · Tu cuenta fue creada",
    texto:
      `Hola, ${datos.nombres}.\n\nSe creó tu cuenta en Kubo.\n` +
      `Usuario: ${datos.email}\nContraseña temporal: ${datos.passwordTemporal}\n\n` +
      `Ingresa en ${datos.urlBase.replace(/\/$/, "")}/login. En tu primer ingreso deberás cambiar la contraseña.`,
  });
}
