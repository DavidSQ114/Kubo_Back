// GET /api/v1/horarios/tutoria/{seccionId}/justificaciones · Justificaciones de los apoderados de la sección: las
// pendientes y las revisadas en los últimos 30 días (bloque M3) · Docente tutor o cotutor de la sección
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { esquemasHorarios, justificacionesDeTutoria } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  return ok(await justificacionesDeTutoria(docente, seccionId));
});
