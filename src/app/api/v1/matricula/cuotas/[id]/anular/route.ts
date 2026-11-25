// POST /api/v1/matricula/cuotas/{id}/anular · Anular una cuota extraordinaria sin pagar (bloque M4) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { anularCuotaExtraordinaria, esquemasMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.MotivoCuotaSchema);
  return ok(await anularCuotaExtraordinaria(coordinador, id, datos, meta));
});
