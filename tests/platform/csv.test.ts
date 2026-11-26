// Bloque M5 · CSV de las descargas con separador «;» para Excel configurado en español (coma decimal), con BOM y CRLF.
import { describe, expect, it } from "vitest";
import { campoCsv, numeroCsv, SEPARADOR_CSV, textoCsv } from "@/platform/http/csv";

describe("CSV de las descargas (bloque M5)", () => {
  it("separa las columnas con «;» y lleva BOM y CRLF, también al final", () => {
    const texto = textoCsv([
      ["Año", "Sección", "Estudiante"],
      [2026, "1° A", "Quispe Rojas, Valeria Sofía"],
    ]);
    expect(SEPARADOR_CSV).toBe(";");
    expect(texto).toBe('﻿Año;Sección;Estudiante\r\n2026;1° A;"Quispe Rojas, Valeria Sofía"\r\n');
  });

  it("pone comillas al campo con «;», coma, comillas o salto de línea", () => {
    expect(campoCsv("Paseo; materiales")).toBe('"Paseo; materiales"');
    expect(campoCsv("Rojas, Lucía")).toBe('"Rojas, Lucía"');
    expect(campoCsv('Dice "hola"')).toBe('"Dice ""hola"""');
    expect(campoCsv("dos\nlíneas")).toBe('"dos\nlíneas"');
    expect(campoCsv("Sin separadores")).toBe("Sin separadores");
  });

  it("neutraliza una fórmula al inicio y deja vacíos los valores nulos", () => {
    expect(campoCsv("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(campoCsv("-1;2")).toBe('"\'-1;2"');
    expect(campoCsv(null)).toBe("");
    expect(campoCsv(undefined)).toBe("");
    expect(campoCsv(15)).toBe("15");
  });

  it("los números con decimales salen con coma decimal y sin comillas, como los lee Excel en español", () => {
    expect(numeroCsv(33.3)).toBe("33,3");
    expect(campoCsv(66.7)).toBe("66,7");
    expect(campoCsv(-1.5)).toBe("-1,5");
    expect(campoCsv(100)).toBe("100");
    expect(campoCsv(Number.NaN)).toBe("");
    expect(textoCsv([["% de asistencia"], [33.3]])).toBe("﻿% de asistencia\r\n33,3\r\n");
    // un texto con decimales (no un número) se respeta tal cual
    expect(campoCsv("33.3")).toBe("33.3");
  });
});
