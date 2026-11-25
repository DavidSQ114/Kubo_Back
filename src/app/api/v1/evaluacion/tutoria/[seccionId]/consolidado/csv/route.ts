// GET /api/v1/evaluacion/tutoria/{seccionId}/consolidado/csv?periodoId= · El consolidado del bimestre en CSV
// (bloque M3) · Docente tutor o cotutor de la sección
import "@/server/wiring";
import { csv, ruta } from "@/platform/http/ruta";
import { consolidadoDeLaSeccionCsv, esquemasEvaluacion, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_EVALUACION.TUTORIA });
  const seccionId = esquemasEvaluacion.IdSchema.parse(params.seccionId);
  const filtro = esquemasEvaluacion.ConsultaTutoriaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const archivo = await consolidadoDeLaSeccionCsv(docente, seccionId, filtro);
  return csv(archivo.texto, archivo.nombreArchivo);
});
