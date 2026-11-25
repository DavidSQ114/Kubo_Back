// GET /api/v1/horarios/tutoria/{seccionId}/reporte?periodoId=&orden=&ascendente= · Reporte de faltas y
// tardanzas por alumno del bimestre, ordenable y con totales (bloque M3) · Docente tutor o cotutor de la sección
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { esquemasHorarios, reporteDeAsistencia } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const filtro = esquemasHorarios.ConsultaReporteTutoriaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await reporteDeAsistencia(docente, seccionId, filtro));
});
