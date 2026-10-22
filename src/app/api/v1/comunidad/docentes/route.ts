// GET /api/v1/comunidad/docentes · Docentes activos para elegir tutor de sección (US08, AD-03) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { listarDocentesActivos } from "@/modules/comunidad";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await listarDocentesActivos());
});
