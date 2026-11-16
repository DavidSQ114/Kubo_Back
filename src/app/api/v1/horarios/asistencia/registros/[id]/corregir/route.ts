// POST /api/v1/horarios/asistencia/registros/{id}/corregir · Corregir un registro de asistencia fuera del plazo del
// docente, con motivo obligatorio y auditoría (US36, M-20) · Solo Administrador
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { corregirAsistencia, esquemasHorarios } from "@/modules/horarios";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const registroId = esquemasHorarios.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasHorarios.CorreccionAsistenciaSchema);
  return ok(await corregirAsistencia(admin, registroId, datos, meta));
});
