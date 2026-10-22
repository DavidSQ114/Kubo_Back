// academico: interfaz pública. Otros módulos y las rutas importan SOLO desde aquí
// (US06 año, US07 periodos, US08 grados y secciones, US09 aulas).
export { ESTADOS_ANIO, NOMBRE_ESTADO_ANIO, ESTADOS_PERIODO, type EstadoAnio, type EstadoPeriodo } from "./domain/tipos";
export { ESTADOS_SECCION, verificarVacantes, type EstadoSeccion, type Vacantes } from "./domain/secciones";
export {
  configurarCierresProvider,
  configurarMatriculasProvider,
  configurarDocentesProvider,
  type CierresProvider,
  type ResumenCierres,
  type MatriculasProvider,
  type DocentesProvider,
  type DocenteResumen,
} from "./puertos";
export {
  listarAnios,
  obtenerAnio,
  crearAnio,
  editarAnio,
  cambiarEstadoAnio,
  type AnioVista,
  type PeriodoVista,
} from "./application/anios";
export { listarPeriodos, guardarPeriodos, periodoVigente } from "./application/periodos";
export {
  listarGrados,
  listarSecciones,
  crearSeccion,
  editarSeccion,
  cambiarEstadoSeccion,
  eliminarSeccion,
  vacantesSeccion,
  type SeccionVista,
} from "./application/secciones";
export { listarAulas, crearAula, editarAula, cambiarEstadoAula, type AulaVista } from "./application/aulas";
export * as esquemasAcademico from "./schemas";
