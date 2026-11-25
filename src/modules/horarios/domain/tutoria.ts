// horarios/domain: reglas puras de la asistencia que ve y maneja el tutor de la sección (bloque M3): el bimestre en
// curso en el que trabaja, los alumnos con aviso por umbral (solo faltas sin justificar), la justificación de faltas y
// tardanzas y el reporte de faltas y tardanzas por bimestre. Las fechas viajan como texto «AAAA-MM-DD» (hora de Lima).
import {
  baseDeInasistencia,
  diaDeClases,
  diasDeAsistencia,
  mesDe,
  nivelDeRiesgo,
  porcentajeDeInasistencia,
  type Bimestre,
  type EstadoAsistencia,
  type NivelDeRiesgo,
  type Rango,
  type Umbrales,
} from "./asistencia";
import { erroresTutoria as E } from "./errores";

// ---------- Bimestre en curso ----------

/** Bimestre que contiene la fecha de hoy; null en vacaciones o fuera del año. */
export function bimestreEnCurso<T extends Bimestre>(bimestres: T[], hoy: string): T | null {
  return bimestres.find((b) => b.fechaInicio <= hoy && hoy <= b.fechaFin) ?? null;
}

/**
 * El tutor registra y modifica la asistencia solo dentro del bimestre en curso, hasta hoy y en días de clase (lunes a
 * viernes). Sin bimestre en curso no hay nada que registrar.
 */
export function verificarFechaDeTutoria(fecha: string, bimestre: Rango | null, hoy: string) {
  if (!bimestre) throw E.sinBimestreEnCurso();
  if (fecha > hoy) throw E.fechaFutura();
  if (fecha < bimestre.fechaInicio || fecha > bimestre.fechaFin) throw E.fueraDelBimestre();
  if (!diaDeClases(fecha)) throw E.finDeSemana();
}

// ---------- Avisos por umbral (solo faltas sin justificar) ----------

export interface SituacionDeAlumno {
  /** Días del mes de `hoy` en que faltó a todas sus clases sin justificar. */
  faltasDelMes: number;
  /** Días del año en que faltó a todas sus clases sin justificar. */
  faltasDelAnio: number;
  /** Porcentaje de inasistencias injustificadas sobre sus días de clase (D-11), con un decimal. */
  porcentaje: number;
  nivel: NivelDeRiesgo;
  /** Alcanzó el umbral de faltas del mes. */
  alertaDelMes: boolean;
  /** Tiene algún aviso por umbral vigente: el del mes o el del año (aviso previo o riesgo). */
  conAviso: boolean;
}

/**
 * Situación del alumno frente a los umbrales de la institución, con los mismos criterios que los avisos por correo
 * (US52): un día cuenta como falta solo si faltó a todas sus clases sin justificar. Una falta que el tutor justifica
 * deja de contar, así que el alumno puede salir de la lista.
 */
export function situacionDeAlumno(
  registros: { fecha: string; estado: EstadoAsistencia }[],
  datos: { bimestres: Rango[]; fechaMatricula: string; hoy: string; umbrales: Umbrales },
): SituacionDeAlumno {
  const ausencias = diasDeAsistencia(registros).filter((d) => d.estado === "AUSENTE");
  const faltasDelMes = ausencias.filter((d) => mesDe(d.fecha) === mesDe(datos.hoy)).length;
  const { lectivos } = baseDeInasistencia(datos.bimestres, datos.fechaMatricula);
  const nivel = nivelDeRiesgo(ausencias.length, lectivos, datos.umbrales);
  const alertaDelMes = faltasDelMes >= datos.umbrales.faltasMes;
  return {
    faltasDelMes,
    faltasDelAnio: ausencias.length,
    porcentaje: porcentajeDeInasistencia(ausencias.length, lectivos),
    nivel,
    alertaDelMes,
    conAviso: alertaDelMes || nivel !== "SIN_RIESGO",
  };
}

// ---------- Justificación ----------

const JUSTIFICADO_DE: Partial<Record<EstadoAsistencia, EstadoAsistencia>> = {
  FALTA: "FALTA_JUSTIFICADA",
  TARDANZA: "TARDANZA_JUSTIFICADA",
};

/** Estado que queda al justificar: una falta pasa a falta justificada y una tardanza, a tardanza justificada. */
export function estadoJustificado(estado: EstadoAsistencia): EstadoAsistencia {
  const justificado = JUSTIFICADO_DE[estado];
  if (justificado) return justificado;
  if (estado === "FALTA_JUSTIFICADA" || estado === "TARDANZA_JUSTIFICADA") throw E.yaJustificado();
  throw E.noJustificable();
}

/** ¿Se puede justificar este registro? Solo una falta o una tardanza sin justificar. */
export const esJustificable = (estado: EstadoAsistencia) => estado in JUSTIFICADO_DE;

// ---------- Reporte de faltas y tardanzas por bimestre ----------

export interface ConteoDeAsistencia {
  /** Clases con asistencia registrada para el alumno. */
  clases: number;
  asistencias: number;
  tardanzas: number;
  tardanzasJustificadas: number;
  faltas: number;
  faltasJustificadas: number;
  /**
   * Clases a las que asistió (a tiempo, con tardanza o con tardanza justificada) sobre las clases registradas, de 0 a
   * 100 con un decimal; null sin clases registradas.
   */
  porcentajeAsistencia: number | null;
}

const porcentaje = (parte: number, total: number) => (total ? Math.round((parte / total) * 1000) / 10 : null);

/** Conteo de los registros de un alumno en el bimestre (una fila del reporte, o el total de la sección). */
export function conteoDeAsistencia(estados: EstadoAsistencia[]): ConteoDeAsistencia {
  const cuenta = (e: EstadoAsistencia) => estados.filter((x) => x === e).length;
  const asistencias = cuenta("PRESENTE");
  const tardanzas = cuenta("TARDANZA");
  const tardanzasJustificadas = cuenta("TARDANZA_JUSTIFICADA");
  return {
    clases: estados.length,
    asistencias,
    tardanzas,
    tardanzasJustificadas,
    faltas: cuenta("FALTA"),
    faltasJustificadas: cuenta("FALTA_JUSTIFICADA"),
    porcentajeAsistencia: porcentaje(asistencias + tardanzas + tardanzasJustificadas, estados.length),
  };
}

/** Suma las filas del reporte: el total de la sección, con el porcentaje sobre todas sus clases registradas. */
export function totalDeAsistencia(filas: ConteoDeAsistencia[]): ConteoDeAsistencia {
  const suma = (campo: keyof Omit<ConteoDeAsistencia, "porcentajeAsistencia">) =>
    filas.reduce((total, f) => total + f[campo], 0);
  const clases = suma("clases");
  return {
    clases,
    asistencias: suma("asistencias"),
    tardanzas: suma("tardanzas"),
    tardanzasJustificadas: suma("tardanzasJustificadas"),
    faltas: suma("faltas"),
    faltasJustificadas: suma("faltasJustificadas"),
    porcentajeAsistencia: porcentaje(suma("asistencias") + suma("tardanzas") + suma("tardanzasJustificadas"), clases),
  };
}

export const ORDENES_REPORTE = [
  "nombre",
  "clases",
  "asistencias",
  "tardanzas",
  "tardanzasJustificadas",
  "faltas",
  "faltasJustificadas",
  "porcentajeAsistencia",
] as const;
export type OrdenReporte = (typeof ORDENES_REPORTE)[number];

/**
 * Ordena las filas del reporte por la columna pedida. Los números van de mayor a menor (primero quien más falta) salvo
 * que se pida ascendente; a igualdad, por nombre. Un porcentaje null (sin clases) va al final.
 */
export function ordenarReporte<T extends ConteoDeAsistencia & { nombre: string }>(
  filas: T[],
  orden: OrdenReporte,
  ascendente: boolean,
): T[] {
  const porNombre = (a: T, b: T) => a.nombre.localeCompare(b.nombre, "es");
  return [...filas].sort((a, b) => {
    if (orden === "nombre") return ascendente ? porNombre(a, b) : porNombre(b, a);
    const x = a[orden];
    const y = b[orden];
    if (x === y) return porNombre(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return ascendente ? x - y : y - x;
  });
}

// ---------- Justificación del apoderado (bloque M3, fase 7) ----------

export const ESTADOS_JUSTIFICACION = ["PENDIENTE", "APROBADA", "RECHAZADA"] as const;
export type EstadoJustificacion = (typeof ESTADOS_JUSTIFICACION)[number];

/** El apoderado justifica faltas y tardanzas de los últimos 7 días (contando hoy como el día 0). */
export const DIAS_PARA_JUSTIFICAR = 7;
export const LARGO_MAXIMO_MOTIVO_JUSTIFICACION = 500;

/** Primer día que todavía se puede justificar: hoy menos DIAS_PARA_JUSTIFICAR. */
export function inicioDelPlazoDeJustificacion(hoy: string, dias = DIAS_PARA_JUSTIFICAR): string {
  const instante = new Date(`${hoy}T00:00:00.000Z`);
  instante.setUTCDate(instante.getUTCDate() - dias);
  return instante.toISOString().slice(0, 10);
}

/** La falta o tardanza debe ser de los últimos 7 días y aún sin justificar. */
export function verificarJustificacionDelApoderado(registro: { fecha: string; estado: EstadoAsistencia }, hoy: string) {
  if (registro.fecha > hoy || registro.fecha < inicioDelPlazoDeJustificacion(hoy))
    throw E.fueraDelPlazoDeJustificacion();
  estadoJustificado(registro.estado);
}

/** Solo una justificación PENDIENTE se aprueba o se rechaza. */
export function verificarJustificacionPendiente(estado: EstadoJustificacion) {
  if (estado !== "PENDIENTE") throw E.justificacionYaRevisada();
}
