// evaluacion/domain: reglas puras de la nota de conducta del bloque M3. El tutor o cotutor la registra por alumno y
// bimestre (AD, A, B o C, con un comentario opcional de hasta 500 caracteres) mientras el periodo no esté FINALIZADO;
// la libreta la muestra cuando el bimestre está publicado.
import { erroresTutoriaNotas as E } from "./errores";
import type { LogroNota } from "./notas";

export const LARGO_MAXIMO_COMENTARIO_CONDUCTA = 500;

export interface ConductaNueva {
  matriculaId: string;
  valor: LogroNota;
  /** null: sin comentario. */
  comentario: string | null;
}

export interface ConductaGuardada extends ConductaNueva {
  id: string;
}

/** Un periodo FINALIZADO ya no admite registrar ni modificar la conducta. */
export function verificarPeriodoDeConducta(estado: string) {
  if (estado === "FINALIZADO") throw E.periodoFinalizado();
}

/** Todas las notas deben ser de alumnos de la sección, sin repetirse, y debe haber al menos una. */
export function verificarAlumnosDeConducta(alumnos: Set<string>, notas: ConductaNueva[]) {
  if (!notas.length) throw E.conductaVacia();
  const ids = new Set(notas.map((n) => n.matriculaId));
  if (ids.size !== notas.length || notas.some((n) => !alumnos.has(n.matriculaId))) throw E.alumnoFueraDeLaSeccion();
}

/**
 * Qué notas son nuevas y cuáles cambian de valor o de comentario. Las que quedan igual no se tocan: así no figuran
 * como modificadas ni dejan una fila más en la auditoría.
 */
export function cambiosDeConducta(
  guardadas: ConductaGuardada[],
  nuevas: ConductaNueva[],
): { crear: ConductaNueva[]; cambiar: { guardada: ConductaGuardada; nueva: ConductaNueva }[] } {
  const porMatricula = new Map(guardadas.map((g) => [g.matriculaId, g]));
  const crear: ConductaNueva[] = [];
  const cambiar: { guardada: ConductaGuardada; nueva: ConductaNueva }[] = [];
  for (const nueva of nuevas) {
    const guardada = porMatricula.get(nueva.matriculaId);
    if (!guardada) crear.push(nueva);
    else if (guardada.valor !== nueva.valor || guardada.comentario !== nueva.comentario) {
      cambiar.push({ guardada, nueva });
    }
  }
  return { crear, cambiar };
}

/** La conducta se ve en la libreta del apoderado y del alumno solo cuando el bimestre está publicado (todos sus cursos). */
export const conductaVisibleEnLibreta = (estadoBimestre: string) => estadoBimestre === "PUBLICADO";

/** Resumen de la conducta de la sección: cuántos alumnos tienen AD, A, B y C, y cuántos están sin nota. */
export function resumenDeConducta(valores: (LogroNota | null)[]): Record<LogroNota | "SIN_NOTA", number> {
  const cuenta = (v: LogroNota | null) => valores.filter((x) => x === v).length;
  return { AD: cuenta("AD"), A: cuenta("A"), B: cuenta("B"), C: cuenta("C"), SIN_NOTA: cuenta(null) };
}
