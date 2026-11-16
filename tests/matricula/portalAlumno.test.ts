// Reglas del portal del alumno (US49): solo entra quien tiene una matrícula vigente. Sin base de datos.
import { describe, expect, it } from "vitest";
import { ErrorApp } from "@/platform/http/errores";
import { matriculaVigente, verificarMatriculaVigente } from "@/modules/matricula/domain/portalAlumno";

const m = (estado: string, estadoAnio: string, anio = 2026) => ({ estado, estadoAnio, anio });

describe("matrícula vigente del alumno (US49)", () => {
  it("es la «Matriculado» de un año en curso, en cierre o en matrícula", () => {
    expect(matriculaVigente([m("MATRICULADO", "EN_CURSO")])).toEqual(m("MATRICULADO", "EN_CURSO"));
    expect(matriculaVigente([m("MATRICULADO", "EN_CIERRE")])).not.toBeNull();
    expect(matriculaVigente([m("MATRICULADO", "EN_MATRICULA")])).not.toBeNull();
  });

  it("un alumno retirado, con la matrícula anulada o en proceso no tiene matrícula vigente", () => {
    expect(matriculaVigente([m("RETIRADO", "EN_CURSO")])).toBeNull();
    expect(matriculaVigente([m("ANULADO", "EN_CURSO")])).toBeNull();
    expect(matriculaVigente([m("EN_PROCESO", "EN_MATRICULA")])).toBeNull();
    expect(matriculaVigente([])).toBeNull();
  });

  it("la matrícula de un año cerrado ya no está vigente", () => {
    expect(matriculaVigente([m("MATRICULADO", "CERRADO", 2025)])).toBeNull();
  });

  it("con matrícula en dos años abiertos, manda la del año en curso", () => {
    const lista = [m("MATRICULADO", "EN_MATRICULA", 2027), m("MATRICULADO", "EN_CURSO", 2026)];
    expect(matriculaVigente(lista)?.anio).toBe(2026);
  });

  it("retirado este año y matriculado para el siguiente: vale la matrícula del año siguiente", () => {
    const lista = [m("RETIRADO", "EN_CURSO", 2026), m("MATRICULADO", "EN_MATRICULA", 2027)];
    expect(matriculaVigente(lista)).toEqual(m("MATRICULADO", "EN_MATRICULA", 2027));
  });

  it("sin matrícula vigente el portal responde 403 SIN_MATRICULA_VIGENTE", () => {
    expect(verificarMatriculaVigente(m("MATRICULADO", "EN_CURSO"))).toEqual(m("MATRICULADO", "EN_CURSO"));
    let error: unknown;
    try {
      verificarMatriculaVigente(null);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorApp);
    expect(error).toMatchObject({ codigo: "SIN_MATRICULA_VIGENTE", estadoHttp: 403 });
  });
});
