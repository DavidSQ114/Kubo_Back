// POST /api/v1/matricula/apoderado/hijos/{id}/matricula · Matricular al hijo (bloque M4): multipart/form-data con
//      gradoId, vinculoResponsableId, confirmaDatos y un archivo PDF o JPG de hasta 5 MB por documento requerido en
//      «documento:<id>» · Solo Apoderado · 403 ESTUDIANTE_NO_VINCULADO si no es su hijo · 422 fuera de las fechas
import "@/server/wiring";
import { archivoDelFormulario, leerFormulario, TAMANO_MAXIMO_ARCHIVO, type ArchivoRecibido } from "@/platform/archivos";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import {
  enviarSolicitud,
  esquemasMatricula,
  MAXIMO_DOCUMENTOS_REQUERIDOS,
  MENSAJE_ARCHIVO_MATRICULA,
} from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const estudianteId = esquemasMatricula.IdSchema.parse(params.id);
  // un archivo de hasta 5 MB por documento: se rechaza antes de leer un cuerpo mayor
  const formulario = await leerFormulario(req, {
    mensaje: MENSAJE_ARCHIVO_MATRICULA,
    tamanoMaximo: TAMANO_MAXIMO_ARCHIVO * MAXIMO_DOCUMENTOS_REQUERIDOS,
  });
  const campos = esquemasMatricula.SolicitudMatriculaSchema.parse({
    gradoId: formulario.get("gradoId"),
    vinculoResponsableId: formulario.get("vinculoResponsableId"),
    confirmaDatos: formulario.get("confirmaDatos"),
  });
  const archivos: Record<string, ArchivoRecibido> = {};
  for (const campo of new Set(formulario.keys())) {
    if (!campo.startsWith(esquemasMatricula.PREFIJO_CAMPO_DOCUMENTO)) continue;
    const documentoId = esquemasMatricula.IdSchema.parse(campo.slice(esquemasMatricula.PREFIJO_CAMPO_DOCUMENTO.length));
    const archivo = await archivoDelFormulario(formulario, campo);
    if (archivo) archivos[documentoId] = archivo;
  }
  return ok(await enviarSolicitud(apoderado, estudianteId, { ...campos, archivos }, meta), 201);
});
