// Pruebas del pago en línea (US70) y su conciliación y devolución (US71): monto del intento, cuándo un cobro cuenta
// como pagado, estados de Orders de Mercado Pago, cuota pagada por otro medio, configuración y firma del aviso.
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  decidirCobro,
  estadoPagoPasarela,
  expiracionIntento,
  limiteConciliacion,
  montoDelIntento,
  MOTIVO_CUOTA_ANULADA,
  MOTIVO_CUOTA_PAGADA,
  MOTIVO_MONTO_DISTINTO,
  puedeActualizarIntento,
  verificarDescartable,
  verificarDevolucionPosible,
  type CobroConsultado,
} from "@/modules/matricula/domain/pasarela";
import type { CuotaParaPago } from "@/modules/matricula/domain/pagos";
import { leerConfigPasarela } from "@/modules/matricula/infrastructure/pasarela/config";
import { centimosDeMonto, resultadoDeOrden } from "@/modules/matricula/infrastructure/pasarela/mercadoPago";
import { firmaAvisoValida } from "@/modules/matricula/infrastructure/pasarela";

const ahora = new Date("2026-11-11T15:00:00Z");
const cuota = (id: string, datos: Partial<CuotaParaPago & { matriculaId: string }> = {}) => ({
  id,
  estudianteId: "e1",
  matriculaId: "m1",
  estado: "PENDIENTE" as const,
  montoCentimos: 45000,
  ...datos,
});

describe("monto del intento: lo calcula el servidor (US70)", () => {
  it("suma las cuotas pendientes elegidas del estudiante", () => {
    expect(montoDelIntento(["a", "b"], [cuota("a"), cuota("b", { montoCentimos: 30000 })], "e1")).toBe(75000);
  });

  it("rechaza una cuota ya pagada, una de otro estudiante o cuotas de dos matrículas", () => {
    expect(() => montoDelIntento(["a"], [cuota("a", { estado: "PAGADO", pagadaEl: "2026-03-05" })], "e1")).toThrow(
      "Esta pensión ya fue cancelada el 05/03/2026",
    );
    expect(() => montoDelIntento(["a"], [cuota("a", { estudianteId: "e2" })], "e1")).toThrow(
      expect.objectContaining({ codigo: "CUOTA_NO_ENCONTRADA" }),
    );
    expect(() => montoDelIntento(["a", "b"], [cuota("a"), cuota("b", { matriculaId: "m2" })], "e1")).toThrow(
      expect.objectContaining({ codigo: "CUOTAS_DE_VARIAS_MATRICULAS" }),
    );
  });

  it("el intento expira a los 30 minutos y se concilia pasados 10", () => {
    expect(expiracionIntento(ahora).toISOString()).toBe("2026-11-11T15:30:00.000Z");
    expect(limiteConciliacion(ahora).toISOString()).toBe("2026-11-11T14:50:00.000Z");
  });
});

describe("cuándo un cobro cuenta como pagado (US70)", () => {
  const intento = { montoCentimos: 90000, referencia: "KUBO-ABC", expiraEn: new Date("2026-11-11T15:30:00Z") };
  const cobro = (datos: Partial<CobroConsultado> = {}): CobroConsultado => ({
    ordenId: "ORD1",
    resultado: "PAGADO",
    estadoExterno: "processed/accredited",
    montoCentimos: 90000,
    montoPagadoCentimos: 90000,
    referencia: "KUBO-ABC",
    ...datos,
  });

  it("acreditado, con lo pagado igual al total, el monto del intento y su referencia: se registra", () => {
    expect(decidirCobro(intento, cobro(), ahora)).toEqual({ tipo: "REGISTRAR" });
  });

  it("acreditado pero con otro monto pagado, otro total u otra referencia: se observa y no se registra", () => {
    const observar = { tipo: "OBSERVAR", motivo: MOTIVO_MONTO_DISTINTO };
    expect(decidirCobro(intento, cobro({ montoPagadoCentimos: 45000 }), ahora)).toEqual(observar);
    expect(decidirCobro(intento, cobro({ montoCentimos: 1000, montoPagadoCentimos: 1000 }), ahora)).toEqual(observar);
    expect(decidirCobro(intento, cobro({ referencia: "KUBO-OTRA" }), ahora)).toEqual(observar);
    expect(decidirCobro(intento, cobro({ montoPagadoCentimos: null }), ahora)).toEqual(observar);
  });

  it("rechazado, expirado, en proceso y sin pago (antes y después de vencer)", () => {
    expect(decidirCobro(intento, cobro({ resultado: "RECHAZADO" }), ahora)).toEqual({
      tipo: "ACTUALIZAR",
      estado: "RECHAZADO",
    });
    expect(decidirCobro(intento, cobro({ resultado: "EXPIRADO" }), ahora).tipo).toBe("ACTUALIZAR");
    expect(decidirCobro(intento, cobro({ resultado: "EN_PROCESO" }), ahora)).toEqual({
      tipo: "ACTUALIZAR",
      estado: "PENDIENTE",
    });
    expect(decidirCobro(intento, cobro({ resultado: "SIN_PAGO" }), ahora)).toEqual({
      tipo: "ACTUALIZAR",
      estado: "PENDIENTE",
    });
    expect(decidirCobro(intento, cobro({ resultado: "SIN_PAGO" }), new Date("2026-11-11T16:00:00Z"))).toEqual({
      tipo: "ACTUALIZAR",
      estado: "EXPIRADO",
    });
  });

  it("un aviso no retrocede un intento ya resuelto", () => {
    expect(puedeActualizarIntento("PENDIENTE", "RECHAZADO")).toBe(true);
    expect(puedeActualizarIntento("PENDIENTE", "PENDIENTE")).toBe(false);
    expect(puedeActualizarIntento("APROBADO", "RECHAZADO")).toBe(false);
    expect(puedeActualizarIntento("OBSERVADO", "EXPIRADO")).toBe(false);
    expect(puedeActualizarIntento("RECHAZADO", "PENDIENTE")).toBe(false);
  });
});

describe("estados de Orders de Mercado Pago (US70, AD-15)", () => {
  it("solo processed + accredited es pagado", () => {
    expect(resultadoDeOrden("processed", "accredited")).toBe("PAGADO");
    expect(resultadoDeOrden("processed", "partially_refunded")).toBe("DEVUELTO");
    expect(resultadoDeOrden("refunded", "refunded")).toBe("DEVUELTO");
  });

  it("failed es rechazado; canceled y expired, expirado; created, sin pago; processing, en proceso", () => {
    expect(resultadoDeOrden("failed", "rejected_by_issuer")).toBe("RECHAZADO");
    expect(resultadoDeOrden("canceled", "canceled")).toBe("EXPIRADO");
    expect(resultadoDeOrden("expired", "expired")).toBe("EXPIRADO");
    expect(resultadoDeOrden("created", "created")).toBe("SIN_PAGO");
    expect(resultadoDeOrden("processing", "in_process")).toBe("EN_PROCESO");
    expect(resultadoDeOrden("action_required", "waiting_capture")).toBe("EN_PROCESO");
    expect(resultadoDeOrden(undefined, undefined)).toBe("EN_PROCESO");
  });

  it("lee los montos de texto sin pasar por float", () => {
    expect(centimosDeMonto("1000.00")).toBe(100000);
    expect(centimosDeMonto("450.5")).toBe(45050);
    expect(centimosDeMonto("300")).toBe(30000);
    expect(centimosDeMonto("abc")).toBeNull();
    expect(centimosDeMonto(undefined)).toBeNull();
  });
});

describe("pago aprobado con una cuota que ya no está pendiente (US70)", () => {
  it("con las cuotas pendientes y el monto exacto queda Confirmado", () => {
    expect(estadoPagoPasarela(["a"], [cuota("a")], 45000)).toEqual({ estado: "CONFIRMADO", motivo: null });
  });

  it("una cuota ya pagada deja la operación Observado con «Cuota pagada por otro medio»", () => {
    const r = estadoPagoPasarela(["a", "b"], [cuota("a"), cuota("b", { estado: "PAGADO" })], 90000);
    expect(r).toEqual({ estado: "OBSERVADO", motivo: MOTIVO_CUOTA_PAGADA });
    expect(MOTIVO_CUOTA_PAGADA).toBe("Cuota pagada por otro medio");
  });

  it("una cuota anulada o un monto que no cuadra también la dejan Observado", () => {
    expect(estadoPagoPasarela(["a"], [cuota("a", { estado: "ANULADO" })], 45000).motivo).toBe(MOTIVO_CUOTA_ANULADA);
    expect(estadoPagoPasarela(["a"], [cuota("a")], 40000).motivo).toBe(MOTIVO_MONTO_DISTINTO);
  });

  it("una cuota que no existe no se convierte en Observado: es un error", () => {
    expect(() => estadoPagoPasarela(["a"], [], 45000)).toThrow(
      expect.objectContaining({ codigo: "CUOTA_NO_ENCONTRADA" }),
    );
  });
});

describe("devolución de un pago en línea Observado (US71)", () => {
  it("solo un pago en línea Observado admite la devolución", () => {
    expect(() => verificarDevolucionPosible({ origen: "PASARELA", estado: "OBSERVADO" })).not.toThrow();
    expect(() => verificarDevolucionPosible({ origen: "TESORERIA", estado: "OBSERVADO" })).toThrow(
      expect.objectContaining({ codigo: "DEVOLUCION_NO_PERMITIDA" }),
    );
    expect(() => verificarDevolucionPosible({ origen: "PASARELA", estado: "CONFIRMADO" })).toThrow(
      expect.objectContaining({ codigo: "DEVOLUCION_NO_PERMITIDA" }),
    );
  });

  it("un pago en línea Observado no se descarta como duplicado", () => {
    expect(() => verificarDescartable("TESORERIA")).not.toThrow();
    expect(() => verificarDescartable("PASARELA")).toThrow(expect.objectContaining({ codigo: "USAR_DEVOLUCION" }));
  });
});

describe("configuración de la pasarela (US70)", () => {
  const SECRETO = "secreto-de-prueba-0123456789";

  it("sin PASARELA el pago en línea queda apagado", () => {
    expect(leerConfigPasarela({ NODE_ENV: "test" })).toBeNull();
    expect(leerConfigPasarela({ NODE_ENV: "test", PASARELA: "" })).toBeNull();
  });

  it("Mercado Pago necesita el access token y la clave del webhook", () => {
    expect(leerConfigPasarela({ NODE_ENV: "test", PASARELA: "mercadopago", MP_WEBHOOK_SECRET: SECRETO })).toBeNull();
    expect(
      leerConfigPasarela({
        NODE_ENV: "test",
        PASARELA: "mercadopago",
        MP_ACCESS_TOKEN: "APP_USR-0000000000-prueba-ficticia",
        MP_WEBHOOK_SECRET: SECRETO,
      })?.PASARELA,
    ).toBe("mercadopago");
  });

  it("la pasarela falsa no se acepta en producción ni con un valor desconocido", () => {
    expect(leerConfigPasarela({ NODE_ENV: "test", PASARELA: "falsa", MP_WEBHOOK_SECRET: SECRETO })?.PASARELA).toBe(
      "falsa",
    );
    expect(leerConfigPasarela({ NODE_ENV: "production", PASARELA: "falsa", MP_WEBHOOK_SECRET: SECRETO })).toBeNull();
    expect(leerConfigPasarela({ NODE_ENV: "test", PASARELA: "paypal", MP_WEBHOOK_SECRET: SECRETO })).toBeNull();
  });
});

describe("firma x-signature del aviso (US70)", () => {
  const SECRETO = "secreto-de-prueba-0123456789";
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  // como Mercado Pago: el data.id va en minúsculas en el manifiesto (D-09)
  const firmar = (dataId: string, requestId: string, ts: string, secreto = SECRETO) =>
    `ts=${ts},v1=${createHmac("sha256", secreto)
      .update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`)
      .digest("hex")}`;

  it("acepta la firma calculada con la clave y rechaza otra clave, otro id o una firma ausente", () => {
    process.env.PASARELA = "falsa";
    process.env.MP_WEBHOOK_SECRET = SECRETO;
    const aviso = { dataId: "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3", requestId: "req-1" };
    expect(firmaAvisoValida({ ...aviso, firma: firmar(aviso.dataId, aviso.requestId, "1742505638") })).toBe(true);
    expect(
      firmaAvisoValida({ ...aviso, firma: firmar(aviso.dataId, aviso.requestId, "1742505638", "otra-clave-xxxxxxxx") }),
    ).toBe(false);
    expect(firmaAvisoValida({ ...aviso, firma: firmar("ORD-OTRA", aviso.requestId, "1742505638") })).toBe(false);
    expect(firmaAvisoValida({ ...aviso, firma: null })).toBe(false);
  });

  it("sin pasarela configurada no se valida nada", () => {
    delete process.env.PASARELA;
    expect(firmaAvisoValida({ dataId: "ORD1", requestId: "r", firma: "ts=1,v1=00" })).toBeNull();
  });
});
