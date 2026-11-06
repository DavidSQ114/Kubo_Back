// matricula/domain: reglas puras de la matrícula en sección (US18, RF14) y de su anulación (M-19).
// Estados: En proceso → Matriculado; desde En proceso o Matriculado (sin pagos) se puede pasar a Anulado.
import { erroresMatricula as E } from "./errores";

export const ESTADOS_MATRICULA = ["EN_PROCESO", "MATRICULADO", "RETIRADO", "ANULADO", "FINALIZADO"] as const;
export type EstadoMatricula = (typeof ESTADOS_MATRICULA)[number];

export const NOMBRE_ESTADO_MATRICULA: Record<EstadoMatricula, string> = {
  EN_PROCESO: "En proceso",
  MATRICULADO: "Matriculado",
  RETIRADO: "Retirado",
  ANULADO: "Anulado",
  FINALIZADO: "Finalizado",
};

export const MODALIDADES_PAGO = ["MENSUAL", "ANUAL"] as const;
export type ModalidadPago = (typeof MODALIDADES_PAGO)[number];

/** Motivos de MotivoAnulacion que aplican a una matrícula (PAGO_DUPLICADO es de los pagos). */
export const MOTIVOS_ANULACION_MATRICULA = ["ERROR_DIGITACION", "SOLICITUD_APODERADO", "OTRO"] as const;
export type MotivoAnulacionMatricula = (typeof MOTIVOS_ANULACION_MATRICULA)[number];

/** Solo se matricula en un año «En matrícula» o «En curso» (matrícula extemporánea). */
export function verificarAnioMatriculable(anio: { anio: number; estado: string }, nombreEstado: string) {
  if (anio.estado !== "EN_MATRICULA" && anio.estado !== "EN_CURSO") throw E.anioNoMatriculable(anio.anio, nombreEstado);
}

/** US18: sin sección o sin responsable de pago no se confirma. */
export function verificarCompleta(datos: { seccionId?: string | null; vinculoResponsableId?: string | null }) {
  if (!datos.seccionId || !datos.vinculoResponsableId) throw E.incompleta();
}

/**
 * Matrícula vigente del estudiante en el año: si ya está Matriculado no se vuelve a matricular (sugiere el traslado);
 * si está En proceso, se confirma esa misma matrícula.
 */
export function verificarConfirmable(
  vigente: { id: string; estado: EstadoMatricula; seccionId: string | null } | null,
): "CREAR" | "CONFIRMAR" {
  if (!vigente) return "CREAR";
  if (vigente.estado === "MATRICULADO") {
    throw E.yaMatriculado({ matriculaId: vigente.id, seccionId: vigente.seccionId });
  }
  return "CONFIRMAR";
}

/** El responsable del pago debe ser uno de los vínculos del estudiante (también lo verifica un trigger). */
export function verificarResponsable(vinculoResponsableId: string, vinculosDelEstudiante: string[]) {
  if (!vinculosDelEstudiante.includes(vinculoResponsableId)) throw E.responsableNoVinculado();
}

/**
 * La vacante se valida recién al confirmar: las matrículas «En proceso» no la reservan. `matriculados` cuenta solo
 * las MATRICULADO de la sección, leídas con la fila de la sección bloqueada.
 */
export function verificarCupo(matriculados: number, aforo: number) {
  if (matriculados >= aforo) throw E.sinVacantes(matriculados, aforo);
}

/** Se anula una matrícula En proceso o Matriculado que no tenga pagos (los pagos se anulan antes, en Tesorería). */
export function verificarAnulable(estado: EstadoMatricula, pagos: number) {
  if (estado !== "EN_PROCESO" && estado !== "MATRICULADO") throw E.noAnulable(NOMBRE_ESTADO_MATRICULA[estado]);
  if (pagos > 0) throw E.conPagos(pagos);
}

/** «SOLICITUD_APODERADO: El apoderado cambió de colegio.»: lo que se guarda en matricula.motivo_anulacion. */
export const textoMotivoAnulacion = (motivo: MotivoAnulacionMatricula, detalle: string) =>
  `${motivo}: ${detalle.trim()}`;
