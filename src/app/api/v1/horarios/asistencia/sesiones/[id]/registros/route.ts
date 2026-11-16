// PUT /api/v1/horarios/asistencia/sesiones/{id}/registros · Guardar la lista de asistencia de la sesión: la primera
// vez registra a todos los alumnos y después corrige dentro del plazo (US35, US36, DO-03) · Solo Docente
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, guardarAsistencia } from "@/modules/horarios";

export const PUT = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const sesionId = esquemasHorarios.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasHorarios.ListaAsistenciaSchema);
  return ok(await guardarAsistencia(docente, sesionId, datos, meta));
});
