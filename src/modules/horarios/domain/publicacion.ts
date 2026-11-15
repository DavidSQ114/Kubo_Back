// horarios/domain: reglas puras de la publicación y de las versiones de un horario (US31, RF24, AD-13).
// Un horario se publica cuando cada curso del plan de estudios de la sección tiene tantos bloques como horas
// semanales. Al publicar, la versión anterior se archiva; editar el publicado crea un borrador a partir de él.
import { erroresHorarios as E, type BloqueLibre, type CursoExcedido, type CursoPendiente } from "./errores";
import { DIAS, type Bloque, type Dia, type EstadoHorario } from "./tipos";

export interface CursoDelPlan {
  cursoId: string;
  nombre: string;
  horasSemanales: number;
}

export interface ClaseAsignada {
  dia: Dia;
  bloqueId: string;
  cursoId: string;
  cursoNombre: string;
  /** false si la asignación docente de la clase se desactivó después (el curso cambió de docente). */
  asignacionActiva: boolean;
}

export interface AvanceCurso extends CursoDelPlan {
  asignados: number;
  faltan: number;
  sobran: number;
}

/**
 * Bloques asignados de cada curso frente a sus horas semanales. Un curso con clases que ya no está en el plan
 * aparece con 0 horas: todos sus bloques sobran.
 */
export function avancePorCurso(plan: CursoDelPlan[], clases: ClaseAsignada[]): AvanceCurso[] {
  const fueraDelPlan = new Map<string, CursoDelPlan>();
  for (const c of clases) {
    if (!plan.some((p) => p.cursoId === c.cursoId)) {
      fueraDelPlan.set(c.cursoId, { cursoId: c.cursoId, nombre: c.cursoNombre, horasSemanales: 0 });
    }
  }
  return [...plan, ...fueraDelPlan.values()].map((curso) => {
    const asignados = clases.filter((c) => c.cursoId === curso.cursoId).length;
    return {
      ...curso,
      asignados,
      faltan: Math.max(curso.horasSemanales - asignados, 0),
      sobran: Math.max(asignados - curso.horasSemanales, 0),
    };
  });
}

/** «32 / 35 bloques»: clases asignadas frente a las horas semanales del plan. */
export function resumenAvance(avance: AvanceCurso[]): { asignados: number; requeridos: number } {
  return {
    asignados: avance.reduce((total, c) => total + c.asignados, 0),
    requeridos: avance.reduce((total, c) => total + c.horasSemanales, 0),
  };
}

/** Celdas de clase (día y bloque) que aún no tienen una clase, en el orden de la cuadrícula. */
export function bloquesLibres(bloques: Bloque[], clases: { dia: Dia; bloqueId: string }[]): BloqueLibre[] {
  const ocupadas = new Set(clases.map((c) => `${c.dia}|${c.bloqueId}`));
  const libres: BloqueLibre[] = [];
  for (const dia of DIAS) {
    for (const b of bloques) {
      if (b.tipo === "CLASE" && !ocupadas.has(`${dia}|${b.id}`)) {
        libres.push({ dia, bloqueId: b.id, horaInicio: b.horaInicio, horaFin: b.horaFin });
      }
    }
  }
  return libres;
}

export interface Pendientes {
  cursos: CursoPendiente[];
  bloquesLibres: BloqueLibre[];
}

/** Lo que falta para publicar: cursos con menos bloques que horas y celdas vacías. Vacío si no falta nada. */
export function pendientesDePublicar(plan: CursoDelPlan[], clases: ClaseAsignada[], bloques: Bloque[]): Pendientes {
  const cursos = avancePorCurso(plan, clases)
    .filter((c) => c.faltan > 0)
    .map(({ cursoId, nombre, horasSemanales, asignados, faltan }) => ({
      cursoId,
      nombre,
      horasSemanales,
      asignados,
      faltan,
    }));
  return { cursos, bloquesLibres: cursos.length ? bloquesLibres(bloques, clases) : [] };
}

/**
 * Un horario se publica solo si cada curso del plan tiene exactamente tantos bloques como horas semanales y todas
 * sus clases siguen respaldadas por una asignación docente activa (US31, criterios 1 y 2).
 */
export function verificarPublicable(plan: CursoDelPlan[], clases: ClaseAsignada[], bloques: Bloque[]) {
  if (plan.length === 0) throw E.planSinCursos();
  const pendientes = pendientesDePublicar(plan, clases, bloques);
  if (pendientes.cursos.length) throw E.horarioIncompleto(pendientes.cursos, pendientes.bloquesLibres);
  const excedidos: CursoExcedido[] = avancePorCurso(plan, clases)
    .filter((c) => c.sobran > 0)
    .map(({ cursoId, nombre, horasSemanales, asignados, sobran }) => ({
      cursoId,
      nombre,
      horasSemanales,
      asignados,
      sobran,
    }));
  if (excedidos.length) throw E.horarioConExceso(excedidos);
  const sinDocente = clases.filter((c) => !c.asignacionActiva);
  if (sinDocente.length) {
    const horas = new Map(bloques.map((b) => [b.id, b]));
    throw E.clasesSinDocenteVigente(
      sinDocente.map((c) => ({
        dia: c.dia,
        bloqueId: c.bloqueId,
        horaInicio: horas.get(c.bloqueId)?.horaInicio ?? "",
        horaFin: horas.get(c.bloqueId)?.horaFin ?? "",
      })),
    );
  }
}

// ---------- Versiones ----------

export interface Version {
  id: string;
  version: number;
  estado: EstadoHorario;
}

export const borradorDe = <T extends Version>(versiones: T[]): T | null =>
  versiones.find((v) => v.estado === "BORRADOR") ?? null;

export const publicadaDe = <T extends Version>(versiones: T[]): T | null =>
  versiones.find((v) => v.estado === "PUBLICADO") ?? null;

/** Versión que se muestra al abrir la cuadrícula: el borrador en edición y, si no hay, la publicada. */
export function versionVigente<T extends Version>(versiones: T[]): T | null {
  return borradorDe(versiones) ?? publicadaDe(versiones);
}

/** Número de la próxima versión de la sección (la primera es la 1). */
export function siguienteVersion(versiones: Version[]): number {
  return versiones.reduce((mayor, v) => Math.max(mayor, v.version), 0) + 1;
}

/**
 * Qué cambia al publicar: el borrador pasa a PUBLICADO y la versión publicada anterior, si existe, a ARCHIVADO
 * (US31, criterio 3). Sin borrador no hay nada que publicar.
 */
export function planDePublicacion<T extends Version>(versiones: T[]): { publicar: T; archivar: T | null } {
  const borrador = borradorDe(versiones);
  if (!borrador) throw E.sinCambiosPorPublicar();
  return { publicar: borrador, archivar: publicadaDe(versiones) };
}
