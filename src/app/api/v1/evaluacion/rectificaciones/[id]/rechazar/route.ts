// POST /api/v1/evaluacion/rectificaciones/{id}/rechazar · Rechazar rectificación con motivo: la nota no cambia y se
// avisa al docente con el estado «Rechazada» (US41, AD-15) · Solo Coordinador académico (nunca su propia solicitud)
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, rechazarRectificacion, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_EVALUACION.GESTION });
  const id = esquemasEvaluacion.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasEvaluacion.RechazarRectificacionSchema);
  return ok(await rechazarRectificacion(coordinador, id, datos, meta));
});
