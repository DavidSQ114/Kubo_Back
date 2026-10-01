// POST /api/v1/identidad/login · Iniciar sesión (RF01, AC-01/02/03)
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { escribirCookiesSesion } from "@/platform/auth/cookies";
import { esquemasIdentidad, iniciarSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta }) => {
  const datos = await leerCuerpo(req, esquemasIdentidad.LoginSchema);
  const r = await iniciarSesion(datos, meta);
  if (r.tipo === "SELECCION") {
    // Tiene más de un perfil: el frontend muestra la elección y llama a /login/perfil.
    return ok({ tipo: r.tipo, tokenSeleccion: r.tokenSeleccion, perfiles: r.perfiles, nombres: r.nombres });
  }
  const res = ok({ tipo: r.tipo, sesion: r.sesion });
  escribirCookiesSesion(res, r.tokens);
  return res;
});
