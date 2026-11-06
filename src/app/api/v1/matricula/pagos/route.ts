// POST /api/v1/matricula/pagos · Registrar pago manual (US22, US23, US04, US25, M-01) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, registrarPago } from "@/modules/matricula";

export const POST = ruta(async (req, { meta }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const datos = await leerCuerpo(req, esquemasMatricula.PagoSchema);
  return ok(await registrarPago(admin, datos, meta), 201);
});
