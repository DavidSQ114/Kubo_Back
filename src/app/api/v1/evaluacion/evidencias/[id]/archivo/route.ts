// GET /api/v1/evaluacion/evidencias/{id}/archivo · Ver o descargar el archivo de una evidencia (US38 DO-04, US47 AP-04
// y AL-03) · Docente del curso y la sección; apoderado del estudiante y el propio alumno solo con el registro publicado
// (el apoderado, sin restricción por deuda: 403 LIBRETA_RESTRINGIDA, US26). A quien no le corresponde, 404.
// Content-Disposition: inline para JPG y PDF, attachment para el resto. Nunca hay URLs públicas del almacén.
import "@/server/wiring";
import { respuestaArchivo } from "@/platform/archivos";
import { ruta } from "@/platform/http/ruta";
import { archivoDeEvidencia, esquemasEvaluacion } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const usuario = await requerirSesion(req, { roles: ["DOCENTE", "APODERADO", "ALUMNO"] });
  const evidenciaId = esquemasEvaluacion.IdSchema.parse(params.id);
  const { flujo, archivo } = await archivoDeEvidencia(usuario, evidenciaId);
  return respuestaArchivo(flujo, archivo);
});
