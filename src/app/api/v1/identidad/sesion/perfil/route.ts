// PUT /api/v1/identidad/sesion/perfil · Cambiar de perfil sin cerrar sesión (RF01)
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { escribirCookiesSesion } from "@/platform/auth/cookies";
import { cambiarPerfil, esquemasIdentidad, requerirSesion } from "@/modules/identidad";

export const PUT = ruta(async (req) => {
  const auth = await requerirSesion(req);
  const { rol } = await leerCuerpo(req, esquemasIdentidad.CambioPerfilSchema);
  const r = await cambiarPerfil(auth, rol);
  const res = ok({ sesion: r.sesion });
  escribirCookiesSesion(res, { acceso: r.acceso });
  return res;
});
