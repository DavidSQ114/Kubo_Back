// GET   /api/v1/academico/anios/{id} · Detalle del año con sus bimestres (US06, AD-02) · Solo Administrador
// PATCH /api/v1/academico/anios/{id} · Corregir número o fechas de un año no cerrado (US06) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { editarAnio, esquemasAcademico, obtenerAnio } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await obtenerAnio(esquemasAcademico.IdSchema.parse(params.id)));
});

export const PATCH = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const anioId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.EditarAnioSchema);
  return ok(await editarAnio(admin, anioId, datos, meta));
});
