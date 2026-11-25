// Bloque M5 · M-07: un rechazo del servidor que se refiere al archivo lo marca como rechazado y no se reenvía.
import { describe, expect, it } from "vitest";
import { esRechazoDeArchivo } from "@/lib/archivos";

describe("rechazo del archivo por el servidor (bloque M5, M-07)", () => {
  it("reconoce el tipo real no permitido, el tamaño y el archivo vacío", () => {
    for (const codigo of ["ARCHIVO_NO_PERMITIDO", "ARCHIVO_DEMASIADO_GRANDE", "ARCHIVO_VACIO"]) {
      expect(esRechazoDeArchivo(codigo)).toBe(true);
    }
  });

  it("otros errores del formulario no marcan el archivo", () => {
    for (const codigo of ["EVIDENCIA_VACIA", "REGISTRO_CERRADO", "DATOS_INVALIDOS", null, undefined]) {
      expect(esRechazoDeArchivo(codigo)).toBe(false);
    }
  });
});
