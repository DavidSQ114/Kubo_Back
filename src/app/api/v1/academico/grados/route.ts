// GET /api/v1/academico/grados · Grados activos (1° a 5° de secundaria) (US08, AD-03) · Coordinador académico y Administrador (lectura)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { listarGrados, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.CONSULTA });
  return ok(await listarGrados());
});
