// GET /api/v1/matricula/apoderado/pagos/intentos/{id} · Estado de un pago en línea (US70, pantalla de retorno)
// Solo Apoderado que lo creó. Muestra el estado registrado en Kubo; la URL de retorno nunca confirma un pago.
import "@/server/wiring";
import { ok, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { consultarIntento, esquemasMatricula } from "@/modules/matricula";

export const GET = ruta(async (req, { meta, params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const intentoId = esquemasMatricula.IdSchema.parse(params.id);
  return ok(await consultarIntento(apoderado, intentoId, meta));
});
