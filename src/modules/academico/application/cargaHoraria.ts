// academico/application: lo que el módulo horarios consulta de académico para armar la cuadrícula de una sección
// (US27–US31, RF22–RF24): la sección con su año, los cursos de su plan de estudios con el docente asignado, las
// asignaciones de las clases ya registradas y las aulas. Solo lectura.
import type { Tx } from "@/platform/db/tipos";
import type { EstadoSeccion } from "../domain/secciones";
import type { EstadoAnio } from "../domain/tipos";
import {
  anios,
  asignaciones,
  aulas,
  planes,
  secciones,
  type AulaFila,
  type GradoFila,
} from "../infrastructure/repositorio";

export interface SeccionParaHorario {
  id: string;
  nombre: string;
  estado: EstadoSeccion;
  grado: GradoFila;
  aula: { id: string; nombre: string } | null;
  anio: { id: string; anio: number; estado: EstadoAnio };
}

/** La sección con su grado, su aula habitual y el estado de su año, o null si no existe. */
export async function seccionParaHorario(seccionId: string, tx?: Tx): Promise<SeccionParaHorario | null> {
  const s = await secciones.porId(seccionId, tx);
  if (!s) return null;
  const anio = (await anios.porId(s.anioAcademicoId, tx))!;
  return {
    id: s.id,
    nombre: s.nombre,
    estado: s.estado,
    grado: s.grado,
    aula: s.aula && { id: s.aula.id, nombre: s.aula.nombre },
    anio: { id: anio.id, anio: anio.anio, estado: anio.estado },
  };
}

export interface CursoDeSeccion {
  planEstudioId: string;
  curso: { id: string; codigo: string; nombre: string };
  horasSemanales: number;
  /** Asignación activa del curso en la sección (US14: un solo docente por curso y sección), si la tiene. */
  asignacion: { id: string; docenteId: string } | null;
}

/** Cursos activos del plan de estudios del grado y año de la sección, con sus horas semanales y su docente. */
export async function planDeSeccion(
  seccion: { id: string; grado: { id: string }; anio: { id: string } },
  tx?: Tx,
): Promise<CursoDeSeccion[]> {
  // una tras otra: dentro de una transacción las consultas comparten la conexión
  const delGrado = await planes.delGrado(seccion.anio.id, seccion.grado.id, tx);
  const activas = await asignaciones.activasDeSeccion(seccion.id, tx);
  return delGrado.map((p) => {
    const asignacion = activas.find((a) => a.planEstudioId === p.id);
    return {
      planEstudioId: p.id,
      curso: p.curso,
      horasSemanales: p.horasSemanales,
      asignacion: asignacion ? { id: asignacion.id, docenteId: asignacion.docenteId } : null,
    };
  });
}

export interface AsignacionDeClase {
  id: string;
  docenteId: string;
  activo: boolean;
  curso: { id: string; codigo: string; nombre: string };
  seccion: { id: string; nombre: string; grado: GradoFila };
}

/** Curso, docente y sección de cada asignación docente, activa o no (las clases de un horario la conservan). */
export async function asignacionesDeClases(ids: string[], tx?: Tx): Promise<AsignacionDeClase[]> {
  if (ids.length === 0) return [];
  const filas = await asignaciones.porIds([...new Set(ids)], tx);
  return filas.map((a) => ({
    id: a.id,
    docenteId: a.docenteId,
    activo: a.activo,
    curso: a.planEstudio.curso,
    seccion: a.seccion,
  }));
}

/** Aulas por id, activas o no. */
export async function aulasPorId(ids: string[], tx?: Tx): Promise<AulaFila[]> {
  return ids.length ? aulas.porIds([...new Set(ids)], tx) : [];
}
