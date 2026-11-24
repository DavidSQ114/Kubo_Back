// PATCH /api/v1/aula-virtual/unidades/{id} · Renombrar una unidad didáctica y/o desactivarla o volver a activarla
// (DO-05) · Solo Docente (solo las de su curso y sección del año en curso; otra, 404). Cuerpo: { titulo?, activo? }.
import "@/server/wiring";
import { leerCuerpo, ok, ruta } from "@/platform/http/ruta";
import { editarUnidad, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const PATCH = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const unidadId = esquemasAulaVirtual.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasAulaVirtual.EditarUnidadSchema);
  return ok(await editarUnidad(docente, unidadId, datos));
});
