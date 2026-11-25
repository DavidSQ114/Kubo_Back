// GET /api/v1/evaluacion/reportes/logro-competencias/csv?anioId=&periodoId=&gradoId=&seccionId=&cursoId= · Reporte
// de logro de competencias en CSV: una fila por alumno y competencia (bloque M2) · Solo Coordinador académico
import "@/server/wiring";
import { csv, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, reporteLogroCsv, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_EVALUACION.REPORTES });
  const filtro = esquemasEvaluacion.FiltroPublicacionSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const archivo = await reporteLogroCsv(filtro);
  return csv(archivo.texto, archivo.nombreArchivo);
});
