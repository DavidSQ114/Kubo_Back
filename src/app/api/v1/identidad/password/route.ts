// PUT /api/v1/identidad/password · Cambiar contraseña (RF43, AC-09). Permitido aunque el cambio sea obligatorio.
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { escribirCookiesSesion } from "@/platform/auth/cookies";
import { cambiarPassword, esquemasIdentidad, requerirSesion } from "@/modules/identidad";

export const PUT = ruta(async (req, { meta }) => {
  const auth = await requerirSesion(req, { permitirCambioPendiente: true });
  const datos = await leerCuerpo(req, esquemasIdentidad.CambioPasswordSchema);
  const { acceso } = await cambiarPassword(auth, datos, meta);
  const res = ok({ mensaje: "Tu contraseña fue actualizada. Se cerraron tus otras sesiones." });
  escribirCookiesSesion(res, { acceso });
  return res;
});
