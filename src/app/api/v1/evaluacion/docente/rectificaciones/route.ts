// GET /api/v1/evaluacion/docente/rectificaciones · Mis solicitudes de rectificación con su estado (US41, DO-04)
// · Solo Docente (solo las que pidió)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { misRectificaciones } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  return ok(await misRectificaciones(docente));
});
