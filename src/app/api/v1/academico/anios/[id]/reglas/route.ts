// GET  /api/v1/academico/anios/{id}/reglas · Regla vigente, historial y bimestres del año (US12, AD-05) · Solo Coordinador académico
// POST /api/v1/academico/anios/{id}/reglas · Guardar una nueva versión de la regla (US12, RF10) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, guardarRegla, reglasDelAnio, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  return ok(await reglasDelAnio(esquemasAcademico.IdSchema.parse(params.id)));
});

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const anioId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.ReglaSchema);
  return ok(await guardarRegla(coordinador, anioId, datos, meta), 201);
});
