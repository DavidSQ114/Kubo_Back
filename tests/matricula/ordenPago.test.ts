// Pruebas del orden de pago de las cuotas (D-14): primero la matrícula y luego las pensiones por vencimiento, en el
// pago manual (US22), el pago anual (US58) y el pago en línea (US70). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { verificarOrdenDePago, type CuotaParaOrden } from "@/modules/matricula/domain/pagos";

const ANIO = 2026;

const cuota = (
  id: string,
  tipo: CuotaParaOrden["tipo"],
  fechaVencimiento: string,
  estado: CuotaParaOrden["estado"] = "PENDIENTE",
): CuotaParaOrden => ({
  id,
  tipo,
  concepto: tipo === "MATRICULA" ? "Matrícula 2026" : `Pensión ${id}`,
  fechaVencimiento,
  estado,
});

/** Matrícula de marzo y pensiones de setiembre a diciembre, todo Pendiente. */
const cronograma = (estadoMatricula: CuotaParaOrden["estado"] = "PENDIENTE") => [
  cuota("matricula", "MATRICULA", "2026-03-01", estadoMatricula),
  cuota("setiembre", "PENSION", "2026-09-30"),
  cuota("octubre", "PENSION", "2026-10-31"),
  cuota("noviembre", "PENSION", "2026-11-30"),
  cuota("diciembre", "PENSION", "2026-12-31"),
];

const error = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e as { codigo: string; message: string; estadoHttp?: number; detalles?: unknown };
  }
  throw new Error("Se esperaba un error");
};

describe("orden de pago: matrícula pendiente (D-14, US22, US70)", () => {
  it("rechaza pensiones con la matrícula pendiente fuera de la operación, con el año de la matrícula", () => {
    const e = error(() => verificarOrdenDePago(["setiembre", "octubre", "noviembre"], cronograma(), ANIO));
    expect(e.codigo).toBe("MATRICULA_PENDIENTE");
    expect(e.message).toBe("Primero debe pagarse la matrícula 2026. Inclúyela en este pago o regístrala antes.");
  });

  it("usa el año de la matrícula, no uno fijo", () => {
    const e = error(() => verificarOrdenDePago(["setiembre"], cronograma(), 2027));
    expect(e.message).toContain("matrícula 2027");
  });

  it("acepta la matrícula en la misma operación que las pensiones", () => {
    expect(() => verificarOrdenDePago(["matricula", "setiembre", "octubre"], cronograma(), ANIO)).not.toThrow();
  });

  it("acepta pagar solo la matrícula", () => {
    expect(() => verificarOrdenDePago(["matricula"], cronograma(), ANIO)).not.toThrow();
  });

  it("no exige la matrícula si ya está pagada", () => {
    expect(() => verificarOrdenDePago(["setiembre"], cronograma("PAGADO"), ANIO)).not.toThrow();
  });
});

describe("orden de pago: pensiones por vencimiento (D-14)", () => {
  it("rechaza saltarse un mes y lista las cuotas anteriores que faltan", () => {
    const e = error(() => verificarOrdenDePago(["noviembre"], cronograma("PAGADO"), ANIO));
    expect(e.codigo).toBe("CUOTAS_ANTERIORES_PENDIENTES");
    expect(e.message).toBe("Primero deben pagarse las cuotas anteriores: Pensión setiembre, Pensión octubre.");
  });

  it("rechaza un hueco en medio aunque la primera vaya incluida", () => {
    const e = error(() => verificarOrdenDePago(["setiembre", "noviembre"], cronograma("PAGADO"), ANIO));
    expect(e.message).toBe("Primero deben pagarse las cuotas anteriores: Pensión octubre.");
  });

  it("acepta las pensiones en orden, sin importar el orden de los ids", () => {
    expect(() => verificarOrdenDePago(["octubre", "setiembre"], cronograma("PAGADO"), ANIO)).not.toThrow();
  });

  it("acepta una pensión cuando las anteriores ya están pagadas", () => {
    const cuotas = cronograma("PAGADO").map((c) => (c.id === "setiembre" ? { ...c, estado: "PAGADO" as const } : c));
    expect(() => verificarOrdenDePago(["octubre"], cuotas, ANIO)).not.toThrow();
  });

  it("no cuenta las cuotas anuladas", () => {
    const cuotas = cronograma("ANULADO").map((c) => (c.id === "setiembre" ? { ...c, estado: "ANULADO" as const } : c));
    expect(() => verificarOrdenDePago(["octubre"], cuotas, ANIO)).not.toThrow();
  });

  it("el pago anual con todas las pendientes cumple el orden (US58)", () => {
    const todas = cronograma().map((c) => c.id);
    expect(() => verificarOrdenDePago(todas, cronograma(), ANIO)).not.toThrow();
  });

  it("ignora los ids de otra matrícula", () => {
    expect(() => verificarOrdenDePago(["otra-matricula"], cronograma(), ANIO)).not.toThrow();
  });
});

describe("orden de pago con cuota de ingreso, mora y extraordinarias (bloque M4)", () => {
  const ingreso = cuota("ingreso", "INGRESO", "2026-03-01");
  const mora = (id: string, pension: string, estado: CuotaParaOrden["estado"] = "PENDIENTE"): CuotaParaOrden => ({
    ...cuota(id, "MORA", "2026-10-06", estado),
    concepto: `Mora de la pensión ${pension}`,
    cuotaOrigenId: pension,
  });
  const extra = cuota("extra", "EXTRAORDINARIA", "2026-10-20");

  it("la matrícula y la cuota de ingreso van juntas: sin la otra responde 409 INGRESO_CON_MATRICULA", () => {
    const cuotas = [...cronograma(), ingreso];
    const e = error(() => verificarOrdenDePago(["matricula"], cuotas, ANIO));
    expect(e.codigo).toBe("INGRESO_CON_MATRICULA");
    expect(e.estadoHttp).toBe(409);
    expect(error(() => verificarOrdenDePago(["ingreso"], cuotas, ANIO)).codigo).toBe("INGRESO_CON_MATRICULA");
    expect(() => verificarOrdenDePago(["matricula", "ingreso"], cuotas, ANIO)).not.toThrow();
  });

  it("con la cuota de ingreso pendiente no se paga una pensión (MATRICULA_PENDIENTE)", () => {
    const cuotas = [...cronograma("PAGADO"), ingreso];
    const e = error(() => verificarOrdenDePago(["setiembre"], cuotas, ANIO));
    expect(e.codigo).toBe("MATRICULA_PENDIENTE");
    expect(e.message).toContain("cuota de ingreso");
    expect(() => verificarOrdenDePago(["ingreso", "setiembre"], cuotas, ANIO)).not.toThrow();
  });

  it("la mora va en la misma operación que su pensión, y la pensión con su mora (MORA_CON_PENSION)", () => {
    const cuotas = [...cronograma("PAGADO"), mora("moraSet", "setiembre")];
    expect(error(() => verificarOrdenDePago(["setiembre"], cuotas, ANIO)).codigo).toBe("MORA_CON_PENSION");
    expect(error(() => verificarOrdenDePago(["moraSet"], cuotas, ANIO)).codigo).toBe("MORA_CON_PENSION");
    expect(() => verificarOrdenDePago(["setiembre", "moraSet"], cuotas, ANIO)).not.toThrow();
  });

  it("una mora condonada no se exige con su pensión", () => {
    const cuotas = [...cronograma("PAGADO"), mora("moraSet", "setiembre", "ANULADO")];
    expect(() => verificarOrdenDePago(["setiembre"], cuotas, ANIO)).not.toThrow();
  });

  it("si la pensión ya no está pendiente, la mora se paga sola", () => {
    const cuotas = [
      ...cronograma("PAGADO").map((c) => (c.id === "setiembre" ? { ...c, estado: "ANULADO" as const } : c)),
      mora("moraSet", "setiembre"),
    ];
    expect(() => verificarOrdenDePago(["moraSet"], cuotas, ANIO)).not.toThrow();
  });

  it("las pensiones siguen en orden aunque cada una lleve su mora", () => {
    const cuotas = [...cronograma("PAGADO"), mora("moraSet", "setiembre"), mora("moraOct", "octubre")];
    const e = error(() => verificarOrdenDePago(["octubre", "moraOct"], cuotas, ANIO));
    expect(e.codigo).toBe("CUOTAS_ANTERIORES_PENDIENTES");
    expect(() => verificarOrdenDePago(["setiembre", "moraSet", "octubre", "moraOct"], cuotas, ANIO)).not.toThrow();
  });

  it("una extraordinaria se paga cuando se quiera, aunque la matrícula esté pendiente", () => {
    const cuotas = [...cronograma(), ingreso, extra];
    expect(() => verificarOrdenDePago(["extra"], cuotas, ANIO)).not.toThrow();
  });

  it("el pago anual con todas las pendientes (moras y extraordinarias incluidas) cumple el orden (US58)", () => {
    const cuotas = [...cronograma(), ingreso, mora("moraSet", "setiembre"), extra];
    expect(() =>
      verificarOrdenDePago(
        cuotas.map((c) => c.id),
        cuotas,
        ANIO,
      ),
    ).not.toThrow();
  });
});
