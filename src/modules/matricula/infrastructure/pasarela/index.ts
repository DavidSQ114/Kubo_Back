// matricula/infrastructure: elige el adaptador de PasarelaPagos según PASARELA (mercadopago | falsa) y valida la firma
// x-signature de los avisos (webhook) con MP_WEBHOOK_SECRET, con el validador del SDK oficial de Mercado Pago.
import { WebhookSignatureValidator } from "mercadopago";
import type { PasarelaPagos } from "../../domain/pasarela";
import { leerConfigPasarela } from "./config";
import { pasarelaFalsa } from "./falsa";
import { pasarelaMercadoPago } from "./mercadoPago";

export { simularPagoFalso, type SimulacionFalsa } from "./falsa";

let enCache: { token: string; pasarela: PasarelaPagos } | null = null;

/** Adaptador configurado, o null si el pago en línea está apagado. */
export function obtenerPasarela(): PasarelaPagos | null {
  const config = leerConfigPasarela();
  if (!config) return null;
  if (config.PASARELA === "falsa") return pasarelaFalsa;
  if (enCache?.token !== config.MP_ACCESS_TOKEN) {
    enCache = { token: config.MP_ACCESS_TOKEN, pasarela: pasarelaMercadoPago(config.MP_ACCESS_TOKEN) };
  }
  return enCache.pasarela;
}

/**
 * ¿El aviso viene de la pasarela? Recalcula el HMAC-SHA256 de «id:[data.id];request-id:[x-request-id];ts:[ts];» con
 * MP_WEBHOOK_SECRET y lo compara en tiempo constante con v1 de x-signature. null: pago en línea apagado.
 */
export function firmaAvisoValida(aviso: {
  firma: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean | null {
  const config = leerConfigPasarela();
  if (!config) return null;
  try {
    WebhookSignatureValidator.validate({
      xSignature: aviso.firma ?? undefined,
      xRequestId: aviso.requestId ?? undefined,
      dataId: aviso.dataId ?? undefined,
      secret: config.MP_WEBHOOK_SECRET,
    });
    return true;
  } catch {
    return false;
  }
}
