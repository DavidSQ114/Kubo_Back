import { ApiError, destinoPorErrorDeSesion } from "@/lib/api";

/** Errores de sesión: redirige; el resto se devuelve para mostrarlo en pantalla. */
export function alertaError(e: unknown): string {
  const destino = destinoPorErrorDeSesion(e);
  if (destino && typeof window !== "undefined") window.location.assign(destino);
  return e instanceof ApiError || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}
