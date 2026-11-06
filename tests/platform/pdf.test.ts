// Pruebas del servicio de PDF (platform/pdf), que usan la ficha de matrícula (US20) y la boleta (US25).
// Ejecutar: npm test
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generarPdf, textoImprimible } from "@/platform/pdf";

describe("servicio de PDF", () => {
  it("conserva tildes, ñ, ° y comillas latinas y reemplaza lo que la fuente no dibuja", () => {
    expect(textoImprimible("Peña Núñez · 3° «B» – Ñandú")).toBe("Peña Núñez · 3° «B» – Ñandú");
    expect(textoImprimible("Emoji 😀 y 中文")).toBe("Emoji ? y ??");
  });

  it("genera un PDF válido con datos, tablas y varias páginas", async () => {
    const bytes = await generarPdf({
      nombre: "prueba",
      institucion: "Institución Educativa Kubo",
      titulo: "Ficha de matrícula 2026",
      subtitulo: "3° de secundaria · Sección B",
      bloques: [
        {
          tipo: "datos",
          titulo: "Datos del estudiante",
          filas: [
            ["Apellidos", "Peña Núñez"],
            ["DNI", ""],
          ],
        },
        {
          tipo: "tabla",
          titulo: "Apoderados",
          columnas: [
            { titulo: "Nombre", ancho: 0.6 },
            { titulo: "Teléfono", ancho: 0.4, alinear: "derecha" },
          ],
          filas: Array.from({ length: 80 }, (_, i) => [`Apoderada ficticia ${i + 1}`, "987654321"]),
        },
        { tipo: "texto", texto: "Documento de prueba con datos ficticios." },
      ],
      pie: "Generada el 06/11/2026 10:24",
    });
    const texto = Buffer.from(bytes).toString("latin1");
    expect(texto.startsWith("%PDF-")).toBe(true);
    expect(texto).toContain("%%EOF");
    const leido = await PDFDocument.load(bytes);
    expect(leido.getPageCount()).toBeGreaterThan(1);
    expect(leido.getTitle()).toBe("Ficha de matrícula 2026");
  });

  it("con una fecha fija produce los mismos bytes (recibo determinista, US25) y admite la marca ANULADO", async () => {
    const doc = {
      nombre: "recibo-pago",
      institucion: "Institución Educativa Kubo",
      titulo: "Recibo de pago N.° R-2026-000001",
      fechaDocumento: new Date("2026-10-01T05:00:00.000Z"),
      bloques: [
        { tipo: "datos" as const, titulo: "Datos del pago", filas: [["Monto", "S/ 900.00"]] as [string, string][] },
      ],
    };
    const a = await generarPdf(doc);
    const b = await generarPdf(doc);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    const anulado = await generarPdf({ ...doc, marcaAgua: "ANULADO" });
    expect(Buffer.from(anulado).equals(Buffer.from(a))).toBe(false);
    expect((await PDFDocument.load(anulado)).getCreationDate()?.toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });

  it("si falla, el error solo nombra el documento y el tipo de falla, sin los datos (log_error)", async () => {
    const datoPersonal = "71234567";
    const fallido = generarPdf({
      nombre: "ficha-matricula",
      institucion: "Kubo",
      titulo: "Ficha",
      bloques: [
        {
          tipo: "datos",
          titulo: "Datos",
          filas: [
            ["DNI", datoPersonal],
            [null as unknown as string, "Roto"],
          ],
        },
      ],
    });
    await expect(fallido).rejects.toThrowError("No se pudo generar el PDF «ficha-matricula» (TypeError)");
    await expect(fallido).rejects.not.toThrowError(datoPersonal);
  });
});
