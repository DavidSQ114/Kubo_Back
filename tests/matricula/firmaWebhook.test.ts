// D-09 (US70): los avisos reales de Mercado Pago respondían 401 porque el id de la order (alfanumérico, en mayúsculas)
// entraba tal cual en el manifiesto de x-signature. La documentación de Orders pide pasarlo a minúsculas; la
// simulación del panel usa un id numérico y por eso sí pasaba. Las firmas se calculan aquí como lo hace Mercado Pago.
import "@/server/wiring";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { logger } from "@/platform/logger";
import { validarAvisoPasarela } from "@/modules/matricula";
import { idParaFirma } from "@/modules/matricula/domain/pasarela";
import { POST as avisoPasarela } from "@/app/api/v1/matricula/pagos/webhooks/pasarela/route";

const SECRETO = "clave-secreta-de-prueba-d09-0123456789";
const ORDEN_REAL = "ORDTST01JQ4S4KY8HWQ6NA5PXB65B3D3";
const ID_SIMULACION = "123456";
const REQUEST_ID = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";
const TS = "1742505638683";

/** Firma como Mercado Pago: HMAC-SHA256 en hexadecimal de «id:<data.id en minúsculas>;request-id:…;ts:…;». */
const firmaMercadoPago = (dataId: string, secreto = SECRETO) =>
  `ts=${TS},v1=${createHmac("sha256", secreto)
    .update(`id:${dataId.toLowerCase()};request-id:${REQUEST_ID};ts:${TS};`)
    .digest("hex")}`;

const aviso = (dataId: string, firma: string | null) => ({ firma, requestId: REQUEST_ID, dataId, tipo: "order" });

describe("firma de los avisos reales de Mercado Pago (D-09, US70)", () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.PASARELA = "falsa";
    process.env.MP_WEBHOOK_SECRET = SECRETO;
  });
  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  it("el id de la order entra en minúsculas en el manifiesto; uno numérico no cambia", () => {
    expect(idParaFirma("ORD01JQ4S4KY8HWQ6NA5PXB65B3D3")).toBe("ord01jq4s4ky8hwq6na5pxb65b3d3");
    expect(idParaFirma(ID_SIMULACION)).toBe(ID_SIMULACION);
  });

  it("acepta la firma de una order real con id alfanumérico en mayúsculas y conserva el id original", () => {
    expect(validarAvisoPasarela(aviso(ORDEN_REAL, firmaMercadoPago(ORDEN_REAL)))).toBe(ORDEN_REAL);
  });

  it("la simulación del panel, con id numérico, sigue pasando", () => {
    expect(validarAvisoPasarela(aviso(ID_SIMULACION, firmaMercadoPago(ID_SIMULACION)))).toBe(ID_SIMULACION);
  });

  it("rechaza una firma alterada, otra clave u otro id con 401 FIRMA_INVALIDA", () => {
    const valida = firmaMercadoPago(ORDEN_REAL);
    const alterada = valida.slice(0, -1) + (valida.endsWith("0") ? "1" : "0");
    const invalida = { codigo: "FIRMA_INVALIDA", estadoHttp: 401 };
    expect(() => validarAvisoPasarela(aviso(ORDEN_REAL, alterada))).toThrow(expect.objectContaining(invalida));
    expect(() =>
      validarAvisoPasarela(aviso(ORDEN_REAL, firmaMercadoPago(ORDEN_REAL, "otra-clave-0123456789ab"))),
    ).toThrow(expect.objectContaining(invalida));
    expect(() => validarAvisoPasarela(aviso("ORDTSTOTRA", valida))).toThrow(expect.objectContaining(invalida));
    expect(() => validarAvisoPasarela(aviso(ORDEN_REAL, null))).toThrow(expect.objectContaining(invalida));
  });

  it("la ruta responde 401 a una firma alterada sin escribir la clave en el log", async () => {
    const registros = (["info", "warn", "error"] as const).map((nivel) => vi.spyOn(logger, nivel));
    const valida = firmaMercadoPago(ORDEN_REAL);
    const alterada = valida.slice(0, -1) + (valida.endsWith("0") ? "1" : "0");
    const req = new NextRequest(
      `http://localhost:3000/api/v1/matricula/pagos/webhooks/pasarela?data.id=${ORDEN_REAL}&type=order`,
      {
        method: "POST",
        headers: { "x-signature": alterada, "x-request-id": REQUEST_ID },
        body: JSON.stringify({ action: "order.processed", type: "order", data: { id: ORDEN_REAL } }),
      },
    );
    const res = await avisoPasarela(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("FIRMA_INVALIDA");
    const escrito = JSON.stringify(registros.flatMap((r) => r.mock.calls));
    expect(escrito).toContain("FIRMA_INVALIDA");
    expect(escrito).not.toContain(SECRETO);
  });
});
