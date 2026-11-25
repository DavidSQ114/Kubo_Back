// matricula: interfaz pública. Matrícula en sección (US18), cronograma de pagos (US21), anulación (M-19), traslado
// (US19), retiro (US57), ficha en PDF (US20), pagos y recibos (US22, US23, US04, US25), portal del apoderado (US42,
// US43, US44), portal del alumno (US49: matrícula vigente, panel y «Mis cursos»), sección del hijo para su horario
// (US48), su matrícula para la asistencia (US45) y la libreta (US46), la restricción de la libreta por deuda (US26),
// pago en línea y conciliación (US70, US71), recordatorios de pago a apoderados morosos (US59), sección en una fecha,
// datos de las matrículas de una lista de asistencia (US35), los datos de demostración de morosidad
// (scripts/demoMorosidad.ts) y los puertos
// que usan académico (vacantes, US08) y comunidad (matrícula «En proceso» del registro de estudiantes, US17).
export { matriculasProviderMatricula } from "./infrastructure/matriculasProvider";
export { matriculaBorradorProviderMatricula } from "./infrastructure/matriculaBorradorProvider";
export { registrosMatriculaProviderMatricula } from "./infrastructure/registrosMatriculaProvider";
export {
  situacionEstudiante,
  confirmarMatricula,
  anularMatricula,
  listarMatriculas,
  detalleMatricula,
  type DatosMatricula,
  type FiltroMatriculas,
} from "./application/matriculas";
export {
  trasladarMatricula,
  retirarMatricula,
  generarFichaMatricula,
  seccionDeMatriculaEnFecha,
  matriculasDeSeccionEnFecha,
  datosDeMatriculas,
  type MatriculaDeLista,
  type DatosTraslado,
  type DatosRetiro,
} from "./application/cambios";
export { MOTIVOS_RETIRO, NOMBRE_MOTIVO_RETIRO, type MotivoRetiro } from "./domain/cambios";
export {
  registrarPago,
  registrarPagoAnual,
  confirmarPagoObservado,
  descartarPagoObservado,
  anularPago,
  registrarDevolucion,
  reciboDePago,
  detalleOperacion,
  estadoDeCuenta,
  type DatosPago,
  type DatosPagoAnual,
} from "./application/pagos";
export {
  panelMorosidad,
  restriccionPorDeuda,
  type FiltroMorosidad,
  type RestriccionPorDeuda,
} from "./application/morosidad";
export { MENSAJE_RESTRICCION_DEUDA } from "./domain/morosidad";
export {
  enviarRecordatoriosPago,
  type RecordatoriosEnviados,
  type ResultadoRecordatorio,
} from "./application/recordatorios";
export { NOMBRE_MOTIVO_OMISION, type MotivoOmision } from "./domain/recordatorios";
export {
  hijosDelApoderado,
  elegirHijo,
  pagosDelHijo,
  comprobanteDeCuota,
  seccionDelHijo,
  matriculaDelHijo,
} from "./application/portalApoderado";
export {
  matriculaVigenteDelAlumno,
  panelDelAlumno,
  cursosDelAlumno,
  type MatriculaDelAlumno,
  type PanelDelAlumno,
  type CursoDelAlumno,
} from "./application/portalAlumno";
export {
  pagoEnLineaDisponible,
  crearIntentoPago,
  validarAvisoPasarela,
  procesarOrdenPasarela,
  consultarIntento,
  simularPagoEnLinea,
  conciliarIntentosPendientes,
  type ResultadoAviso,
  type ResumenConciliacion,
} from "./application/pasarela";
export { prepararDemoMorosidad, type ResultadoDemoMorosidad } from "./application/demoMorosidad";
export * as esquemasMatricula from "./schemas";
export { ROLES_MATRICULA } from "./accesos";
