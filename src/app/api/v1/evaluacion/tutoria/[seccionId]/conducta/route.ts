// GET /api/v1/evaluacion/tutoria/{seccionId}/conducta?periodoId= · Nota de conducta de los alumnos de la sección en un
// bimestre (por defecto, el actual) (bloque M3) · Docente tutor o cotutor de la sección (403 NO_ES_TUTOR)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { conductaDeLaSeccion, esquemasEvaluacion, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_EVALUACION.TUTORIA });
  const seccionId = esquemasEvaluacion.IdSchema.parse(params.seccionId);
  const filtro = esquemasEvaluacion.ConsultaTutoriaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await conductaDeLaSeccion(docente, seccionId, filtro));
});
