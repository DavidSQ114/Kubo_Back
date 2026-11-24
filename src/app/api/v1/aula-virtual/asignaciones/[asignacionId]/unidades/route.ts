// POST /api/v1/aula-virtual/asignaciones/{asignacionId}/unidades · Crear una unidad didáctica al final del orden
// (DO-05) · Solo Docente (solo su curso y sección del año en curso). Cuerpo: { titulo }.
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { crearUnidad, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId } = esquemasAulaVirtual.AsignacionParamsSchema.parse(params);
  const { titulo } = await leerCuerpo(req, esquemasAulaVirtual.NuevaUnidadSchema);
  return ok(await crearUnidad(docente, asignacionId, titulo), 201);
});
