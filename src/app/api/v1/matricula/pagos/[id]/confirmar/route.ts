// POST /api/v1/matricula/pagos/{id}/confirmar · Confirmar un pago Observado (US23, AD-11) · Solo Coordinador académico
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { confirmarPagoObservado, esquemasMatricula, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const id = esquemasMatricula.IdSchema.parse(params.id);
  return ok(await confirmarPagoObservado(coordinador, id, meta));
});
