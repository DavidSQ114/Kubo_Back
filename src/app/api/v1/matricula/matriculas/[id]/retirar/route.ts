// POST /api/v1/matricula/matriculas/{id}/retirar · Retiro del estudiante (US57, M-18) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, retirarMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.RetiroSchema);
  return ok(await retirarMatricula(coordinador, id, datos, meta));
});
