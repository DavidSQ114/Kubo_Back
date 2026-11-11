// POST /api/v1/matricula/pagos/webhooks/pasarela · Aviso «Order (Mercado Pago)» (US70) · Público, sin sesión
// Valida x-signature con MP_WEBHOOK_SECRET (401 si no coincide), responde 200 de inmediato y después consulta la order
// (GET /v1/orders/{id}) para registrar el pago. Idempotente: un aviso repetido no registra dos veces.
// data.id se toma solo de la query: es el que firma Mercado Pago (D-09). Sin él, el aviso se ignora.
import "@/server/wiring";
import { after } from "next/server";
import { ok, leerCuerpo, ruta } from "@/platform/http/ruta";
import { esquemasMatricula, procesarOrdenPasarela, validarAvisoPasarela } from "@/modules/matricula";

export const POST = ruta(async (req, { meta }) => {
  const consulta = esquemasMatricula.ConsultaAvisoPasarelaSchema.parse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  const cuerpo = await leerCuerpo(req, esquemasMatricula.AvisoPasarelaSchema);
  const ordenId = validarAvisoPasarela({
    firma: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    // el id del cuerpo no se usa: no está firmado y podría no coincidir con el de la query
    dataId: consulta["data.id"] ?? null,
    tipo: consulta.type ?? cuerpo.type ?? null,
  });
  if (ordenId) after(() => procesarOrdenPasarela(ordenId, meta));
  return ok({ recibido: true });
});
