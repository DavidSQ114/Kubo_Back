// POST /api/v1/horarios/tutoria/{seccionId}/registros/{registroId}/corregir · Modificar un registro de la sección en
// el bimestre en curso, sin el plazo de 24 horas, con motivo y auditoría (bloque M3) · Docente tutor o cotutor
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { corregirAsistenciaDeTutoria, esquemasHorarios } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const registroId = esquemasHorarios.IdSchema.parse(params.registroId);
  const datos = await leerCuerpo(req, esquemasHorarios.CorreccionAsistenciaSchema);
  return ok(await corregirAsistenciaDeTutoria(docente, seccionId, registroId, datos, meta));
});
