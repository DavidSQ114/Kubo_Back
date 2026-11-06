// POST /api/v1/matricula/matriculas/{id}/retirar · Retiro del estudiante (US57, M-18) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, retirarMatricula } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.RetiroSchema);
  return ok(await retirarMatricula(admin, id, datos, meta));
});
