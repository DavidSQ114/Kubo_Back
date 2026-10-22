// Pruebas de las reglas puras de secciones (US08) y aulas (US09). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  calcularVacantes,
  listaSecciones,
  normalizarNombreSeccion,
  verificarAforo,
  verificarAforoAula,
  verificarAnioEditable,
  verificarEliminacion,
  verificarVacantes,
} from "@/modules/academico/domain/secciones";

function esperarError(fn: () => void, codigo: string, mensaje?: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo, ...(mensaje ? { message: mensaje } : {}) }));
}

describe("aforo (US09)", () => {
  it("acepta enteros mayores a 0", () => {
    expect(() => verificarAforo(30)).not.toThrow();
    expect(() => verificarAforo(1)).not.toThrow();
  });
  it("rechaza 0, negativos y decimales", () => {
    for (const malo of [0, -5, 25.5, Number.NaN]) {
      esperarError(() => verificarAforo(malo), "AFORO_INVALIDO", "El aforo debe ser un número entero mayor a 0");
    }
  });
  it("el aforo de un aula no baja del de sus secciones", () => {
    expect(() => verificarAforoAula(30, [28, 30])).not.toThrow();
    expect(() => verificarAforoAula(24, [])).not.toThrow();
    esperarError(() => verificarAforoAula(25, [28, 30]), "AFORO_MENOR_QUE_SECCIONES");
    esperarError(() => verificarAforoAula(0, []), "AFORO_INVALIDO");
  });
});

describe("secciones (US08)", () => {
  it("normaliza el nombre a mayúsculas", () => {
    expect(normalizarNombreSeccion(" b ")).toBe("B");
    expect(normalizarNombreSeccion("ab")).toBe("AB");
  });
  it("rechaza nombres que no son letras", () => {
    for (const malo of ["", "1", "A-1", "ABCD", "Á"]) {
      esperarError(() => normalizarNombreSeccion(malo), "NOMBRE_SECCION_INVALIDO");
    }
  });
  it("solo se editan en un año que no está cerrado", () => {
    expect(() => verificarAnioEditable("EN_MATRICULA")).not.toThrow();
    esperarError(() => verificarAnioEditable("CERRADO"), "ANIO_CERRADO");
  });
  it("no se elimina con matrículas; sin matrículas sí", () => {
    expect(() => verificarEliminacion(0)).not.toThrow();
    expect(() => verificarEliminacion(27)).toThrowError(
      expect.objectContaining({
        codigo: "SECCION_CON_MATRICULADOS",
        message: expect.stringContaining("No se puede eliminar una sección con alumnos matriculados"),
      }),
    );
  });
  it("arma la lista de secciones para los mensajes", () => {
    expect(
      listaSecciones([
        { grado: 1, nombre: "A" },
        { grado: 3, nombre: "B" },
      ]),
    ).toBe("1° A, 3° B");
  });
});

describe("vacantes (US08, para matrícula)", () => {
  it("calcula matriculados, disponibles y si está completo", () => {
    expect(calcularVacantes(27, 30)).toEqual({ matriculados: 27, aforo: 30, disponibles: 3, completo: false });
    expect(calcularVacantes(30, 30)).toEqual({ matriculados: 30, aforo: 30, disponibles: 0, completo: true });
    expect(calcularVacantes(31, 30).disponibles).toBe(0);
  });
  it("una sección completa no recibe matrículas", () => {
    expect(() => verificarVacantes("ACTIVA", calcularVacantes(29, 30))).not.toThrow();
    esperarError(
      () => verificarVacantes("ACTIVA", calcularVacantes(30, 30)),
      "SECCION_SIN_VACANTES",
      "Sección sin vacantes disponibles (30/30)",
    );
  });
  it("una sección inactiva tampoco", () => {
    esperarError(() => verificarVacantes("INACTIVA", calcularVacantes(0, 30)), "SECCION_INACTIVA");
  });
});
