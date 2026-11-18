// POST /api/v1/evaluacion/rectificaciones/{id}/aprobar · Aprobar rectificación: cambia la nota, recalcula el
// consolidado con la regla usada al cerrar, registra la bitácora de notas y la auditoría y avisa al docente
// (US41, US03, AD-15) · Solo Administrador (nunca su propia solicitud)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { aprobarRectificacion, esquemasEvaluacion } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasEvaluacion.IdSchema.parse(params.id);
  return ok(await aprobarRectificacion(admin, id, meta));
});
