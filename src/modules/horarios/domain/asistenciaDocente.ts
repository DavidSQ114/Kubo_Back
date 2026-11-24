// horarios/domain: reglas puras del registro de ingreso del personal docente (US32, AD-14). Las fechas viajan como
// texto «AAAA-MM-DD» y las horas como «HH:MM:SS», ambas en la hora de Lima. Los parámetros de la jornada son «HH:MM».
import { erroresAsistenciaDocente as E } from "./errores";

export const ESTADOS_ASISTENCIA_DOCENTE = ["PUNTUAL", "TARDANZA", "FALTA", "FALTA_JUSTIFICADA"] as const;
export type EstadoAsistenciaDocente = (typeof ESTADOS_ASISTENCIA_DOCENTE)[number];

/** Nombres del Product Backlog (US32): la falta se muestra como «Inasistencia». */
export const NOMBRE_ESTADO_ASISTENCIA_DOCENTE: Record<EstadoAsistenciaDocente, string> = {
  PUNTUAL: "Puntual",
  TARDANZA: "Tardanza",
  FALTA: "Inasistencia",
  FALTA_JUSTIFICADA: "Falta justificada",
};

const ZONA_COLEGIO = "America/Lima";
const MINUTOS_POR_HORA = 60;

/** «07:31:05» del instante en la hora de Lima: la hora exacta del registro. */
export function horaEnLima(instante: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_COLEGIO,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(instante);
}

/** «07:31:05» → «07:31». */
export const minutoDe = (hora: string) => hora.slice(0, 5);

/** «07:31» → 451 minutos desde la medianoche. */
const enMinutos = (hora: string) => Number(hora.slice(0, 2)) * MINUTOS_POR_HORA + Number(hora.slice(3, 5));

/**
 * Estado de un ingreso según la hora de inicio de la jornada (HORA_INICIO_JORNADA_DOCENTE): hasta ese minuto
 * inclusive es «Puntual» y desde el minuto siguiente, «Tardanza». Con 07:30, las 07:30:59 son Puntual y las 07:31:00,
 * Tardanza: se compara al minuto, como se muestra la hora en la pantalla.
 */
export function estadoDeIngreso(horaIngreso: string, horaInicioJornada: string): "PUNTUAL" | "TARDANZA" {
  return minutoDe(horaIngreso) <= minutoDe(horaInicioJornada) ? "PUNTUAL" : "TARDANZA";
}

/** ¿Ya llegó la hora límite (HORA_LIMITE_ASISTENCIA_DOCENTE)? Desde ese minuto, quien no fue marcado tiene falta. */
export const alcanzoHoraLimite = (hora: string, horaLimite: string) => minutoDe(hora) >= minutoDe(horaLimite);

/** Minutos que faltan para la hora límite (AD-14 «Faltan 14 minutos para la hora límite»); 0 si ya pasó. */
export const minutosParaLimite = (hora: string, horaLimite: string) =>
  Math.max(0, enMinutos(horaLimite) - enMinutos(hora));

/** US32, criterio 3: el ingreso y la salida solo se registran el día actual de Lima; nunca otra fecha. */
export function verificarDiaActual(fecha: string, hoy: string) {
  if (fecha !== hoy) throw E.soloDiaActual();
}

export interface RegistroDocente {
  estado: EstadoAsistenciaDocente;
  horaIngreso: string | null;
  horaSalida: string | null;
}

export interface Ingreso {
  estado: "PUNTUAL" | "TARDANZA";
  /** El docente tenía la falta automática de la hora límite: pasa a Tardanza con la hora real (US32, criterio 2). */
  reemplazaFalta: boolean;
}

/**
 * «Asistió»: el estado del ingreso. Sin registro, Puntual o Tardanza según la hora. Con la falta automática, siempre
 * Tardanza (llegó después de la hora límite). Un ingreso ya registrado o una falta justificada no se vuelven a marcar.
 */
export function ingresoPara(actual: RegistroDocente | null, hora: string, horaInicioJornada: string): Ingreso {
  if (!actual) return { estado: estadoDeIngreso(hora, horaInicioJornada), reemplazaFalta: false };
  if (actual.estado === "FALTA") return { estado: "TARDANZA", reemplazaFalta: true };
  if (actual.estado === "FALTA_JUSTIFICADA") throw E.faltaJustificada();
  throw E.ingresoYaRegistrado(minutoDe(actual.horaIngreso ?? hora));
}

/** La salida necesita el ingreso del día, se registra una vez y no puede ser anterior al ingreso. */
export function verificarSalida(actual: RegistroDocente | null, hora: string) {
  if (!actual?.horaIngreso) throw E.sinIngreso();
  if (actual.horaSalida) throw E.salidaYaRegistrada(minutoDe(actual.horaSalida));
  if (hora < actual.horaIngreso) throw E.salidaAntesDelIngreso();
}

/** Solo una inasistencia se justifica (de cualquier fecha); queda como «Falta justificada». */
export function verificarJustificable(actual: RegistroDocente) {
  if (actual.estado !== "FALTA") throw E.noEsFalta();
}

/** Docentes activos sin ningún registro del día: los que la verificación automática marca con falta. */
export function docentesSinMarcar(activos: string[], conRegistro: string[]): string[] {
  const marcados = new Set(conRegistro);
  return activos.filter((id) => !marcados.has(id));
}

export interface ResumenAsistenciaDocente {
  /** Docentes activos del listado. */
  total: number;
  puntuales: number;
  tardanzas: number;
  /** Inasistencias, justificadas o no. */
  faltas: number;
  justificadas: number;
  sinMarcar: number;
}

/** Contadores de AD-14 («22 / 28 puntuales», «4 sin marcar», «2 faltas · 1 con justificación»). */
export function resumenAsistenciaDocente(estados: (EstadoAsistenciaDocente | null)[]): ResumenAsistenciaDocente {
  const cuenta = (e: EstadoAsistenciaDocente | null) => estados.filter((x) => x === e).length;
  const justificadas = cuenta("FALTA_JUSTIFICADA");
  return {
    total: estados.length,
    puntuales: cuenta("PUNTUAL"),
    tardanzas: cuenta("TARDANZA"),
    faltas: cuenta("FALTA") + justificadas,
    justificadas,
    sinMarcar: cuenta(null),
  };
}
