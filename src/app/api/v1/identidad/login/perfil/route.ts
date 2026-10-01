// POST /api/v1/identidad/login/perfil · Elegir perfil después del login (RF01, AC-08)
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { escribirCookiesSesion } from "@/platform/auth/cookies";
import { esquemasIdentidad, seleccionarPerfil } from "@/modules/identidad";

export const POST = ruta(async (req, { meta }) => {
  const datos = await leerCuerpo(req, esquemasIdentidad.SeleccionPerfilSchema);
  const r = await seleccionarPerfil(datos, meta);
  const res = ok({ tipo: "SESION", sesion: r.sesion });
  escribirCookiesSesion(res, r.tokens);
  return res;
});
