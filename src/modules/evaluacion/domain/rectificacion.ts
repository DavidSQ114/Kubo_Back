// evaluacion/domain: reglas puras de la solicitud de rectificación de nota (US41, M-08 y AD-15) y de la bitácora de
// notas (US03, AD-16 «Cambios de notas»). Sin base de datos: los casos de uso les pasan los datos ya cargados.
import { erroresEvaluacion as E } from "./errores";
import type { EstadoRegistro, LogroNota } from "./notas";

/** Estados de solicitud_rectificacion (enumeración EstadoSolicitud del diagrama de clases v4.2). */
export const ESTADOS_SOLICITUD = ["PENDIENTE", "EN_REVISION", "APROBADA", "RECHAZADA", "CANCELADA"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

/** Cómo se muestra cada estado. «Pendiente de aprobación» y «Rechazada» son los textos del backlog (US41). */
export const NOMBRE_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  PENDIENTE: "Pendiente de aprobación",
  EN_REVISION: "En revisión",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
};

/** Una solicitud sin resolver: mientras exista, no se puede pedir otra para la misma nota. */
export const esPendiente = (estado: EstadoSolicitud) => estado === "PENDIENTE" || estado === "EN_REVISION";

/** Largo máximo del motivo del error y del motivo del rechazo. */
export const LARGO_MAXIMO_MOTIVO = 500;

/**
 * Se pide rectificación solo de una nota que existe en un registro CERRADO o PUBLICADO, con un valor distinto del que
 * tiene y si no hay otra solicitud pendiente para esa nota (US41, criterio 1). En un registro abierto la nota se
 * corrige directamente.
 */
export function verificarSolicitud(datos: {
  estadoRegistro: EstadoRegistro;
  logroActual: LogroNota | null;
  valorCorrecto: LogroNota;
  hayPendiente: boolean;
}) {
  if (datos.estadoRegistro === "ABIERTO") throw E.registroAbierto();
  if (datos.logroActual === null) throw E.notaFueraDelRegistro();
  if (datos.logroActual === datos.valorCorrecto) throw E.valorIgualAlActual(datos.logroActual);
  if (datos.hayPendiente) throw E.rectificacionPendiente();
}

/**
 * Solo se aprueba o rechaza una solicitud pendiente, y nunca la propia: un usuario con perfil de Administrador y de
 * Docente no resuelve lo que él mismo pidió (US41).
 */
export function verificarResolucion(datos: { estado: EstadoSolicitud; solicitadoPorId: string; usuarioId: string }) {
  if (datos.solicitadoPorId === datos.usuarioId) throw E.solicitudPropia();
  if (!esPendiente(datos.estado)) throw E.solicitudYaResuelta(NOMBRE_ESTADO_SOLICITUD[datos.estado]);
}

/** Al aprobar, la nota debe tener todavía el valor con el que se pidió la rectificación. */
export function verificarValorVigente(logroActual: LogroNota, valorAnterior: LogroNota) {
  if (logroActual !== valorAnterior) throw E.notaCambio();
}

/**
 * Competencias con el peso que se usó al cerrar el registro (guardado en el detalle del cálculo): el consolidado se
 * recalcula igual que al cerrar aunque el plan haya cambiado después. Si una competencia no está en el detalle,
 * conserva su peso actual.
 */
export function pesosDelCierre<T extends { codigo: string; peso: number | null }>(
  competencias: T[],
  detalle: unknown,
): T[] {
  const logros = (detalle as { logros?: { competencia?: unknown; peso?: unknown }[] } | null)?.logros ?? [];
  const usados = new Map(
    logros
      .filter((l) => typeof l.competencia === "string")
      .map((l) => [l.competencia as string, typeof l.peso === "number" ? l.peso : null]),
  );
  return competencias.map((c) => (usados.has(c.codigo) ? { ...c, peso: usados.get(c.codigo)! } : c));
}

// ---------- Bitácora de notas (US03) ----------

export const ORIGENES_CAMBIO = ["REGISTRO", "RECTIFICACION", "ITEMS"] as const;
export type OrigenCambio = (typeof ORIGENES_CAMBIO)[number];

/** Etiqueta del origen en AD-16. */
export const NOMBRE_ORIGEN: Record<OrigenCambio, string> = {
  REGISTRO: "Registro docente",
  RECTIFICACION: "Rectificación aprobada",
  ITEMS: "Calculada por ítems",
};

/** Columna de la competencia en el registro de notas (C1, C2…), como en DO-04 y AD-16. */
export const columnaDeCompetencia = (columna: number) => `C${columna}`;

export interface CompetenciaDeColumna {
  /** 1, 2, 3…: posición en el registro, ordenado por el orden del plan. */
  columna: number;
  codigo: string;
  nombre: string;
}

/** Columna (C1, C2…) de cada competencia del registro, por id de competencia del plan. */
export function columnasDelRegistro(
  competencias: { competenciaPlanId: string; codigo: string; nombre: string; orden: number }[],
): Map<string, CompetenciaDeColumna> {
  return new Map(
    [...competencias]
      .sort((a, b) => a.orden - b.orden)
      .map((c, i) => [c.competenciaPlanId, { columna: i + 1, codigo: c.codigo, nombre: c.nombre }]),
  );
}

/** Lima no tiene horario de verano: siempre UTC−5. */
const DESFASE_LIMA = "-05:00";
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Rango de la bitácora: desde las 00:00 de «desde» hasta el fin del día de «hasta», ambos en Lima (US03, criterio 2).
 * Las fechas llegan como «AAAA-MM-DD»; un rango al revés se rechaza.
 */
export function rangoDeFechas(desde?: string, hasta?: string): { desde?: Date; hasta?: Date } {
  if (desde && hasta && desde > hasta) throw E.rangoFechasInvalido();
  return {
    desde: desde ? new Date(`${desde}T00:00:00.000${DESFASE_LIMA}`) : undefined,
    hasta: hasta ? new Date(new Date(`${hasta}T00:00:00.000${DESFASE_LIMA}`).getTime() + UN_DIA_MS) : undefined,
  };
}
