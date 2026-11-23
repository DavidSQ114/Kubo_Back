// Cliente de la API para el frontend. Las cookies de sesión viajan solas (httpOnly).
// - Si el token de acceso venció (401 NO_AUTENTICADO), renueva la sesión una vez y repite la solicitud.
// - Los errores llegan como ApiError con el código y el mensaje listo para mostrar.
// - Un cuerpo FormData (subida de archivos, US38) se envía como multipart/form-data; los archivos protegidos se
//   leen como Blob para verlos, abrirlos o descargarlos sin exponer ninguna URL pública.

export type Rol = "ADMINISTRADOR" | "DOCENTE" | "APODERADO" | "ALUMNO";

export interface Sesion {
  usuario: { id: string; email: string; nombres: string; apellidos: string; nombreCompleto: string; iniciales: string };
  rolActivo: Rol;
  perfiles: Rol[];
  debeCambiarPassword: boolean;
}

export class ApiError extends Error {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    public readonly estado: number,
    public readonly detalles: Record<string, unknown> = {},
  ) {
    super(mensaje);
    this.name = "ApiError";
  }
}

let renovando: Promise<boolean> | null = null;

function renovarSesion(): Promise<boolean> {
  renovando ??= fetch("/api/v1/identidad/refresh", { method: "POST", credentials: "same-origin" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

interface Opciones {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON, o FormData para un formulario con archivos (el navegador pone el multipart y su boundary). */
  body?: unknown;
}

const SIN_CONEXION = "No pudimos conectarnos con el servidor. Revisa tu conexión e inténtalo nuevamente.";

export async function api<T>(ruta: string, opciones: Opciones = {}, reintentar = true): Promise<T> {
  let res: Response;
  try {
    const formulario = opciones.body instanceof FormData;
    res = await fetch(`/api/v1${ruta}`, {
      method: opciones.method ?? "GET",
      headers: opciones.body !== undefined && !formulario ? { "Content-Type": "application/json" } : undefined,
      body: formulario
        ? (opciones.body as FormData)
        : opciones.body !== undefined
          ? JSON.stringify(opciones.body)
          : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("SIN_CONEXION", SIN_CONEXION, 0);
  }

  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && json?.error?.code === "NO_AUTENTICADO" && reintentar && (await renovarSesion())) {
    return api<T>(ruta, opciones, false);
  }
  if (!res.ok) {
    throw new ApiError(
      json?.error?.code ?? "ERROR",
      json?.error?.message ?? "Ocurrió un error inesperado. Inténtalo nuevamente.",
      res.status,
      json?.error?.details ?? {},
    );
  }
  return json.data as T;
}

/** Tiempo que se espera para liberar el archivo: el navegador debe alcanzar a iniciar la descarga. */
const ESPERA_LIBERAR_DESCARGA_MS = 10_000;

/**
 * Lee un archivo protegido de la API (PDF, imagen…) con su nombre. Renueva la sesión como `api()` y, si falla, lanza
 * ApiError con el mensaje del backend.
 */
export async function obtenerArchivo(
  ruta: string,
  nombrePorDefecto = "documento.pdf",
  reintentar = true,
): Promise<{ blob: Blob; nombre: string }> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${ruta}`, { credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError("SIN_CONEXION", SIN_CONEXION, 0);
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && json?.error?.code === "NO_AUTENTICADO" && reintentar && (await renovarSesion())) {
      return obtenerArchivo(ruta, nombrePorDefecto, false);
    }
    throw new ApiError(
      json?.error?.code ?? "ERROR",
      json?.error?.message ?? "Ocurrió un error inesperado. Inténtalo nuevamente.",
      res.status,
      json?.error?.details ?? {},
    );
  }
  const disposicion = res.headers.get("content-disposition") ?? "";
  const utf8 = disposicion.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  const nombre = utf8 ? decodeURIComponent(utf8) : (disposicion.match(/filename="([^"]+)"/)?.[1] ?? nombrePorDefecto);
  return { blob: await res.blob(), nombre };
}

/**
 * Descarga un archivo de la API (por ejemplo, la ficha de matrícula en PDF, US20) y lo guarda en el navegador con el
 * nombre que envía el servidor.
 */
export async function descargar(ruta: string, nombrePorDefecto = "documento.pdf"): Promise<void> {
  const { blob, nombre } = await obtenerArchivo(ruta, nombrePorDefecto);
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), ESPERA_LIBERAR_DESCARGA_MS);
}

/**
 * Abre un archivo de la API en una pestaña nueva (un PDF en el visor del navegador). La pestaña se abre antes de
 * pedir el archivo para que el navegador no la bloquee como ventana emergente.
 */
export async function abrirEnPestana(ruta: string): Promise<void> {
  const pestana = window.open("", "_blank");
  try {
    const { blob } = await obtenerArchivo(ruta);
    const url = URL.createObjectURL(blob);
    if (pestana) pestana.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), ESPERA_LIBERAR_DESCARGA_MS * 6);
  } catch (e) {
    pestana?.close();
    throw e;
  }
}

/** A dónde va cada perfil después de iniciar sesión. */
export function inicioPorRol(rol: Rol): string {
  if (rol === "ADMINISTRADOR") return "/admin/usuarios";
  if (rol === "APODERADO") return "/apoderado";
  if (rol === "DOCENTE") return "/docente";
  return "/alumno";
}

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMINISTRADOR: "Administrador",
  DOCENTE: "Docente",
  APODERADO: "Apoderado",
  ALUMNO: "Alumno",
};

/**
 * Ruta a la que hay que ir según el error de sesión, o null si el error no es de sesión.
 * Se usa en las pantallas protegidas: if (destino) router.replace(destino).
 */
export function destinoPorErrorDeSesion(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  if (e.codigo === "NO_AUTENTICADO" || e.codigo === "SESION_INVALIDA") return "/login";
  if (e.codigo === "CAMBIO_PASSWORD_REQUERIDO") return "/cambiar-password";
  if (e.codigo === "ACCESO_DENEGADO") return "/acceso-denegado";
  return null;
}

export async function cerrarSesion() {
  await api("/identidad/logout", { method: "POST" }).catch(() => undefined);
}
