// GET /api/v1/evaluacion/tutoria/{seccionId}/consolidado?periodoId= · Consolidado del bimestre: alumnos por cursos con
// el logro consolidado y la conducta, y el resumen de AD, A, B y C por curso (bloque M3) · Docente tutor o cotutor
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { consolidadoDeLaSeccion, esquemasEvaluacion, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_EVALUACION.TUTORIA });
  const seccionId = esquemasEvaluacion.IdSchema.parse(params.seccionId);
  const filtro = esquemasEvaluacion.ConsultaTutoriaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await consolidadoDeLaSeccion(docente, seccionId, filtro));
});
