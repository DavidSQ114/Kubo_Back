// POST /api/v1/academico/cursos/{id}/estado · Activar o desactivar un curso (US10) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { cambiarEstadoCurso, esquemasAcademico } from "@/modules/academico";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const cursoId = esquemasAcademico.IdSchema.parse(params.id);
  const { estado } = await leerCuerpo(req, esquemasAcademico.EstadoCursoSchema);
  return ok(await cambiarEstadoCurso(admin, cursoId, estado, meta));
});
