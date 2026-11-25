// evaluacion/application: notas de la tutoría (bloque M3). (a) Notas por alumno: el tutor ve la libreta completa del
// año de cada alumno de su sección, todos los cursos (lo no publicado, marcado «Sin publicar») y la conducta de cada
// bimestre. (b) Consolidado de la sección: matriz de alumnos por cursos con el logro consolidado del bimestre elegido
// y la conducta, el resumen de AD, A, B y C por curso y su descarga en CSV.
import { nombreArchivoSeguro, textoCsv } from "@/platform/http/csv";
import { planDeSeccion, tutoriaDelDocente } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import { datosDeMatriculas } from "@/modules/matricula";
import { resumenDeConducta } from "../domain/conducta";
import { erroresTutoriaNotas as E } from "../domain/errores";
import type { LogroNota } from "../domain/notas";
import { ETIQUETA_ESTADO_CURSO, type EstadoCursoAlumno } from "../domain/reportes";
import { conductas } from "../infrastructure/conducta";
import { cierres, estadoDeRegistro, resultados } from "../infrastructure/repositorio";
import { conductaDeMatricula } from "./conducta";
import { notasDelAlumno, type NotasDelAlumno } from "./reportes";
import { alumnosDeLaTutoria, periodosDeTutoria, type AlumnoDeLaTutoria, type PeriodoDeTutoria } from "./tutoriaComun";

// ---------- (a) Notas por alumno ----------

/** Alumnos de la sección (vigentes en el bimestre actual) para elegir de quién ver las notas. */
export async function alumnosParaNotasDeTutoria(
  auth: Autenticado,
  seccionId: string,
  ahora: Date = new Date(),
): Promise<{ seccion: { id: string; etiqueta: string }; alumnos: Omit<AlumnoDeLaTutoria, "estudianteId">[] }> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const { elegido, hoy } = await periodosDeTutoria(t, undefined, ahora);
  const alumnos = await alumnosDeLaTutoria(seccionId, elegido, hoy);
  return {
    seccion: { id: t.seccion.id, etiqueta: t.seccion.etiqueta },
    alumnos: alumnos.map(({ matriculaId, nombre }) => ({ matriculaId, nombre })),
  };
}

export interface NotasDeAlumnoDeTutoria extends Omit<NotasDelAlumno, "bimestres"> {
  bimestres: (NotasDelAlumno["bimestres"][number] & {
    conducta: { valor: LogroNota; comentario: string | null } | null;
  })[];
}

/**
 * Libreta completa del año de un alumno de la sección (403 si su matrícula no es de la sección de la tutoría): todos
 * los cursos y bimestres, con lo no publicado marcado «Sin publicar», y la conducta de cada bimestre.
 */
export async function notasDeAlumnoDeTutoria(
  auth: Autenticado,
  seccionId: string,
  matriculaId: string,
): Promise<NotasDeAlumnoDeTutoria> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const m = (await datosDeMatriculas([matriculaId]))[matriculaId];
  if (!m || m.seccionId !== seccionId || m.anioAcademicoId !== t.anio.id) throw E.alumnoDeOtraSeccion();
  const [notas, conducta] = await Promise.all([notasDelAlumno(matriculaId), conductaDeMatricula(matriculaId)]);
  return { ...notas, bimestres: notas.bimestres.map((b) => ({ ...b, conducta: conducta.get(b.id) ?? null })) };
}

// ---------- (b) Consolidado de la sección ----------

export interface CursoDelConsolidado {
  cursoId: string;
  codigo: string;
  nombre: string;
  estado: EstadoCursoAlumno;
  /** «Publicado» o «Sin publicar · …». */
  etiquetaEstado: string;
  publicado: boolean;
  /** Cuántos alumnos tienen AD, A, B y C en el curso, y cuántos sin consolidado. */
  resumen: Record<LogroNota | "SIN_NOTA", number>;
}

export interface ConsolidadoDeLaSeccion {
  seccion: { id: string; etiqueta: string };
  anio: { id: string; anio: number };
  periodos: PeriodoDeTutoria[];
  periodo: PeriodoDeTutoria;
  cursos: CursoDelConsolidado[];
  alumnos: {
    matriculaId: string;
    nombre: string;
    /** Logro consolidado por curso (cursoId); null si el registro aún no se cierra. */
    logros: Record<string, LogroNota | null>;
    conducta: LogroNota | null;
  }[];
  resumenConducta: Record<LogroNota | "SIN_NOTA", number>;
}

/**
 * Consolidado del bimestre: por alumno de la sección y curso del plan, el logro consolidado del registro (existe desde
 * que el docente lo cierra; los no publicados se marcan «Sin publicar»), la conducta y el resumen por curso.
 */
export async function consolidadoDeLaSeccion(
  auth: Autenticado,
  seccionId: string,
  filtro: { periodoId?: string },
  ahora: Date = new Date(),
): Promise<ConsolidadoDeLaSeccion> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const { periodos, elegido, hoy } = await periodosDeTutoria(t, filtro.periodoId, ahora);
  const [alumnos, plan] = await Promise.all([
    alumnosDeLaTutoria(seccionId, elegido, hoy),
    planDeSeccion({ id: seccionId, grado: { id: t.seccion.grado.id }, anio: { id: t.anio.id } }),
  ]);
  const asignacionIds = plan.flatMap((p) => (p.asignacion ? [p.asignacion.id] : []));
  const delPeriodo = (await cierres.deAsignaciones(asignacionIds)).filter((c) => c.periodoEvaluacionId === elegido.id);
  const matriculaIds = alumnos.map((a) => a.matriculaId);
  const [consolidados, conducta] = await Promise.all([
    resultados.deCierres(delPeriodo.map((c) => c.id)),
    conductas.delPeriodo(elegido.id, matriculaIds),
  ]);

  const columnas = plan
    .map((p) => {
      const cierre = delPeriodo.find((c) => c.asignacionDocenteId === p.asignacion?.id) ?? null;
      const estado: EstadoCursoAlumno = cierre ? estadoDeRegistro(cierre) : "SIN_REGISTRO";
      return { p, cierre, estado };
    })
    .sort((a, b) => a.p.curso.nombre.localeCompare(b.p.curso.nombre, "es"));
  const logroDe = (cierreId: string | undefined, matriculaId: string) =>
    (cierreId &&
      consolidados.find((r) => r.cierreId === cierreId && r.matriculaId === matriculaId)?.logroConsolidado) ||
    null;

  const filas = alumnos.map((a) => ({
    matriculaId: a.matriculaId,
    nombre: a.nombre,
    logros: Object.fromEntries(columnas.map((c) => [c.p.curso.id, logroDe(c.cierre?.id, a.matriculaId)])),
    conducta: conducta.find((x) => x.matriculaId === a.matriculaId)?.valor ?? null,
  }));
  return {
    seccion: { id: t.seccion.id, etiqueta: t.seccion.etiqueta },
    anio: t.anio,
    periodos,
    periodo: elegido,
    cursos: columnas.map(({ p, estado }) => ({
      cursoId: p.curso.id,
      codigo: p.curso.codigo,
      nombre: p.curso.nombre,
      estado,
      etiquetaEstado: ETIQUETA_ESTADO_CURSO[estado],
      publicado: estado === "PUBLICADO",
      resumen: resumenDeConducta(filas.map((f) => f.logros[p.curso.id])),
    })),
    alumnos: filas,
    resumenConducta: resumenDeConducta(filas.map((f) => f.conducta)),
  };
}

/** CSV del consolidado: una fila por alumno (logro por curso y conducta) y, al final, el resumen por curso. */
export async function consolidadoDeLaSeccionCsv(auth: Autenticado, seccionId: string, filtro: { periodoId?: string }) {
  const c = await consolidadoDeLaSeccion(auth, seccionId, filtro);
  const logros: (LogroNota | "SIN_NOTA")[] = ["AD", "A", "B", "C", "SIN_NOTA"];
  const texto = textoCsv([
    ["Año", "Bimestre", "Sección", "Estudiante", ...c.cursos.map((k) => k.nombre), "Conducta"],
    ...c.alumnos.map((a) => [
      c.anio.anio,
      c.periodo.nombre,
      c.seccion.etiqueta,
      a.nombre,
      ...c.cursos.map((k) => a.logros[k.cursoId] ?? ""),
      a.conducta ?? "",
    ]),
    [],
    ["Estado del curso", "", "", "", ...c.cursos.map((k) => k.etiquetaEstado), ""],
    ...logros.map((l) => [
      `Alumnos con ${l === "SIN_NOTA" ? "sin nota" : l}`,
      "",
      "",
      "",
      ...c.cursos.map((k) => k.resumen[l]),
      c.resumenConducta[l],
    ]),
  ]);
  return {
    texto,
    nombreArchivo: nombreArchivoSeguro(["Consolidado", c.seccion.etiqueta, c.periodo.nombre, c.anio.anio], "csv"),
  };
}
