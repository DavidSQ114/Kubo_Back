// POST /api/v1/identidad/logout · Cerrar sesión (siempre responde 200 y borra las cookies)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { borrarCookiesSesion, leerRefresh, leerTokenAcceso } from "@/platform/auth/cookies";
import { cerrarSesion } from "@/modules/identidad";

export const POST = ruta(async (req) => {
  await cerrarSesion({ tokenAcceso: leerTokenAcceso(req), refresh: leerRefresh(req) });
  const res = ok({ sesionCerrada: true });
  borrarCookiesSesion(res);
  return res;
});
