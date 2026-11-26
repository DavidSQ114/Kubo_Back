// platform/http: armado de archivos CSV para las descargas (reportes del tutor y del coordinador). Con BOM para que la
// hoja de cálculo lea las tildes, separador «;» y fin de línea CRLF. La respuesta se envía con csv() de ./ruta.
// El separador es «;» porque Excel configurado en español (coma decimal) parte las columnas por punto y coma: con «,»
// abría todo el archivo en una sola columna (bloque M5).

/** Separador de columnas de los CSV que descarga Kubo. */
export const SEPARADOR_CSV = ";";

/**
 * Un campo del CSV: entre comillas si lleva «;», coma, comillas o salto de línea (la coma se sigue protegiendo para
 * quien abra el archivo con otra configuración); una fórmula al inicio se neutraliza.
 */
export function campoCsv(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  // =, +, -, @ al inicio: la hoja de cálculo lo ejecutaría como fórmula
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return /[";,\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** Texto completo del CSV a partir de sus filas (la primera, la cabecera), con BOM y CRLF. */
export function textoCsv(filas: (string | number | null | undefined)[][]): string {
  return `\uFEFF${filas.map((f) => f.map(campoCsv).join(SEPARADOR_CSV)).join("\r\n")}\r\n`;
}

/** «Reporte_asistencia_3B_BimestreI_2026.csv»: sin tildes, espacios ni datos personales. */
export function nombreArchivoSeguro(partes: (string | number)[], extension: "csv" | "pdf"): string {
  const limpio = partes.map((p) =>
    String(p)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, ""),
  );
  return `${limpio.filter(Boolean).join("_")}.${extension}`;
}
