// GET /api/v1/evaluacion/apoderado/hijos/{id}/libreta/pdf?periodoId= · Descargar libreta (PDF) de un bimestre
// (US66, AP-04) · Solo Apoderado · 403 LIBRETA_RESTRINGIDA con deuda (US26); 422 LIBRETA_SIN_PUBLICAR sin cursos
// publicados en el bimestre.
import "@/server/wiring";
import { pdf, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, libretaPdfDelHijo } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const estudianteId = esquemasEvaluacion.IdSchema.parse(params.id);
  const { periodoId } = esquemasEvaluacion.LibretaPdfSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const r = await libretaPdfDelHijo(apoderado, estudianteId, periodoId);
  return pdf(r.bytes, r.nombreArchivo);
});
