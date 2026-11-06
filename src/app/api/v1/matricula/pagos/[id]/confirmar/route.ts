// POST /api/v1/matricula/pagos/{id}/confirmar · Confirmar un pago Observado (US23, AD-11) · Solo Administrador
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { confirmarPagoObservado, esquemasMatricula } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  return ok(await confirmarPagoObservado(admin, id, meta));
});
