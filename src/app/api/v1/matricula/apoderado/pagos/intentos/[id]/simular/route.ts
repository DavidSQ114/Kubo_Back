// POST /api/v1/matricula/apoderado/pagos/intentos/{id}/simular · Pasarela de prueba (US70) · Solo Apoderado
// Solo con PASARELA=falsa (desarrollo y pruebas): aprueba, rechaza o deja en proceso la order del intento.
import "@/server/wiring";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { requerirSesion } from "@/modules/identidad";
import { esquemasMatricula, simularPagoEnLinea } from "@/modules/matricula";

export const POST = ruta(async (req, { meta, params }) => {
  const apoderado = await requerirSesion(req, { roles: ["APODERADO"] });
  const intentoId = esquemasMatricula.IdSchema.parse(params.id);
  const { resultado } = await leerCuerpo(req, esquemasMatricula.SimularPagoSchema);
  return ok(await simularPagoEnLinea(apoderado, intentoId, resultado, meta));
});
