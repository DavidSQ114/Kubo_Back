// Pruebas de las reglas puras de la matrícula «En proceso» que deja el registro del estudiante (US17). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { anioParaBorrador } from "@/modules/matricula/domain/reglas";

describe("año de la matrícula en borrador (US17)", () => {
  const anios = [
    { id: "a26", anio: 2026, estado: "EN_CURSO" },
    { id: "a27", anio: 2027, estado: "EN_MATRICULA" },
  ];
  it("usa el año en matrícula", () => {
    expect(anioParaBorrador(anios).id).toBe("a27");
  });
  it("si no hay año en matrícula, usa el año en curso", () => {
    expect(anioParaBorrador([anios[0], { id: "a28", anio: 2028, estado: "PLANIFICADO" }]).id).toBe("a26");
  });
  it("sin año en matrícula ni en curso no deja guardar el borrador", () => {
    expect(() => anioParaBorrador([{ id: "a25", anio: 2025, estado: "CERRADO" }])).toThrowError(
      expect.objectContaining({ codigo: "SIN_ANIO_EN_MATRICULA", estadoHttp: 422 }),
    );
  });
});
