// GET  /api/v1/academico/competencias · Catálogo oficial: áreas con sus competencias, descripción y uso (US56, AD-04)
//      · Solo Coordinador académico
// POST /api/v1/academico/competencias · Registrar una competencia nueva en su área (US56, criterio 1) · Solo
//      Administrador · 409 COMPETENCIA_CODIGO_EN_USO si el código ya existe
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { catalogoDeCompetencias, esquemasAcademico, registrarCompetencia, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  return ok(await catalogoDeCompetencias());
});

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const datos = await leerCuerpo(req, esquemasAcademico.CompetenciaSchema);
  return ok(await registrarCompetencia(coordinador, datos, meta), 201);
});
