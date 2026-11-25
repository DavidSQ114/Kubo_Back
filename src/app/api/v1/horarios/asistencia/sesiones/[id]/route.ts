// GET /api/v1/horarios/asistencia/sesiones/{id} · Una sesión de clase con su lista de alumnos y el estado de cada
// uno (US35, US36) · Docente (solo sus sesiones: 403 CLASE_AJENA) y Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { detalleDeSesion, esquemasHorarios, ROLES_HORARIOS } from "@/modules/horarios";

export const GET = ruta(async (req, { params }) => {
  const sesion = await requerirSesion(req, { roles: ROLES_HORARIOS.ASISTENCIA_ALUMNOS });
  return ok(await detalleDeSesion(sesion, esquemasHorarios.IdSchema.parse(params.id)));
});
