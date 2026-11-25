// Bloque M5 · Bimestre que se abre primero en «Notas por alumno» (coordinador y tutor).
import { describe, expect, it } from "vitest";
import { bimestrePorDefecto } from "@/lib/bimestres";

const sinNotas = { cursos: [{ estado: "SIN_REGISTRO" }] };

describe("bimestre por defecto de la libreta completa (bloque M5, notas por alumno)", () => {
  it("abre el último bimestre con notas, no el Bimestre I", () => {
    const bimestres = [
      { id: "I", ...sinNotas },
      { id: "II", cursos: [{ estado: "PUBLICADO" }] },
      { id: "III", ...sinNotas },
      { id: "IV", cursos: [{ estado: "SIN_REGISTRO" }, { estado: "ABIERTO" }] },
    ];
    expect(bimestrePorDefecto(bimestres)).toBe("IV");
  });

  it("cuenta la conducta del tutor aunque no haya notas de cursos", () => {
    const bimestres = [
      { id: "I", cursos: [{ estado: "CERRADO" }] },
      { id: "II", ...sinNotas, conducta: { valor: "A" } },
      { id: "III", ...sinNotas, conducta: null },
    ];
    expect(bimestrePorDefecto(bimestres)).toBe("II");
  });

  it("sin notas en ningún bimestre abre el primero, y sin bimestres no elige ninguno", () => {
    expect(
      bimestrePorDefecto([
        { id: "I", ...sinNotas },
        { id: "II", ...sinNotas },
      ]),
    ).toBe("I");
    expect(bimestrePorDefecto([])).toBeNull();
  });
});
