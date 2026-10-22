// GET /api/v1/academico/grados · Grados activos (1° a 5° de secundaria) (US08, AD-03) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { listarGrados } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await listarGrados());
});
