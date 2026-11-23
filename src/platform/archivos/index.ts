// platform/archivos: almacenamiento común de los archivos que suben los usuarios (US38 evidencias; luego aula virtual y
// trabajos). Elige el almacén con ARCHIVOS_DRIVER («s3»: bucket privado ARCHIVOS_S3_BUCKET en AWS_REGION; «disco»:
// ARCHIVOS_DIR, en desarrollo ./.archivos), lee el formulario con el límite de tamaño, valida el tipo real y responde
// las descargas con su Content-Disposition. Nunca hay URLs públicas: toda descarga pasa por un endpoint que valida el
// permiso. Los logs llevan la clave, el tipo y el tamaño, nunca el contenido ni el nombre original.
import { randomUUID } from "node:crypto";
import path from "node:path";
import { logger } from "@/platform/logger";
import { almacenDisco } from "./disco";
import type { AlmacenArchivos } from "./puerto";
import {
  cabeceraDisposicion,
  claveDeArchivo,
  erroresArchivos,
  TAMANO_MAXIMO_ARCHIVO,
  tipoDeMime,
  type ArchivoValidado,
} from "./reglas";
import { almacenS3 } from "./s3";

export type { AlmacenArchivos } from "./puerto";
export * from "./reglas";

/** Carpeta del almacén en disco en desarrollo (está en .gitignore). */
const CARPETA_DESARROLLO = ".archivos";

let almacen: AlmacenArchivos | undefined;

/**
 * Almacén configurado. Sin ARCHIVOS_DRIVER, en desarrollo se usa el disco (./.archivos); en producción no hay almacén
 * (por ejemplo en Vercel, de disco de solo lectura) y subir o descargar responde 503 ALMACEN_NO_CONFIGURADO.
 */
export function almacenArchivos(): AlmacenArchivos {
  if (almacen) return almacen;
  const produccion = process.env.NODE_ENV === "production";
  const driver = process.env.ARCHIVOS_DRIVER?.trim() || (produccion ? "" : "disco");
  if (driver === "s3") {
    const bucket = process.env.ARCHIVOS_S3_BUCKET?.trim();
    if (!bucket) throw erroresArchivos.almacenNoConfigurado();
    almacen = almacenS3({ bucket, region: process.env.AWS_REGION?.trim() || undefined });
  } else if (driver === "disco") {
    // turbopackIgnore: la carpeta es de datos y se decide al ejecutar; sin el comentario, el build rastrea todo el
    // proyecto y lo copia al código del servidor («Dynamic filesystem access causes tracing of the whole project»)
    const carpeta =
      process.env.ARCHIVOS_DIR?.trim() ||
      (produccion ? "" : path.join(/* turbopackIgnore: true */ process.cwd(), CARPETA_DESARROLLO));
    // en producción la carpeta se indica siempre: la del release se perdería en el siguiente despliegue
    if (!carpeta) throw erroresArchivos.almacenNoConfigurado();
    almacen = almacenDisco(path.resolve(/* turbopackIgnore: true */ carpeta));
  } else {
    throw erroresArchivos.almacenNoConfigurado();
  }
  return almacen;
}

/** Olvida el almacén elegido para volver a leer las variables (solo para las pruebas). */
export function reiniciarAlmacen() {
  almacen = undefined;
}

/** Guarda el archivo ya validado con una clave nueva <area>/<uuid> y la devuelve. */
export async function guardarArchivo(area: string, archivo: ArchivoValidado, requestId: string): Promise<string> {
  const clave = claveDeArchivo(area, randomUUID());
  await almacenArchivos().guardar(clave, archivo.bytes, archivo.mime);
  logger.info("Archivo guardado", { requestId, clave, tipo: archivo.tipo, tamanoBytes: archivo.tamanoBytes });
  return clave;
}

/** Contenido del archivo como flujo; 404 si ya no está en el almacén. */
export async function abrirArchivo(clave: string): Promise<ReadableStream<Uint8Array>> {
  const flujo = await almacenArchivos().leer(clave);
  if (!flujo) throw erroresArchivos.noEncontrado();
  return flujo;
}

/**
 * Borra el archivo sin lanzar error: se llama después de confirmar la transacción (o para deshacer una subida cuya
 * transacción falló). Si el almacén falla, la clave queda en el log como huérfana para borrarla a mano.
 */
export async function eliminarArchivo(clave: string, requestId: string): Promise<boolean> {
  try {
    await almacenArchivos().eliminar(clave);
    logger.info("Archivo eliminado", { requestId, clave });
    return true;
  } catch (e) {
    logger.warn("No se pudo eliminar el archivo: queda huérfano en el almacén", {
      requestId,
      clave,
      error: (e as Error)?.message ?? "Error desconocido",
    });
    return false;
  }
}

// ---------- Subida: formulario multipart con límite de tamaño ----------

/** Holgura para las cabeceras de cada parte del formulario y sus campos de texto (un comentario de 1000 caracteres). */
export const HOLGURA_FORMULARIO = 64 * 1024;

async function leerConLimite(flujo: ReadableStream<Uint8Array> | null, limite: number, mensaje: string) {
  const partes: Uint8Array[] = [];
  if (!flujo) return Buffer.alloc(0);
  const lector = flujo.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      // se deja de leer en cuanto se pasa el límite: un cuerpo enorme nunca termina en memoria
      await lector.cancel().catch(() => undefined);
      throw erroresArchivos.demasiadoGrande(mensaje);
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

/**
 * Lee un formulario multipart/form-data. Si el Content-Length declarado supera el máximo (más la holgura del
 * formulario) se rechaza sin leer el cuerpo; si no lo declara, se cuenta mientras se lee y se corta al pasarse.
 */
export async function leerFormulario(
  req: Request,
  reglas: { mensaje: string; tamanoMaximo?: number },
): Promise<FormData> {
  const limite = (reglas.tamanoMaximo ?? TAMANO_MAXIMO_ARCHIVO) + HOLGURA_FORMULARIO;
  const tipo = req.headers.get("content-type") ?? "";
  if (!tipo.toLowerCase().startsWith("multipart/form-data")) throw erroresArchivos.formularioInvalido();
  const declarado = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declarado) && declarado > limite) throw erroresArchivos.demasiadoGrande(reglas.mensaje);
  const cuerpo = await leerConLimite(req.body, limite, reglas.mensaje);
  try {
    return await new Response(cuerpo, { headers: { "content-type": tipo } }).formData();
  } catch {
    throw erroresArchivos.formularioInvalido();
  }
}

/** Archivo de un campo del formulario; null si no se eligió ninguno (el navegador envía uno vacío sin nombre). */
export async function archivoDelFormulario(form: FormData, campo: string) {
  const valor = form.get(campo);
  if (!(valor instanceof File) || (valor.size === 0 && !valor.name)) return null;
  return { nombre: valor.name, bytes: new Uint8Array(await valor.arrayBuffer()) };
}

// ---------- Descarga ----------

/**
 * Respuesta con el archivo: inline para JPG y PDF (el navegador los muestra) y attachment para el resto. Nunca se
 * guarda en caché compartida y el navegador no adivina el tipo (nosniff).
 */
export function respuestaArchivo(
  flujo: ReadableStream<Uint8Array>,
  archivo: { mime: string; nombre: string; tamanoBytes: number | null },
): Response {
  const tipo = tipoDeMime(archivo.mime);
  const cabeceras: Record<string, string> = {
    "Content-Type": tipo ? archivo.mime : "application/octet-stream",
    "Content-Disposition": cabeceraDisposicion(tipo, archivo.nombre),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (archivo.tamanoBytes != null) cabeceras["Content-Length"] = String(archivo.tamanoBytes);
  return new Response(flujo, { status: 200, headers: cabeceras });
}

// ---------- Verificación (npm run archivos:verificar) ----------

export interface PasoVerificacion {
  paso: "guardar" | "leer" | "eliminar" | "confirmar borrado";
  ok: boolean;
  detalle: string;
}

export interface VerificacionAlmacen {
  almacen: string;
  ok: boolean;
  pasos: PasoVerificacion[];
}

const textoDeError = (e: unknown) => {
  const err = e as { name?: string; message?: string };
  return [err?.name, err?.message].filter(Boolean).join(": ") || "Error desconocido";
};

/**
 * Guarda, lee y borra un objeto de prueba (clave verificacion/<uuid>) y confirma que ya no está. Si guardar funcionó,
 * siempre intenta borrarlo aunque falle la lectura.
 */
export async function verificarAlmacen(): Promise<VerificacionAlmacen> {
  const destino = almacenArchivos();
  const clave = claveDeArchivo("verificacion", randomUUID());
  const contenido = new TextEncoder().encode(`Kubo · verificación del almacén ${new Date().toISOString()}`);
  const pasos: PasoVerificacion[] = [];
  const resultado = () => ({ almacen: destino.descripcion, ok: pasos.every((p) => p.ok), pasos });

  try {
    await destino.guardar(clave, contenido, "text/plain");
    pasos.push({ paso: "guardar", ok: true, detalle: `${clave} (${contenido.byteLength} bytes)` });
  } catch (e) {
    pasos.push({ paso: "guardar", ok: false, detalle: textoDeError(e) });
    return resultado();
  }
  try {
    const flujo = await destino.leer(clave);
    const leido = flujo ? new Uint8Array(await new Response(flujo).arrayBuffer()) : null;
    const igual = !!leido && Buffer.from(leido).equals(Buffer.from(contenido));
    pasos.push({
      paso: "leer",
      ok: igual,
      detalle: igual ? "el contenido coincide" : leido ? "el contenido leído es distinto" : "no se encontró",
    });
  } catch (e) {
    pasos.push({ paso: "leer", ok: false, detalle: textoDeError(e) });
  }
  try {
    await destino.eliminar(clave);
    pasos.push({ paso: "eliminar", ok: true, detalle: "borrado" });
    const sigue = await destino.leer(clave);
    if (sigue) await sigue.cancel();
    pasos.push({
      paso: "confirmar borrado",
      ok: !sigue,
      detalle: sigue ? "el objeto sigue en el almacén" : "ya no está",
    });
  } catch (e) {
    pasos.push({ paso: "eliminar", ok: false, detalle: textoDeError(e) });
  }
  return resultado();
}
