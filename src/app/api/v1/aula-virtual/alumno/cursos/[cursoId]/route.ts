// GET /api/v1/aula-virtual/alumno/cursos/{cursoId} · Aula de un curso en «Mis cursos» del alumno (US67, AL-05):
// materiales publicados agrupados por unidad activa y enlaces visibles con su estado (la URL solo si está Activo) ·
// Solo Alumno con matrícula vigente (403 SIN_MATRICULA_VIGENTE); un curso que no es de su sección, 404.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { cursoDelAlumnoEnAula, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const alumno = await requerirSesion(req, { roles: ["ALUMNO"] });
  const { cursoId } = esquemasAulaVirtual.CursoParamsSchema.parse(params);
  return ok(await cursoDelAlumnoEnAula(alumno, cursoId));
});
