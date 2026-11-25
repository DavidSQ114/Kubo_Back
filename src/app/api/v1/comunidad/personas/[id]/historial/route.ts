// GET /api/v1/comunidad/personas/{id}/historial · Historial de cambios de la persona, leído de la bitácora (US69, RF03)
// Administrador y Coordinador académico (lectura)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasComunidad, historialPersona, ROLES_COMUNIDAD } from "@/modules/comunidad";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_COMUNIDAD.CONSULTA });
  const personaId = esquemasComunidad.IdPersonaSchema.parse(params.id);
  return ok(await historialPersona(personaId));
});
