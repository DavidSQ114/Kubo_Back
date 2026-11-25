// GET /api/v1/academico/parametros · Parámetros generales del sistema con su descripción y tipo (bloque M1)
// · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { listarParametrosSistema, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.PARAMETROS_SISTEMA });
  return ok(await listarParametrosSistema());
});
