// platform/logger: log en formato JSON (una línea por evento).
// - Consola siempre.
// - Archivo con rotación al superar 50 MB (RNF04, US05) cuando LOG_DIR está definido: los rotados se guardan
//   comprimidos con gzip (kubo.log → 20261106-0900-01-kubo.log.gz) y se conservan los 10 más recientes.
// - Nunca escribe contraseñas, tokens ni datos personales: se ocultan por nombre de campo, y los textos libres
//   (mensajes y stack traces) pasan por redactarTexto.
import fs from "node:fs";
import path from "node:path";
import { createStream, type RotatingFileStream } from "rotating-file-stream";

type Nivel = "INFO" | "WARN" | "ERROR" | "FATAL";

const CAMPOS_SENSIBLES = /pass|token|secret|authorization|cookie|dni|telefono|direccion|fechaNacimiento/i;

/** Tamaño a partir del cual se rota el archivo de log (US05). */
export const TAMANO_ROTACION_LOG = "50M";
/** Archivos rotados (comprimidos) que se conservan. */
export const ARCHIVOS_ROTADOS = 10;

const PATRONES_TEXTO: [RegExp, string][] = [
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token]"], // JWT
  [/\bBearer\s+[\w.~+/=-]+/gi, "Bearer [token]"],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[correo]"],
  [/(?<![\w.:/-])\d{8}(?![\w.:/-])/g, "[dni]"], // un DNI suelto (8 dígitos); no toca números de línea ni ids
];

/**
 * Oculta datos personales y credenciales en un texto libre (mensaje o stack trace de un error): JWT, «Bearer …»,
 * correos y números de 8 dígitos (DNI). Los campos con nombre sensible ya se ocultan con `ocultar`.
 */
export function redactarTexto(texto: string): string {
  return PATRONES_TEXTO.reduce((t, [patron, reemplazo]) => t.replace(patron, reemplazo), texto);
}

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
    archivo = createStream("kubo.log", {
      path: path.resolve(dir),
      size: TAMANO_ROTACION_LOG,
      maxFiles: ARCHIVOS_ROTADOS,
      compress: "gzip",
    });
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
  redactarTexto,
};
