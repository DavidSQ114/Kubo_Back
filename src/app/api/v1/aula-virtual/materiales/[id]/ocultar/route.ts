// POST /api/v1/aula-virtual/materiales/{id}/ocultar · Ocultar un material publicado (US61 criterio 3, DO-05; auditado)
// · Solo Docente (solo los de su curso y sección; otro, 404).
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasAulaVirtual, ocultarMaterial } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const materialId = esquemasAulaVirtual.IdSchema.parse(params.id);
  return ok(await ocultarMaterial(docente, materialId, meta));
});
