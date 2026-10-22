// academico/domain: reglas puras de la asignación de cursos a docentes (US14, RF11).
// Una asignación es plan de estudio (curso + grado + año) + sección + docente. Un solo docente activo por curso y
// sección: lo garantiza además el índice uq_asignacion_activa.
import { erroresAcademico as E } from "./errores";
import type { EstadoCurso } from "./cursos";
import type { EstadoSeccion } from "./secciones";
import type { EstadoAnio } from "./tipos";

export interface CandidatoAsignacion {
  anioEstado: EstadoAnio;
  docenteActivo: boolean;
  seccion: { estado: EstadoSeccion; gradoId: string; anioAcademicoId: string };
  cursoEstado: EstadoCurso;
  /** Plan del curso para el grado y año de la sección; null si el curso no se dicta en ese grado ese año. */
  plan: { gradoId: string; anioAcademicoId: string } | null;
}

/** Año abierto, docente, sección y curso activos, y el curso dictado en el grado y año de la sección. */
export function verificarAsignable(c: CandidatoAsignacion) {
  if (c.anioEstado === "CERRADO") throw E.anioCerrado();
  if (!c.docenteActivo) throw E.docenteInactivo();
  if (c.seccion.estado !== "ACTIVA") throw E.seccionInactivaParaAsignar();
  if (c.cursoEstado !== "ACTIVO") throw E.cursoInactivo();
  const corresponde =
    c.plan !== null && c.plan.gradoId === c.seccion.gradoId && c.plan.anioAcademicoId === c.seccion.anioAcademicoId;
  if (!corresponde) throw E.cursoNoCorresponde();
}

/** Con la asignación activa del curso en la sección (si hay): el mismo docente la repite; otro docente choca. */
export function verificarConflicto(activa: { docenteId: string } | null, docenteId: string) {
  if (!activa) return;
  if (activa.docenteId === docenteId) throw E.asignacionDuplicada();
  throw E.cursoConDocente();
}

export type ModoQuitar = "DESACTIVAR" | "ELIMINAR";

/** Con notas u horarios la asignación se desactiva para conservar su historia; sin ellos, se elimina. */
export function modoQuitar(registros: { notas: number; bloquesHorario: number }): ModoQuitar {
  return registros.notas > 0 || registros.bloquesHorario > 0 ? "DESACTIVAR" : "ELIMINAR";
}
