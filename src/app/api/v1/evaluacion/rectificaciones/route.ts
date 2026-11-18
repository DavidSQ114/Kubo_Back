// GET /api/v1/evaluacion/rectificaciones · Bandeja de solicitudes de rectificación: pendientes o resueltas, paginadas
// (US41, AD-15) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { bandejaRectificaciones, esquemasEvaluacion } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const filtro = esquemasEvaluacion.BandejaRectificacionesSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  return ok(await bandejaRectificaciones(admin, filtro));
});
