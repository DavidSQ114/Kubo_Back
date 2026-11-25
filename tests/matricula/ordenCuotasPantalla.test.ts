// Pruebas de la selección de cuotas en orden en AD-11 (M-01) y en el modal «Pagar en línea» de AP-02 (D-14),
// con la cuota de ingreso, la mora y las cuotas extraordinarias del bloque M4.
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  alternarEnOrden,
  avisoEnRevision,
  cuotaEnRevision,
  cuotasElegibles,
  ordenarParaPago,
  puedeMarcarse,
  seleccionEnOrden,
  type CuotaOrdenable,
} from "@/lib/ordenCuotas";

const cuota = (
  id: string,
  tipo: CuotaOrdenable["tipo"],
  fechaVencimiento: string,
  pagable = true,
  cuotaOrigenId: string | null = null,
) => ({ id, tipo, fechaVencimiento, pagable, cuotaOrigenId });

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

  it("marca la matrícula pendiente aunque no se pida; al desmarcarla se desmarcan las pensiones", () => {
    const elegidas = seleccionEnOrden(orden, []);
    expect(ids(elegidas)).toEqual(["matricula"]);
    expect(ids(alternarEnOrden(orden, seleccionEnOrden(orden, ["octubre"]), "matricula", false))).toEqual([]);
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

describe("selección con cuota de ingreso, mora y extraordinarias (bloque M4)", () => {
  const conM4 = ordenarParaPago([
    cuota("extra", "EXTRAORDINARIA", "2026-10-15"),
    cuota("moraSet", "MORA", "2026-09-10", true, "setiembre"),
    cuota("octubre", "PENSION", "2026-10-05"),
    cuota("setiembre", "PENSION", "2026-09-05"),
    cuota("ingreso", "INGRESO", "2026-03-01"),
    cuota("matricula", "MATRICULA", "2026-03-01"),
    cuota("moraHuerfana", "MORA", "2026-08-10", true, "agosto"),
  ]);

  it("ordena matrícula, ingreso, cada pensión con su mora y al final las libres", () => {
    expect(conM4.map((c) => c.id)).toEqual([
      "matricula",
      "ingreso",
      "setiembre",
      "moraSet",
      "octubre",
      "moraHuerfana",
      "extra",
    ]);
  });

  it("la matrícula y la cuota de ingreso se marcan y desmarcan juntas", () => {
    expect(ids(seleccionEnOrden(conM4, []))).toEqual(["ingreso", "matricula"]);
    expect(ids(alternarEnOrden(conM4, new Set(), "ingreso", true))).toEqual(["ingreso", "matricula"]);
    expect(ids(alternarEnOrden(conM4, new Set(["ingreso", "matricula"]), "matricula", false))).toEqual([]);
  });

  it("marcar una pensión marca su mora, y desmarcar la mora desmarca la pensión y las posteriores", () => {
    const inicio = seleccionEnOrden(conM4, []);
    const conSetiembre = alternarEnOrden(conM4, inicio, "setiembre", true);
    expect(ids(conSetiembre)).toEqual(["ingreso", "matricula", "moraSet", "setiembre"]);
    const conOctubre = alternarEnOrden(conM4, conSetiembre, "octubre", true);
    expect(ids(alternarEnOrden(conM4, conOctubre, "moraSet", false))).toEqual(["ingreso", "matricula"]);
  });

  it("una extraordinaria o una mora sin pensión pendiente se marcan solas, sin la matrícula", () => {
    expect(puedeMarcarse(conM4, new Set(), "extra")).toBe(true);
    expect(ids(alternarEnOrden(conM4, new Set(), "extra", true))).toEqual(["extra"]);
    expect(ids(alternarEnOrden(conM4, new Set(), "moraHuerfana", true))).toEqual(["moraHuerfana"]);
    expect(puedeMarcarse(conM4, new Set(), "setiembre")).toBe(false);
  });

  it("al pedir una extraordinaria se marca junto con el inicio, y desmarcar el inicio no la quita", () => {
    const elegidas = seleccionEnOrden(conM4, ["extra"]);
    expect(ids(elegidas)).toEqual(["extra", "ingreso", "matricula"]);
    expect(ids(alternarEnOrden(conM4, elegidas, "matricula", false))).toEqual(["extra"]);
  });

  it("una extraordinaria en revisión no bloquea la cadena", () => {
    const conRevision = ordenarParaPago([
      cuota("matricula", "MATRICULA", "2026-03-01"),
      cuota("setiembre", "PENSION", "2026-09-05"),
      cuota("extra", "EXTRAORDINARIA", "2026-08-01", false),
    ]);
    expect(cuotaEnRevision(conRevision)).toBeNull();
    expect(cuotasElegibles(conRevision).map((c) => c.id)).toEqual(["matricula", "setiembre"]);
  });
});
