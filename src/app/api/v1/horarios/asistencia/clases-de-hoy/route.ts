// GET /api/v1/horarios/asistencia/clases-de-hoy · Clases de hoy del docente en sesión según el horario publicado y
// la fecha de Lima, con el estado de su asistencia (US35, DO-03) · Solo Docente
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { clasesDeHoy } from "@/modules/horarios";

export const GET = ruta(async (req) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  return ok(await clasesDeHoy(docente));
});
