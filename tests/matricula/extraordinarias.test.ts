// Pruebas de las cuotas extraordinarias (bloque M4 · fase 4): validación del lote, matrículas del destino (alumno,
// sección, grado o todo el año), anulación y resumen. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  conceptoExtraValido,
  matriculasDelDestino,
  resumenLote,
  verificarAnioParaLote,
  verificarConMatriculas,
  verificarDestino,
  verificarExtraordinariaAnulable,
  verificarLoteAnulable,
  verificarVencimientoLote,
} from "@/modules/matricula/domain/extraordinarias";

const matriculas = [
  { id: "m1", estudianteId: "e1", seccionId: "3A", estado: "MATRICULADO" },
  { id: "m2", estudianteId: "e2", seccionId: "3B", estado: "MATRICULADO" },
  { id: "m3", estudianteId: "e3", seccionId: "4A", estado: "MATRICULADO" },
  { id: "m4", estudianteId: "e4", seccionId: "3A", estado: "RETIRADO" },
  { id: "m5", estudianteId: "e5", seccionId: null, estado: "EN_PROCESO" },
];
const grados = new Map([
  ["3A", "g3"],
  ["3B", "g3"],
  ["4A", "g4"],
]);
const ids = (lista: { id: string }[]) => lista.map((m) => m.id);

describe("matrículas del destino de un lote extraordinario (bloque M4)", () => {
  it("un alumno: solo su matrícula Matriculado", () => {
    expect(ids(matriculasDelDestino(matriculas, { destino: "ALUMNO", destinoId: "e2" }, grados))).toEqual(["m2"]);
    expect(matriculasDelDestino(matriculas, { destino: "ALUMNO", destinoId: "e4" }, grados)).toEqual([]);
  });
  it("una sección: las Matriculado de esa sección (no las retiradas)", () => {
    expect(ids(matriculasDelDestino(matriculas, { destino: "SECCION", destinoId: "3A" }, grados))).toEqual(["m1"]);
  });
  it("un grado: las Matriculado de todas sus secciones", () => {
    expect(ids(matriculasDelDestino(matriculas, { destino: "GRADO", destinoId: "g3" }, grados))).toEqual(["m1", "m2"]);
  });
  it("todo el año: todas las Matriculado (no En proceso ni Retirado)", () => {
    expect(ids(matriculasDelDestino(matriculas, { destino: "ANIO" }, grados))).toEqual(["m1", "m2", "m3"]);
  });
  it("sin matrículas en el destino no se crea el lote", () => {
    expect(() => verificarConMatriculas(0)).toThrow("No hay alumnos matriculados");
    expect(() => verificarConMatriculas(1)).not.toThrow();
  });
});

describe("datos del lote extraordinario (bloque M4)", () => {
  it("el concepto se limpia y tiene hasta 100 caracteres", () => {
    expect(conceptoExtraValido("  Paseo   de fin de año ")).toBe("Paseo de fin de año");
    expect(() => conceptoExtraValido("   ")).toThrow("Escribe el concepto");
    expect(() => conceptoExtraValido("x".repeat(101))).toThrow("hasta 100 caracteres");
    expect(conceptoExtraValido("x".repeat(100))).toHaveLength(100);
  });
  it("el vencimiento puede ser hoy pero no antes", () => {
    expect(() => verificarVencimientoLote("2026-11-25", "2026-11-25")).not.toThrow();
    expect(() => verificarVencimientoLote("2026-11-24", "2026-11-25")).toThrow("no puede ser anterior a hoy");
  });
  it("un destino que no es todo el año necesita su id", () => {
    expect(() => verificarDestino("SECCION", null)).toThrow("Elige el alumno, la sección o el grado.");
    expect(() => verificarDestino("ANIO", null)).not.toThrow();
  });
  it("solo en un año en matrícula o en curso", () => {
    expect(() => verificarAnioParaLote({ anio: 2026, estado: "EN_CURSO" }, "En curso")).not.toThrow();
    expect(() => verificarAnioParaLote({ anio: 2025, estado: "CERRADO" }, "Cerrado")).toThrow("está «Cerrado»");
  });
});

describe("anulación de un lote o una cuota extraordinaria (bloque M4)", () => {
  it("un lote anulado no se vuelve a anular", () => {
    expect(() => verificarLoteAnulable("ACTIVO")).not.toThrow();
    expect(() => verificarLoteAnulable("ANULADO")).toThrow("El lote ya fue anulado.");
  });
  it("solo se anula una cuota extraordinaria pendiente", () => {
    expect(() => verificarExtraordinariaAnulable({ tipo: "EXTRAORDINARIA", estado: "PENDIENTE" })).not.toThrow();
    expect(() => verificarExtraordinariaAnulable({ tipo: "PENSION", estado: "PENDIENTE" })).toThrow(
      "Solo se puede anular una cuota extraordinaria.",
    );
    expect(() => verificarExtraordinariaAnulable({ tipo: "EXTRAORDINARIA", estado: "PAGADO" })).toThrow(
      "ya fue pagada",
    );
    expect(() => verificarExtraordinariaAnulable({ tipo: "EXTRAORDINARIA", estado: "ANULADO" })).toThrow(
      "ya fue anulada",
    );
  });
  it("el resumen cuenta cada estado y suma solo las cuotas no anuladas", () => {
    expect(
      resumenLote([
        { estado: "PAGADO", montoCentimos: 5000 },
        { estado: "PENDIENTE", montoCentimos: 5000 },
        { estado: "ANULADO", montoCentimos: 5000 },
      ]),
    ).toEqual({ cuotas: 3, pendientes: 1, pagadas: 1, anuladas: 1, totalCentimos: 10000 });
  });
});
