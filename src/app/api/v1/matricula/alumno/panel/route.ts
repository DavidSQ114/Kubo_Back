// GET /api/v1/matricula/alumno/panel · Panel del alumno en sesión: nombre, año, grado y sección (US49, AL-01)
// · Solo Alumno · 403 SIN_MATRICULA_VIGENTE si no tiene una matrícula vigente.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { panelDelAlumno } from "@/modules/matricula";

export const GET = ruta(async (req) => {
  const alumno = await requerirSesion(req, { roles: ["ALUMNO"] });
  return ok(await panelDelAlumno(alumno));
});
