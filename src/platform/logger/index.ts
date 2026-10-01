// platform/logger: log en formato JSON (una línea por evento).
// - Consola siempre.
// - Archivo con rotación al superar 50 MB (RNF04) cuando LOG_DIR está definido.
// - Nunca escribe contraseñas, tokens ni datos personales: se ocultan por nombre de campo.
import fs from "node:fs";
import path from "node:path";
import { createStream, type RotatingFileStream } from "rotating-file-stream";

type Nivel = "INFO" | "WARN" | "ERROR" | "FATAL";

const CAMPOS_SENSIBLES = /pass|token|secret|authorization|cookie|dni|telefono|direccion|fechaNacimiento/i;

function ocultar(valor: unknown, profundidad = 0): unknown {
  if (profundidad > 5 || valor === null || typeof valor !== "object") return valor;
  if (Array.isArray(valor)) return valor.map((v) => ocultar(v, profundidad + 1));
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    salida[k] = CAMPOS_SENSIBLES.test(k) ? "[oculto]" : ocultar(v, profundidad + 1);
  }
  return salida;
}

let archivo: RotatingFileStream | null | undefined;
function streamArchivo(): RotatingFileStream | null {
  if (archivo !== undefined) return archivo;
  const dir = process.env.LOG_DIR;
  if (!dir) return (archivo = null);
  try {
    fs.mkdirSync(path.resolve(dir), { recursive: true });
    archivo = createStream("kubo.log", { path: path.resolve(dir), size: "50M", maxFiles: 10 });
  } catch {
    archivo = null;
  }
  return archivo;
}

function escribir(nivel: Nivel, mensaje: string, datos?: Record<string, unknown>) {
  const linea = JSON.stringify({
    fecha: new Date().toISOString(),
    nivel,
    mensaje,
    ...(datos ? (ocultar(datos) as Record<string, unknown>) : {}),
  });
  if (nivel === "ERROR" || nivel === "FATAL") console.error(linea);
  else console.log(linea);
  streamArchivo()?.write(linea + "\n");
}

export const logger = {
  info: (mensaje: string, datos?: Record<string, unknown>) => escribir("INFO", mensaje, datos),
  warn: (mensaje: string, datos?: Record<string, unknown>) => escribir("WARN", mensaje, datos),
  error: (mensaje: string, datos?: Record<string, unknown>) => escribir("ERROR", mensaje, datos),
  fatal: (mensaje: string, datos?: Record<string, unknown>) => escribir("FATAL", mensaje, datos),
  ocultar,
};
