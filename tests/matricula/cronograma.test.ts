// Pruebas del cronograma de pagos que se genera al confirmar la matrícula (US21, RF16). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  diaVencimientoValido,
  esExtemporanea,
  generarCronograma,
  rangoPensiones,
  totalCentimos,
} from "@/modules/matricula/domain/cronograma";

const base = { anio: 2026, montoMatriculaCentimos: 35000, montoPensionCentimos: 45000 };

describe("cronograma de una matrícula oportuna (US21)", () => {
  const cuotas = generarCronograma({ ...base, fechaMatricula: "2026-02-20" });

  it("genera la cuota de matrícula y 10 pensiones de marzo a diciembre", () => {
    expect(cuotas).toHaveLength(11);
    expect(cuotas[0]).toEqual({
      tipo: "MATRICULA",
      mes: null,
      concepto: "Matrícula 2026",
      montoCentimos: 35000,
      fechaVencimiento: "2026-02-20",
    });
    expect(cuotas.slice(1).map((c) => c.mes)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it("las pensiones vencen el día 5 de cada mes con el monto del año", () => {
    expect(cuotas[1]).toEqual({
      tipo: "PENSION",
      mes: 3,
      concepto: "Pensión de marzo 2026",
      montoCentimos: 45000,
      fechaVencimiento: "2026-03-05",
    });
    expect(cuotas[10].fechaVencimiento).toBe("2026-12-05");
  });
  it("suma S/ 4 850.00 sin errores de coma flotante", () => {
    expect(totalCentimos(cuotas)).toBe(485000);
    expect(esExtemporanea(cuotas)).toBe(false);
  });
  it("matricular el 2 de marzo todavía incluye la pensión de marzo (vence el 5)", () => {
    expect(generarCronograma({ ...base, fechaMatricula: "2026-03-02" })).toHaveLength(11);
  });
  it("matricular en noviembre para el año siguiente genera las 10 pensiones", () => {
    const siguiente = generarCronograma({ ...base, anio: 2027, fechaMatricula: "2026-11-06" });
    expect(siguiente).toHaveLength(11);
    expect(siguiente[1].fechaVencimiento).toBe("2027-03-05");
  });
});

describe("cronograma de una matrícula extemporánea (US21)", () => {
  it("en setiembre solo genera las pensiones de octubre a diciembre", () => {
    const cuotas = generarCronograma({ ...base, fechaMatricula: "2026-09-16" });
    expect(cuotas.map((c) => c.mes)).toEqual([null, 10, 11, 12]);
    expect(cuotas[0].fechaVencimiento).toBe("2026-09-16");
    expect(esExtemporanea(cuotas)).toBe(true);
    expect(rangoPensiones(cuotas)).toBe("octubre a diciembre");
    expect(totalCentimos(cuotas)).toBe(35000 + 3 * 45000);
  });
  it("una pensión que vence el mismo día de la matrícula no se genera (debe vencer después)", () => {
    expect(generarCronograma({ ...base, fechaMatricula: "2026-10-05" }).map((c) => c.mes)).toEqual([null, 11, 12]);
  });
  it("después del 5 de diciembre solo queda la cuota de matrícula", () => {
    const cuotas = generarCronograma({ ...base, fechaMatricula: "2026-12-10" });
    expect(cuotas).toHaveLength(1);
    expect(rangoPensiones(cuotas)).toBeNull();
  });
});

describe("día de vencimiento (parámetro DIA_VENCIMIENTO)", () => {
  it("usa el día configurado entre 1 y 28", () => {
    expect(diaVencimientoValido(10)).toBe(10);
    expect(generarCronograma({ ...base, fechaMatricula: "2026-01-10", diaVencimiento: 10 })[1].fechaVencimiento).toBe(
      "2026-03-10",
    );
  });
  it("si no es válido, vuelve al día 5", () => {
    expect(diaVencimientoValido(31)).toBe(5);
    expect(diaVencimientoValido("x")).toBe(5);
    expect(diaVencimientoValido(0)).toBe(5);
  });
});
