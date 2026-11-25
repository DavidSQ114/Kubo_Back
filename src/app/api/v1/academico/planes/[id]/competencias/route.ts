// GET /api/v1/academico/planes/{id}/competencias · Competencias del curso en un grado y las de su área (US11) · Solo Coordinador académico
// PUT /api/v1/academico/planes/{id}/competencias · Reemplazar las competencias del plan (US11, RF09) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { competenciasDePlan, esquemasAcademico, guardarCompetenciasPlan, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  return ok(await competenciasDePlan(esquemasAcademico.IdSchema.parse(params.id)));
});

export const PUT = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const planId = esquemasAcademico.IdSchema.parse(params.id);
  const { competencias } = await leerCuerpo(req, esquemasAcademico.CompetenciasPlanSchema);
  return ok(await guardarCompetenciasPlan(coordinador, planId, competencias, meta));
});
