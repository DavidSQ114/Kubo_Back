// POST /api/v1/matricula/extraordinarias/vista-previa · Cantidad y total de un lote antes de crearlo (bloque M4) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, ROLES_MATRICULA, vistaPreviaLote } from "@/modules/matricula";

export const POST = ruta(async (req) => {
  await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const datos = await leerCuerpo(req, esquemasMatricula.LoteExtraordinarioSchema);
  return ok(await vistaPreviaLote(datos));
});
