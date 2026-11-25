// PUT /api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/competencias/{competenciaPlanId}/items ·
// Guardar los ítems de evaluación de una competencia (crear, editar, reordenar y eliminar), con confirmación si se
// borran calificaciones o se quitan notas, y recalcular sus notas (bloque M2, DO-04) · Solo Docente (solo sus cursos)
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, guardarItems } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const PUT = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const ids = esquemasEvaluacion.ItemsParamsSchema.parse(params);
  const datos = await leerCuerpo(req, esquemasEvaluacion.GuardarItemsSchema);
  return ok(await guardarItems(docente, ids, datos, meta));
});
