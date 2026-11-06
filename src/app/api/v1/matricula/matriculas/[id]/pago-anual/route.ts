// POST /api/v1/matricula/matriculas/{id}/pago-anual · Pago anual adelantado (US58, M-15) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, registrarPagoAnual } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.PagoAnualSchema);
  return ok(await registrarPagoAnual(admin, id, datos, meta), 201);
});
