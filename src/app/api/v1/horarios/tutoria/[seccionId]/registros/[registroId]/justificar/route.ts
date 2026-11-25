// POST /api/v1/horarios/tutoria/{seccionId}/registros/{registroId}/justificar · Justificar una falta o una tardanza
// de la sección con motivo y auditoría; deja de contar para los avisos por umbral (bloque M3) · Docente tutor o cotutor
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { esquemasHorarios, justificarAsistenciaDeTutoria } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const registroId = esquemasHorarios.IdSchema.parse(params.registroId);
  const datos = await leerCuerpo(req, esquemasHorarios.JustificacionAsistenciaSchema);
  return ok(await justificarAsistenciaDeTutoria(docente, seccionId, registroId, datos, meta));
});
