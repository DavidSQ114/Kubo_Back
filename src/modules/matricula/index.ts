// matricula: interfaz pública. Matrícula en sección (US18), cronograma de pagos (US21), anulación (M-19), traslado
// (US19), retiro (US57), ficha en PDF (US20), sección en una fecha (asistencia y notas) y los puertos
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
export * as esquemasMatricula from "./schemas";
