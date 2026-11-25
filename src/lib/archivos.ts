// Archivos que sube el navegador (bloque M5, M-07): reconoce los rechazos del servidor que se refieren al archivo
// (tipo real, tamaño o archivo vacío; platform/archivos) para marcarlo como rechazado y no volver a enviarlo.

/** Códigos de platform/archivos que rechazan el archivo elegido. */
export const CODIGOS_ARCHIVO_RECHAZADO = ["ARCHIVO_NO_PERMITIDO", "ARCHIVO_DEMASIADO_GRANDE", "ARCHIVO_VACIO"] as const;

/** ¿El error del servidor rechaza el archivo (y no otro dato del formulario)? */
export function esRechazoDeArchivo(codigo: string | null | undefined): boolean {
  return (CODIGOS_ARCHIVO_RECHAZADO as readonly string[]).includes(codigo ?? "");
}
