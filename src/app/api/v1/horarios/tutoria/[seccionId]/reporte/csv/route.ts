// GET /api/v1/horarios/tutoria/{seccionId}/reporte/csv?periodoId=&orden=&ascendente= · El reporte de faltas y
// tardanzas en CSV (bloque M3) · Docente tutor o cotutor de la sección
import "@/server/wiring";
import { csv, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { esquemasHorarios, reporteDeAsistenciaCsv } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const filtro = esquemasHorarios.ConsultaReporteTutoriaSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const archivo = await reporteDeAsistenciaCsv(docente, seccionId, filtro);
  return csv(archivo.texto, archivo.nombreArchivo);
});
