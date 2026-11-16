// GET /api/v1/horarios/alumno/asistencia · «Mi asistencia» del alumno en sesión: faltas y tardanzas del bimestre y
// del año, nivel de riesgo y alertas (US52, AL-04) · Solo Alumno · 403 SIN_MATRICULA_VIGENTE si no tiene una
// matrícula vigente.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { asistenciaDelAlumno } from "@/modules/horarios";

export const GET = ruta(async (req) => {
  const alumno = await requerirSesion(req, { roles: ["ALUMNO"] });
  return ok(await asistenciaDelAlumno(alumno));
});
