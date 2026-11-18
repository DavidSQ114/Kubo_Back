// POST /api/v1/evaluacion/rectificaciones/{id}/rechazar · Rechazar rectificación con motivo: la nota no cambia y se
// avisa al docente con el estado «Rechazada» (US41, AD-15) · Solo Administrador (nunca su propia solicitud)
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, rechazarRectificacion } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasEvaluacion.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasEvaluacion.RechazarRectificacionSchema);
  return ok(await rechazarRectificacion(admin, id, datos, meta));
});
