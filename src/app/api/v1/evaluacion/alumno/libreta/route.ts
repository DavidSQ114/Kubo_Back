// GET /api/v1/evaluacion/alumno/libreta · «Mis notas» del alumno en sesión: solo registros PUBLICADOS, todos los
// bimestres del año para el filtro (US51, AL-03) · Solo Alumno · 403 SIN_MATRICULA_VIGENTE sin matrícula vigente.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { libretaDelAlumno } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const alumno = await requerirSesion(req, { roles: ["ALUMNO"] });
  return ok(await libretaDelAlumno(alumno));
});
