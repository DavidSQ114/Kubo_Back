// GET /api/v1/matricula/alumno/cursos · «Mis cursos» del alumno en sesión: cursos del plan de su sección con su
// docente (US49, AL-05) · Solo Alumno · 403 SIN_MATRICULA_VIGENTE si no tiene una matrícula vigente.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { cursosDelAlumno } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  const alumno = await requerirSesion(req, { roles: ["ALUMNO"] });
  return ok(await cursosDelAlumno(alumno));
});
