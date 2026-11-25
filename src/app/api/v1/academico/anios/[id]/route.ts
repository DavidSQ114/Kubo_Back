// GET   /api/v1/academico/anios/{id} · Detalle del año con sus bimestres (US06, AD-02) · Coordinador académico y Administrador (lectura)
// PATCH  /api/v1/academico/anios/{id} · Corregir número o fechas de un año no cerrado (US06) · Solo Coordinador académico
// DELETE /api/v1/academico/anios/{id} · Eliminar un año Planificado sin registros (US06, AD-02) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { editarAnio, eliminarAnio, esquemasAcademico, obtenerAnio, ROLES_ACADEMICO } from "@/modules/academico";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_ACADEMICO.CONSULTA });
  return ok(await obtenerAnio(esquemasAcademico.IdSchema.parse(params.id)));
});

export const PATCH = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const anioId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.EditarAnioSchema);
  return ok(await editarAnio(coordinador, anioId, datos, meta));
});

export const DELETE = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  return ok(await eliminarAnio(coordinador, esquemasAcademico.IdSchema.parse(params.id), meta));
});
