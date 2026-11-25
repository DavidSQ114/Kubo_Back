// GET /api/v1/academico/areas · Áreas curriculares con sus competencias del CNEB (US10, US11, AD-04) · Coordinador académico y Administrador (lectura)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { listarAreas, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.CONSULTA });
  return ok(await listarAreas());
});
