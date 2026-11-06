// academico: interfaz pública. Otros módulos y las rutas importan SOLO desde aquí
// (US06 año, US07 periodos, US08 grados y secciones, US09 aulas, US10 cursos, US11 competencias,
// US12 reglas de consolidación, US14 asignaciones, montos del año para US18 y US21).
export { ESTADOS_ANIO, NOMBRE_ESTADO_ANIO, ESTADOS_PERIODO, type EstadoAnio, type EstadoPeriodo } from "./domain/tipos";
export {
  ESTADOS_SECCION,
  calcularVacantes,
  verificarVacantes,
  type EstadoSeccion,
  type Vacantes,
} from "./domain/secciones";
export { aCentimos, deCentimos, type MontosAnio } from "./domain/montos";
export { fechaEnLima } from "./domain/reglas";
export { montosDelAnio, guardarMontos, seccionBloqueadaParaMatricula } from "./application/montos";
export { ESTADOS_CURSO, verificarCompetenciasConfiguradas, type EstadoCurso } from "./domain/cursos";
export {
  LOGROS,
  METODOS_CONSOLIDACION,
  CRITERIOS_DESEMPATE,
  VALOR_LOGRO,
  REDONDEO_PONDERADO,
  consolidarLogro,
  versionAplicable,
  type Logro,
  type MetodoConsolidacion,
  type CriterioDesempate,
  type ReglaCalculo,
} from "./domain/consolidacion";
export type { SituacionAnio } from "./domain/reglas";
export {
  configurarCierresProvider,
  configurarHorariosProvider,
  configurarMatriculasProvider,
  configurarDocentesProvider,
  configurarPersonasProvider,
  type CierresProvider,
  type ResumenCierres,
  type MatriculasProvider,
  type DocentesProvider,
  type DocenteResumen,
  type HorariosProvider,
  type PersonasProvider,
} from "./puertos";
export {
  listarAnios,
  obtenerAnio,
  crearAnio,
  editarAnio,
  cambiarEstadoAnio,
  eliminarAnio,
  situacionActual,
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
export {
  listarAreas,
  listarCursos,
  crearCurso,
  editarCurso,
  cambiarEstadoCurso,
  eliminarCurso,
  planesDelCurso,
  guardarPlanes,
  type CursoVista,
  type PlanResumen,
} from "./application/cursos";
export {
  competenciasDePlan,
  guardarCompetenciasPlan,
  competenciasDelPlan,
  type CompetenciaDelPlan,
} from "./application/competencias";
export {
  listarAsignaciones,
  misCursos,
  asignarCurso,
  quitarAsignacion,
  type AsignacionVista,
} from "./application/asignaciones";
export {
  reglasDelAnio,
  guardarRegla,
  simularConsolidacion,
  type ReglasDelAnio,
  type VersionRegla,
} from "./application/reglasConsolidacion";
export * as esquemasAcademico from "./schemas";
