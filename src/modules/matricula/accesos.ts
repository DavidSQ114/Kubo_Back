// matricula: roles de cada grupo de rutas (bloque M1, separación estricta Administrador / Coordinador académico).
// Las rutas los usan en requerirSesion; la tabla completa de endpoints está en docs/ACCESOS.md.
import type { Rol } from "@/modules/identidad";

export const ROLES_MATRICULA = {
  /** Matrícula, cambios, ficha, pagos, estado de cuenta, morosidad y recordatorios. */
  GESTION: ["COORDINADOR"],
} as const satisfies Record<string, readonly Rol[]>;
