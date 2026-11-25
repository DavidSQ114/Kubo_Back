// GET /api/v1/evaluacion/tutoria/{seccionId}/alumnos · Alumnos de la sección para ver sus notas (bloque M3) · Docente
// tutor o cotutor de la sección (403 NO_ES_TUTOR)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { alumnosParaNotasDeTutoria, esquemasEvaluacion, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_EVALUACION.TUTORIA });
  const seccionId = esquemasEvaluacion.IdSchema.parse(params.seccionId);
  return ok(await alumnosParaNotasDeTutoria(docente, seccionId));
});
