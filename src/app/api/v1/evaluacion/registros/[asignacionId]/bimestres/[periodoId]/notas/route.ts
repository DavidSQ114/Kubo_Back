// PUT /api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/notas · Guardar notas (también un avance
// parcial) con la escala AD, A, B o C, solo en el bimestre activo y con el registro abierto (US37, US40, DO-04)
// · Solo Docente (solo sus cursos y secciones)
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { esquemasEvaluacion, guardarNotas } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const PUT = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId, periodoId } = esquemasEvaluacion.RegistroParamsSchema.parse(params);
  const datos = await leerCuerpo(req, esquemasEvaluacion.GuardarNotasSchema);
  return ok(await guardarNotas(docente, asignacionId, periodoId, datos));
});
