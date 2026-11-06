// POST /api/v1/matricula/pagos/{id}/descartar · Descartar un pago Observado (US23, AD-11) · Solo Administrador
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { descartarPagoObservado, esquemasMatricula } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const admin = await requerirSesion(req, { roles: ["ADMINISTRADOR"] });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.DescartarPagoSchema);
  return ok(await descartarPagoObservado(admin, id, datos, meta));
});
