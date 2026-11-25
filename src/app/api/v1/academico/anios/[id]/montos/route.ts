// GET /api/v1/academico/anios/{id}/montos · Montos de matrícula y pensión del año (US21, AD-10) · Solo Coordinador académico
// PUT /api/v1/academico/anios/{id}/montos · Guardar los montos del año (US21, AD-10) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, guardarMontos, montosDelAnio, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  return ok(await montosDelAnio(esquemasAcademico.IdSchema.parse(params.id)));
});

export const PUT = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const id = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.MontosSchema);
  return ok(await guardarMontos(coordinador, id, datos, meta));
});
