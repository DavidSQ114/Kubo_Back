// Pruebas de los pagos manuales (US22), los duplicados (US23), la anulación (US04) y el correlativo del recibo (US25).
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  estadoInicialPago,
  normalizarNumeroOperacion,
  numeroComprobante,
  siguienteComprobante,
  verificarCuotasPagables,
  verificarFechaPago,
  verificarMontoExacto,
  verificarMotivoAnulacionPago,
  verificarObservado,
  verificarPagoAnulable,
  verificarReciboDisponible,
  type CuotaParaPago,
} from "@/modules/matricula/domain/pagos";
import { aCentimos } from "@/modules/academico/domain/montos";
import { esquemasMatricula } from "@/modules/matricula";

const codigo = (c: string) => expect.objectContaining({ codigo: c });

const cuota = (id: string, estado: CuotaParaPago["estado"] = "PENDIENTE", extra: Partial<CuotaParaPago> = {}) => ({
  id,
  estudianteId: "valeria",
  estado,
  montoCentimos: 45000,
  ...extra,
});

describe("registro de pago manual (US22)", () => {
  it("suma exacta en céntimos de las cuotas elegidas", () => {
    const suma = verificarCuotasPagables(["set", "oct"], [cuota("set"), cuota("oct"), cuota("nov")]);
    expect(suma).toBe(90000);
    expect(() => verificarMontoExacto(aCentimos("900.00"), suma)).not.toThrow();
    expect(() => verificarMontoExacto(aCentimos("900"), suma)).not.toThrow();
  });
  it("monto distinto: «El monto ingresado no coincide con el total de las cuotas seleccionadas»", () => {
    expect(() => verificarMontoExacto(aCentimos("899.99"), 90000)).toThrowError(
      expect.objectContaining({
        codigo: "MONTO_NO_COINCIDE",
        message: "El monto ingresado no coincide con el total de las cuotas seleccionadas",
        detalles: { total: "900.00" },
      }),
    );
    expect(() => verificarMontoExacto(aCentimos("450"), 90000)).toThrowError(codigo("MONTO_NO_COINCIDE"));
  });
  it("sin float: 0.10 + 0.20 en céntimos es exactamente 0.30", () => {
    const suma = verificarCuotasPagables(
      ["a", "b"],
      [
        cuota("a", "PENDIENTE", { montoCentimos: aCentimos("0.10") }),
        cuota("b", "PENDIENTE", { montoCentimos: aCentimos("0.20") }),
      ],
    );
    expect(() => verificarMontoExacto(aCentimos("0.30"), suma)).not.toThrow();
  });
  it("sin número de operación: «El número de operación es obligatorio»", () => {
    for (const vacio of ["", "   ", null, undefined]) {
      expect(() => normalizarNumeroOperacion(vacio)).toThrowError(
        expect.objectContaining({
          codigo: "NUMERO_OPERACION_REQUERIDO",
          message: "El número de operación es obligatorio",
        }),
      );
    }
    expect(normalizarNumeroOperacion("  op  00561207 ")).toBe("OP 00561207");
  });
  it("cuotas: al menos una, sin repetir, existentes y del mismo estudiante", () => {
    expect(() => verificarCuotasPagables([], [])).toThrowError(codigo("SIN_CUOTAS"));
    expect(() => verificarCuotasPagables(["a", "a"], [cuota("a")])).toThrowError(codigo("CUOTA_REPETIDA"));
    expect(() => verificarCuotasPagables(["x"], [cuota("a")])).toThrowError(codigo("CUOTA_NO_ENCONTRADA"));
    expect(() =>
      verificarCuotasPagables(["a", "b"], [cuota("a"), cuota("b", "PENDIENTE", { estudianteId: "diego" })]),
    ).toThrowError(codigo("CUOTAS_DE_VARIOS_ESTUDIANTES"));
    expect(() => verificarCuotasPagables(["a"], [cuota("a", "ANULADO")])).toThrowError(codigo("CUOTA_ANULADA"));
  });
  it("la fecha de pago no puede ser futura", () => {
    expect(() => verificarFechaPago("2026-11-06", "2026-11-06")).not.toThrow();
    expect(() => verificarFechaPago("2026-11-07", "2026-11-06")).toThrowError(codigo("FECHA_PAGO_FUTURA"));
  });
});

describe("pagos duplicados (US23)", () => {
  it("cuota ya pagada: «Esta pensión ya fue cancelada el [fecha]»", () => {
    expect(() => verificarCuotasPagables(["jul"], [cuota("jul", "PAGADO", { pagadaEl: "2026-07-03" })])).toThrowError(
      expect.objectContaining({ codigo: "CUOTA_YA_PAGADA", message: "Esta pensión ya fue cancelada el 03/07/2026" }),
    );
  });
  it("número de operación repetido: la operación queda Observado; si no, Confirmado", () => {
    expect(estadoInicialPago(true)).toBe("OBSERVADO");
    expect(estadoInicialPago(false)).toBe("CONFIRMADO");
  });
  it("solo una operación Observado se confirma o se descarta", () => {
    expect(() => verificarObservado("OBSERVADO")).not.toThrow();
    expect(() => verificarObservado("CONFIRMADO")).toThrowError(codigo("PAGO_NO_OBSERVADO"));
    expect(() => verificarObservado("ANULADO")).toThrowError(codigo("PAGO_NO_OBSERVADO"));
  });
  it("una cuota que volvió a Pendiente por una anulación se puede pagar otra vez", () => {
    expect(verificarCuotasPagables(["jul"], [cuota("jul", "PENDIENTE")])).toBe(45000);
  });
});

describe("anulación de pagos (US04)", () => {
  it("exige un motivo de la lista; con «Otro» el detalle es obligatorio", () => {
    expect(verificarMotivoAnulacionPago("PAGO_DUPLICADO")).toBe("PAGO_DUPLICADO");
    expect(verificarMotivoAnulacionPago("OTRO", "Se cobró a otra familia")).toBe("OTRO");
    expect(() => verificarMotivoAnulacionPago(null)).toThrowError(codigo("MOTIVO_ANULACION_REQUERIDO"));
    expect(() => verificarMotivoAnulacionPago("OTRO", "  ")).toThrowError(codigo("DETALLE_ANULACION_REQUERIDO"));
  });
  it("una operación Anulado no se anula otra vez", () => {
    expect(() => verificarPagoAnulable("CONFIRMADO")).not.toThrow();
    expect(() => verificarPagoAnulable("OBSERVADO")).not.toThrow();
    expect(() => verificarPagoAnulable("ANULADO")).toThrowError(codigo("PAGO_YA_ANULADO"));
  });
});

describe("recibo y correlativo (US25)", () => {
  it("número correlativo «R-2026-000001» y el siguiente sin huecos", () => {
    expect(numeroComprobante(2026, 1)).toBe("R-2026-000001");
    expect(siguienteComprobante(2026, null)).toBe("R-2026-000001");
    expect(siguienteComprobante(2026, "R-2026-000041")).toBe("R-2026-000042");
    expect(siguienteComprobante(2027, null)).toBe("R-2027-000001");
  });
  it("Observado o sin comprobante: «No se puede generar un recibo de un pago no confirmado»", () => {
    expect(() => verificarReciboDisponible("CONFIRMADO", true)).not.toThrow();
    expect(() => verificarReciboDisponible("ANULADO", true)).not.toThrow();
    expect(() => verificarReciboDisponible("OBSERVADO", false)).toThrowError(
      expect.objectContaining({
        codigo: "RECIBO_NO_CONFIRMADO",
        message: "No se puede generar un recibo de un pago no confirmado",
      }),
    );
    expect(() => verificarReciboDisponible("ANULADO", false)).toThrowError(codigo("RECIBO_NO_CONFIRMADO"));
  });
});

describe("esquema del pago (RNF16)", () => {
  const uuid = "3f1c2a4e-1111-4b2c-9d3e-123456789abc";
  const base = { conceptoIds: [uuid], monto: "450.00", medioPago: "TRANSFERENCIA", fechaPago: "2026-11-06" };
  it("acepta el pago y deja que falte el número para responder el mensaje del Backlog", () => {
    expect(esquemasMatricula.PagoSchema.safeParse(base).success).toBe(true);
  });
  it("rechaza montos con tres decimales, negativos o en texto, y medios fuera de la lista", () => {
    for (const monto of ["450.001", "-450", "cuatrocientos"]) {
      expect(esquemasMatricula.PagoSchema.safeParse({ ...base, monto }).success).toBe(false);
    }
    expect(esquemasMatricula.PagoSchema.safeParse({ ...base, medioPago: "YAPE" }).success).toBe(false);
    expect(esquemasMatricula.PagoSchema.safeParse({ ...base, conceptoIds: [] }).success).toBe(false);
  });
});
