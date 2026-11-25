// PATCH  /api/v1/academico/cursos/{id} · Editar curso: código, nombre, descripción, área (US10) · Solo Coordinador académico
// DELETE /api/v1/academico/cursos/{id} · Eliminar curso sin docentes ni horarios publicados (US10) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { editarCurso, eliminarCurso, esquemasAcademico, ROLES_ACADEMICO } from "@/modules/academico";

export const PATCH = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const cursoId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.EditarCursoSchema);
  return ok(await editarCurso(coordinador, cursoId, datos, meta));
});

export const DELETE = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  return ok(await eliminarCurso(coordinador, esquemasAcademico.IdSchema.parse(params.id), meta));
});
