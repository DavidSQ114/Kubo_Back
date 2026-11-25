// POST /api/v1/matricula/pagos · Registrar pago manual (US22, US23, US04, US25, M-01) · Solo Coordinador académico
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, registrarPago, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const datos = await leerCuerpo(req, esquemasMatricula.PagoSchema);
  return ok(await registrarPago(coordinador, datos, meta), 201);
});
