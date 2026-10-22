// academico: interfaz pública. Otros módulos y las rutas importan SOLO desde aquí (US06 año, US07 periodos).
export { ESTADOS_ANIO, NOMBRE_ESTADO_ANIO, ESTADOS_PERIODO, type EstadoAnio, type EstadoPeriodo } from "./domain/tipos";
export { configurarCierresProvider, type CierresProvider, type ResumenCierres } from "./puertos";
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
export * as esquemasAcademico from "./schemas";
