// GET /api/v1/matricula/pagos/{id} · Detalle de una operación de pago (AD-11) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { detalleOperacion, esquemasMatricula } from "@/modules/matricula";

export const GET = ruta(async (req, { params }) => {
  await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  return ok(await detalleOperacion(esquemasMatricula.IdSchema.parse(params.id)));
});
