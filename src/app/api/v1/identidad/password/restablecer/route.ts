// GET  /api/v1/identidad/password/restablecer?token=… · ¿El enlace sigue vigente? (AC-06)
// POST /api/v1/identidad/password/restablecer          · Guardar la nueva contraseña (RF02)
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { esquemasIdentidad, restablecerPassword, validarEnlace } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return ok(await validarEnlace(token));
});

export const POST = ruta(async (req, { meta }) => {
  const datos = await leerCuerpo(req, esquemasIdentidad.RestablecerSchema);
  await restablecerPassword(datos, meta);
  return ok({ mensaje: "Tu contraseña fue actualizada. Ya puedes iniciar sesión." });
});
