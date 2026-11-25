// GET /api/v1/evaluacion/reportes/logro-competencias?anioId=&periodoId=&gradoId=&seccionId=&cursoId= · Reporte de
// logro de competencias: cantidad y porcentaje de AD, A, B y C por competencia y detalle por alumno, solo de registros
// cerrados o publicados (bloque M2) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, reporteLogroCompetencias, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_EVALUACION.REPORTES });
  const filtro = esquemasEvaluacion.FiltroPublicacionSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await reporteLogroCompetencias(filtro));
});
