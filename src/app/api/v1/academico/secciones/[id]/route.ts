// PATCH  /api/v1/academico/secciones/{id} · Editar sección: grado, nombre, aforo, aula, tutor (US08) · Solo Coordinador académico
// DELETE /api/v1/academico/secciones/{id} · Eliminar sección sin matrículas (US08) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { editarSeccion, eliminarSeccion, esquemasAcademico, ROLES_ACADEMICO } from "@/modules/academico";

export const PATCH = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const seccionId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.EditarSeccionSchema);
  return ok(await editarSeccion(coordinador, seccionId, datos, meta));
});

export const DELETE = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  return ok(await eliminarSeccion(coordinador, esquemasAcademico.IdSchema.parse(params.id), meta));
});
