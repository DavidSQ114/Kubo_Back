// evaluacion/domain: reglas puras del registro de notas (US37, DO-04), del cierre de bimestre (US39, M-10) y del
// bloqueo del registro cerrado (US40). Sin base de datos: los casos de uso les pasan los datos ya cargados.
import {
  erroresEvaluacion as E,
  MENSAJE_PERIODO_NO_ACTIVO,
  MENSAJE_REGISTRO_CERRADO,
  type CeldaRechazada,
  type Pendiente,
} from "./errores";

/** Escala cualitativa oficial del CNEB: lo único que se puede registrar como nota (US37). */
export const LOGROS_NOTA = ["AD", "A", "B", "C"] as const;
export type LogroNota = (typeof LOGROS_NOTA)[number];

export const ESTADOS_REGISTRO = ["ABIERTO", "CERRADO", "PUBLICADO"] as const;
/** Estado del registro de un curso y sección en un bimestre. Sin notas todavía, está ABIERTO. */
export type EstadoRegistro = (typeof ESTADOS_REGISTRO)[number];

/** Cómo se corrige una nota de un registro cerrado (US40, criterio 3): con una solicitud de rectificación (US41). */
export const MENSAJE_CORRECCION =
  "Si detectas un error, envía una solicitud de rectificación a la coordinación académica.";

export const esLogroNota = (valor: unknown): valor is LogroNota =>
  typeof valor === "string" && (LOGROS_NOTA as readonly string[]).includes(valor);

/** Rechaza todas las celdas con un valor fuera de la escala, con el mensaje del backlog (US37, criterio 2). */
export function verificarValores(celdas: { matriculaId: string; competenciaPlanId: string; logro: unknown }[]) {
  const rechazadas: CeldaRechazada[] = celdas
    .filter((c) => !esLogroNota(c.logro))
    .map((c) => ({ matriculaId: c.matriculaId, competenciaPlanId: c.competenciaPlanId, valor: String(c.logro ?? "") }));
  if (rechazadas.length) throw E.valorNoPermitido(rechazadas);
}

// ---------- Bimestre activo ----------

export interface BimestreDeNotas {
  id: string;
  numero: number;
  nombre: string;
  /** «AAAA-MM-DD». */
  fechaInicio: string;
  fechaFin: string;
  /** Estado del periodo de evaluación (INACTIVO, ACTIVO, EN_CIERRE o FINALIZADO). */
  estado: string;
}

/**
 * ¿Se califica hoy en este bimestre? Solo si el año está EN_CURSO, hoy (en Lima) cae dentro de sus fechas y el
 * bimestre no está FINALIZADO (US37, criterio 3).
 */
export function esBimestreActivo(bimestre: BimestreDeNotas, anioEstado: string, hoy: string): boolean {
  return (
    anioEstado === "EN_CURSO" &&
    bimestre.estado !== "FINALIZADO" &&
    bimestre.fechaInicio <= hoy &&
    hoy <= bimestre.fechaFin
  );
}

export interface SituacionDelRegistro {
  /** El docente puede guardar notas y cerrar el registro. */
  editable: boolean;
  /** Por qué es de solo lectura: registro cerrado (US40) o bimestre no activo (US37). */
  motivoSoloLectura: "REGISTRO_CERRADO" | "PERIODO_NO_ACTIVO" | null;
  /** Mensaje del backlog para el motivo; null si es editable. */
  mensaje: string | null;
  /** Cómo corregir una nota ya cerrada (US40, criterio 3); null si el registro no está cerrado. */
  correccion: string | null;
}

/** Un registro cerrado (o publicado) es de solo lectura aunque su bimestre siga activo: lo dice primero. */
export function situacionDelRegistro(estado: EstadoRegistro, bimestreActivo: boolean): SituacionDelRegistro {
  if (estado !== "ABIERTO") {
    return {
      editable: false,
      motivoSoloLectura: "REGISTRO_CERRADO",
      mensaje: MENSAJE_REGISTRO_CERRADO,
      correccion: MENSAJE_CORRECCION,
    };
  }
  if (!bimestreActivo) {
    return {
      editable: false,
      motivoSoloLectura: "PERIODO_NO_ACTIVO",
      mensaje: MENSAJE_PERIODO_NO_ACTIVO,
      correccion: null,
    };
  }
  return { editable: true, motivoSoloLectura: null, mensaje: null, correccion: null };
}

/** Rechaza una escritura sobre un registro de solo lectura, venga de la pantalla o directo por la API (US40). */
export function verificarEditable(situacion: SituacionDelRegistro) {
  if (situacion.motivoSoloLectura === "REGISTRO_CERRADO") throw E.registroCerrado();
  if (situacion.motivoSoloLectura === "PERIODO_NO_ACTIVO") throw E.periodoNoActivo();
}

// ---------- Grilla: alumnos × competencias ----------

export interface AlumnoDelRegistro {
  matriculaId: string;
  nombre: string;
  /** Para importar calificaciones desde CSV (bloque M2); nunca sale en la grilla. */
  dni?: string;
}

export interface CompetenciaDelRegistro {
  competenciaPlanId: string;
  codigo: string;
  nombre: string;
}

export interface NotaGuardada {
  id: string;
  matriculaId: string;
  competenciaPlanId: string;
  logro: LogroNota;
}

export interface NotaPedida {
  matriculaId: string;
  competenciaPlanId: string;
  logro: LogroNota;
}

const clave = (n: { matriculaId: string; competenciaPlanId: string }) => `${n.matriculaId}|${n.competenciaPlanId}`;

/** Solo se califican los alumnos de la lista en las competencias del curso. */
export function verificarCeldas(
  pedidas: NotaPedida[],
  alumnos: AlumnoDelRegistro[],
  competencias: CompetenciaDelRegistro[],
) {
  const matriculas = new Set(alumnos.map((a) => a.matriculaId));
  const deCurso = new Set(competencias.map((c) => c.competenciaPlanId));
  if (pedidas.some((p) => !matriculas.has(p.matriculaId) || !deCurso.has(p.competenciaPlanId))) {
    throw E.notaFueraDelRegistro();
  }
}

export interface CambiosDeNotas {
  nuevas: NotaPedida[];
  /** Notas que cambian de valor, con el que tenían (se guarda como logro anterior). */
  modificadas: { id: string; anterior: LogroNota; logro: LogroNota }[];
  /** Pedidas con el mismo valor que ya tenían: no se tocan (no cuentan como cambio). */
  sinCambio: number;
}

/** Separa lo que se crea, lo que cambia y lo que ya estaba igual (guardado parcial, US37). */
export function cambiosDeNotas(guardadas: NotaGuardada[], pedidas: NotaPedida[]): CambiosDeNotas {
  const actuales = new Map(guardadas.map((n) => [clave(n), n]));
  const cambios: CambiosDeNotas = { nuevas: [], modificadas: [], sinCambio: 0 };
  for (const p of pedidas) {
    const actual = actuales.get(clave(p));
    if (!actual) cambios.nuevas.push(p);
    else if (actual.logro !== p.logro)
      cambios.modificadas.push({ id: actual.id, anterior: actual.logro, logro: p.logro });
    else cambios.sinCambio += 1;
  }
  return cambios;
}

/** Alumnos con alguna competencia sin calificar y cuáles le faltan (US39, criterio 2). */
export function pendientesDelRegistro(
  alumnos: AlumnoDelRegistro[],
  competencias: CompetenciaDelRegistro[],
  notas: Pick<NotaGuardada, "matriculaId" | "competenciaPlanId">[],
): Pendiente[] {
  const calificadas = new Set(notas.map(clave));
  return alumnos.flatMap((a) => {
    const faltan = competencias.filter((c) => !calificadas.has(clave({ matriculaId: a.matriculaId, ...c })));
    return faltan.length
      ? [
          {
            matriculaId: a.matriculaId,
            nombre: a.nombre,
            competencias: faltan.map(({ competenciaPlanId, codigo, nombre }) => ({
              competenciaPlanId,
              codigo,
              nombre,
            })),
          },
        ]
      : [];
  });
}

/** Solo se cierra un registro con alumnos y con todas sus competencias calificadas (US39, criterio 2). */
export function verificarCompletitud(
  alumnos: AlumnoDelRegistro[],
  competencias: CompetenciaDelRegistro[],
  notas: Pick<NotaGuardada, "matriculaId" | "competenciaPlanId">[],
) {
  if (alumnos.length === 0) throw E.sinAlumnos();
  const pendientes = pendientesDelRegistro(alumnos, competencias, notas);
  if (pendientes.length) throw E.notasIncompletas(pendientes);
}

export interface AvanceDelRegistro {
  calificadas: number;
  total: number;
  /** Entero de 0 a 100 («Avance del registro: 72 %»). */
  porcentaje: number;
  /** Alumnos con competencias pendientes. */
  alumnosPendientes: number;
}

/** Avance del registro: notas de la lista sobre alumnos × competencias (DO-04). */
export function avanceDelRegistro(
  alumnos: AlumnoDelRegistro[],
  competencias: CompetenciaDelRegistro[],
  notas: Pick<NotaGuardada, "matriculaId" | "competenciaPlanId">[],
): AvanceDelRegistro {
  const total = alumnos.length * competencias.length;
  const celdas = new Set(alumnos.flatMap((a) => competencias.map((c) => clave({ matriculaId: a.matriculaId, ...c }))));
  const calificadas = new Set(notas.map(clave).filter((k) => celdas.has(k))).size;
  return {
    calificadas,
    total,
    porcentaje: total ? Math.floor((calificadas * 100) / total) : 0,
    alumnosPendientes: pendientesDelRegistro(alumnos, competencias, notas).length,
  };
}

// ---------- Consolidación (US39 con la regla de US12) ----------

export interface NotaParaConsolidar {
  competenciaPlanId: string;
  logro: LogroNota;
  /** Cuándo se registró o se cambió por última vez: ordena los logros para el criterio ULTIMO_REGISTRO. */
  fecha: Date;
}

export interface CompetenciaConPeso {
  competenciaPlanId: string;
  codigo: string;
  peso: number | null;
}

/**
 * Logros de un alumno en orden cronológico, con el peso de cada competencia: lo que recibe consolidarLogro de
 * académico (US12). Los pesos solo cuentan en el promedio ponderado.
 */
export function entradaDeConsolidacion(competencias: CompetenciaConPeso[], notas: NotaParaConsolidar[]) {
  const peso = new Map(competencias.map((c) => [c.competenciaPlanId, c]));
  const ordenadas = notas
    .filter((n) => peso.has(n.competenciaPlanId))
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  return {
    logros: ordenadas.map((n) => n.logro),
    pesos: ordenadas.map((n) => peso.get(n.competenciaPlanId)!.peso),
    detalle: ordenadas.map((n) => ({
      competencia: peso.get(n.competenciaPlanId)!.codigo,
      logro: n.logro,
      peso: peso.get(n.competenciaPlanId)!.peso,
    })),
  };
}
