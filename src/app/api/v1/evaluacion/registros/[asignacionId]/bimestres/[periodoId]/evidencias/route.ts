// POST /api/v1/evaluacion/registros/{asignacionId}/bimestres/{periodoId}/evidencias · Adjuntar evidencia a una
// calificación (US38, DO-04) · Solo Docente (solo su curso y sección, con el registro abierto) · multipart/form-data:
// matriculaId, competenciaPlanId, comentario (hasta 1000 caracteres) y/o archivo PDF o JPG de hasta 5 MB.
import "@/server/wiring";
import { archivoDelFormulario, leerFormulario } from "@/platform/archivos";
import { ok, ruta } from "@/platform/http/ruta";
import { agregarEvidencia, esquemasEvaluacion, MENSAJE_ARCHIVO_EVIDENCIA } from "@/modules/evaluacion";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId, periodoId } = esquemasEvaluacion.RegistroParamsSchema.parse(params);
  // rechaza por Content-Length (o mientras lee) un cuerpo de más de 5 MB, antes de leerlo completo
  const formulario = await leerFormulario(req, { mensaje: MENSAJE_ARCHIVO_EVIDENCIA });
  const campos = esquemasEvaluacion.NuevaEvidenciaSchema.parse({
    matriculaId: formulario.get("matriculaId"),
    competenciaPlanId: formulario.get("competenciaPlanId"),
    comentario: formulario.get("comentario"),
  });
  const archivo = await archivoDelFormulario(formulario, "archivo");
  return ok(await agregarEvidencia(docente, asignacionId, periodoId, { ...campos, archivo }, meta), 201);
});
