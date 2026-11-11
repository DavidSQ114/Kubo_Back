// matricula: interfaz pública. Matrícula en sección (US18), cronograma de pagos (US21), anulación (M-19), traslado
// (US19), retiro (US57), ficha en PDF (US20), pagos y recibos (US22, US23, US04, US25), portal del apoderado (US42,
// US43, US44), pago en línea y conciliación (US70, US71), sección en una fecha y los puertos
// que usan académico (vacantes, US08) y comunidad (matrícula «En proceso» del registro de estudiantes, US17).
export { matriculasProviderMatricula } from "./infrastructure/matriculasProvider";
export { matriculaBorradorProviderMatricula } from "./infrastructure/matriculaBorradorProvider";
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
export { panelMorosidad, type FiltroMorosidad } from "./application/morosidad";
export { hijosDelApoderado, elegirHijo, pagosDelHijo, comprobanteDeCuota } from "./application/portalApoderado";
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
export * as esquemasMatricula from "./schemas";
