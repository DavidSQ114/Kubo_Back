// POST /api/v1/matricula/pagos/webhooks/pasarela · Aviso «Order (Mercado Pago)» (US70) · Público, sin sesión
// Valida x-signature con MP_WEBHOOK_SECRET (401 si no coincide), responde 200 de inmediato y después consulta la order
// (GET /v1/orders/{id}) para registrar el pago. Idempotente: un aviso repetido no registra dos veces.
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
    // la firma se calcula con el data.id de la query; el cuerpo es el respaldo
    dataId: consulta["data.id"] ?? cuerpo.data?.id ?? null,
    tipo: consulta.type ?? cuerpo.type ?? null,
  });
  if (ordenId) after(() => procesarOrdenPasarela(ordenId, meta));
  return ok({ recibido: true });
});
