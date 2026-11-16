// GET /api/v1/horarios/alumno/horario · «Mi horario» del alumno en sesión: horario publicado de su sección, con
// curso, aula y docente (US50, AL-02) · Solo Alumno · 403 SIN_MATRICULA_VIGENTE si no tiene una matrícula vigente.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { horarioDelAlumno } from "@/modules/horarios";

export const GET = ruta(async (req) => {
  const alumno = await requerirSesion(req, { roles: ["ALUMNO"] });
  return ok(await horarioDelAlumno(alumno));
});
