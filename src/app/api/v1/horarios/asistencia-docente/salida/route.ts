// POST /api/v1/horarios/asistencia-docente/salida · Registrar la hora de salida del día (US32, AD-14) · Solo
//      Administrador · 422 SOLO_DIA_ACTUAL si la fecha no es la de hoy en Lima
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasHorarios, registrarSalida, ROLES_HORARIOS } from "@/modules/horarios";

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ROLES_HORARIOS.ASISTENCIA_DOCENTE });
  const datos = await leerCuerpo(req, esquemasHorarios.MarcacionDocenteSchema);
  return ok(await registrarSalida(admin, datos, meta));
});
