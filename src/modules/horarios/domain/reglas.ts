// horarios/domain: reglas puras de la cuadrícula y de la asignación de clases (US27, US28, US29, US30; RF22, RF23;
// pantallas AD-13 y M-06). Sin Prisma ni Next.js: reciben los datos ya leídos y lanzan los errores del módulo.
import { errores } from "@/platform/http/errores";
import { erroresHorarios as E } from "./errores";
import { TIPOS_BLOQUE, type Bloque, type BloqueNuevo, type Dia, type EstadoHorario } from "./tipos";

/** Un año cerrado ya no es el periodo académico activo: sus horarios quedan en solo lectura (US27, criterio 3). */
const ESTADOS_ANIO_SIN_EDICION: readonly string[] = ["CERRADO"];

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface SeccionDelHorario {
  estado: string;
  anioEstado: string;
}

/** ¿El año de la sección es el periodo académico activo (cualquier estado menos «Cerrado»)? */
export function esAnioActivo(anioEstado: string): boolean {
  return !ESTADOS_ANIO_SIN_EDICION.includes(anioEstado);
}

/** Por qué la cuadrícula se muestra en solo lectura, o null si se puede editar (US27). */
export function motivoSoloLectura(seccion: SeccionDelHorario) {
  if (!esAnioActivo(seccion.anioEstado)) return E.seccionFueraDelAnioActivo();
  if (seccion.estado !== "ACTIVA") return E.seccionInactiva();
  return null;
}

/** Solo se edita el horario de una sección activa del periodo académico activo. */
export function verificarEditable(seccion: SeccionDelHorario) {
  const motivo = motivoSoloLectura(seccion);
  if (motivo) throw motivo;
}

/**
 * Valida la jornada por defecto (parámetro BLOQUES_HORARIO): bloques con orden único, horas "HH:MM" con fin
 * posterior al inicio, tipo CLASE o RECREO y sin solaparse. La devuelve ordenada.
 */
export function leerJornada(valor: unknown): BloqueNuevo[] {
  if (!Array.isArray(valor) || valor.length === 0) throw E.jornadaNoConfigurada();
  const bloques = valor.map((v): BloqueNuevo => {
    const b = (v ?? {}) as Record<string, unknown>;
    const valido =
      Number.isInteger(b.orden) &&
      (b.orden as number) >= 1 &&
      typeof b.horaInicio === "string" &&
      FORMATO_HORA.test(b.horaInicio) &&
      typeof b.horaFin === "string" &&
      FORMATO_HORA.test(b.horaFin) &&
      b.horaFin > b.horaInicio &&
      TIPOS_BLOQUE.includes(b.tipo as BloqueNuevo["tipo"]) &&
      typeof b.etiqueta === "string" &&
      b.etiqueta.trim().length > 0;
    if (!valido) throw E.jornadaNoConfigurada();
    return {
      orden: b.orden as number,
      horaInicio: b.horaInicio as string,
      horaFin: b.horaFin as string,
      tipo: b.tipo as BloqueNuevo["tipo"],
      etiqueta: (b.etiqueta as string).trim(),
    };
  });
  bloques.sort((a, b) => a.orden - b.orden);
  bloques.forEach((b, i) => {
    const anterior = bloques[i - 1];
    if (anterior && (anterior.orden === b.orden || b.horaInicio < anterior.horaFin)) throw E.jornadaNoConfigurada();
  });
  return bloques;
}

export interface DatosClase {
  cursoId?: string | null;
  docenteId?: string | null;
  aulaId?: string | null;
}

/** Curso, docente y aula son obligatorios (US28, criterio 2). */
export function verificarClaseCompleta(datos: DatosClase): { cursoId: string; docenteId: string; aulaId: string } {
  const { cursoId, docenteId, aulaId } = datos;
  if (!cursoId || !docenteId || !aulaId) throw E.claseIncompleta();
  return { cursoId, docenteId, aulaId };
}

/** El bloque debe ser del catálogo del año de la sección y de tipo CLASE (el recreo queda sin asignar, US27). */
export function verificarBloqueAsignable(bloque: Bloque | null): Bloque {
  if (!bloque) throw errores.noEncontrado("El bloque horario");
  if (bloque.tipo !== "CLASE") throw E.bloqueDeRecreo();
  return bloque;
}

export interface CursoDeSeccion {
  cursoId: string;
  /** Asignación activa del curso en la sección (un solo docente por curso y sección), si la tiene. */
  asignacion: { id: string; docenteId: string } | null;
}

/**
 * El curso debe estar en el plan de estudios de la sección y el docente elegido debe tenerlo asignado en ella
 * (US28, criterio 3). Devuelve la asignación docente que respalda la clase.
 */
export function verificarDocenteDelCurso(
  plan: CursoDeSeccion[],
  cursoId: string,
  docenteId: string,
): { id: string; docenteId: string } {
  const curso = plan.find((c) => c.cursoId === cursoId);
  if (!curso) throw E.cursoFueraDelPlan();
  if (!curso.asignacion || curso.asignacion.docenteId !== docenteId) throw E.docenteSinCurso();
  return curso.asignacion;
}

/** Clase vigente (de un borrador o de una versión publicada) que ocupa a un docente y un aula. */
export interface Ocupacion {
  seccionId: string;
  dia: Dia;
  bloqueId: string;
  docenteId: string;
  aulaId: string;
  estadoHorario: EstadoHorario;
}

export interface ClaseCandidata {
  seccionId: string;
  dia: Dia;
  bloqueId: string;
  docenteId: string;
  aulaId: string;
}

export interface Cruces {
  docente: Ocupacion | null;
  aula: Ocupacion | null;
}

/**
 * Cruces de la clase con las de OTRAS secciones en el mismo día y bloque (US29, US30). El borrador y la versión
 * publicada de la propia sección no cuentan: repiten sus clases. Si el docente o el aula chocan con varias
 * versiones de otra sección, se informa primero la publicada.
 */
export function buscarCruces(candidata: ClaseCandidata, ocupaciones: Ocupacion[]): Cruces {
  const delBloque = ocupaciones
    .filter(
      (o) =>
        o.seccionId !== candidata.seccionId &&
        o.dia === candidata.dia &&
        o.bloqueId === candidata.bloqueId &&
        o.estadoHorario !== "ARCHIVADO",
    )
    .sort((a, b) => Number(b.estadoHorario === "PUBLICADO") - Number(a.estadoHorario === "PUBLICADO"));
  return {
    docente: delBloque.find((o) => o.docenteId === candidata.docenteId) ?? null,
    aula: delBloque.find((o) => o.aulaId === candidata.aulaId) ?? null,
  };
}
