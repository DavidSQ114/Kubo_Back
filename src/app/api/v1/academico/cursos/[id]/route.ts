// PATCH  /api/v1/academico/cursos/{id} · Editar curso: código, nombre, descripción, área (US10) · Solo Administrador
// DELETE /api/v1/academico/cursos/{id} · Eliminar curso sin docentes ni horarios publicados (US10) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { editarCurso, eliminarCurso, esquemasAcademico } from "@/modules/academico";

export const PATCH = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const cursoId = esquemasAcademico.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAcademico.EditarCursoSchema);
  return ok(await editarCurso(admin, cursoId, datos, meta));
});

export const DELETE = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await eliminarCurso(admin, esquemasAcademico.IdSchema.parse(params.id), meta));
});
