// GET /api/v1/academico/planes/{id}/competencias · Competencias del curso en un grado y las de su área (US11) · Solo Administrador
// PUT /api/v1/academico/planes/{id}/competencias · Reemplazar las competencias del plan (US11, RF09) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { competenciasDePlan, esquemasAcademico, guardarCompetenciasPlan } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await competenciasDePlan(esquemasAcademico.IdSchema.parse(params.id)));
});

export const PUT = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const planId = esquemasAcademico.IdSchema.parse(params.id);
  const { competencias } = await leerCuerpo(req, esquemasAcademico.CompetenciasPlanSchema);
  return ok(await guardarCompetenciasPlan(admin, planId, competencias, meta));
});
