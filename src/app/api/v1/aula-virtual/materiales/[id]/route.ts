// DELETE /api/v1/aula-virtual/materiales/{id} · Eliminar un material de estudio y su archivo (US61, DO-05; auditado)
// · Solo Docente (solo los de su curso y sección del año en curso; otro, 404).
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { eliminarMaterial, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const DELETE = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const materialId = esquemasAulaVirtual.IdSchema.parse(params.id);
  await eliminarMaterial(docente, materialId, meta);
  return ok({ id: materialId });
});
