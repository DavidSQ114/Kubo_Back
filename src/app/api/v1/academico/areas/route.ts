// GET /api/v1/academico/areas · Áreas curriculares con sus competencias del CNEB (US10, US11, AD-04) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { listarAreas } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await listarAreas());
});
