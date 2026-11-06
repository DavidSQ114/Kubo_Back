// POST /api/v1/matricula/pagos/{id}/anular · Anular un pago (US04, US23, M-02) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { anularPago, esquemasMatricula } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.AnularPagoSchema);
  return ok(await anularPago(admin, id, datos, meta));
});
