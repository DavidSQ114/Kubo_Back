// GET /api/v1/evaluacion/publicaciones/{cierreId} · Registro cerrado o publicado en solo lectura, con las notas por
// competencia y el consolidado de cada alumno, para revisarlo antes de publicar (US39, AD-15) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, registroDeCierre, ROLES_EVALUACION } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_EVALUACION.GESTION });
  return ok(await registroDeCierre(esquemasEvaluacion.IdSchema.parse(params.cierreId)));
});
