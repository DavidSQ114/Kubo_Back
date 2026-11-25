// GET /api/v1/evaluacion/tutoria/{seccionId}/alumnos/{matriculaId}/notas · Libreta completa del año de un alumno de la
// sección: todos los cursos (lo no publicado, «Sin publicar») y la conducta (bloque M3) · Docente tutor o cotutor;
// 403 ALUMNO_DE_OTRA_SECCION si la matrícula no es de su sección
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, notasDeAlumnoDeTutoria, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_EVALUACION.TUTORIA });
  const seccionId = esquemasEvaluacion.IdSchema.parse(params.seccionId);
  const matriculaId = esquemasEvaluacion.IdSchema.parse(params.matriculaId);
  return ok(await notasDeAlumnoDeTutoria(docente, seccionId, matriculaId));
});
