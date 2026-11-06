// matricula: interfaz pública. Matrícula en sección (US18), cronograma de pagos (US21), anulación (M-19) y los puertos
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
export * as esquemasMatricula from "./schemas";
