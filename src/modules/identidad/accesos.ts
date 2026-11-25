// identidad: roles de cada grupo de rutas (bloque M1, separación estricta Administrador / Coordinador académico).
// Las rutas los usan en requerirSesion; la tabla completa de endpoints está en docs/ACCESOS.md.
import type { Rol } from "./domain/reglas";

export const ROLES_IDENTIDAD = {
  /** Cuentas de usuario: suspender, reactivar y desbloquear. */
  CUENTAS: ["ADMINISTRADOR"],
  /** Bitácora de operaciones críticas y log de errores (AD-16): solo lectura del administrador. */
  AUDITORIA: ["ADMINISTRADOR"],
} as const satisfies Record<string, readonly Rol[]>;
