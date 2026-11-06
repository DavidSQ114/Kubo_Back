// matricula: interfaz pública. Matrícula en sección (US18), cronograma de pagos (US21), anulación (M-19), traslado
// (US19), retiro (US57), ficha en PDF (US20), pagos y recibos (US22, US23, US04, US25), sección en una fecha y
// los puertos
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
  confirmarPagoObservado,
  descartarPagoObservado,
  anularPago,
  reciboDePago,
  detalleOperacion,
  estadoDeCuenta,
  type DatosPago,
} from "./application/pagos";
export * as esquemasMatricula from "./schemas";
