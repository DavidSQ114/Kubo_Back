// GET /api/v1/matricula/matriculas/{id} · Detalle con apoderados y cronograma (US18, US21, AD-10) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { detalleMatricula, esquemasMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  return ok(await detalleMatricula(esquemasMatricula.IdSchema.parse(params.id)));
});
