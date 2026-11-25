// academico: roles de cada grupo de rutas (bloque M1, separación estricta Administrador / Coordinador académico).
// Las rutas los usan en requerirSesion; la tabla completa de endpoints está en docs/ACCESOS.md.
import type { Rol } from "@/modules/identidad";

export const ROLES_ACADEMICO = {
  /** Configura el año, bimestres, montos, reglas, grados, secciones, cursos, competencias, planes y asignaciones docentes. */
  GESTION: ["COORDINADOR"],
  /** Lecturas que ambos necesitan: años, bimestres, grados, áreas y aulas (el administrador los usa al registrar usuarios y en Espacios). */
  CONSULTA: ["COORDINADOR", "ADMINISTRADOR"],
  /** Espacios del colegio (aulas): los registra, modifica y desactiva el administrador. */
  ESPACIOS: ["ADMINISTRADOR"],
  /** Parámetros generales del sistema (bloque M1): los lista y edita el administrador. */
  PARAMETROS_SISTEMA: ["ADMINISTRADOR"],
} as const satisfies Record<string, readonly Rol[]>;
