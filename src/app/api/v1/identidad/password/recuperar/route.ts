// POST /api/v1/identidad/password/recuperar · Enviar enlace de recuperación (RF02, AC-04)
import "@/server/wiring";
import { ok, leerCuerpo, ruta, urlBase } from "@/platform/http/ruta";
import { esquemasIdentidad, solicitarRecuperacion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta }) => {
  const { email } = await leerCuerpo(req, esquemasIdentidad.RecuperacionSchema);
  await solicitarRecuperacion(email, urlBase(req), meta);
  return ok({ mensaje: "Si el correo existe, recibirás un enlace para restablecer tu contraseña." });
});
