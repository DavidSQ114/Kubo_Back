// matricula/domain: solicitud de matrícula del apoderado y revisión de sus documentos por el coordinador (bloque M4).
// El apoderado matricula a un hijo sin matrícula activa con el proceso abierto y sube cada documento requerido; la
// matrícula queda En proceso con la solicitud «Documentos en revisión». El coordinador aprueba u observa cada
// documento; con todos los obligatorios aprobados asigna la sección con el flujo de matrícula de siempre.
import { erroresMatricula as E } from "./errores";

export const ESTADOS_SOLICITUD = ["EN_REVISION", "OBSERVADA", "APROBADA", "MATRICULADA", "ANULADA"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const NOMBRE_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  EN_REVISION: "Documentos en revisión",
  OBSERVADA: "Con observaciones",
  APROBADA: "Documentos aprobados",
  MATRICULADA: "Matriculado",
  ANULADA: "Anulada",
};

export const ESTADOS_DOCUMENTO = ["EN_REVISION", "APROBADO", "OBSERVADO"] as const;
export type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number];

export const NOMBRE_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  EN_REVISION: "En revisión",
  APROBADO: "Aprobado",
  OBSERVADO: "Observado",
};

export const ORIGENES_SOLICITUD = ["EN_LINEA", "PRESENCIAL"] as const;
export type OrigenSolicitud = (typeof ORIGENES_SOLICITUD)[number];

export const NOMBRE_ORIGEN_SOLICITUD: Record<OrigenSolicitud, string> = {
  EN_LINEA: "En línea",
  PRESENCIAL: "Recibido en secretaría",
};

export const DECISIONES_DOCUMENTO = ["APROBAR", "OBSERVAR"] as const;
export type DecisionDocumento = (typeof DECISIONES_DOCUMENTO)[number];

/** Área de platform/archivos de los documentos de matrícula. */
export const AREA_DOCUMENTOS_MATRICULA = "matricula";
export const MENSAJE_ARCHIVO_MATRICULA = "Cada documento debe ser un PDF o una imagen JPG de hasta 5 MB.";
/** Largo máximo de la observación de un documento. */
export const LARGO_MAXIMO_OBSERVACION = 300;

/**
 * ¿Puede el apoderado matricular a su hijo en el año? Sin matrícula vigente, sí. Con una En proceso sin solicitud (el
 * borrador que deja el registro del estudiante, US17), también: la solicitud se agrega a esa matrícula. Si ya está
 * Matriculado o ya envió la solicitud, no.
 */
export function verificarPuedeMatricular(
  vigente: { estado: string; tieneSolicitud: boolean } | null,
  anio: number,
): "CREAR" | "COMPLETAR" {
  if (!vigente) return "CREAR";
  if (vigente.estado === "MATRICULADO") throw E.hijoYaMatriculado(anio);
  if (vigente.tieneSolicitud) throw E.solicitudExistente(anio);
  return "COMPLETAR";
}

export interface DocumentoDelProceso {
  id: string;
  nombre: string;
  obligatorio: boolean;
}

/**
 * Los archivos enviados corresponden a documentos activos del proceso y cubren todos los obligatorios (los opcionales
 * pueden faltar). `enviados`: ids de documento requerido con archivo.
 */
export function verificarDocumentosEnviados(requeridos: DocumentoDelProceso[], enviados: string[]) {
  const ids = new Set(requeridos.map((d) => d.id));
  if (enviados.some((id) => !ids.has(id))) throw E.documentoNoRequerido();
  const conArchivo = new Set(enviados);
  const falta = requeridos.find((d) => d.obligatorio && !conArchivo.has(d.id));
  if (falta) throw E.documentoFaltante(falta.nombre);
}

/**
 * Estado de la solicitud según sus documentos: con alguno observado, «Con observaciones»; con todos los obligatorios
 * aprobados (y ninguno observado), «Documentos aprobados»; si no, «Documentos en revisión».
 */
export function estadoSegunDocumentos(
  requeridos: DocumentoDelProceso[],
  subidos: { documentoRequeridoId: string; estado: EstadoDocumento }[],
): Extract<EstadoSolicitud, "EN_REVISION" | "OBSERVADA" | "APROBADA"> {
  if (subidos.some((d) => d.estado === "OBSERVADO")) return "OBSERVADA";
  const aprobados = new Set(subidos.filter((d) => d.estado === "APROBADO").map((d) => d.documentoRequeridoId));
  return requeridos.filter((d) => d.obligatorio).every((d) => aprobados.has(d.id)) ? "APROBADA" : "EN_REVISION";
}

/** Una solicitud Matriculada o Anulada ya no cambia. */
export function verificarSolicitudAbierta(estado: EstadoSolicitud) {
  if (estado === "MATRICULADA" || estado === "ANULADA") throw E.solicitudCerrada();
}

/** El apoderado reemplaza un documento observado o sube uno (opcional) que faltaba; uno en revisión o aprobado, no. */
export function verificarReemplazable(estadoActual: EstadoDocumento | null) {
  if (estadoActual !== null && estadoActual !== "OBSERVADO") throw E.documentoNoReemplazable();
}

/**
 * El coordinador revisa un documento En revisión: lo aprueba o lo observa con el motivo (obligatorio). Devuelve el
 * nuevo estado y la observación limpia.
 */
export function revisarDocumento(
  actual: EstadoDocumento,
  decision: DecisionDocumento,
  observacion?: string | null,
): { estado: EstadoDocumento; observacion: string | null } {
  if (actual !== "EN_REVISION") throw E.documentoYaRevisado(NOMBRE_ESTADO_DOCUMENTO[actual]);
  if (decision === "APROBAR") return { estado: "APROBADO", observacion: null };
  const limpia = (observacion ?? "").trim().replace(/\s+/g, " ");
  if (!limpia) throw E.observacionRequerida();
  return { estado: "OBSERVADO", observacion: limpia.slice(0, LARGO_MAXIMO_OBSERVACION) };
}

/**
 * Documentos que la coordinación debe recibir al matricular directamente en «Matrícula»: a un alumno nuevo (sin
 * matrícula anterior) que no tiene solicitud en línea se le piden los documentos activos del proceso de matrícula del
 * año. Lista vacía (alumno antiguo, con solicitud en línea o año sin proceso o sin documentos): la matrícula sigue
 * como siempre.
 */
export function documentosParaMatriculaDirecta(situacion: {
  esAlumnoNuevo: boolean;
  tieneSolicitud: boolean;
  requeridos: DocumentoDelProceso[];
}): DocumentoDelProceso[] {
  if (!situacion.esAlumnoNuevo || situacion.tieneSolicitud) return [];
  return situacion.requeridos;
}

/**
 * Valida los archivos que adjuntó la coordinación al matricular directamente: si no se piden documentos no debe
 * llegar ninguno (422 DOCUMENTOS_NO_CORRESPONDEN); si se piden, cubren los obligatorios y solo nombran documentos del
 * proceso (los opcionales pueden faltar).
 */
export function verificarDocumentosDirectos(exigidos: DocumentoDelProceso[], enviados: string[]) {
  if (!exigidos.length) {
    if (enviados.length) throw E.documentosNoCorresponden();
    return;
  }
  const ids = new Set(exigidos.map((d) => d.id));
  if (enviados.some((id) => !ids.has(id))) throw E.documentoNoRequerido();
  const conArchivo = new Set(enviados);
  const faltan = exigidos.filter((d) => d.obligatorio && !conArchivo.has(d.id)).map((d) => d.nombre);
  if (faltan.length) throw E.documentosPresencialesFaltantes(faltan);
}

/** Para asignar la sección, todos los obligatorios deben estar aprobados (los nombra si faltan). */
export function verificarListaParaAsignar(
  requeridos: DocumentoDelProceso[],
  subidos: { documentoRequeridoId: string; estado: EstadoDocumento }[],
) {
  const aprobados = new Set(subidos.filter((d) => d.estado === "APROBADO").map((d) => d.documentoRequeridoId));
  const faltan = requeridos.filter((d) => d.obligatorio && !aprobados.has(d.id)).map((d) => d.nombre);
  if (faltan.length) throw E.documentosPendientes(faltan);
}
