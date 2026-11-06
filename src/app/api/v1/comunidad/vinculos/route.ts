// POST /api/v1/comunidad/vinculos · Vincular un apoderado con un estudiante (US15 «Vincular a un estudiante», US17) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasComunidad, vincularApoderado } from "@/modules/comunidad";

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasComunidad.VincularSchema);
  return ok(await vincularApoderado(admin, datos, meta), 201);
});
