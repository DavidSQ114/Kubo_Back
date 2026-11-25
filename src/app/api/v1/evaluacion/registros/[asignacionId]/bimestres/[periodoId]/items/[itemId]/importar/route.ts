// POST /api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/items/{itemId}/importar · Importar las
// calificaciones de un ítem desde un CSV «dni,calificativo»: sin confirmar valida y muestra las filas rechazadas con su
// motivo; con confirmar guarda las válidas y recalcula (bloque M2, COULD) · Solo Docente (solo sus cursos)
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, importarCalificacionesItem } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const ids = esquemasEvaluacion.ImportarItemParamsSchema.parse(params);
  const datos = await leerCuerpo(req, esquemasEvaluacion.ImportarCalificacionesSchema);
  return ok(await importarCalificacionesItem(docente, ids, datos));
});
