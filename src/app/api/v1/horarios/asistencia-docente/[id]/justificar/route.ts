// POST /api/v1/horarios/asistencia-docente/{id}/justificar · Justificar una inasistencia de cualquier fecha con motivo
//      obligatorio: pasa a «Falta justificada» (US32, AD-14) · Solo Administrador
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, justificarFalta } from "@/modules/horarios";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const registroId = esquemasHorarios.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasHorarios.JustificacionDocenteSchema);
  return ok(await justificarFalta(admin, registroId, datos, meta));
});
