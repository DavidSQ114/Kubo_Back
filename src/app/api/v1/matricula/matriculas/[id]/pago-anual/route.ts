// POST /api/v1/matricula/matriculas/{id}/pago-anual · Pago anual adelantado (US58, M-15) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, registrarPagoAnual, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.PagoAnualSchema);
  return ok(await registrarPagoAnual(coordinador, id, datos, meta), 201);
});
