// evaluacion/domain: errores del registro de notas (US37), del cierre de bimestre (US39), del bloqueo del registro
// cerrado (US40), de la rectificación de nota (US41) y de la bitácora de notas (US03). Los mensajes entre comillas son
// los del Product Backlog v3.3.
import { ErrorApp } from "@/platform/http/errores";

/** Estudiante con competencias sin calificar: impide cerrar el registro (US39, criterio 2). */
export interface Pendiente {
  matriculaId: string;
  /** «Castillo Ramos, Bruno». */
  nombre: string;
  /** Competencias sin logro, por código y nombre. */
  competencias: { competenciaPlanId: string; codigo: string; nombre: string }[];
}

/** Nota rechazada por un valor fuera de la escala: dónde estaba y qué se envió (US37, criterio 2). */
export interface CeldaRechazada {
  matriculaId: string;
  competenciaPlanId: string;
  valor: string;
}

export const MENSAJE_VALOR_NO_PERMITIDO = "Solo se permiten los valores AD, A, B o C";
export const MENSAJE_PERIODO_NO_ACTIVO = "Este periodo de evaluación no está activo.";
export const MENSAJE_REGISTRO_CERRADO = "Este registro está cerrado y no puede modificarse directamente.";
export const MENSAJE_NOTAS_INCOMPLETAS = "Existen registros de notas incompletos";

export const erroresEvaluacion = {
  valorNoPermitido: (celdas: CeldaRechazada[]) =>
    new ErrorApp("VALOR_NO_PERMITIDO", MENSAJE_VALOR_NO_PERMITIDO, 400, { celdas }),
  periodoNoActivo: () => new ErrorApp("PERIODO_NO_ACTIVO", MENSAJE_PERIODO_NO_ACTIVO, 422),
  registroCerrado: () => new ErrorApp("REGISTRO_CERRADO", MENSAJE_REGISTRO_CERRADO, 409),
  notasIncompletas: (pendientes: Pendiente[]) =>
    new ErrorApp("NOTAS_INCOMPLETAS", MENSAJE_NOTAS_INCOMPLETAS, 422, { pendientes }),
  sinAlumnos: () =>
    new ErrorApp(
      "REGISTRO_SIN_ALUMNOS",
      "No hay estudiantes con matrícula vigente en esta sección: no hay notas que cerrar.",
      422,
    ),
  notaFueraDelRegistro: () =>
    new ErrorApp(
      "NOTA_FUERA_DEL_REGISTRO",
      "El estudiante o la competencia no pertenecen a este registro de notas.",
      422,
    ),
  sinReglaConsolidacion: () =>
    new ErrorApp(
      "SIN_REGLA_CONSOLIDACION",
      "El año no tiene una regla de consolidación configurada. Comunícate con el Administrador.",
      422,
    ),
  bimestreAjeno: () => new ErrorApp("NO_ENCONTRADO", "El bimestre no existe en el año de este curso.", 404),
  // ---------- Publicación (US39) y libreta (US46, US51, US66) ----------
  registroNoCerrado: () =>
    new ErrorApp(
      "REGISTRO_NO_CERRADO",
      "Solo se pueden publicar registros cerrados por el docente: este registro sigue abierto.",
      409,
    ),
  yaPublicado: () => new ErrorApp("REGISTRO_YA_PUBLICADO", "Las notas de este registro ya están publicadas.", 409),
  registroNoEncontrado: () => new ErrorApp("NO_ENCONTRADO", "El registro de notas no existe.", 404),
  /** El mensaje es el de la restricción por deuda (US26, criterio 2), que define el módulo matricula. */
  libretaRestringida: (mensaje: string) => new ErrorApp("LIBRETA_RESTRINGIDA", mensaje, 403),
  sinNotasPublicadas: () =>
    new ErrorApp(
      "LIBRETA_SIN_PUBLICAR",
      "Aún no hay notas publicadas en este bimestre: no hay libreta que descargar.",
      422,
    ),
  bimestreDeLibretaAjeno: () => new ErrorApp("NO_ENCONTRADO", "El bimestre no pertenece al año de la libreta.", 404),
  // ---------- Rectificación de nota (US41) y bitácora de notas (US03) ----------
  registroAbierto: () =>
    new ErrorApp(
      "REGISTRO_ABIERTO",
      "Este registro sigue abierto: corrige la nota directamente en el registro de notas.",
      409,
    ),
  valorIgualAlActual: (actual: string) =>
    new ErrorApp("VALOR_IGUAL_AL_ACTUAL", `El valor correcto debe ser distinto del registrado (${actual}).`, 422),
  rectificacionPendiente: () =>
    new ErrorApp(
      "RECTIFICACION_PENDIENTE",
      "Ya hay una solicitud de rectificación pendiente de aprobación para esta nota.",
      409,
    ),
  solicitudNoEncontrada: () => new ErrorApp("NO_ENCONTRADO", "La solicitud de rectificación no existe.", 404),
  solicitudPropia: () =>
    new ErrorApp("SOLICITUD_PROPIA", "No puedes aprobar ni rechazar tu propia solicitud de rectificación.", 403),
  solicitudYaResuelta: (estado: string) =>
    new ErrorApp("SOLICITUD_YA_RESUELTA", `Esta solicitud ya fue atendida: está «${estado}».`, 409),
  notaCambio: () =>
    new ErrorApp(
      "NOTA_CAMBIO",
      "La nota ya no tiene el valor con el que se pidió la rectificación. Pide al docente una nueva solicitud.",
      409,
    ),
  rangoFechasInvalido: () =>
    new ErrorApp("RANGO_FECHAS_INVALIDO", "La fecha «Desde» no puede ser posterior a la fecha «Hasta».", 400),
  // ---------- Evidencias pedagógicas (US38, US47) ----------
  evidenciaVacia: () =>
    new ErrorApp("EVIDENCIA_VACIA", "Escribe un comentario o adjunta un archivo para guardar la evidencia.", 400),
  comentarioEvidenciaLargo: () =>
    new ErrorApp("COMENTARIO_DEMASIADO_LARGO", "El comentario de la evidencia admite hasta 1000 caracteres.", 400),
  notaSinCalificar: () =>
    new ErrorApp(
      "NOTA_SIN_CALIFICAR",
      "Primero guarda la calificación de esta competencia: la evidencia se asocia a una calificación registrada.",
      422,
    ),
  /** También para quien no puede verla (apoderado ajeno, otro alumno, registro sin publicar): no se revela que existe. */
  evidenciaNoEncontrada: () => new ErrorApp("NO_ENCONTRADO", "La evidencia no existe.", 404),
};
