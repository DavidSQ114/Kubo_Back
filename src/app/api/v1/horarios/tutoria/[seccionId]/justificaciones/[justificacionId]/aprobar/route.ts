// POST /api/v1/horarios/tutoria/{seccionId}/justificaciones/{justificacionId}/aprobar · Aprobar la justificación: el
// registro queda justificado y el apoderado recibe la notificación (bloque M3) · Docente tutor o cotutor de la sección
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { aprobarJustificacion, esquemasHorarios } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const id = esquemasHorarios.IdSchema.parse(params.justificacionId);
  return ok(await aprobarJustificacion(docente, seccionId, id, meta));
});
