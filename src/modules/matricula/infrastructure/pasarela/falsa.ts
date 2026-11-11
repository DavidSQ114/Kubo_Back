// matricula/infrastructure: pasarela falsa para pruebas y desarrollo local (PASARELA=falsa, nunca en producción).
// Imita una order de Checkout Pro: el «checkout» es una pantalla de Kubo con «Aprobar», «Rechazar» y «Dejar en
// proceso», y la consulta responde con los mismos estados que Orders. Las orders viven en memoria del proceso.
import { randomUUID } from "node:crypto";
import type { CobroConsultado, DatosCobro, PasarelaPagos } from "../../domain/pasarela";
import { resultadoDeOrden } from "./mercadoPago";

export interface OrdenFalsa {
  ordenId: string;
  referencia: string;
  totalCentimos: number;
  pagadoCentimos: number;
  status: string;
  statusDetail: string;
}

export type SimulacionFalsa = "APROBADO" | "RECHAZADO" | "EN_PROCESO" | "EXPIRADO";

const ESTADO_SIMULADO: Record<SimulacionFalsa, { status: string; statusDetail: string; pagada: boolean }> = {
  APROBADO: { status: "processed", statusDetail: "accredited", pagada: true },
  RECHAZADO: { status: "failed", statusDetail: "rejected_by_issuer", pagada: false },
  EN_PROCESO: { status: "processing", statusDetail: "in_process", pagada: false },
  EXPIRADO: { status: "expired", statusDetail: "expired", pagada: false },
};

// en globalThis: en desarrollo, Next.js puede cargar el módulo más de una vez en el mismo proceso
const almacen = globalThis as typeof globalThis & { __kuboOrdenesFalsas?: Map<string, OrdenFalsa> };
const ordenes = (almacen.__kuboOrdenesFalsas ??= new Map<string, OrdenFalsa>());

/** URL del checkout falso: la pantalla de Kubo que simula a Mercado Pago. */
export const rutaCheckoutFalso = (urlRetorno: string) => {
  const url = new URL(urlRetorno);
  url.pathname = "/apoderado/pagos/pasarela-de-prueba";
  return url.toString();
};

/**
 * Cambia el estado de una order falsa como si el apoderado hubiera pagado en el checkout. `montoPagadoCentimos`
 * permite simular un pago con otro monto (pruebas de integración).
 */
export function simularPagoFalso(ordenId: string, resultado: SimulacionFalsa, montoPagadoCentimos?: number) {
  const orden = ordenes.get(ordenId);
  if (!orden) return null;
  const e = ESTADO_SIMULADO[resultado];
  orden.status = e.status;
  orden.statusDetail = e.statusDetail;
  orden.pagadoCentimos = montoPagadoCentimos ?? (e.pagada ? orden.totalCentimos : 0);
  return orden;
}

export const pasarelaFalsa: PasarelaPagos = {
  nombre: "falsa",

  async crearCobro(datos: DatosCobro) {
    const ordenId = `ORDFALSA${randomUUID().replace(/-/g, "").toUpperCase()}`;
    ordenes.set(ordenId, {
      ordenId,
      referencia: datos.referencia,
      totalCentimos: datos.montoCentimos,
      pagadoCentimos: 0,
      status: "created",
      statusDetail: "created",
    });
    return { ordenId, urlCheckout: rutaCheckoutFalso(datos.urlRetorno) };
  },

  async consultarPago(ordenId: string): Promise<CobroConsultado | null> {
    const o = ordenes.get(ordenId);
    if (!o) return null;
    return {
      ordenId,
      resultado: resultadoDeOrden(o.status, o.statusDetail),
      estadoExterno: `${o.status}/${o.statusDetail}`,
      montoCentimos: o.totalCentimos,
      montoPagadoCentimos: o.pagadoCentimos,
      referencia: o.referencia,
    };
  },
};
