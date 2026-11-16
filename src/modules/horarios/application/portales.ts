// horarios/application: horario del estudiante en los portales (US48 «Horario» del apoderado, AP-05; US50 «Mi
// horario» del alumno, AL-02). La sección nunca llega del navegador: matricula la resuelve desde la sesión (el alumno)
// o desde el vínculo del apoderado con el hijo pedido (403 si no es su hijo). Solo se muestra la versión PUBLICADA
// vigente: al publicarse una nueva, la siguiente consulta ya la trae.
import type { Autenticado } from "@/modules/identidad";
import { matriculaVigenteDelAlumno, seccionDelHijo } from "@/modules/matricula";
import { DIAS, type Bloque, type Dia } from "../domain/tipos";
import { horarioPublicadoDeSeccion } from "./consultas";
import type { ClaseVista, SeccionVista, VersionVista } from "./cuadricula";

export interface HorarioDeEstudiante {
  estudiante: { estudianteId: string; nombres: string; nombreCompleto: string };
  /** null si el estudiante no tiene una sección con matrícula vigente (por ejemplo, un hijo retirado). */
  seccion: SeccionVista | null;
  dias: readonly Dia[];
  bloques: Bloque[];
  /** Versión publicada; null si la institución aún no publica el horario de la sección. */
  horario: VersionVista | null;
  clases: ClaseVista[];
}

async function horarioDeEstudiante(e: {
  estudianteId: string;
  nombres: string;
  apellidos: string;
  seccionId: string | null;
}): Promise<HorarioDeEstudiante> {
  const estudiante = {
    estudianteId: e.estudianteId,
    nombres: e.nombres,
    nombreCompleto: `${e.nombres} ${e.apellidos}`,
  };
  if (!e.seccionId) return { estudiante, seccion: null, dias: DIAS, bloques: [], horario: null, clases: [] };
  return { estudiante, ...(await horarioPublicadoDeSeccion(e.seccionId)) };
}

/** «Mi horario» del alumno en sesión (US50): el horario publicado de la sección de su matrícula vigente. */
export async function horarioDelAlumno(auth: Autenticado): Promise<HorarioDeEstudiante> {
  return horarioDeEstudiante(await matriculaVigenteDelAlumno(auth));
}

/** «Horario» de un hijo del apoderado en sesión (US48). 403 ESTUDIANTE_NO_VINCULADO si no es su hijo. */
export async function horarioDelHijo(auth: Autenticado, estudianteId: string): Promise<HorarioDeEstudiante> {
  return horarioDeEstudiante(await seccionDelHijo(auth, estudianteId));
}
