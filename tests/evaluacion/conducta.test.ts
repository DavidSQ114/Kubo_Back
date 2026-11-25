// Pruebas de las reglas puras de la nota de conducta del tutor (bloque M3). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  cambiosDeConducta,
  conductaVisibleEnLibreta,
  resumenDeConducta,
  verificarAlumnosDeConducta,
  verificarPeriodoDeConducta,
} from "@/modules/evaluacion/domain/conducta";

function esperarError(fn: () => void, codigo: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo }));
}

describe("nota de conducta del tutor (bloque M3)", () => {
  it("se registra mientras el periodo no esté FINALIZADO", () => {
    for (const estado of ["INACTIVO", "ACTIVO", "EN_CIERRE"]) {
      expect(() => verificarPeriodoDeConducta(estado)).not.toThrow();
    }
    esperarError(() => verificarPeriodoDeConducta("FINALIZADO"), "PERIODO_FINALIZADO");
  });

  it("solo acepta alumnos de la sección, sin repetir y al menos uno", () => {
    const alumnos = new Set(["m1", "m2"]);
    const nota = (matriculaId: string) => ({ matriculaId, valor: "A" as const, comentario: null });
    expect(() => verificarAlumnosDeConducta(alumnos, [nota("m1"), nota("m2")])).not.toThrow();
    esperarError(() => verificarAlumnosDeConducta(alumnos, [nota("m3")]), "ALUMNO_FUERA_DE_LA_SECCION");
    esperarError(() => verificarAlumnosDeConducta(alumnos, [nota("m1"), nota("m1")]), "ALUMNO_FUERA_DE_LA_SECCION");
    esperarError(() => verificarAlumnosDeConducta(alumnos, []), "DATOS_INVALIDOS");
  });

  it("separa las notas nuevas de las que cambian y no toca las iguales", () => {
    const guardadas = [
      { id: "c1", matriculaId: "m1", valor: "A" as const, comentario: null },
      { id: "c2", matriculaId: "m2", valor: "B" as const, comentario: "Conversa en clase" },
    ];
    const { crear, cambiar } = cambiosDeConducta(guardadas, [
      { matriculaId: "m1", valor: "A", comentario: null },
      { matriculaId: "m2", valor: "B", comentario: "Mejoró su participación" },
      { matriculaId: "m3", valor: "AD", comentario: null },
    ]);
    expect(crear.map((c) => c.matriculaId)).toEqual(["m3"]);
    expect(cambiar.map((c) => c.guardada.id)).toEqual(["c2"]);
  });

  it("aparece en la libreta solo con el bimestre publicado", () => {
    expect(conductaVisibleEnLibreta("PUBLICADO")).toBe(true);
    for (const estado of ["PARCIAL", "PENDIENTE", "NO_INICIADO"]) expect(conductaVisibleEnLibreta(estado)).toBe(false);
  });

  it("resume cuántos alumnos tienen cada valor y cuántos están sin nota", () => {
    expect(resumenDeConducta(["AD", "A", "A", null, "C"])).toEqual({ AD: 1, A: 2, B: 0, C: 1, SIN_NOTA: 1 });
  });
});
