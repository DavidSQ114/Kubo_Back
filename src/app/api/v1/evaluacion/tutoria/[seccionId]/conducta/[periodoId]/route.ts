// PUT /api/v1/evaluacion/tutoria/{seccionId}/conducta/{periodoId} · Registrar o modificar la nota de conducta de
// alumnos de la sección en un bimestre que no esté FINALIZADO, con auditoría (bloque M3) · Docente tutor o cotutor
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, guardarConducta, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const PUT = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_EVALUACION.TUTORIA });
  const seccionId = esquemasEvaluacion.IdSchema.parse(params.seccionId);
  const periodoId = esquemasEvaluacion.IdSchema.parse(params.periodoId);
  const datos = await leerCuerpo(req, esquemasEvaluacion.GuardarConductaSchema);
  return ok(await guardarConducta(docente, seccionId, periodoId, datos, meta));
});
