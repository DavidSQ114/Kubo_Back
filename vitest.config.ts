import path from "node:path";
import { defineConfig } from "vitest/config";

// Con KUBO_PRUEBA_INTEGRACION=1 los archivos corren uno tras otro: varias pruebas de integración crean su propio año
// EN_CURSO (asistencia, notas) y la base admite uno solo (uq_anio_en_curso).
const integracion = process.env.KUBO_PRUEBA_INTEGRACION === "1";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/**/*.test.ts"], environment: "node", fileParallelism: !integracion },
});
