// GET /api/v1/matricula/extraordinarias/{id} · Detalle de un lote con sus cuotas (bloque M4) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { detalleLote, esquemasMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  return ok(await detalleLote(esquemasMatricula.IdSchema.parse(params.id)));
});
