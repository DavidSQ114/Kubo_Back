// POST /api/v1/aula-virtual/materiales/{id}/publicar · Publicar un borrador o un material oculto (US61, DO-05;
// auditado y con aviso a los alumnos de la sección) · Solo Docente (solo los de su curso y sección; otro, 404).
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { esquemasAulaVirtual, publicarMaterial } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const materialId = esquemasAulaVirtual.IdSchema.parse(params.id);
  return ok(await publicarMaterial(docente, materialId, meta));
});
