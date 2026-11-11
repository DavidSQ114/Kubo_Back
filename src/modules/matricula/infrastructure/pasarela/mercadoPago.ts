// matricula/infrastructure: adaptador de Mercado Pago Checkout Pro con la API de Orders (US70, US71), con el SDK
// oficial `mercadopago`. Crea la order (POST /v1/orders) y la consulta (GET /v1/orders/{id}). No recibe ni guarda datos
// de tarjeta: el apoderado paga en el checkout de Mercado Pago. Endpoints y estados en docs/arquitectura (AD-15).
import { MercadoPagoConfig, MPNotFoundError, Order } from "mercadopago";
import type { CobroConsultado, DatosCobro, PasarelaPagos, ResultadoCobro } from "../../domain/pasarela";
import { duracionIso } from "../../domain/pasarela";
import { decimalDeCentimos } from "../pagos";

/** Tiempo máximo de cada llamada a la API (el SDK reintenta los 5xx y los 429). */
const TIEMPO_ESPERA_MS = 10_000;
const DESCRIPCION = "Pensiones escolares";

/** «1000.00» o «1000» → céntimos; null si la pasarela no informó un monto con ese formato. */
export function centimosDeMonto(monto: string | number | null | undefined): number | null {
  if (monto == null) return null;
  const texto = String(monto).trim();
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(texto);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

/**
 * Estado de una order de Checkout Pro según la documentación de Orders:
 * - processed + accredited: pagada (además se compara total_paid_amount con total_amount, en el dominio);
 * - processed + partially_refunded / refunded / charged_back: devuelta;
 * - failed: rechazada; canceled / expired: expirada o cancelada antes de pagar;
 * - created: aún sin pago; processing / action_required: en proceso.
 */
export function resultadoDeOrden(status: string | undefined, detalle: string | undefined): ResultadoCobro {
  switch (status) {
    case "processed":
      return detalle === "accredited" ? "PAGADO" : "DEVUELTO";
    case "refunded":
    case "charged_back":
      return "DEVUELTO";
    case "failed":
      return "RECHAZADO";
    case "canceled":
    case "cancelled":
    case "expired":
      return "EXPIRADO";
    case "created":
      return "SIN_PAGO";
    default:
      return "EN_PROCESO";
  }
}

export function pasarelaMercadoPago(accessToken: string): PasarelaPagos {
  const ordenes = new Order(new MercadoPagoConfig({ accessToken, options: { timeout: TIEMPO_ESPERA_MS } }));

  return {
    nombre: "mercadopago",

    async crearCobro(datos: DatosCobro) {
      const r = await ordenes.create({
        body: {
          type: "online",
          processing_mode: "manual",
          total_amount: decimalDeCentimos(datos.montoCentimos),
          external_reference: datos.referencia,
          description: DESCRIPCION,
          expiration_time: duracionIso(datos.expiraEnMinutos),
          items: datos.items.map((i) => ({
            title: i.titulo,
            unit_price: decimalDeCentimos(i.montoCentimos),
            quantity: 1,
          })),
          config: {
            online: {
              success_url: datos.urlRetorno,
              failure_url: datos.urlRetorno,
              pending_url: datos.urlRetorno,
              auto_return: "approved",
            },
          },
        },
        requestOptions: { idempotencyKey: datos.idempotencia },
      });
      if (!r.id || !r.checkout_url) throw new Error("Mercado Pago no devolvió la order ni su checkout_url");
      return { ordenId: r.id, urlCheckout: r.checkout_url };
    },

    async consultarPago(ordenId: string): Promise<CobroConsultado | null> {
      try {
        const o = await ordenes.get({ id: ordenId });
        return {
          ordenId,
          resultado: resultadoDeOrden(o.status, o.status_detail),
          estadoExterno: `${o.status ?? "?"}/${o.status_detail ?? "?"}`,
          montoCentimos: centimosDeMonto(o.total_amount),
          montoPagadoCentimos: centimosDeMonto(o.total_paid_amount),
          referencia: o.external_reference ?? null,
        };
      } catch (e) {
        if (e instanceof MPNotFoundError) return null;
        throw e;
      }
    },
  };
}
