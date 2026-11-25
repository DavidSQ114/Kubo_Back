// PUT /api/v1/horarios/tutoria/{seccionId}/sesiones/{sesionId}/registros · El tutor guarda la lista de una clase de su
// sección: registra a quien falte y, con motivo y auditoría, modifica lo ya guardado (bloque M3) · Docente tutor o
// cotutor de la sección
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { ROLES_ACADEMICO } from "@/modules/academico";
import { esquemasHorarios, guardarAsistenciaDeTutoria } from "@/modules/horarios";
import { requerirSesion } from "@/modules/identidad";

export const PUT = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ROLES_ACADEMICO.TUTORIA });
  const seccionId = esquemasHorarios.IdSchema.parse(params.seccionId);
  const sesionId = esquemasHorarios.IdSchema.parse(params.sesionId);
  const datos = await leerCuerpo(req, esquemasHorarios.ListaAsistenciaTutoriaSchema);
  return ok(await guardarAsistenciaDeTutoria(docente, seccionId, sesionId, datos, meta));
});
