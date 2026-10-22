// GET /api/v1/academico/anios/{id}/periodos · Bimestres del año (US07, AD-02) · Solo Administrador
// PUT /api/v1/academico/anios/{id}/periodos · Guardar los 4 bimestres juntos (US07) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, guardarPeriodos, listarPeriodos } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await listarPeriodos(esquemasAcademico.IdSchema.parse(params.id)));
});

export const PUT = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const anioId = esquemasAcademico.IdSchema.parse(params.id);
  const { periodos } = await leerCuerpo(req, esquemasAcademico.PeriodosSchema);
  return ok(await guardarPeriodos(admin, anioId, periodos, meta));
});
