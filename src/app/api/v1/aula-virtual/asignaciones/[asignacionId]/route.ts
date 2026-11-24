// GET /api/v1/aula-virtual/asignaciones/{asignacionId} · Aula de un curso y sección (DO-05): unidades, materiales
// (US61) y enlaces (US62) en cualquier estado, con el estado del enlace calculado · Solo Docente (solo su curso y
// sección: otro, 403).
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { aulaDelDocente, esquemasAulaVirtual } from "@/modules/aula-virtual";
import { requerirSesion } from "@/modules/identidad";

export const GET = ruta(async (req, { params }) => {
  const docente = await requerirSesion(req, { roles: ["DOCENTE"] });
  const { asignacionId } = esquemasAulaVirtual.AsignacionParamsSchema.parse(params);
  return ok(await aulaDelDocente(docente, asignacionId));
});
