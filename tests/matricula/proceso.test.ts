// Pruebas del proceso de matrícula del año (bloque M4 · fase 5): fechas, documentos requeridos, estado en una fecha
// y los cambios en la lista. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  cambiosDocumentos,
  estadoProceso,
  verificarProceso,
  verificarProcesoAbierto,
  verificarProcesoEditable,
} from "@/modules/matricula/domain/proceso";

const fechas = { fechaInicio: "2026-12-01", fechaFin: "2027-02-28" };
const doc = (nombre: string, obligatorio = true) => ({ nombre, obligatorio });

describe("configuración del proceso de matrícula (bloque M4)", () => {
  it("acepta fechas en orden y documentos con nombre, limpiándolos", () => {
    expect(verificarProceso({ ...fechas, documentos: [doc("  Partida   de nacimiento "), doc("DNI", false)] })).toEqual(
      [
        { id: null, nombre: "Partida de nacimiento", obligatorio: true },
        { id: null, nombre: "DNI", obligatorio: false },
      ],
    );
  });
  it("rechaza un inicio posterior al fin", () => {
    expect(() =>
      verificarProceso({ fechaInicio: "2027-03-01", fechaFin: "2027-02-28", documentos: [doc("DNI")] }),
    ).toThrow("La fecha de inicio no puede ser posterior a la fecha de fin.");
  });
  it("exige al menos un documento, sin nombres vacíos ni repetidos", () => {
    expect(() => verificarProceso({ ...fechas, documentos: [] })).toThrow("al menos un documento");
    expect(() => verificarProceso({ ...fechas, documentos: [doc("  ")] })).toThrow("Escribe el nombre");
    expect(() => verificarProceso({ ...fechas, documentos: [doc("DNI del alumno"), doc("dni DEL alumno")] })).toThrow(
      "está repetido",
    );
  });
  it("no deja cambiar el proceso de un año cerrado", () => {
    expect(() => verificarProcesoEditable({ anio: 2025, estado: "CERRADO" })).toThrow("está cerrado");
    expect(() => verificarProcesoEditable({ anio: 2027, estado: "PLANIFICADO" })).not.toThrow();
  });
});

describe("estado del proceso en una fecha (bloque M4)", () => {
  it("sin configurar, próximo, abierto (bordes incluidos) y cerrado", () => {
    expect(estadoProceso(null, "2026-12-10")).toBe("SIN_CONFIGURAR");
    expect(estadoProceso(fechas, "2026-11-30")).toBe("PROXIMO");
    expect(estadoProceso(fechas, "2026-12-01")).toBe("ABIERTO");
    expect(estadoProceso(fechas, "2027-02-28")).toBe("ABIERTO");
    expect(estadoProceso(fechas, "2027-03-01")).toBe("CERRADO");
  });
  it("fuera de las fechas el apoderado recibe un mensaje claro", () => {
    expect(() => verificarProcesoAbierto(fechas, "2026-11-30", 2027)).toThrow(
      "La matrícula en línea empieza el 01/12/2026.",
    );
    expect(() => verificarProcesoAbierto(fechas, "2027-03-01", 2027)).toThrow("terminó el 28/02/2027");
    expect(() => verificarProcesoAbierto(null, "2027-03-01", 2027)).toThrow("todavía no abrió la matrícula 2027");
    expect(() => verificarProcesoAbierto(fechas, "2027-01-15", 2027)).not.toThrow();
  });
});

describe("cambios en la lista de documentos (bloque M4)", () => {
  it("conserva los que siguen, crea los nuevos y desactiva los quitados, con el orden de la lista", () => {
    const r = cambiosDocumentos(
      [{ id: "a" }, { id: "b" }],
      [
        { id: "b", nombre: "DNI", obligatorio: true },
        { id: null, nombre: "Libreta", obligatorio: false },
      ],
    );
    expect(r.actualizar).toEqual([{ id: "b", nombre: "DNI", obligatorio: true, orden: 1 }]);
    expect(r.crear).toEqual([{ id: null, nombre: "Libreta", obligatorio: false, orden: 2 }]);
    expect(r.desactivar).toEqual(["a"]);
  });
});
