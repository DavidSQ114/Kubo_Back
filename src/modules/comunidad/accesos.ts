// comunidad: roles de cada grupo de rutas (bloque M1, separación estricta Administrador / Coordinador académico).
// Las rutas los usan en requerirSesion; la tabla completa de endpoints está en docs/ACCESOS.md.
import type { Rol } from "@/modules/identidad";

export const ROLES_COMUNIDAD = {
  /** Usuarios de todos los roles: listado, docentes, administradores, coordinadores y baja de personas. */
  USUARIOS: ["ADMINISTRADOR"],
  /** Registro y edición de alumnos y apoderados y sus vínculos (el coordinador, desde la matrícula). */
  ALUMNOS_Y_APODERADOS: ["ADMINISTRADOR", "COORDINADOR"],
  /** Lecturas que ambos necesitan: personas, su historial y vínculos, y la lista de docentes. */
  CONSULTA: ["ADMINISTRADOR", "COORDINADOR"],
  /** «Mi perfil» (bloque M1): todos los perfiles leen y cambian sus propios datos. */
  MI_PERFIL: ["ADMINISTRADOR", "COORDINADOR", "DOCENTE", "APODERADO", "ALUMNO"],
} as const satisfies Record<string, readonly Rol[]>;
