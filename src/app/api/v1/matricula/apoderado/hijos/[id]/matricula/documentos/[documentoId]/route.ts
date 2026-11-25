// POST /api/v1/matricula/apoderado/hijos/{id}/matricula/documentos/{documentoId} · Reemplazar un documento observado o
//      subir uno opcional que faltaba (bloque M4): multipart/form-data con «archivo» (PDF o JPG de hasta 5 MB);
//      {documentoId} es el documento requerido · Solo Apoderado · 403 ESTUDIANTE_NO_VINCULADO si no es su hijo
import "@/server/wiring";
import { archivoDelFormulario, leerFormulario } from "@/platform/archivos";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, MENSAJE_ARCHIVO_MATRICULA, reemplazarDocumento } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const estudianteId = esquemasMatricula.IdSchema.parse(params.id);
  const documentoId = esquemasMatricula.IdSchema.parse(params.documentoId);
  const formulario = await leerFormulario(req, { mensaje: MENSAJE_ARCHIVO_MATRICULA });
  const archivo = await archivoDelFormulario(formulario, "archivo");
  return ok(await reemplazarDocumento(apoderado, estudianteId, documentoId, archivo, meta));
});
