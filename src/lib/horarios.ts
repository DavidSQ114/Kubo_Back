// AD-13 · Matriz de horarios (US31): textos de los cursos y clases que impiden publicar. Los usan el banner del
// rechazo y el panel «Validaciones», para que ambos describan lo mismo con el mismo dato.

export type DiaHorario = "LUNES" | "MARTES" | "MIERCOLES" | "JUEVES" | "VIERNES";

export const NOMBRE_DIA: Record<DiaHorario, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
};

/** Lo mínimo de un curso para describir su avance: vale para el plan de la cuadrícula y para los detalles del error. */
export interface AvanceCursoTexto {
  nombre: string;
  horasSemanales: number;
  asignados: number;
}

export interface BloqueTexto {
  dia: DiaHorario;
  horaInicio: string;
  horaFin: string;
}

/** Detalles de los rechazos HORARIO_INCOMPLETO, HORARIO_CON_EXCESO y CLASES_SIN_DOCENTE_VIGENTE. */
export interface DetallesRechazo {
  cursos?: AvanceCursoTexto[];
  bloquesLibres?: BloqueTexto[];
  clases?: BloqueTexto[];
}

/** Máximo de bloques que se listan en el banner; el resto se resume como «y N más». */
const MAXIMO_BLOQUES = 8;

/** «Martes 12:35 – 13:20». */
export const textoBloque = (b: BloqueTexto) => `${NOMBRE_DIA[b.dia]} ${b.horaInicio} – ${b.horaFin}`;

/**
 * Avance de un curso frente a sus horas semanales, calculado con asignados y horas (no con «faltan» ni «sobran»,
 * que solo trae uno de los dos rechazos).
 *   textoAvanceCurso({ nombre: "Comunicación", asignados: 19, horasSemanales: 5 })
 *   // «Comunicación: 19 de 5 bloques (sobran 14)»
 */
export function textoAvanceCurso(c: AvanceCursoTexto): string {
  const diferencia = c.asignados - c.horasSemanales;
  const base = `${c.nombre}: ${c.asignados} de ${c.horasSemanales} ${c.horasSemanales === 1 ? "bloque" : "bloques"}`;
  if (diferencia > 0) return `${base} (${diferencia === 1 ? "sobra 1" : `sobran ${diferencia}`})`;
  if (diferencia < 0) return `${base} (${diferencia === -1 ? "falta 1" : `faltan ${-diferencia}`})`;
  return base;
}

/** «Lunes 08:00 – 08:45 · Martes 09:30 – 10:15 · y 3 más». */
export function listaBloques(bloques: BloqueTexto[]): string {
  const visibles = bloques.slice(0, MAXIMO_BLOQUES).map(textoBloque).join(" · ");
  return bloques.length > MAXIMO_BLOQUES ? `${visibles} · y ${bloques.length - MAXIMO_BLOQUES} más` : visibles;
}

/** Líneas del banner que explican un rechazo al publicar: cursos, bloques libres y clases por reasignar. */
export function lineasRechazo(detalles: DetallesRechazo | null | undefined): string[] {
  const lineas: string[] = [];
  const cursos = detalles?.cursos ?? [];
  const libres = detalles?.bloquesLibres ?? [];
  const clases = detalles?.clases ?? [];
  if (cursos.length) lineas.push(cursos.map(textoAvanceCurso).join(" · "));
  if (libres.length) lineas.push(`Bloques libres: ${listaBloques(libres)}`);
  if (clases.length) lineas.push(`Clases por reasignar: ${listaBloques(clases)}`);
  return lineas;
}
