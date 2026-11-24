// evaluacion/domain: reglas puras de las evidencias pedagógicas (US38, DO-04) y de cómo se muestran en la libreta del
// apoderado y en «Mis notas» del alumno (US47, AP-04 y AL-03). Una evidencia pertenece a una calificación (una nota:
// un estudiante en una competencia de un registro) y tiene un comentario, un archivo o ambos.
import { erroresEvaluacion as E } from "./errores";
import type { EstadoRegistro } from "./notas";

export const LARGO_MAXIMO_COMENTARIO_EVIDENCIA = 1000;

/** US38: el docente sube solo PDF o JPG (el almacén común admite más tipos para el aula virtual). */
export const FORMATOS_EVIDENCIA = ["PDF", "JPG"] as const;

/** Mensaje del Product Backlog v3.3 (US38, criterio 2): el mismo para el formato y para el tamaño. */
export const MENSAJE_ARCHIVO_EVIDENCIA =
  "Formato no permitido o archivo demasiado pesado (máx. 5 MB, formatos PDF/JPG)";

/** Carpeta de las evidencias en el almacén de archivos (clave evidencias/<uuid>). */
export const AREA_EVIDENCIAS = "evidencias";

/** Largo de un texto como lo cuenta PostgreSQL (char_length): por caracteres, no por unidades UTF-16. */
export const largoEnCaracteres = (texto: string) => [...texto].length;

/** Comentario sin espacios sobrantes; uno vacío o solo de espacios no cuenta como comentario. */
export function normalizarComentario(comentario: string | null | undefined): string | null {
  const limpio = comentario?.trim();
  return limpio ? limpio : null;
}

/** Al menos un comentario o un archivo, y el comentario hasta 1000 caracteres (US38, criterio 1). */
export function verificarContenidoEvidencia(datos: { comentario: string | null; tieneArchivo: boolean }) {
  if (!datos.comentario && !datos.tieneArchivo) throw E.evidenciaVacia();
  if (datos.comentario && largoEnCaracteres(datos.comentario) > LARGO_MAXIMO_COMENTARIO_EVIDENCIA) {
    throw E.comentarioEvidenciaLargo();
  }
}

/**
 * Las evidencias se agregan y eliminan solo con el registro ABIERTO (US38, criterio 3); con el registro cerrado o
 * publicado quedan en solo lectura, como sus notas (US40).
 */
export function verificarEvidenciasEditables(estado: EstadoRegistro) {
  if (estado !== "ABIERTO") throw E.registroCerrado();
}

// ---------- Vista (DO-04, AP-04, AL-03) ----------

export interface ArchivoDeEvidencia {
  /** Nombre original saneado. */
  nombre: string;
  /** PDF, JPG… según el contenido; null si el tipo guardado no se reconoce. */
  tipo: string | null;
  mime: string;
  tamanoBytes: number;
}

export interface EvidenciaVista {
  id: string;
  comentario: string | null;
  archivo: ArchivoDeEvidencia | null;
  subidoEn: string;
}

export type AccionEvidencia = "VER_EVIDENCIA" | "VER_COMENTARIO";

/**
 * Enlace de la columna «Evidencia del docente» de AP-04: «Ver evidencia» si alguna trae archivo, «Ver comentario» si
 * solo hay comentarios y ninguno (la celda no es clicable) si la calificación no tiene evidencias (US47, criterio 2).
 */
export function accionDeEvidencias(evidencias: Pick<EvidenciaVista, "archivo">[]): AccionEvidencia | null {
  if (!evidencias.length) return null;
  return evidencias.some((e) => e.archivo) ? "VER_EVIDENCIA" : "VER_COMENTARIO";
}

/** Evidencias agrupadas por nota, en el orden en que se subieron. */
export function evidenciasPorNota<T extends { notaId: string; createdAt: Date }>(filas: T[]): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const f of [...filas].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    grupos.set(f.notaId, [...(grupos.get(f.notaId) ?? []), f]);
  }
  return grupos;
}
