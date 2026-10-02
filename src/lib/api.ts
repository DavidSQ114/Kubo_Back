// Cliente de la API para el frontend. Las cookies de sesión viajan solas (httpOnly).
// - Si el token de acceso venció (401 NO_AUTENTICADO), renueva la sesión una vez y repite la solicitud.
// - Los errores llegan como ApiError con el código y el mensaje listo para mostrar.

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
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

export async function api<T>(ruta: string, opciones: Opciones = {}, reintentar = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${ruta}`, {
      method: opciones.method ?? "GET",
      headers: opciones.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "SIN_CONEXION",
      "No pudimos conectarnos con el servidor. Revisa tu conexión e inténtalo nuevamente.",
      0,
    );
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

/** A dónde va cada perfil después de iniciar sesión. */
export function inicioPorRol(rol: Rol): string {
  if (rol === "ADMINISTRADOR") return "/admin/usuarios";
  if (rol === "DOCENTE") return "/docente";
  return "/inicio";
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
