// POST /api/v1/notificaciones/marcar-leidas · «Marcar como leídas» (US55, criterio 2) · Todos los perfiles
// Solo marca notificaciones del usuario en sesión: un id ajeno responde 404 NOTIFICACION_NO_ENCONTRADA.
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { marcarLeidas } from "@/platform/notificaciones";
import { MarcarLeidasSchema } from "@/platform/notificaciones/schemas";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req) => {
  const auth = await requerirSesion(req);
  const { ids } = await leerCuerpo(req, MarcarLeidasSchema);
  return ok(await marcarLeidas(auth.usuarioId, ids));
});
