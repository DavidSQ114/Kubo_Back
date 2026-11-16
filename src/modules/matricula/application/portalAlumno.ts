// matricula/application: portal del alumno (US49, AL-01 y AL-05), solo lectura. El alumno en sesión se resuelve en el
// servidor (persona → estudiante → matrícula vigente): nunca llega un id de estudiante ni de sección desde el
// navegador, así que un alumno no puede consultar la sección de otro. Sin matrícula vigente (retirado, anulado, en
// proceso o año cerrado) todo responde 403 SIN_MATRICULA_VIGENTE.
import { planDeSeccion, seccionParaHorario } from "@/modules/academico";
import { docentesProviderComunidad, estudianteDePersona } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { erroresMatricula as E } from "../domain/errores";
import { matriculaVigente, verificarMatriculaVigente } from "../domain/portalAlumno";
import { matriculasVisibles, seccionDe } from "./portalApoderado";

export interface MatriculaDelAlumno {
  estudianteId: string;
  nombres: string;
  apellidos: string;
  matriculaId: string;
  anioAcademicoId: string;
  anio: number;
  /** null solo si la matrícula no tiene sección. */
  seccionId: string | null;
}

/** Matrícula vigente del alumno en sesión; si no la tiene, 403 SIN_MATRICULA_VIGENTE. */
export async function matriculaVigenteDelAlumno(auth: Autenticado): Promise<MatriculaDelAlumno> {
  const estudiante = await estudianteDePersona(auth.personaId);
  if (!estudiante) throw E.sinMatriculaVigente();
  const m = verificarMatriculaVigente(matriculaVigente(await matriculasVisibles(estudiante.estudianteId)));
  return {
    ...estudiante,
    matriculaId: m.id,
    anioAcademicoId: m.anioAcademicoId,
    anio: m.anio,
    seccionId: m.seccionId,
  };
}

export interface PanelDelAlumno {
  estudiante: { estudianteId: string; nombres: string; nombreCompleto: string; iniciales: string };
  anio: number;
  /** «1° de secundaria». */
  grado: string | null;
  /** «A». */
  seccion: string | null;
  /** «1° A». */
  seccionCorta: string | null;
}

/** Datos del panel del alumno (AL-01): quién es y en qué grado y sección está matriculado este año. */
export async function panelDelAlumno(auth: Autenticado): Promise<PanelDelAlumno> {
  const m = await matriculaVigenteDelAlumno(auth);
  const seccion = await seccionDe(m);
  return {
    estudiante: {
      estudianteId: m.estudianteId,
      nombres: m.nombres,
      nombreCompleto: `${m.nombres} ${m.apellidos}`,
      iniciales: `${m.nombres.trim().charAt(0)}${m.apellidos.trim().charAt(0)}`.toUpperCase(),
    },
    anio: m.anio,
    grado: seccion?.grado ?? null,
    seccion: seccion?.seccion ?? null,
    seccionCorta: seccion?.corta ?? null,
  };
}

export interface CursoDelAlumno {
  cursoId: string;
  codigo: string;
  nombre: string;
  horasSemanales: number;
  /** Docente con el curso asignado en la sección (US14); null si aún no tiene. */
  docente: { nombreCompleto: string; nombreCorto: string } | null;
}

/** «Mis cursos» del alumno (US49): los cursos del plan de estudios de su sección, cada uno con su docente. */
export async function cursosDelAlumno(
  auth: Autenticado,
): Promise<{ anio: number; seccionCorta: string | null; cursos: CursoDelAlumno[] }> {
  const m = await matriculaVigenteDelAlumno(auth);
  const seccion = m.seccionId ? await seccionParaHorario(m.seccionId) : null;
  if (!seccion) return { anio: m.anio, seccionCorta: null, cursos: [] };
  const plan = await planDeSeccion(seccion);
  const ids = [...new Set(plan.flatMap((p) => (p.asignacion ? [p.asignacion.docenteId] : [])))];
  const docentes = new Map(
    (ids.length ? await docentesProviderComunidad.docentesPorId(ids) : []).map((d) => [d.id, d]),
  );
  const cursos = plan
    .map((p) => {
      const docente = p.asignacion ? docentes.get(p.asignacion.docenteId) : undefined;
      return {
        cursoId: p.curso.id,
        codigo: p.curso.codigo,
        nombre: p.curso.nombre,
        horasSemanales: p.horasSemanales,
        docente: docente ? { nombreCompleto: docente.nombreCompleto, nombreCorto: docente.nombreCorto } : null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { anio: m.anio, seccionCorta: `${seccion.grado.numero}° ${seccion.nombre}`, cursos };
}
