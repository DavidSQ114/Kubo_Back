// Pruebas de la mora de las pensiones vencidas (bloque M4 · fase 2): generación idempotente, monto 0, condonación y
// cómo la muestra el panel de morosidad (US24). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  conceptoMora,
  morasPorGenerar,
  motivoValido,
  verificarMoraCondonable,
  type PensionParaMora,
} from "@/modules/matricula/domain/mora";
import { cuotasVencidasSinMora, etiquetasAdeudadas } from "@/modules/matricula/domain/morosidad";

const hoy = "2026-09-10";
const pension = (mes: number, extra: Partial<PensionParaMora> = {}): PensionParaMora => ({
  id: `p${mes}`,
  matriculaId: "m1",
  tipo: "PENSION",
  mes,
  concepto: `Pensión de ${mes === 8 ? "agosto" : mes === 9 ? "setiembre" : "octubre"} 2026`,
  estado: "PENDIENTE",
  fechaVencimiento: `2026-${String(mes).padStart(2, "0")}-05`,
  tieneMora: false,
  ...extra,
});

describe("generación de la mora (bloque M4)", () => {
  it("crea una mora por cada pensión vencida, con el monto del año y vencimiento hoy", () => {
    const moras = morasPorGenerar([pension(8), pension(9), pension(10)], 2000, hoy);
    expect(moras).toEqual([
      {
        cuotaOrigenId: "p8",
        matriculaId: "m1",
        mes: 8,
        concepto: "Mora de la pensión de agosto 2026",
        montoCentimos: 2000,
        fechaVencimiento: hoy,
      },
      {
        cuotaOrigenId: "p9",
        matriculaId: "m1",
        mes: 9,
        concepto: "Mora de la pensión de setiembre 2026",
        montoCentimos: 2000,
        fechaVencimiento: hoy,
      },
    ]);
  });
  it("es idempotente: una pensión que ya tiene su mora no genera otra", () => {
    expect(morasPorGenerar([pension(8, { tieneMora: true }), pension(9)], 2000, hoy).map((m) => m.mes)).toEqual([9]);
  });
  it("con el monto de mora en 0 no genera ninguna", () => {
    expect(morasPorGenerar([pension(8), pension(9)], 0, hoy)).toEqual([]);
  });
  it("el día del vencimiento todavía no hay mora, ni en pensiones pagadas o anuladas", () => {
    expect(morasPorGenerar([pension(9)], 2000, "2026-09-05")).toEqual([]);
    expect(morasPorGenerar([pension(8, { estado: "PAGADO" }), pension(9, { estado: "ANULADO" })], 2000, hoy)).toEqual(
      [],
    );
  });
  it("solo las pensiones generan mora (no la matrícula ni otras cuotas)", () => {
    expect(morasPorGenerar([pension(8, { tipo: "MATRICULA" }), pension(9, { tipo: "MORA" })], 2000, hoy)).toEqual([]);
  });
  it("el concepto nombra la pensión de origen", () => {
    expect(conceptoMora("Pensión de octubre 2026")).toBe("Mora de la pensión de octubre 2026");
  });
});

describe("condonar una mora (bloque M4)", () => {
  it("permite condonar una mora pendiente", () => {
    expect(() => verificarMoraCondonable({ tipo: "MORA", estado: "PENDIENTE" })).not.toThrow();
  });
  it("rechaza otras cuotas, una mora pagada o ya condonada", () => {
    expect(() => verificarMoraCondonable({ tipo: "PENSION", estado: "PENDIENTE" })).toThrow(
      "Solo se puede condonar una cuota de mora.",
    );
    expect(() => verificarMoraCondonable({ tipo: "MORA", estado: "PAGADO" })).toThrow("ya fue pagada");
    expect(() => verificarMoraCondonable({ tipo: "MORA", estado: "ANULADO" })).toThrow("ya fue condonada");
  });
  it("exige el motivo y lo limpia", () => {
    expect(motivoValido("  acuerdo   con la familia ")).toBe("acuerdo con la familia");
    expect(() => motivoValido("   ")).toThrow("Escribe el motivo.");
  });
});

describe("la mora en el panel de morosidad (US24, bloque M4)", () => {
  it("se etiqueta con el mes de su pensión y las otras cuotas con su tipo", () => {
    expect(
      etiquetasAdeudadas([
        { tipo: "MATRICULA", mes: null },
        { tipo: "INGRESO", mes: null },
        { tipo: "PENSION", mes: 8 },
        { tipo: "MORA", mes: 8 },
        { tipo: "EXTRAORDINARIA", mes: null },
      ]),
    ).toEqual(["Matr.", "Ingr.", "Ago", "Mora Ago", "Extr."]);
  });
  it("las moras no cuentan como cuotas vencidas para el filtro de meses", () => {
    expect(cuotasVencidasSinMora(["PENSION", "MORA", "PENSION", "MORA", "MATRICULA"])).toBe(3);
  });
});
