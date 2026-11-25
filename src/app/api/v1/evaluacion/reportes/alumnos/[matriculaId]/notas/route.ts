// GET /api/v1/evaluacion/reportes/alumnos/{matriculaId}/notas · Notas por alumno: su libreta completa del año, con
// todos los cursos y bimestres; lo no publicado sale marcado «Sin publicar» (bloque M2) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, notasDelAlumno, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_EVALUACION.REPORTES });
  return ok(await notasDelAlumno(esquemasEvaluacion.IdSchema.parse(params.matriculaId)));
});
