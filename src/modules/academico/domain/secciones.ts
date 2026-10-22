// academico/domain: reglas puras de secciones (US08) y aulas con su aforo (US09).
// El tope «aforo de la sección ≤ aforo del aula» lo valida el trigger tg_seccion_aforo_aula; aquí no se repite.
import { erroresAcademico as E } from "./errores";
import type { EstadoAnio } from "./tipos";

export const ESTADOS_SECCION = ["ACTIVA", "INACTIVA"] as const;
export type EstadoSeccion = (typeof ESTADOS_SECCION)[number];

const NOMBRE_SECCION = /^[A-Z]{1,3}$/;

export interface Vacantes {
  matriculados: number;
  aforo: number;
  disponibles: number;
  completo: boolean;
}

/** Aforo de un aula o de una sección: entero mayor a 0. */
export function verificarAforo(aforo: number) {
  if (!Number.isInteger(aforo) || aforo <= 0) throw E.aforoInvalido();
}

/** "  b " → "B". Las secciones se nombran con letras (A, B, C…). */
export function normalizarNombreSeccion(nombre: string): string {
  const limpio = nombre.trim().toUpperCase();
  if (!NOMBRE_SECCION.test(limpio)) throw E.nombreSeccionInvalido();
  return limpio;
}

/** Las secciones solo se crean o cambian en un año que no esté cerrado. */
export function verificarAnioEditable(estado: EstadoAnio) {
  if (estado === "CERRADO") throw E.anioCerrado();
}

/** Matriculados frente al aforo: «27/30» y si quedó completo. */
export function calcularVacantes(matriculados: number, aforo: number): Vacantes {
  const disponibles = Math.max(0, aforo - matriculados);
  return { matriculados, aforo, disponibles, completo: disponibles === 0 };
}

/** Para matricular: la sección debe estar activa y tener al menos una vacante. */
export function verificarVacantes(estado: EstadoSeccion, v: Vacantes) {
  if (estado !== "ACTIVA") throw E.seccionInactiva();
  if (v.completo) throw E.seccionSinVacantes(v.matriculados, v.aforo);
}

/** Una sección con matrículas (vigentes o históricas) no se elimina: se inactiva. */
export function verificarEliminacion(matriculas: number) {
  if (matriculas > 0) throw E.seccionConMatriculados(matriculas);
}

/** El aforo nuevo de un aula no puede quedar por debajo del de sus secciones asignadas. */
export function verificarAforoAula(aforo: number, aforosSecciones: number[]) {
  verificarAforo(aforo);
  const maximo = Math.max(0, ...aforosSecciones);
  if (aforo < maximo) throw E.aforoMenorQueSecciones(maximo);
}

/** «1° A, 2° B»: secciones que usan un aula (mensajes). */
export const listaSecciones = (secciones: { grado: number; nombre: string }[]) =>
  secciones.map((s) => `${s.grado}° ${s.nombre}`).join(", ");
