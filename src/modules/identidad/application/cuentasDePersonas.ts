// identidad/application: lo que comunidad necesita de la cuenta de una persona al editarla o darla de baja (US69).
// identidad es el dueño de usuario, sesion y token_recuperacion: comunidad llama a estas funciones dentro de su
// transacción y nunca escribe en esas tablas.
import type { Tx } from "@/platform/db/tipos";
import { enviarCorreo } from "@/platform/correo";
import { erroresIdentidad as E } from "../domain/errores";
import { enmascararEmail, normalizarEmail, type EstadoUsuario } from "../domain/reglas";
import { sesiones, tokensRecuperacion, usuarios } from "../infrastructure/repositorio";

export interface CuentaDePersona {
  usuarioId: string;
  email: string;
  estado: EstadoUsuario;
  /** Ingresó al sistema al menos una vez: una cuenta usada no se elimina. */
  usada: boolean;
  /** Último ingreso registrado («Mi perfil», bloque M1). */
  ultimoAccesoEn: Date | null;
}

/** Cuenta de la persona, o null si no tiene. */
export async function cuentaDePersona(personaId: string, tx?: Tx): Promise<CuentaDePersona | null> {
  const u = await usuarios.porPersona(personaId, tx);
  return u
    ? {
        usuarioId: u.id,
        email: u.email,
        estado: u.estado,
        usada: u.ultimoAccesoEn !== null,
        ultimoAccesoEn: u.ultimoAccesoEn,
      }
    : null;
}

/**
 * Usuario de cada persona que tiene una cuenta vigente (no dada de baja), por id de persona: los módulos lo usan para
 * dirigir las notificaciones internas (US55). Las personas sin cuenta no aparecen (reciben, si acaso, solo el correo).
 */
export async function usuariosDePersonas(personaIds: string[], tx?: Tx): Promise<Record<string, string>> {
  const unicos = [...new Set(personaIds)];
  if (!unicos.length) return {};
  const filas = await usuarios.vigentesDePersonas(unicos, tx);
  return Object.fromEntries(filas.map((u) => [u.personaId, u.id]));
}

/** Aumenta la versión de sesión y revoca las sesiones abiertas: los tokens de acceso dejan de valer de inmediato. */
async function cerrarSesiones(tx: Tx, usuarioId: string, cambios: { email?: string } = {}) {
  await usuarios.actualizar(usuarioId, { ...cambios, versionSesion: { increment: 1 } }, tx);
  await sesiones.revocarTodas(usuarioId, null, tx);
}

/**
 * Cambia el correo de la cuenta de la persona dentro de la transacción de quien la edita (US69). El correo no puede
 * ser el de la cuenta de otra persona (409 EMAIL_EN_USO). Cierra todas sus sesiones y anula los enlaces de
 * recuperación pendientes, que se enviaron al correo anterior. Devuelve null si la persona no tiene cuenta o ya
 * usaba ese correo (en ese caso solo se comprobó que esté libre).
 */
export async function cambiarCorreoDeCuenta(
  tx: Tx,
  datos: { personaId: string; email: string },
): Promise<{ usuarioId: string; emailAnterior: string; emailNuevo: string } | null> {
  const email = normalizarEmail(datos.email);
  const cuenta = await usuarios.porPersona(datos.personaId, tx);
  if (cuenta) await usuarios.bloquearFila(tx, cuenta.id);

  const otra = await usuarios.porEmail(email, tx);
  if (otra && otra.personaId !== datos.personaId) throw E.emailEnUso();
  if (!cuenta || cuenta.email === email) return null;

  await cerrarSesiones(tx, cuenta.id, { email });
  await tokensRecuperacion.revocarPendientes(cuenta.id, tx);
  return { usuarioId: cuenta.id, emailAnterior: cuenta.email, emailNuevo: email };
}

/** Cierra las sesiones de la persona, por ejemplo al desactivarle un perfil (US69). false si no tiene cuenta. */
export async function cerrarSesionesDePersona(tx: Tx, personaId: string): Promise<boolean> {
  const cuenta = await usuarios.porPersona(personaId, tx);
  if (!cuenta) return false;
  await cerrarSesiones(tx, cuenta.id);
  return true;
}

/**
 * Elimina la cuenta de una persona que se va a eliminar (US69). Solo si nunca se usó: una cuenta usada tiene
 * auditoría y registros a su nombre (409 CUENTA_EN_USO). false si la persona no tenía cuenta.
 */
export async function eliminarCuentaSinUso(tx: Tx, personaId: string): Promise<boolean> {
  const cuenta = await usuarios.porPersona(personaId, tx);
  if (!cuenta) return false;
  if (cuenta.ultimoAccesoEn) throw E.cuentaEnUso();
  await usuarios.eliminar(cuenta.id, tx);
  return true;
}

const PIE_AVISO = "Si no reconoces este cambio, comunícate con la administración del colegio.";

/**
 * Avisa del cambio de correo al correo nuevo y al anterior (US69). Se llama después de confirmar la transacción:
 * si un envío falla, el cambio no se revierte y se informa cuál no salió.
 */
export async function avisarCambioDeCorreo(datos: {
  nombres: string;
  emailAnterior: string;
  emailNuevo: string;
}): Promise<{ nuevo: boolean; anterior: boolean }> {
  const nuevo = await enviarCorreo({
    para: datos.emailNuevo,
    asunto: "Kubo · Tu correo de acceso cambió",
    texto:
      `Hola, ${datos.nombres}.\n\nLa administración del colegio actualizó el correo de tu cuenta en Kubo. ` +
      `Desde ahora ingresas con: ${datos.emailNuevo}\n` +
      `Tu contraseña no cambió. Por seguridad cerramos tus sesiones abiertas: vuelve a iniciar sesión.\n\n${PIE_AVISO}`,
  });
  const anterior = await enviarCorreo({
    para: datos.emailAnterior,
    asunto: "Kubo · El correo de tu cuenta cambió",
    texto:
      `Hola, ${datos.nombres}.\n\nEl correo de tu cuenta en Kubo se cambió a ${enmascararEmail(datos.emailNuevo)}. ` +
      `Esta dirección ya no sirve para ingresar ni para recuperar la contraseña.\n\n${PIE_AVISO}`,
  });
  return { nuevo, anterior };
}
