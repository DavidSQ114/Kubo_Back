// GET /api/v1/notificaciones · Panel de notificaciones de la campana (US55, M-11 a M-14) · Todos los perfiles
// Solo las del usuario en sesión: últimos 30 días, las más recientes primero, con la cantidad de no leídas.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { notificacionesDe } from "@/platform/notificaciones";
import { ListadoSchema } from "@/platform/notificaciones/schemas";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const auth = await requerirSesion(req);
  const { estado } = ListadoSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await notificacionesDe(auth.usuarioId, { soloNoLeidas: estado === "no-leidas" }));
});
