// POST /api/v1/aula-virtual/asignaciones/{asignacionId}/materiales · Subir material de estudio (US61, M-16) · Solo
// Docente (solo su curso y sección del año en curso) · multipart/form-data: unidadId, titulo, tipo (ARCHIVO o ENLACE),
// visible (true o false) y archivo (PDF, PPTX, DOCX, XLSX, JPG o PNG de hasta 5 MB) o url (http o https).
import "@/server/wiring";
import { archivoDelFormulario, leerFormulario } from "@/platform/archivos";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasAulaVirtual, MENSAJE_TAMANO_MATERIAL, subirMaterial } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId } = esquemasAulaVirtual.AsignacionParamsSchema.parse(params);
  // rechaza por Content-Length (o mientras lee) un cuerpo de más de 5 MB, antes de leerlo completo
  const formulario = await leerFormulario(req, { mensaje: MENSAJE_TAMANO_MATERIAL });
  const campos = esquemasAulaVirtual.NuevoMaterialSchema.parse({
    unidadId: formulario.get("unidadId"),
    titulo: formulario.get("titulo"),
    tipo: formulario.get("tipo"),
    url: formulario.get("url"),
    visible: formulario.get("visible"),
  });
  const archivo = await archivoDelFormulario(formulario, "archivo");
  return ok(await subirMaterial(docente, asignacionId, { ...campos, archivo }, meta), 201);
});
