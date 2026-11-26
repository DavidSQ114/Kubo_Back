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
  /** D-14: no se paga una pensión con la cuota de matrícula pendiente fuera de la operación. */
  matriculaPendiente: (anio: number, conIngreso = false) =>
    new ErrorApp(
      "MATRICULA_PENDIENTE",
      conIngreso
        ? `Primero deben pagarse la matrícula ${anio} y la cuota de ingreso. Inclúyelas en este pago o regístralas antes.`
        : `Primero debe pagarse la matrícula ${anio}. Inclúyela en este pago o regístrala antes.`,
      409,
      { anio },
    ),
  /** D-14: las pensiones se pagan en orden de vencimiento. `conceptos`: las anteriores que faltan elegir. */
  cuotasAnterioresPendientes: (conceptos: string[]) =>
    new ErrorApp(
      "CUOTAS_ANTERIORES_PENDIENTES",
      `Primero deben pagarse las cuotas anteriores: ${conceptos.join(", ")}.`,
      409,
      { conceptos },
    ),
  fechaPagoFutura: () => new ErrorApp("FECHA_PAGO_FUTURA", "La fecha de pago no puede ser posterior a hoy.", 422),
  pagoNoEncontrado: () => new ErrorApp("PAGO_NO_ENCONTRADO", "La operación de pago no existe.", 404),
  pagoNoObservado: (estado: string) =>
    new ErrorApp(
      "PAGO_NO_OBSERVADO",
      `Solo se confirma o descarta una operación «Observado». Esta está «${estado}».`,
      409,
    ),
  pagoYaAnulado: () => new ErrorApp("PAGO_YA_ANULADO", "La operación de pago ya está anulada.", 409),
  /** Bloque M5: anularlo dejaría sus cuotas Pendiente y el portal volvería a cobrarlas (cobro duplicado). */
  pagoEnLineaNoAnulable: () =>
    new ErrorApp(
      "PAGO_EN_LINEA_NO_ANULABLE",
      "Este pago se cobró en Mercado Pago y no se puede anular. Si hay que revertirlo, devuelve el dinero desde el " +
        "panel de Mercado Pago y luego registra la devolución.",
      422,
    ),
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

  // ---------- Pago en línea (US70) y devolución (US71) ----------
  pagoEnLineaNoDisponible: () =>
    new ErrorApp(
      "PAGO_EN_LINEA_NO_DISPONIBLE",
      "El pago en línea no está disponible en este momento. Puedes pagar en tesorería.",
      409,
    ),
  pasarelaNoResponde: () =>
    new ErrorApp(
      "PASARELA_NO_RESPONDE",
      "No pudimos conectar con la pasarela de pagos. Inténtalo de nuevo en unos minutos.",
      502,
    ),
  cuotasDeVariasMatriculas: () =>
    new ErrorApp("CUOTAS_DE_VARIAS_MATRICULAS", "Elige cuotas de un mismo año académico.", 422),
  intentoNoEncontrado: () => new ErrorApp("INTENTO_NO_ENCONTRADO", "No encontramos ese pago en línea.", 404),
  firmaInvalida: () => new ErrorApp("FIRMA_INVALIDA", "La notificación no tiene una firma válida de la pasarela.", 401),
  simulacionNoDisponible: () =>
    new ErrorApp("SIMULACION_NO_DISPONIBLE", "La pasarela de prueba solo está disponible en desarrollo.", 409),
  devolucionNoPermitida: () =>
    new ErrorApp(
      "DEVOLUCION_NO_PERMITIDA",
      "Solo se registra la devolución de un pago en línea en estado «Observado» o «Confirmado».",
      409,
    ),
  motivoDevolucionRequerido: () =>
    new ErrorApp("MOTIVO_DEVOLUCION_REQUERIDO", "Escribe el motivo de la devolución.", 422),
  usarDevolucion: () =>
    new ErrorApp(
      "USAR_DEVOLUCION",
      "Un pago en línea observado no se descarta: registra su devolución cuando el dinero se haya devuelto.",
      409,
    ),

  // ---------- Portal del apoderado (US42, US43, US44) ----------
  /** 403 aunque el estudiante exista: el apoderado no distingue entre «no existe» y «no es tuyo». */
  /** Portal del alumno (US49): solo ingresa quien tiene una matrícula «Matriculado» en un año abierto. */
  sinMatriculaVigente: () =>
    new ErrorApp(
      "SIN_MATRICULA_VIGENTE",
      "No tienes una matrícula vigente. Comunícate con la secretaría del colegio.",
      403,
    ),
  estudianteNoVinculado: () =>
    new ErrorApp("ESTUDIANTE_NO_VINCULADO", "No tienes acceso a la información de este estudiante.", 403),

  // ---------- Datos de demostración de morosidad (scripts/demoMorosidad.ts) ----------
  demoSinAnioEnCurso: () => new ErrorApp("DEMO_SIN_ANIO_EN_CURSO", "No hay un año académico en curso.", 422),
  demoPersonaNoEncontrada: () => new ErrorApp("DEMO_PERSONA_NO_ENCONTRADA", "No hay ninguna persona con ese DNI.", 404),
  demoNoEsEstudiante: () =>
    new ErrorApp("DEMO_NO_ES_ESTUDIANTE", "La persona con ese DNI no es un estudiante activo.", 422),
  demoSinMatricula: (anio: number) =>
    new ErrorApp("DEMO_SIN_MATRICULA", `El estudiante no tiene una matrícula en proceso ni vigente en ${anio}.`, 422),
  demoMatriculaNoVigente: (estado: "RETIRADO" | "ANULADO") =>
    new ErrorApp(
      "DEMO_MATRICULA_NO_VIGENTE",
      `La matrícula del estudiante está ${estado === "RETIRADO" ? "retirada" : "anulada"}: no se modifica.`,
      422,
    ),
  demoCuotasConPagos: (pagos: number) =>
    new ErrorApp(
      "DEMO_CUOTAS_CON_PAGOS",
      "Alguna cuota de la matrícula ya tiene pagos: no se modifica su cronograma.",
      409,
      { pagos },
    ),
  demoFechaFueraDelAnio: (anio: number) =>
    new ErrorApp("DEMO_FECHA_FUERA_DEL_ANIO", `La fecha --desde debe ser del año ${anio}.`, 422),
  demoFechaPosterior: (fechaMatricula: string) =>
    new ErrorApp(
      "DEMO_FECHA_POSTERIOR",
      `La fecha --desde no puede ser posterior a la fecha de matrícula actual (${fechaMatricula}).`,
      422,
    ),

  // ---------- Bloque M4 · Mora ----------
  cuotaNoEsMora: () => new ErrorApp("CUOTA_NO_ES_MORA", "Solo se puede condonar una cuota de mora.", 422),
  moraPagada: () => new ErrorApp("MORA_PAGADA", "La mora ya fue pagada: no se puede condonar.", 409),
  moraYaCondonada: () => new ErrorApp("MORA_YA_CONDONADA", "La mora ya fue condonada o anulada.", 409),
  motivoRequerido: () => new ErrorApp("MOTIVO_REQUERIDO", "Escribe el motivo.", 400),

  // ---------- Bloque M4 · Orden de pago con ingreso y mora (D-14) ----------
  /** La cuota de ingreso y la matrícula pendientes se pagan en la misma operación. `falta`: la que no se eligió. */
  inicioJunto: (falta: string) =>
    new ErrorApp(
      "INGRESO_CON_MATRICULA",
      `La matrícula y la cuota de ingreso se pagan juntas: incluye también «${falta}».`,
      409,
      { falta },
    ),
  /** Cada mora se paga en la misma operación que su pensión, y la pensión con su mora. */
  moraConPension: (mora: string, pension: string) =>
    new ErrorApp(
      "MORA_CON_PENSION",
      `La «${pension}» y su mora se pagan en la misma operación: incluye las dos.`,
      409,
      { mora, pension },
    ),

  // ---------- Bloque M4 · Cuotas extraordinarias ----------
  conceptoExtraRequerido: () =>
    new ErrorApp("CONCEPTO_REQUERIDO", "Escribe el concepto de la cuota (hasta 100 caracteres).", 400),
  vencimientoPasado: () => new ErrorApp("VENCIMIENTO_PASADO", "El vencimiento no puede ser anterior a hoy.", 422),
  anioSinCuotasExtra: (anio: number, estado: string) =>
    new ErrorApp(
      "ANIO_NO_ADMITE_CUOTAS",
      `El año ${anio} está «${estado}»: solo se crean cuotas extraordinarias en un año en matrícula o en curso.`,
      422,
    ),
  destinoRequerido: () => new ErrorApp("DESTINO_REQUERIDO", "Elige el alumno, la sección o el grado.", 400),
  destinoNoEncontrado: () =>
    new ErrorApp("DESTINO_NO_ENCONTRADO", "El alumno, la sección o el grado elegido no es de ese año.", 404),
  loteSinMatriculas: () =>
    new ErrorApp(
      "LOTE_SIN_MATRICULAS",
      "No hay alumnos matriculados en el destino elegido: no se generaría ninguna cuota.",
      422,
    ),
  loteNoEncontrado: () => new ErrorApp("LOTE_NO_ENCONTRADO", "El lote de cuotas extraordinarias no existe.", 404),
  loteYaAnulado: () => new ErrorApp("LOTE_YA_ANULADO", "El lote ya fue anulado.", 409),
  cuotaNoEsExtraordinaria: () =>
    new ErrorApp("CUOTA_NO_ES_EXTRAORDINARIA", "Solo se puede anular una cuota extraordinaria.", 422),
  extraordinariaPagada: () =>
    new ErrorApp("CUOTA_PAGADA", "La cuota ya fue pagada: anula primero su pago si corresponde.", 409),
  extraordinariaAnulada: () => new ErrorApp("CUOTA_YA_ANULADA", "La cuota ya fue anulada.", 409),

  // ---------- Bloque M4 · Proceso de matrícula ----------
  fechasProcesoInvalidas: () =>
    new ErrorApp("FECHAS_PROCESO_INVALIDAS", "La fecha de inicio no puede ser posterior a la fecha de fin.", 400),
  sinDocumentosRequeridos: () =>
    new ErrorApp("SIN_DOCUMENTOS_REQUERIDOS", "Agrega al menos un documento requerido.", 400),
  demasiadosDocumentos: (maximo: number) =>
    new ErrorApp("DEMASIADOS_DOCUMENTOS", `Puedes pedir hasta ${maximo} documentos.`, 400),
  documentoSinNombre: () =>
    new ErrorApp("DOCUMENTO_SIN_NOMBRE", "Escribe el nombre de cada documento (hasta 100 caracteres).", 400),
  documentoRepetido: (nombre: string) =>
    new ErrorApp("DOCUMENTO_REPETIDO", `El documento «${nombre}» está repetido.`, 409, { nombre }),
  anioCerradoProceso: (anio: number) =>
    new ErrorApp("ANIO_CERRADO", `El año ${anio} está cerrado: su proceso de matrícula ya no cambia.`, 422),
  matriculaNoConfigurada: (anio: number) =>
    new ErrorApp(
      "MATRICULA_NO_CONFIGURADA",
      `El colegio todavía no abrió la matrícula ${anio} en línea. Consulta las fechas con la coordinación.`,
      422,
    ),
  matriculaAunNoAbre: (desde: string) =>
    new ErrorApp("MATRICULA_AUN_NO_ABRE", `La matrícula en línea empieza el ${desde}.`, 422, { desde }),
  matriculaCerrada: (hasta: string) =>
    new ErrorApp(
      "MATRICULA_CERRADA",
      `La matrícula en línea terminó el ${hasta}. Comunícate con la coordinación para matricular a tu hijo.`,
      422,
      { hasta },
    ),

  // ---------- Bloque M4 · Solicitud de matrícula del apoderado ----------
  hijoYaMatriculado: (anio: number) =>
    new ErrorApp("HIJO_YA_MATRICULADO", `Tu hijo ya está matriculado en ${anio}.`, 409, { anio }),
  solicitudExistente: (anio: number) =>
    new ErrorApp(
      "SOLICITUD_EXISTENTE",
      `Ya enviaste la solicitud de matrícula ${anio} de tu hijo: revisa su estado en esta pantalla.`,
      409,
      { anio },
    ),
  datosNoConfirmados: () =>
    new ErrorApp("DATOS_NO_CONFIRMADOS", "Confirma que los datos del alumno son correctos.", 400),
  gradoNoValido: () => new ErrorApp("GRADO_NO_VALIDO", "Elige un grado válido.", 400),
  documentoFaltante: (nombre: string) =>
    new ErrorApp("DOCUMENTO_FALTANTE", `Sube el documento «${nombre}».`, 400, { nombre }),
  documentoNoRequerido: () =>
    new ErrorApp("DOCUMENTO_NO_REQUERIDO", "Ese documento no está en la lista del proceso de matrícula.", 400),
  solicitudNoEncontrada: () => new ErrorApp("SOLICITUD_NO_ENCONTRADA", "La solicitud de matrícula no existe.", 404),
  solicitudCerrada: () =>
    new ErrorApp("SOLICITUD_CERRADA", "La solicitud ya fue resuelta: sus documentos no cambian.", 409),
  documentoNoReemplazable: () =>
    new ErrorApp(
      "DOCUMENTO_NO_REEMPLAZABLE",
      "Solo puedes reemplazar un documento observado o subir uno que faltaba.",
      409,
    ),
  documentoYaRevisado: (estado: string) =>
    new ErrorApp(
      "DOCUMENTO_YA_REVISADO",
      `El documento ya está «${estado}». Espera a que el apoderado lo reemplace.`,
      409,
    ),
  observacionRequerida: () => new ErrorApp("OBSERVACION_REQUERIDA", "Escribe qué debe corregir el apoderado.", 400),
  documentosPendientes: (nombres: string[]) =>
    new ErrorApp(
      "DOCUMENTOS_PENDIENTES",
      `Antes de asignar la sección deben estar aprobados: ${nombres.join(", ")}.`,
      422,
      { nombres },
    ),
  seccionOtroGrado: (grado: string) =>
    new ErrorApp("SECCION_OTRO_GRADO", `La sección debe ser de ${grado}, el grado de la solicitud.`, 422, { grado }),
};
