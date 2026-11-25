// evaluacion: roles de cada grupo de rutas (bloque M1, separación estricta Administrador / Coordinador académico).
// Las rutas los usan en requerirSesion; la tabla completa de endpoints está en docs/ACCESOS.md.
import type { Rol } from "@/modules/identidad";

export const ROLES_EVALUACION = {
  /** Publicaciones, rectificaciones y bitácora de notas. */
  GESTION: ["COORDINADOR"],
  /** Reportes de notas: notas por alumno y logro de competencias (bloque M2). */
  REPORTES: ["COORDINADOR"],
  /**
   * Conducta y notas de la tutoría (bloque M3): solo docentes; cada caso de uso exige con tutoriaDelDocente que sea
   * tutor o cotutor de la sección.
   */
  TUTORIA: ["DOCENTE"],
} as const satisfies Record<string, readonly Rol[]>;
