// evaluacion: interfaz pública. Registro de notas cualitativas del docente (US37), cierre, consolidación y publicación
// del bimestre (US39), bloqueo del registro cerrado (US40), libreta del apoderado y del alumno con su PDF (US46, US51,
// US66; con la restricción por deuda de US26), solicitud de rectificación de nota (US41), bitácora de notas (US03),
// evidencias pedagógicas y su archivo (US38, US47) y el puerto que usa académico (cierres del año y notas por
// competencia).
export { cierresProviderEvaluacion } from "./infrastructure/cierresProvider";
export { LOGROS_NOTA, ESTADOS_REGISTRO, MENSAJE_CORRECCION, type LogroNota, type EstadoRegistro } from "./domain/notas";
export {
  MENSAJE_VALOR_NO_PERMITIDO,
  MENSAJE_PERIODO_NO_ACTIVO,
  MENSAJE_REGISTRO_CERRADO,
  MENSAJE_NOTAS_INCOMPLETAS,
  type Pendiente,
} from "./domain/errores";
export {
  misRegistros,
  registroDeNotas,
  guardarNotas,
  cerrarRegistro,
  type MisRegistros,
  type RegistroDeNotas,
  type NotasGuardadas,
  type RegistroCerrado,
  type AvisoCierre,
  registroDeCierre,
} from "./application/registroNotas";
export {
  registrosParaPublicar,
  publicarNotas,
  type FiltroPublicacion,
  type Publicaciones,
  type RegistroPublicable,
  type NotasPublicadas,
} from "./application/publicacion";
export {
  libretaDelHijo,
  libretaDelAlumno,
  libretaPdfDelHijo,
  libretaPdfDelAlumno,
  type Libreta,
  type LibretaDelHijo,
  type BimestreDeLibreta,
} from "./application/libreta";
export {
  NOMBRE_ESTADO_SOLICITUD,
  NOMBRE_ORIGEN,
  type EstadoSolicitud,
  type OrigenCambio,
} from "./domain/rectificacion";
export {
  solicitarRectificacion,
  misRectificaciones,
  bandejaRectificaciones,
  aprobarRectificacion,
  rechazarRectificacion,
  type SolicitudVista,
  type SolicitudCreada,
  type SolicitudResuelta,
  type AvisoRectificacion,
} from "./application/rectificaciones";
export { listarBitacoraNotas, docentesDeBitacora, type CambioRegistrado } from "./application/bitacora";
export {
  LARGO_MAXIMO_COMENTARIO_EVIDENCIA,
  MENSAJE_ARCHIVO_EVIDENCIA,
  FORMATOS_EVIDENCIA,
  type EvidenciaVista,
  type ArchivoDeEvidencia,
} from "./domain/evidencias";
export {
  agregarEvidencia,
  eliminarEvidencia,
  archivoDeEvidencia,
  type DatosEvidencia,
  type EvidenciaAgregada,
} from "./application/evidencias";
export * as esquemasEvaluacion from "./schemas";
