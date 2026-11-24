// POST /api/v1/aula-virtual/enlaces/{id}/publicar · Mostrar un enlace oculto a los alumnos de la sección (US62; auditado
// y con aviso a los alumnos) · Solo Docente (solo los de su curso y sección; otro, 404).
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { cambiarVisibilidadEnlace, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const POST = ruta(async (req, { meta, params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const enlaceId = esquemasAulaVirtual.IdSchema.parse(params.id);
  return ok(await cambiarVisibilidadEnlace(docente, enlaceId, true, meta));
});
