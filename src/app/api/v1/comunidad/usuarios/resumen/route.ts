// GET /api/v1/comunidad/usuarios/resumen · Contadores de las pestañas y tarjetas de AD-06 · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { resumenUsuarios } from "@/modules/comunidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await resumenUsuarios());
});
