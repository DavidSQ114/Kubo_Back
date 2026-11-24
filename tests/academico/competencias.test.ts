// Pruebas de las reglas puras del catálogo oficial de competencias (US56, AD-04): código único normalizado, no
// eliminar una competencia con calificaciones o en un plan, cambios con valor anterior y nuevo para la bitácora, y una
// competencia desactivada que no se asocia a cursos nuevos. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  cambiosDeCompetencia,
  normalizarCodigoCompetencia,
  prepararCompetencias,
  verificarEliminacionCompetencia,
} from "@/modules/academico/domain/cursos";

function esperarError(fn: () => void, codigo: string, mensaje?: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo, ...(mensaje ? { message: mensaje } : {}) }));
}

describe("código de la competencia (US56, criterio 1)", () => {
  it("lo normaliza a mayúsculas, como los del CNEB", () => {
    expect(normalizarCodigoCompetencia(" mat-c5 ")).toBe("MAT-C5");
    expect(normalizarCodigoCompetencia("DPCC-C3")).toBe("DPCC-C3");
  });

  it("rechaza códigos vacíos, muy largos o con espacios y símbolos", () => {
    for (const malo of ["", "M", "MAT C5", "MAT_C5", "CIENCIAYTECNO-C12", "MAT-C5!"]) {
      esperarError(() => normalizarCodigoCompetencia(malo), "CODIGO_COMPETENCIA_INVALIDO");
    }
  });
});

describe("eliminar una competencia (US56, criterio 2)", () => {
  it("se elimina si no está en ningún plan ni tiene calificaciones", () => {
    expect(() => verificarEliminacionCompetencia({ planes: 0, notas: 0 })).not.toThrow();
  });

  it("con calificaciones registradas no se elimina: solo se desactiva", () => {
    esperarError(
      () => verificarEliminacionCompetencia({ planes: 2, notas: 318 }),
      "COMPETENCIA_CON_CALIFICACIONES",
      "No se puede eliminar una competencia con calificaciones registradas: solo puedes desactivarla.",
    );
  });

  it("asociada a un plan de estudios, aunque sin notas, tampoco se elimina", () => {
    esperarError(() => verificarEliminacionCompetencia({ planes: 1, notas: 0 }), "COMPETENCIA_EN_PLAN");
  });
});

describe("cambios para la bitácora (US56, criterio 3)", () => {
  const actual = { nombre: "Resuelve problemas de cantidad", descripcion: "Texto anterior", activo: true };

  it("guarda solo lo que cambia, con el valor anterior y el nuevo", () => {
    expect(cambiosDeCompetencia(actual, { nombre: actual.nombre, descripcion: "Texto nuevo" })).toEqual({
      anterior: { descripcion: "Texto anterior" },
      nuevo: { descripcion: "Texto nuevo" },
    });
  });

  it("registra la desactivación", () => {
    expect(cambiosDeCompetencia(actual, { activo: false })).toEqual({
      anterior: { activo: true },
      nuevo: { activo: false },
    });
  });

  it("quitar la descripción también es un cambio", () => {
    expect(cambiosDeCompetencia(actual, { descripcion: null }).nuevo).toEqual({ descripcion: null });
  });

  it("sin cambios no guarda nada", () => {
    esperarError(
      () => cambiosDeCompetencia(actual, { nombre: actual.nombre, activo: true }),
      "COMPETENCIA_SIN_CAMBIOS",
    );
  });
});

describe("competencia desactivada en los planes (US56, criterio 2)", () => {
  const catalogo = [
    { id: "mat-c1", areaCurricularId: "mat", activo: true },
    { id: "mat-c5", areaCurricularId: "mat", activo: false },
  ];

  it("no se asocia a un curso nuevo", () => {
    esperarError(() => prepararCompetencias([{ competenciaId: "mat-c5" }], "mat", catalogo), "COMPETENCIA_INACTIVA");
  });

  it("el plan que ya la tenía la conserva", () => {
    expect(
      prepararCompetencias([{ competenciaId: "mat-c1" }, { competenciaId: "mat-c5" }], "mat", catalogo, ["mat-c5"]),
    ).toHaveLength(2);
  });
});
