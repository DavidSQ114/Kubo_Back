// GET /api/v1/evaluacion/rectificaciones · Bandeja de solicitudes de rectificación: pendientes o resueltas, paginadas
// (US41, AD-15) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { bandejaRectificaciones, esquemasEvaluacion, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_EVALUACION.GESTION });
  const filtro = esquemasEvaluacion.BandejaRectificacionesSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  return ok(await bandejaRectificaciones(coordinador, filtro));
});
