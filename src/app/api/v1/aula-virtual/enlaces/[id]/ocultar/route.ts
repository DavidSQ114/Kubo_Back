// POST /api/v1/aula-virtual/enlaces/{id}/ocultar · Ocultar un enlace a los alumnos (US62; auditado) · Solo Docente
// (solo los de su curso y sección; otro, 404).
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { cambiarVisibilidadEnlace, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const enlaceId = esquemasAulaVirtual.IdSchema.parse(params.id);
  return ok(await cambiarVisibilidadEnlace(docente, enlaceId, false, meta));
});
