// GET /api/v1/notificaciones/no-leidas · Indicador de la campana (US55, criterio 1) · Todos los perfiles
// La cabecera de cada portal lo consulta al cargar y cada 60 segundos.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { contarNoLeidas } from "@/platform/notificaciones";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const auth = await requerirSesion(req);
  return ok({ noLeidas: await contarNoLeidas(auth.usuarioId) });
});
