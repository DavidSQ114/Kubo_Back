// DELETE /api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/evidencias/{evidenciaId} · Eliminar una
// evidencia de una calificación (US38, DO-04) · Solo Docente (solo su curso y sección, con el registro abierto).
// Responde el registro de notas actualizado.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { eliminarEvidencia, esquemasEvaluacion } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const DELETE = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId, periodoId, evidenciaId } = esquemasEvaluacion.EvidenciaParamsSchema.parse(params);
  return ok(await eliminarEvidencia(docente, asignacionId, periodoId, evidenciaId, meta));
});
