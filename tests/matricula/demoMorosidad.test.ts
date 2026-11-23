// Reglas de los datos de demostración de morosidad (US24, US26, US59; scripts/demoMorosidad.ts).
import { describe, expect, it } from "vitest";
import {
  pensionesFaltantes,
  pensionesVencidas,
  referenciaPension,
  vencimientoMatriculaAMover,
  verificarAjusteDemo,
  type CuotaExistente,
} from "@/modules/matricula/domain/demoMorosidad";
import { DemoMorosidadSchema } from "@/modules/matricula/schemas";

// matrícula confirmada el 18 de noviembre: solo tiene la cuota de matrícula y la pensión de diciembre (día 7)
const EXISTENTES: CuotaExistente[] = [
  { tipo: "MATRICULA", mes: null, montoCentimos: 30000, fechaVencimiento: "2026-11-18" },
  { tipo: "PENSION", mes: 12, montoCentimos: 40000, fechaVencimiento: "2026-12-07" },
];

describe("verificarAjusteDemo (US24)", () => {
  const base = { estado: "MATRICULADO", fechaMatricula: "2026-11-18", pagos: 0, anio: 2026, desde: "2026-09-01" };

  it("acepta una matrícula vigente sin pagos y una fecha anterior del mismo año", () => {
    expect(() => verificarAjusteDemo(base)).not.toThrow();
    expect(() => verificarAjusteDemo({ ...base, estado: "EN_PROCESO" })).not.toThrow();
  });

  it("acepta la misma fecha (segunda ejecución)", () => {
    expect(() => verificarAjusteDemo({ ...base, fechaMatricula: "2026-09-01" })).not.toThrow();
  });

  it("rechaza una matrícula retirada o anulada", () => {
    expect(() => verificarAjusteDemo({ ...base, estado: "RETIRADO" })).toThrow(/retirada/);
    expect(() => verificarAjusteDemo({ ...base, estado: "ANULADO" })).toThrow(/anulada/);
  });

  it("rechaza si alguna cuota tiene pagos", () => {
    expect(() => verificarAjusteDemo({ ...base, pagos: 1 })).toThrow(
      expect.objectContaining({ codigo: "DEMO_CUOTAS_CON_PAGOS" }),
    );
  });

  it("rechaza una fecha de otro año o posterior a la matrícula actual", () => {
    expect(() => verificarAjusteDemo({ ...base, desde: "2025-09-01" })).toThrow(/del año 2026/);
    expect(() => verificarAjusteDemo({ ...base, desde: "2026-11-20" })).toThrow(/posterior/);
  });
});

describe("pensionesFaltantes (US21)", () => {
  it("usa el día de vencimiento y el monto de las pensiones existentes", () => {
    expect(referenciaPension(EXISTENTES)).toEqual({ dia: 7, montoCentimos: 40000 });
    expect(referenciaPension(EXISTENTES.slice(0, 1))).toBeNull();
  });

  it("agrega setiembre, octubre y noviembre sin repetir diciembre", () => {
    const r = pensionesFaltantes({
      anio: 2026,
      desde: "2026-09-01",
      dia: 7,
      montoCentimos: 40000,
      existentes: EXISTENTES,
    });
    expect(r.map((c) => [c.mes, c.fechaVencimiento, c.montoCentimos])).toEqual([
      [9, "2026-09-07", 40000],
      [10, "2026-10-07", 40000],
      [11, "2026-11-07", 40000],
    ]);
  });

  it("no agrega nada si ya están todas", () => {
    const todas: CuotaExistente[] = [9, 10, 11, 12].map((mes) => ({
      tipo: "PENSION",
      mes,
      montoCentimos: 40000,
      fechaVencimiento: `2026-${String(mes).padStart(2, "0")}-07`,
    }));
    expect(
      pensionesFaltantes({ anio: 2026, desde: "2026-09-01", dia: 7, montoCentimos: 40000, existentes: todas }),
    ).toEqual([]);
  });
});

describe("pensionesVencidas (US24)", () => {
  it("cuenta solo pensiones Pendiente con vencimiento anterior a hoy", () => {
    const cuotas = [
      { tipo: "MATRICULA", estado: "PENDIENTE", fechaVencimiento: "2026-09-01" },
      { tipo: "PENSION", estado: "PENDIENTE", fechaVencimiento: "2026-09-05" },
      { tipo: "PENSION", estado: "PAGADO", fechaVencimiento: "2026-10-05" },
      { tipo: "PENSION", estado: "PENDIENTE", fechaVencimiento: "2026-11-18" },
    ];
    expect(pensionesVencidas(cuotas, "2026-11-18")).toBe(1);
  });
});

describe("DemoMorosidadSchema", () => {
  it("usa 2026-09-01 si no se indica --desde", () => {
    expect(DemoMorosidadSchema.parse({ dni: "90000001" })).toEqual({ dni: "90000001", desde: "2026-09-01" });
  });

  it("rechaza un DNI que no tiene 8 dígitos o una fecha inexistente", () => {
    expect(() => DemoMorosidadSchema.parse({ dni: "1234" })).toThrow(/8 dígitos/);
    expect(() => DemoMorosidadSchema.parse({ dni: "90000001", desde: "2026-02-30" })).toThrow(/AAAA-MM-DD/);
  });
});

describe("vencimientoMatriculaAMover (D-14)", () => {
  it("mueve el vencimiento de la cuota de matrícula a la fecha nueva", () => {
    expect(vencimientoMatriculaAMover(EXISTENTES, "2026-09-01")).toBe("2026-11-18");
  });

  it("no hace nada si ya vence en esa fecha o si no hay cuota de matrícula", () => {
    expect(vencimientoMatriculaAMover(EXISTENTES, "2026-11-18")).toBeNull();
    expect(vencimientoMatriculaAMover(EXISTENTES.slice(1), "2026-09-01")).toBeNull();
  });
});
