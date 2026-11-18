// GET /api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId} · Registro de notas: alumnos con matrícula
// vigente por competencias del curso, con el consolidado y el estado del registro (US37, US39, US40, DO-04)
// · Solo Docente (solo sus cursos y secciones)
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, registroDeNotas } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId, periodoId } = esquemasEvaluacion.RegistroParamsSchema.parse(params);
  return ok(await registroDeNotas(docente, asignacionId, periodoId));
});
