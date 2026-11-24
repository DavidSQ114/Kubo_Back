// platform/archivos: reglas puras de los archivos que suben los usuarios (US38 evidencias; luego aula virtual y
// trabajos). El tipo real se decide por los primeros bytes (nunca por la extensión ni el Content-Type del navegador),
// el tamaño máximo es 5 MB, el nombre original se sanea y la clave interna es <area>/<uuid>.
import { ErrorApp } from "@/platform/http/errores";

export const TIPOS_ARCHIVO = ["PDF", "JPG", "PNG", "DOCX", "PPTX", "XLSX"] as const;
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number];

/** 5 MB: límite de US38 y de ck_evidencia_tamano en la base. */
export const TAMANO_MAXIMO_ARCHIVO = 5 * 1024 * 1024;

export const MIME_ARCHIVO: Record<TipoArchivo, string> = {
  PDF: "application/pdf",
  JPG: "image/jpeg",
  PNG: "image/png",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const EXTENSIONES: Record<TipoArchivo, string[]> = {
  PDF: ["pdf"],
  JPG: ["jpg", "jpeg"],
  PNG: ["png"],
  DOCX: ["docx"],
  PPTX: ["pptx"],
  XLSX: ["xlsx"],
};

export const erroresArchivos = {
  vacio: () => new ErrorApp("ARCHIVO_VACIO", "El archivo está vacío. Elige otro archivo.", 400),
  /** El mensaje lo define cada caso de uso (por ejemplo, el de US38 con sus formatos). */
  noPermitido: (mensaje: string) => new ErrorApp("ARCHIVO_NO_PERMITIDO", mensaje, 400),
  demasiadoGrande: (mensaje: string) => new ErrorApp("ARCHIVO_DEMASIADO_GRANDE", mensaje, 413),
  formularioInvalido: () =>
    new ErrorApp(
      "DATOS_INVALIDOS",
      "No se pudo leer el formulario. Vuelve a elegir el archivo e inténtalo de nuevo.",
      400,
    ),
  almacenNoConfigurado: () =>
    new ErrorApp(
      "ALMACEN_NO_CONFIGURADO",
      "El almacenamiento de archivos no está disponible en este ambiente. Comunícate con el Administrador.",
      503,
    ),
  noEncontrado: () => new ErrorApp("NO_ENCONTRADO", "El archivo no existe.", 404),
};

// ---------- Tipo real por los primeros bytes ----------

const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const FIRMA_JPG = [0xff, 0xd8, 0xff];
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FIRMA_ZIP = [0x50, 0x4b, 0x03, 0x04]; // PK\3\4: DOCX, PPTX y XLSX son ZIP

const empiezaCon = (bytes: Uint8Array, firma: number[]) =>
  bytes.byteLength >= firma.length && firma.every((b, i) => bytes[i] === b);

// Estructura del ZIP (APPNOTE de PKWARE): el directorio central se ubica desde el registro final
const FIRMA_FIN_DIRECTORIO = 0x06054b50;
const FIRMA_ENTRADA_DIRECTORIO = 0x02014b50;
const LARGO_FIN_DIRECTORIO = 22;
const LARGO_MAXIMO_COMENTARIO_ZIP = 0xffff;
const LARGO_ENTRADA_DIRECTORIO = 46;

/** Nombres de las entradas de un ZIP según su directorio central; [] si la estructura no es válida. */
export function nombresDelZip(bytes: Uint8Array): string[] {
  if (bytes.byteLength < LARGO_FIN_DIRECTORIO) return [];
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const desde = Math.max(0, bytes.byteLength - LARGO_FIN_DIRECTORIO - LARGO_MAXIMO_COMENTARIO_ZIP);
  let fin = -1;
  for (let i = bytes.byteLength - LARGO_FIN_DIRECTORIO; i >= desde; i--) {
    if (vista.getUint32(i, true) === FIRMA_FIN_DIRECTORIO) {
      fin = i;
      break;
    }
  }
  if (fin < 0) return [];
  const entradas = vista.getUint16(fin + 10, true);
  let posicion = vista.getUint32(fin + 16, true);
  const decodificador = new TextDecoder();
  const nombres: string[] = [];
  for (let n = 0; n < entradas; n++) {
    const inicio = posicion + LARGO_ENTRADA_DIRECTORIO;
    if (inicio > bytes.byteLength || vista.getUint32(posicion, true) !== FIRMA_ENTRADA_DIRECTORIO) return [];
    const largoNombre = vista.getUint16(posicion + 28, true);
    const largoExtra = vista.getUint16(posicion + 30, true);
    const largoComentario = vista.getUint16(posicion + 32, true);
    if (inicio + largoNombre > bytes.byteLength) return [];
    nombres.push(decodificador.decode(bytes.subarray(inicio, inicio + largoNombre)));
    posicion = inicio + largoNombre + largoExtra + largoComentario;
  }
  return nombres;
}

/** Parte principal de cada documento de Office (Open XML) dentro del ZIP. */
const PARTE_PRINCIPAL: [string, TipoArchivo][] = [
  ["word/document.xml", "DOCX"],
  ["ppt/presentation.xml", "PPTX"],
  ["xl/workbook.xml", "XLSX"],
];

/** DOCX, PPTX o XLSX según las partes del ZIP; un ZIP cualquiera o uno con macros (vbaProject.bin) no lo es. */
export function tipoOffice(nombres: string[]): TipoArchivo | null {
  if (!nombres.includes("[Content_Types].xml")) return null;
  if (nombres.some((n) => n.toLowerCase().endsWith("vbaproject.bin"))) return null;
  return PARTE_PRINCIPAL.find(([parte]) => nombres.includes(parte))?.[1] ?? null;
}

/** Tipo real del archivo por su contenido; null si no es ninguno de los admitidos. */
export function detectarTipo(bytes: Uint8Array): TipoArchivo | null {
  if (empiezaCon(bytes, FIRMA_PDF)) return "PDF";
  if (empiezaCon(bytes, FIRMA_JPG)) return "JPG";
  if (empiezaCon(bytes, FIRMA_PNG)) return "PNG";
  if (empiezaCon(bytes, FIRMA_ZIP)) return tipoOffice(nombresDelZip(bytes));
  return null;
}

export const tipoDeMime = (mime: string): TipoArchivo | null =>
  TIPOS_ARCHIVO.find((t) => MIME_ARCHIVO[t] === mime) ?? null;

// ---------- Nombre original saneado ----------

/** Largo máximo del nombre guardado, con su extensión. */
export const LARGO_MAXIMO_NOMBRE = 120;
const NOMBRE_POR_DEFECTO = "archivo";
const PROHIBIDOS = new Set(["<", ">", ":", '"', "|", "?", "*"]);
const CODIGO_PRIMER_IMPRIMIBLE = 0x20;
const CODIGO_SUPRIMIR = 0x7f;

/**
 * Nombre que se muestra y se usa en la descarga: sin carpetas, sin caracteres de control ni reservados, con la
 * extensión del tipo real. «C:\fakepath\Informe final.JPEG» → «Informe final.jpg»; «virus.exe» (un PDF) →
 * «virus.exe.pdf».
 */
export function sanearNombre(original: string, tipo: TipoArchivo): string {
  const base = original.split(/[\\/]/).pop() ?? "";
  const limpio = [...base.normalize("NFC")]
    .filter((c) => {
      const codigo = c.codePointAt(0)!;
      return codigo >= CODIGO_PRIMER_IMPRIMIBLE && codigo !== CODIGO_SUPRIMIR && !PROHIBIDOS.has(c);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const punto = limpio.lastIndexOf(".");
  const extensionActual = punto >= 0 ? limpio.slice(punto + 1).toLowerCase() : "";
  const sinExtension = EXTENSIONES[tipo].includes(extensionActual) ? limpio.slice(0, punto) : limpio;
  const extension = EXTENSIONES[tipo][0];
  const cuerpo = [...sinExtension.replace(/^[.\s]+|[.\s]+$/g, "")]
    .slice(0, LARGO_MAXIMO_NOMBRE - extension.length - 1)
    .join("")
    .trim();
  return `${cuerpo || NOMBRE_POR_DEFECTO}.${extension}`;
}

// ---------- Validación ----------

export interface ArchivoRecibido {
  nombre: string;
  bytes: Uint8Array;
}

export interface ArchivoValidado {
  bytes: Uint8Array;
  tipo: TipoArchivo;
  mime: string;
  /** Nombre original saneado. */
  nombre: string;
  tamanoBytes: number;
}

export interface ReglasArchivo {
  permitidos: readonly TipoArchivo[];
  /** Mensaje para el formato no permitido o el exceso de tamaño (US38: el mismo para ambos). */
  mensaje: string;
  tamanoMaximo?: number;
}

/** Rechaza un archivo vacío, más pesado que el máximo o de un tipo real no permitido. */
export function validarArchivo(archivo: ArchivoRecibido, reglas: ReglasArchivo): ArchivoValidado {
  const tamanoBytes = archivo.bytes.byteLength;
  if (tamanoBytes === 0) throw erroresArchivos.vacio();
  if (tamanoBytes > (reglas.tamanoMaximo ?? TAMANO_MAXIMO_ARCHIVO))
    throw erroresArchivos.demasiadoGrande(reglas.mensaje);
  const tipo = detectarTipo(archivo.bytes);
  if (!tipo || !reglas.permitidos.includes(tipo)) throw erroresArchivos.noPermitido(reglas.mensaje);
  return {
    bytes: archivo.bytes,
    tipo,
    mime: MIME_ARCHIVO[tipo],
    nombre: sanearNombre(archivo.nombre, tipo),
    tamanoBytes,
  };
}

// ---------- Clave interna ----------

const AREA = /^[a-z][a-z0-9-]{1,39}$/;
const CLAVE = /^[a-z][a-z0-9-]{1,39}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** «evidencias/3f1c…»: el área agrupa los archivos de cada funcionalidad; el uuid no dice nada del contenido. */
export function claveDeArchivo(area: string, uuid: string): string {
  const clave = `${area}/${uuid}`;
  if (!AREA.test(area) || !CLAVE.test(clave)) throw new Error(`Clave de archivo no válida: ${clave}`);
  return clave;
}

/** Solo una clave con esta forma llega al almacén: nunca una ruta con «..» ni una carpeta ajena. */
export const esClaveValida = (clave: string) => CLAVE.test(clave);

// ---------- Descarga ----------

/** JPG y PDF se abren en el navegador; el resto se descarga. */
export const disposicionDe = (tipo: TipoArchivo | null): "inline" | "attachment" =>
  tipo === "JPG" || tipo === "PDF" ? "inline" : "attachment";

/** Content-Disposition con el nombre en ASCII y, completo, en UTF-8 (RFC 6266 y RFC 5987). */
export function cabeceraDisposicion(tipo: TipoArchivo | null, nombre: string): string {
  const ascii = nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w.() -]/g, "_");
  const utf8 = encodeURIComponent(nombre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposicionDe(tipo)}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
