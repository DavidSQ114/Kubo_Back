// horarios: roles de cada grupo de rutas (bloque M1, separación estricta Administrador / Coordinador académico).
// Las rutas los usan en requerirSesion; la tabla completa de endpoints está en docs/ACCESOS.md.
import type { Rol } from "@/modules/identidad";

export const ROLES_HORARIOS = {
  /** Horarios de las secciones y corrección de la asistencia de alumnos. */
  GESTION: ["COORDINADOR"],
  /** Sesiones de clase: el docente ve las suyas y el coordinador, todas. */
  ASISTENCIA_ALUMNOS: ["DOCENTE", "COORDINADOR"],
  /** Asistencia del personal docente (US32). */
  ASISTENCIA_DOCENTE: ["ADMINISTRADOR"],
} as const satisfies Record<string, readonly Rol[]>;
