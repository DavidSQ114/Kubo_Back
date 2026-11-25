// identidad: interfaz pública. Otros módulos y las rutas importan SOLO desde aquí.
import type { NextRequest } from "next/server";
import { leerTokenAcceso } from "@/platform/auth/cookies";
import { autenticar, type Autenticado } from "./application/sesion";
import type { Rol } from "./domain/reglas";

export { ROLES, esRol, estaBloqueada, type Rol, type EstadoUsuario } from "./domain/reglas";
export { configurarPerfilesProvider, type PerfilesProvider, type DatosPersona } from "./puertos";
export {
  iniciarSesion,
  seleccionarPerfil,
  cambiarPerfil,
  renovarSesion,
  cerrarSesion,
  obtenerSesion,
  type Autenticado,
  type ResumenSesion,
  type ResultadoLogin,
  type TokensSesion,
} from "./application/sesion";
export { cambiarPassword, solicitarRecuperacion, validarEnlace, restablecerPassword } from "./application/password";
export {
  suspenderUsuario,
  reactivarUsuario,
  desbloquearUsuario,
  asegurarCuenta,
  enviarBienvenida,
} from "./application/cuentas";
export {
  cuentaDePersona,
  usuariosDePersonas,
  cambiarCorreoDeCuenta,
  cerrarSesionesDePersona,
  eliminarCuentaSinUso,
  avisarCambioDeCorreo,
  type CuentaDePersona,
} from "./application/cuentasDePersonas";
export {
  listarErroresSistema,
  detalleErrorSistema,
  listarAuditoria,
  type FiltroErroresSistema,
  type FiltroAuditoria,
} from "./application/erroresSistema";
export * as esquemasIdentidad from "./schemas";

/**
 * Guardia para cada ruta protegida (RF04, RNF01): exige sesión válida y, si se indica, uno de los roles.
 * Ejemplo: const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
 */
export function requerirSesion(
  req: NextRequest,
  opciones: { roles?: readonly Rol[]; permitirCambioPendiente?: boolean } = {},
): Promise<Autenticado> {
  return autenticar(leerTokenAcceso(req), opciones);
}
export { ROLES_IDENTIDAD } from "./accesos";
