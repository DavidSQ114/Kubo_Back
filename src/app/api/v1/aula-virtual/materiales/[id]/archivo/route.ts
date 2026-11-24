// GET /api/v1/aula-virtual/materiales/{id}/archivo · Descargar el archivo de un material (US61 DO-05, US67 AL-05) ·
// Docente del curso y la sección (en cualquier estado) y alumno de la sección con matrícula vigente (solo publicado y
// en una unidad activa). A quien no le corresponde (material ajeno, en borrador u oculto), 404. Content-Disposition:
// inline para JPG y PDF, attachment para el resto. Nunca hay URLs públicas del almacén.
import "@/server/wiring";
import { respuestaArchivo } from "@/platform/archivos";
import { ruta } from "@/platform/http/ruta";
import { archivoDeMaterial, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const usuario = await requerirSesion(req, { roles: ["DOCENTE", "ALUMNO"] });
  const materialId = esquemasAulaVirtual.IdSchema.parse(params.id);
  const { flujo, archivo } = await archivoDeMaterial(usuario, materialId);
  return respuestaArchivo(flujo, archivo);
});
