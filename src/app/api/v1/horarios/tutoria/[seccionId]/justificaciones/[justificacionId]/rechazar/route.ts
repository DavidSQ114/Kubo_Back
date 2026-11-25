// POST /api/v1/horarios/tutoria/{seccionId}/justificaciones/{justificacionId}/rechazar · Rechazar la justificación
// con motivo; el apoderado recibe la notificación (bloque M3) · Docente tutor o cotutor de la sección
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { esquemasHorarios, rechazarJustificacion } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const id = esquemasHorarios.IdSchema.parse(params.justificacionId);
  const datos = await leerCuerpo(req, esquemasHorarios.RechazoJustificacionSchema);
  return ok(await rechazarJustificacion(docente, seccionId, id, datos, meta));
});
