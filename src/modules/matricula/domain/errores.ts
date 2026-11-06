// matricula/domain: errores del módulo (US17 matrícula «En proceso», US18 matrícula en sección, US21 cronograma).
import { ErrorApp } from "@/platform/http/errores";

export const erroresMatricula = {
  sinAnioEnMatricula: () =>
    new ErrorApp(
      "SIN_ANIO_EN_MATRICULA",
      "No hay un año académico en matrícula ni en curso. Abre la matrícula en «Año y bimestres» para guardar el borrador.",
      422,
    ),
  matriculaExistente: (anio: number) =>
    new ErrorApp(
      "MATRICULA_EXISTENTE",
      `El estudiante ya tiene una matrícula en proceso o confirmada en ${anio}.`,
      409,
    ),

  // ---------- Matrícula en sección (US18) ----------
  incompleta: () =>
    new ErrorApp(
      "MATRICULA_INCOMPLETA",
      "Complete la sección y el apoderado responsable para confirmar la matrícula",
      422,
    ),
  sinVacantes: (matriculados: number, aforo: number) =>
    new ErrorApp("SECCION_SIN_VACANTES", "Sección sin vacantes disponibles", 409, { matriculados, aforo }),
  yaMatriculado: (detalles: { matriculaId: string; seccionId: string | null }) =>
    new ErrorApp("YA_MATRICULADO", "Este estudiante ya está matriculado en el periodo actual", 409, {
      ...detalles,
      sugerencia: "Usa «Traslado de sección» para cambiarlo de sección.",
    }),
  seccionInactiva: () =>
    new ErrorApp("SECCION_INACTIVA", "La sección está inactiva y no recibe nuevas matrículas.", 409),
  seccionNoEncontrada: () => new ErrorApp("SECCION_NO_ENCONTRADA", "La sección no existe.", 404),
  seccionOtroAnio: () =>
    new ErrorApp("SECCION_OTRO_ANIO", "La sección no pertenece al año académico de la matrícula.", 422),
  responsableNoVinculado: () =>
    new ErrorApp(
      "RESPONSABLE_NO_VINCULADO",
      "El apoderado responsable del pago debe ser uno de los apoderados vinculados al estudiante.",
      422,
    ),
  anioNoMatriculable: (anio: number, estado: string) =>
    new ErrorApp(
      "ANIO_NO_MATRICULABLE",
      `El año ${anio} está «${estado}»: solo se matricula en un año «En matrícula» o «En curso».`,
      422,
    ),
  sinMontos: (anio: number) =>
    new ErrorApp(
      "SIN_MONTOS",
      `El año ${anio} no tiene montos de matrícula y pensión. Configúralos en «Montos del año» antes de matricular.`,
      422,
    ),
  estudianteNoEncontrado: () =>
    new ErrorApp("ESTUDIANTE_NO_ENCONTRADO", "El estudiante no existe o ya no está activo.", 404),
  noEncontrada: () => new ErrorApp("MATRICULA_NO_ENCONTRADA", "La matrícula no existe.", 404),

  // ---------- Anulación (US18, M-19) y cronograma (US21) ----------
  noAnulable: (estado: string) =>
    new ErrorApp(
      "MATRICULA_NO_ANULABLE",
      `Solo se anula una matrícula «En proceso» o «Matriculado». Esta está «${estado}».`,
      409,
    ),
  conPagos: (pagos: number) =>
    new ErrorApp(
      "MATRICULA_CON_PAGOS",
      "No se puede anular esta matrícula: primero anula los pagos confirmados de esta matrícula.",
      409,
      { pagos },
    ),

  // ---------- Traslado de sección (US19, M-05) ----------
  noTrasladable: (estado: string) =>
    new ErrorApp(
      "MATRICULA_NO_TRASLADABLE",
      `Solo se traslada una matrícula «Matriculado». Esta está «${estado}».`,
      409,
    ),
  trasladoOtroGrado: () =>
    new ErrorApp("TRASLADO_OTRO_GRADO", "Solo se permite el traslado entre secciones del mismo grado", 422),
  mismaSeccion: () =>
    new ErrorApp("MISMA_SECCION", "El estudiante ya está en esa sección. Elige otra sección de destino.", 422),
  destinoSinVacantes: (matriculados: number, aforo: number) =>
    new ErrorApp("DESTINO_SIN_VACANTES", "La sección destino no tiene vacantes disponibles", 409, {
      matriculados,
      aforo,
    }),
  fechaTrasladoInvalida: (mensaje: string) => new ErrorApp("FECHA_TRASLADO_INVALIDA", mensaje, 422),

  // ---------- Retiro del estudiante (US57, M-18) ----------
  noRetirable: (estado: string) =>
    new ErrorApp(
      "MATRICULA_NO_RETIRABLE",
      `Solo se registra el retiro de una matrícula «Matriculado». Esta está «${estado}».`,
      409,
    ),
  motivoRetiroRequerido: () => new ErrorApp("MOTIVO_RETIRO_REQUERIDO", "Seleccione el motivo del retiro", 422),
  fechaRetiroInvalida: (mensaje: string) => new ErrorApp("FECHA_RETIRO_INVALIDA", mensaje, 422),

  // ---------- Ficha de matrícula en PDF (US20) ----------
  fichaDatosPendientes: (pendientes: string[]) =>
    new ErrorApp("FICHA_DATOS_PENDIENTES", "No se puede generar la ficha: existen datos obligatorios pendientes", 422, {
      pendientes,
    }),
  fichaNoDisponible: (estado: string) =>
    new ErrorApp(
      "FICHA_NO_DISPONIBLE",
      `La ficha solo se genera para una matrícula «Matriculado» o «Retirado». Esta está «${estado}».`,
      409,
    ),

  // ---------- Pagos (US22, US23, US04, US25) ----------
  numeroOperacionRequerido: () =>
    new ErrorApp("NUMERO_OPERACION_REQUERIDO", "El número de operación es obligatorio", 422),
  montoNoCoincide: (totalCentimos: number) =>
    new ErrorApp("MONTO_NO_COINCIDE", "El monto ingresado no coincide con el total de las cuotas seleccionadas", 422, {
      total: `${Math.trunc(totalCentimos / 100)}.${String(totalCentimos % 100).padStart(2, "0")}`,
    }),
  sinCuotas: () => new ErrorApp("SIN_CUOTAS", "Selecciona al menos una cuota pendiente.", 422),
  cuotaRepetida: () => new ErrorApp("CUOTA_REPETIDA", "Una cuota aparece más de una vez en el pago.", 422),
  cuotaNoEncontrada: () => new ErrorApp("CUOTA_NO_ENCONTRADA", "Una de las cuotas elegidas no existe.", 404),
  cuotasDeVariosEstudiantes: () =>
    new ErrorApp("CUOTAS_DE_VARIOS_ESTUDIANTES", "Las cuotas de un pago deben ser del mismo estudiante.", 422),
  /** «Esta pensión ya fue cancelada el 03/07/2026» (US23). */
  cuotaYaPagada: (fecha: string | null) =>
    new ErrorApp(
      "CUOTA_YA_PAGADA",
      `Esta pensión ya fue cancelada el ${fecha ? fecha.split("-").reverse().join("/") : "—"}`,
      409,
      { fecha },
    ),
  cuotaAnulada: () => new ErrorApp("CUOTA_ANULADA", "La cuota está anulada y no admite pagos.", 409),
  fechaPagoFutura: () => new ErrorApp("FECHA_PAGO_FUTURA", "La fecha de pago no puede ser posterior a hoy.", 422),
  pagoNoEncontrado: () => new ErrorApp("PAGO_NO_ENCONTRADO", "La operación de pago no existe.", 404),
  pagoNoObservado: (estado: string) =>
    new ErrorApp(
      "PAGO_NO_OBSERVADO",
      `Solo se confirma o descarta una operación «Observado». Esta está «${estado}».`,
      409,
    ),
  pagoYaAnulado: () => new ErrorApp("PAGO_YA_ANULADO", "La operación de pago ya está anulada.", 409),
  motivoAnulacionPagoRequerido: () =>
    new ErrorApp("MOTIVO_ANULACION_REQUERIDO", "Selecciona el motivo de la anulación.", 422),
  detalleAnulacionRequerido: () =>
    new ErrorApp("DETALLE_ANULACION_REQUERIDO", "Con el motivo «Otro», describe la anulación en la observación.", 422),
  // ---------- Pago anual adelantado (US58) ----------
  montoNoCoincidePendiente: (totalCentimos: number) =>
    new ErrorApp("MONTO_NO_COINCIDE_PENDIENTE", "El monto no coincide con el total pendiente", 422, {
      total: `${Math.trunc(totalCentimos / 100)}.${String(totalCentimos % 100).padStart(2, "0")}`,
    }),
  sinCuotasPendientes: () =>
    new ErrorApp("SIN_CUOTAS_PENDIENTES", "El estudiante no tiene cuotas pendientes en este año.", 422),
  pagoAnualNoPermitido: (estado: string) =>
    new ErrorApp(
      "PAGO_ANUAL_NO_PERMITIDO",
      `El pago anual solo se registra para una matrícula «Matriculado». Esta está «${estado}».`,
      409,
    ),
  reciboNoConfirmado: () =>
    new ErrorApp("RECIBO_NO_CONFIRMADO", "No se puede generar un recibo de un pago no confirmado", 422),
};
