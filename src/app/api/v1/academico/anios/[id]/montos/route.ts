// GET /api/v1/academico/anios/{id}/montos · Montos de matrícula y pensión del año (US21, AD-10) · Solo Administrador
// PUT /api/v1/academico/anios/{id}/montos · Guardar los montos del año (US21, AD-10) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasAcademico, guardarMontos, montosDelAnio } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await montosDelAnio(esquemasAcademico.IdSchema.parse(params.id)));
});

export const PUT = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.MontosSchema);
  return ok(await guardarMontos(admin, id, datos, meta));
});
