// Pruebas de la restricción de la libreta por deuda (US26): pensiones vencidas con el criterio de US24.
import { describe, expect, it } from "vitest";
import { pensionesVencidas, restringeLibreta } from "@/modules/matricula/domain/morosidad";

describe("restricción de la libreta por deuda (US26)", () => {
  const hoy = "2026-10-06";
  const cuotas = [
    { tipo: "MATRICULA", estado: "PENDIENTE", fechaVencimiento: "2026-03-01" },
    { tipo: "PENSION", estado: "PENDIENTE", fechaVencimiento: "2026-08-05" },
    { tipo: "PENSION", estado: "PENDIENTE", fechaVencimiento: "2026-09-05" },
    { tipo: "PENSION", estado: "PAGADO", fechaVencimiento: "2026-07-05" },
    { tipo: "PENSION", estado: "PENDIENTE", fechaVencimiento: "2026-10-06" },
  ];

  it("cuenta solo pensiones Pendiente con vencimiento anterior a hoy", () => {
    expect(pensionesVencidas(cuotas, hoy).map((c) => c.fechaVencimiento)).toEqual(["2026-08-05", "2026-09-05"]);
  });

  it("restringe con 2 o más pensiones vencidas y no con 1", () => {
    expect(restringeLibreta(2, 2)).toBe(true);
    expect(restringeLibreta(1, 2)).toBe(false);
  });

  it("al pagar una de las dos pensiones, la restricción se levanta en la siguiente consulta", () => {
    const pagada = cuotas.map((c) => (c.fechaVencimiento === "2026-08-05" ? { ...c, estado: "PAGADO" } : c));
    expect(restringeLibreta(pensionesVencidas(pagada, hoy).length, 2)).toBe(false);
  });
});
