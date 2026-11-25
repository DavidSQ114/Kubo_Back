// GET /api/v1/matricula/solicitudes/{id}/documentos/{documentoId}/archivo · Archivo de un documento de matrícula (PDF
//     o JPG, inline) (bloque M4) · Coordinador académico o apoderado vinculado al alumno (403 para cualquier otro)
import "@/server/wiring";
import { respuestaArchivo } from "@/platform/archivos";
import { ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { archivoDeDocumentoMatricula, esquemasMatricula } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  const usuario = await requerirSesion(req, { roles: ["COORDINADOR", "APODERADO"] });
  const solicitudId = esquemasMatricula.IdSchema.parse(params.id);
  const documentoId = esquemasMatricula.IdSchema.parse(params.documentoId);
  const { flujo, archivo } = await archivoDeDocumentoMatricula(usuario, solicitudId, documentoId);
  return respuestaArchivo(flujo, archivo);
});
