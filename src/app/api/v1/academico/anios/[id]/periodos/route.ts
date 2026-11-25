// GET /api/v1/academico/anios/{id}/periodos · Bimestres del año (US07, AD-02) · Coordinador académico y Administrador (lectura)
// PUT /api/v1/academico/anios/{id}/periodos · Guardar los 4 bimestres juntos (US07) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, guardarPeriodos, listarPeriodos, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.CONSULTA });
  return ok(await listarPeriodos(esquemasAcademico.IdSchema.parse(params.id)));
});

export const PUT = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const anioId = esquemasAcademico.IdSchema.parse(params.id);
  const { periodos } = await leerCuerpo(req, esquemasAcademico.PeriodosSchema);
  return ok(await guardarPeriodos(coordinador, anioId, periodos, meta));
});
