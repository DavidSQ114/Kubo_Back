// POST /api/v1/matricula/pagos/{id}/devolver · Registrar devolución de un pago en línea Observado (US71, AD-11)
// Solo Coordinador académico. La operación pasa a Anulado con el motivo «Devuelto» y queda en la auditoría.
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, registrarDevolucion, ROLES_MATRICULA } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const coordinador = await requerirSesion(req, { roles: ROLES_MATRICULA.GESTION });
  const operacionId = esquemasMatricula.IdSchema.parse(params.id);
  const datos = await leerCuerpo(req, esquemasMatricula.DevolucionSchema);
  return ok(await registrarDevolucion(coordinador, operacionId, datos, meta));
});
