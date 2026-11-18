// GET /api/v1/evaluacion/apoderado/hijos/{id}/libreta · Libreta de notas del hijo: solo registros PUBLICADOS, por
// bimestre, curso y competencia (US46, AP-04); con 2 o más pensiones vencidas, la restricción sin notas (US26, AP-06)
// · Solo Apoderado · 403 ESTUDIANTE_NO_VINCULADO si el estudiante no es su hijo.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, libretaDelHijo } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  return ok(await libretaDelHijo(apoderado, esquemasEvaluacion.IdSchema.parse(params.id)));
});
