// GET /api/v1/identidad/sesion · Datos del usuario y perfil activo (barra superior, guardas del frontend)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { obtenerSesion, requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const auth = await requerirSesion(req, { permitirCambioPendiente: true });
  return ok(await obtenerSesion(auth));
});
