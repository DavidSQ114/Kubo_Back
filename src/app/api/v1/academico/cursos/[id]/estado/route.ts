// POST /api/v1/academico/cursos/{id}/estado · Activar o desactivar un curso (US10) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { cambiarEstadoCurso, esquemasAcademico, ROLES_ACADEMICO } from "@/modules/academico";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_ACADEMICO.GESTION });
  const cursoId = esquemasAcademico.IdSchema.parse(params.id);
  const { estado } = await leerCuerpo(req, esquemasAcademico.EstadoCursoSchema);
  return ok(await cambiarEstadoCurso(coordinador, cursoId, estado, meta));
});
