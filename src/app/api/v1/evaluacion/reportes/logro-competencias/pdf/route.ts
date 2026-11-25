// GET /api/v1/evaluacion/reportes/logro-competencias/pdf?anioId=&periodoId=&gradoId=&seccionId=&cursoId= · Reporte
// de logro de competencias en PDF: resumen por competencia y detalle por alumno de cada curso (bloque M2) · Solo
// Coordinador académico
import "@/server/wiring";
import { pdf, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, reporteLogroPdf, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_EVALUACION.REPORTES });
  const filtro = esquemasEvaluacion.FiltroPublicacionSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const archivo = await reporteLogroPdf(filtro);
  return pdf(archivo.bytes, archivo.nombreArchivo);
});
