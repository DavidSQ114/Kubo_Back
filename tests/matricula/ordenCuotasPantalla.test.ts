// Pruebas de la selección de cuotas en orden en AD-11 (M-01) y en el modal «Pagar en línea» de AP-02 (D-14).
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  alternarEnOrden,
  avisoEnRevision,
  cuotaEnRevision,
  cuotasElegibles,
  esFija,
  ordenarParaPago,
  puedeMarcarse,
  seleccionEnOrden,
  type CuotaOrdenable,
} from "@/lib/ordenCuotas";

const cuota = (id: string, tipo: CuotaOrdenable["tipo"], fechaVencimiento: string, pagable = true) => ({
  id,
  tipo,
  fechaVencimiento,
  pagable,
});

// llegan desordenadas a propósito
const orden = ordenarParaPago([
  cuota("octubre", "PENSION", "2026-10-31"),
  cuota("setiembre", "PENSION", "2026-09-30"),
  cuota("matricula", "MATRICULA", "2026-11-20"),
  cuota("noviembre", "PENSION", "2026-11-30"),
]);
const ids = (s: Set<string>) => [...s].sort();

describe("selección de cuotas en orden en la pantalla (D-14, AD-11, AP-02)", () => {
  it("ordena la matrícula primero y luego las pensiones por vencimiento", () => {
    expect(orden.map((c) => c.id)).toEqual(["matricula", "setiembre", "octubre", "noviembre"]);
  });

  it("marca la matrícula pendiente y fija aunque no se pida", () => {
    const elegidas = seleccionEnOrden(orden, []);
    expect(ids(elegidas)).toEqual(["matricula"]);
    expect(esFija(orden[0])).toBe(true);
    expect(alternarEnOrden(orden, elegidas, "matricula", false)).toBe(elegidas);
  });

  it("al pedir una pensión marca también las anteriores", () => {
    expect(ids(seleccionEnOrden(orden, ["octubre"]))).toEqual(["matricula", "octubre", "setiembre"]);
  });

  it("solo deja marcar una pensión si las anteriores están marcadas", () => {
    const elegidas = seleccionEnOrden(orden, []);
    expect(puedeMarcarse(orden, elegidas, "octubre")).toBe(false);
    expect(alternarEnOrden(orden, elegidas, "octubre", true)).toBe(elegidas);
    expect(ids(alternarEnOrden(orden, elegidas, "setiembre", true))).toEqual(["matricula", "setiembre"]);
  });

  it("al desmarcar una pensión desmarca las posteriores", () => {
    const todas = seleccionEnOrden(orden, ["noviembre"]);
    expect(ids(alternarEnOrden(orden, todas, "octubre", false))).toEqual(["matricula", "setiembre"]);
  });

  it("una cuota pendiente que no es pagable (pago en revisión) bloquea las posteriores", () => {
    const conRevision = ordenarParaPago([
      cuota("matricula", "MATRICULA", "2026-03-01", false),
      cuota("setiembre", "PENSION", "2026-09-30"),
    ]);
    expect(ids(seleccionEnOrden(conRevision, ["setiembre"]))).toEqual([]);
    expect(puedeMarcarse(conRevision, new Set(), "setiembre")).toBe(false);
  });

  it("con una pensión en revisión avisa cuál es y solo deja elegir las anteriores (CP-D14-15)", () => {
    const conRevision = ordenarParaPago([
      cuota("matricula", "MATRICULA", "2026-03-01"),
      cuota("setiembre", "PENSION", "2026-09-30", false),
      cuota("octubre", "PENSION", "2026-10-31"),
    ]);
    expect(cuotaEnRevision(conRevision)?.id).toBe("setiembre");
    expect(cuotasElegibles(conRevision).map((c) => c.id)).toEqual(["matricula"]);
    expect(avisoEnRevision("Pensión de setiembre 2026")).toBe(
      "La pensión de setiembre 2026 tiene un pago en revisión. Las cuotas siguientes se podrán pagar cuando se confirme.",
    );
  });

  it("con la matrícula en revisión no queda ninguna cuota elegible (CP-D14-15)", () => {
    const conRevision = ordenarParaPago([
      cuota("matricula", "MATRICULA", "2026-03-01", false),
      cuota("setiembre", "PENSION", "2026-09-30"),
    ]);
    expect(cuotaEnRevision(conRevision)?.id).toBe("matricula");
    expect(cuotasElegibles(conRevision)).toEqual([]);
    expect(avisoEnRevision("Matrícula 2026")).toMatch(/^La matrícula 2026 tiene un pago en revisión\./);
  });

  it("sin cuotas en revisión no hay aviso y todas son elegibles", () => {
    expect(cuotaEnRevision(orden)).toBeNull();
    expect(cuotasElegibles(orden)).toHaveLength(orden.length);
  });
});
