// horarios/application: asistencia del estudiante en los portales, solo lectura (US45 «Asistencia» del apoderado,
// AP-03; US52 «Mi asistencia» del alumno, AL-04). La matrícula nunca llega del navegador: matricula la resuelve desde
// la sesión (el alumno) o desde el vínculo del apoderado con el hijo pedido (403 si no es su hijo).
import { parametroNumero } from "@/platform/config/parametros";
import { asignacionesDeClases, fechaEnLima, obtenerAnio } from "@/modules/academico";
import { docentesProviderComunidad } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { matriculaDelHijo, matriculaVigenteDelAlumno } from "@/modules/matricula";
import {
  alertaDelMes,
  bimestreDeReferencia,
  calendarioDelMes,
  diasDeAsistencia,
  diasLectivos,
  incidenciasDe,
  mesDe,
  resumenDeDias,
  situacionAnual,
  type Bimestre,
  type DiaDelCalendario,
  type Incidencia,
  type Rango,
  type RegistroDeClase,
  type ResumenDeDias,
  type SituacionAnual,
  type Umbrales,
} from "../domain/asistencia";
import { asistencias } from "../infrastructure/asistencia";

/** Umbrales de inasistencia de la institución; un año puede tener los suyos (ParametroInstitucion). */
export async function leerUmbrales(anioAcademicoId: string): Promise<Umbrales> {
  const [faltasMes, aviso, riesgo] = await Promise.all([
    parametroNumero("UMBRAL_FALTAS_MES", anioAcademicoId),
    parametroNumero("UMBRAL_INASISTENCIA_AVISO", anioAcademicoId),
    parametroNumero("UMBRAL_INASISTENCIA", anioAcademicoId),
  ]);
  return { faltasMes, aviso, riesgo };
}

export interface AnioDeAsistencia extends Rango {
  id: string;
  anio: number;
  bimestres: Bimestre[];
}

/** El año escolar con sus bimestres: marcan los días de clase y los periodos en que se acumulan las faltas. */
export async function anioDeAsistencia(anioAcademicoId: string): Promise<AnioDeAsistencia> {
  const a = await obtenerAnio(anioAcademicoId);
  return {
    id: a.id,
    anio: a.anio,
    fechaInicio: a.fechaInicio,
    fechaFin: a.fechaFin,
    bimestres: a.periodos.map(({ numero, nombre, fechaInicio, fechaFin }) => ({
      numero,
      nombre,
      fechaInicio,
      fechaFin,
    })),
  };
}

/** Asistencia de la matrícula en un rango, con el curso, la hora y el docente de cada clase. */
export async function registrosDeMatricula(matriculaId: string, rango: Rango): Promise<RegistroDeClase[]> {
  const filas = await asistencias.deMatricula(matriculaId, rango);
  if (!filas.length) return [];
  const asignaciones = await asignacionesDeClases(filas.map((f) => f.asignacionDocenteId));
  const docentes = await docentesProviderComunidad.docentesPorId([...new Set(filas.map((f) => f.docenteId))]);
  return filas.map((f) => ({
    fecha: f.fecha,
    estado: f.estado,
    observacion: f.observacion,
    clase: {
      curso: asignaciones.find((a) => a.id === f.asignacionDocenteId)?.curso.nombre ?? "Clase",
      horaInicio: f.horaInicio,
      docente: docentes.find((d) => d.id === f.docenteId)?.nombreCorto ?? null,
    },
  }));
}

const contarAusencias = (registros: RegistroDeClase[]) =>
  diasDeAsistencia(registros).filter((d) => d.estado === "AUSENTE");

interface AlertaDelMes {
  /** «Atención: 3 inasistencias injustificadas este mes». */
  mensaje: string;
  faltas: number;
  /** Días en que faltó a todas sus clases sin justificación. */
  fechas: string[];
}

function alertaDe(registrosDelMes: RegistroDeClase[], umbrales: Umbrales): AlertaDelMes | null {
  const ausencias = contarAusencias(registrosDelMes);
  const mensaje = alertaDelMes(ausencias.length, umbrales.faltasMes);
  return mensaje ? { mensaje, faltas: ausencias.length, fechas: ausencias.map((d) => d.fecha) } : null;
}

interface Estudiante {
  estudianteId: string;
  nombres: string;
  nombreCompleto: string;
}

const estudianteDe = (m: { estudianteId: string; nombres: string; apellidos: string }): Estudiante => ({
  estudianteId: m.estudianteId,
  nombres: m.nombres,
  nombreCompleto: `${m.nombres} ${m.apellidos}`,
});

export interface AsistenciaDelMes {
  estudiante: Estudiante;
  anio: number;
  /** Mes consultado («2026-09») y meses entre los que se puede navegar: del inicio del año al mes actual. */
  mes: string;
  primerMes: string;
  ultimoMes: string;
  /** Días de lunes a viernes del mes con su estado. */
  calendario: DiaDelCalendario[];
  resumen: ResumenDeDias;
  /** Inasistencias, tardanzas y observaciones del mes, de la más reciente a la más antigua. */
  incidencias: Incidencia[];
  /** Alerta al llegar a UMBRAL_FALTAS_MES inasistencias injustificadas en el mes; null si no llega. */
  alerta: AlertaDelMes | null;
  anual: SituacionAnual;
  umbralFaltasMes: number;
}

/**
 * «Asistencia» de un hijo del apoderado en sesión (US45): resumen del mes por día, con las observaciones del docente.
 * Sin `mes` muestra el actual. 403 ESTUDIANTE_NO_VINCULADO si el estudiante no es su hijo.
 */
export async function asistenciaDelHijo(
  auth: Autenticado,
  estudianteId: string,
  mes?: string,
  ahora: Date = new Date(),
): Promise<AsistenciaDelMes> {
  const m = await matriculaDelHijo(auth, estudianteId);
  const anio = await anioDeAsistencia(m.anioAcademicoId);
  const [umbrales, registros] = await Promise.all([leerUmbrales(anio.id), registrosDeMatricula(m.matriculaId, anio)]);
  const mesActual = mesDe(fechaEnLima(ahora));
  const consultado = mes ?? mesActual;
  const delMes = registros.filter((r) => mesDe(r.fecha) === consultado);
  const dias = diasDeAsistencia(delMes);
  const primerMes = mesDe(anio.fechaInicio);
  // un año que ya terminó se recorre hasta su último mes; el año en curso, hasta hoy
  const tope = mesActual < mesDe(anio.fechaFin) ? mesActual : mesDe(anio.fechaFin);
  return {
    estudiante: estudianteDe(m),
    anio: anio.anio,
    mes: consultado,
    primerMes,
    ultimoMes: tope < primerMes ? primerMes : tope,
    calendario: calendarioDelMes(consultado, dias, anio, anio.bimestres),
    resumen: resumenDeDias(dias),
    incidencias: incidenciasDe(delMes),
    alerta: alertaDe(delMes, umbrales),
    anual: situacionAnual(contarAusencias(registros).length, diasLectivos(anio.bimestres), umbrales),
    umbralFaltasMes: umbrales.faltasMes,
  };
}

interface Acumulado {
  /** Días de inasistencia sin justificar. */
  faltas: number;
  /** Días con tardanza. */
  tardanzas: number;
  /** Días de inasistencia justificada (no cuentan para los umbrales). */
  justificadas: number;
}

function acumuladoDe(registros: RegistroDeClase[]): Acumulado {
  const r = resumenDeDias(diasDeAsistencia(registros));
  return { faltas: r.ausentes, tardanzas: r.tardanzas, justificadas: r.justificados };
}

export interface AsistenciaDelAlumno {
  estudiante: Estudiante;
  anio: number;
  /** Bimestre en el que se acumula hoy (en vacaciones, el último que empezó); null antes del primero. */
  bimestre: (Acumulado & { numero: number; nombre: string }) | null;
  /** Acumulado del año, desde su primer día. */
  delAnio: Acumulado & { desde: string };
  riesgo: SituacionAnual;
  alertaDelMes: AlertaDelMes | null;
  /** Faltas y tardanzas del bimestre (o del año si aún no hay bimestre), de la más reciente a la más antigua. */
  detalle: Incidencia[];
  /** Sin faltas ni tardanzas en el año: «¡Felicidades! No registras inasistencias este periodo». */
  sinInasistencias: boolean;
}

/**
 * «Mi asistencia» del alumno en sesión (US52): faltas y tardanzas acumuladas en el bimestre y en el año, el nivel de
 * riesgo frente a los umbrales y la alerta por faltas injustificadas del mes. 403 SIN_MATRICULA_VIGENTE si no tiene
 * una matrícula vigente.
 */
export async function asistenciaDelAlumno(auth: Autenticado, ahora: Date = new Date()): Promise<AsistenciaDelAlumno> {
  const m = await matriculaVigenteDelAlumno(auth);
  const anio = await anioDeAsistencia(m.anioAcademicoId);
  const [umbrales, registros] = await Promise.all([leerUmbrales(anio.id), registrosDeMatricula(m.matriculaId, anio)]);
  const hoy = fechaEnLima(ahora);
  const bimestre = bimestreDeReferencia(anio.bimestres, hoy);
  const delBimestre = bimestre
    ? registros.filter((r) => bimestre.fechaInicio <= r.fecha && r.fecha <= bimestre.fechaFin)
    : registros;
  const delAnio = acumuladoDe(registros);
  return {
    estudiante: estudianteDe(m),
    anio: anio.anio,
    bimestre: bimestre && { numero: bimestre.numero, nombre: bimestre.nombre, ...acumuladoDe(delBimestre) },
    delAnio: { ...delAnio, desde: anio.fechaInicio },
    riesgo: situacionAnual(delAnio.faltas, diasLectivos(anio.bimestres), umbrales),
    alertaDelMes: alertaDe(
      registros.filter((r) => mesDe(r.fecha) === mesDe(hoy)),
      umbrales,
    ),
    detalle: incidenciasDe(delBimestre).filter((i) => i.estado !== "PRESENTE"),
    sinInasistencias: delAnio.faltas + delAnio.tardanzas + delAnio.justificadas === 0,
  };
}
