// Pruebas del panel de morosidad (US24) y del pago anual adelantado (US58). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  conMinimoDeMeses,
  diasAtraso,
  estaVencida,
  etiquetasAdeudadas,
  mesesAdeudados,
  ordenarMorosidad,
} from "@/modules/matricula/domain/morosidad";
import {
  totalPendienteCentimos,
  verificarMontoAnual,
  verificarPagoAnualPosible,
} from "@/modules/matricula/domain/pagos";
import { aCentimos } from "@/modules/academico/domain/montos";
import { esquemasMatricula } from "@/modules/matricula";

const codigo = (c: string) => expect.objectContaining({ codigo: c });

describe("panel de morosidad (US24)", () => {
  const hoy = "2026-09-16";
  it("una cuota está vencida si sigue Pendiente después de su vencimiento (no el mismo día)", () => {
    expect(estaVencida({ estado: "PENDIENTE", fechaVencimiento: "2026-09-05" }, hoy)).toBe(true);
    expect(estaVencida({ estado: "PENDIENTE", fechaVencimiento: hoy }, hoy)).toBe(false);
    expect(estaVencida({ estado: "PAGADO", fechaVencimiento: "2026-09-05" }, hoy)).toBe(false);
    expect(estaVencida({ estado: "ANULADO", fechaVencimiento: "2026-09-05" }, hoy)).toBe(false);
  });
  it("meses adeudados: pensiones vencidas; la matrícula se muestra aparte", () => {
    const cuotas = [
      { tipo: "MATRICULA", mes: null },
      { tipo: "PENSION", mes: 8 },
      { tipo: "PENSION", mes: 9 },
    ];
    expect(etiquetasAdeudadas(cuotas)).toEqual(["Matr.", "Ago", "Set"]);
    expect(mesesAdeudados(cuotas)).toBe(2);
  });
  it("días de atraso desde el primer vencimiento impago", () => {
    expect(diasAtraso("2026-09-05", hoy)).toBe(11);
    expect(diasAtraso("2026-07-05", hoy)).toBe(73);
    expect(diasAtraso(hoy, hoy)).toBe(0);
  });

  const fila = (nombreCompleto: string, deuda: string, cuotasVencidas: number) => ({
    nombreCompleto,
    deudaCentimos: aCentimos(deuda),
    mesesAdeudados: cuotasVencidas,
    cuotasVencidas,
  });
  const lista = [
    fila("Valeria", "450.00", 1),
    fila("Camila", "1350.00", 3),
    fila("Andrés", "900.00", 2),
    fila("Bruno", "450.00", 1),
  ];

  it("filtro «Meses adeudados»: 2 o más", () => {
    expect(conMinimoDeMeses(lista, 2).map((f) => f.nombreCompleto)).toEqual(["Camila", "Andrés"]);
    expect(conMinimoDeMeses(lista)).toHaveLength(4);
  });
  it("orden por monto o por meses, de mayor a menor; a igualdad, por nombre", () => {
    expect(ordenarMorosidad(lista, "MONTO").map((f) => f.nombreCompleto)).toEqual([
      "Camila",
      "Andrés",
      "Bruno",
      "Valeria",
    ]);
    expect(ordenarMorosidad(lista, "MESES")[0].nombreCompleto).toBe("Camila");
  });
  it("filtros del panel: año obligatorio, grado y sección opcionales, orden por monto por defecto", () => {
    const anioId = "3f1c2a4e-1111-4b2c-9d3e-123456789abc";
    expect(esquemasMatricula.FiltroMorosidadSchema.parse({ anioId })).toEqual({ anioId, orden: "MONTO" });
    expect(esquemasMatricula.FiltroMorosidadSchema.safeParse({}).success).toBe(false);
    expect(esquemasMatricula.FiltroMorosidadSchema.parse({ anioId, mesesMinimos: "3" }).mesesMinimos).toBe(3);
  });
});

describe("pago anual adelantado (US58)", () => {
  const cuotas = [
    { estado: "PAGADO", montoCentimos: 35000 },
    { estado: "PAGADO", montoCentimos: 45000 },
    { estado: "PENDIENTE", montoCentimos: 45000 },
    { estado: "PENDIENTE", montoCentimos: 45000 },
    { estado: "ANULADO", montoCentimos: 45000 },
  ];
  it("total pendiente sin descuento y sin las pagadas ni las anuladas", () => {
    expect(totalPendienteCentimos(cuotas)).toBe(90000);
  });
  it("monto exacto; distinto: «El monto no coincide con el total pendiente»", () => {
    expect(() => verificarMontoAnual(aCentimos("900.00"), 90000)).not.toThrow();
    expect(() => verificarMontoAnual(aCentimos("899.99"), 90000)).toThrowError(
      expect.objectContaining({
        codigo: "MONTO_NO_COINCIDE_PENDIENTE",
        message: "El monto no coincide con el total pendiente",
        detalles: { total: "900.00" },
      }),
    );
  });
  it("solo para una matrícula Matriculado con cuotas pendientes", () => {
    expect(() => verificarPagoAnualPosible("MATRICULADO", "Matriculado", 2)).not.toThrow();
    expect(() => verificarPagoAnualPosible("RETIRADO", "Retirado", 2)).toThrowError(codigo("PAGO_ANUAL_NO_PERMITIDO"));
    expect(() => verificarPagoAnualPosible("MATRICULADO", "Matriculado", 0)).toThrowError(
      codigo("SIN_CUOTAS_PENDIENTES"),
    );
  });
  it("el esquema del pago anual no pide cuotas", () => {
    const datos = { monto: "900", medioPago: "TRANSFERENCIA", numeroOperacion: "00701244", fechaPago: "2026-09-18" };
    expect(esquemasMatricula.PagoAnualSchema.safeParse(datos).success).toBe(true);
  });
});
