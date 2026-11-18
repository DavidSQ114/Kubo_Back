// GET /api/v1/evaluacion/registros · Mis registros de notas: cursos y secciones del docente con los bimestres del año
// y el estado del registro en cada uno (US37, DO-04) · Solo Docente
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { misRegistros } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  return ok(await misRegistros(docente));
});
