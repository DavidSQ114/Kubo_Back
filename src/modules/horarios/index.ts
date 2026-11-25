// horarios: interfaz pública. Otros módulos y las rutas importan SOLO desde aquí (US27 cuadrícula por sección,
// US28 asignación de clases, US29 y US30 cruces de docente y de aula, US31 publicación por versiones, el horario
// publicado en los portales del docente, del apoderado y del alumno, US34, US48 y US50, la asistencia de alumnos por
// sesión de clase, US35 y US36, su consulta en los portales, US45 y US52, y el puerto que académico usa para no borrar
// cursos ni asignaciones con horario, US10 y US14), y el registro de ingreso del personal docente con su
// verificación automática de la hora límite (US32).
export { horariosProviderHorarios } from "./infrastructure/horariosProvider";
export {
  DIAS,
  NOMBRE_DIA,
  TIPOS_BLOQUE,
  ESTADOS_HORARIO,
  type Dia,
  type TipoBloque,
  type EstadoHorario,
  type Bloque,
} from "./domain/tipos";
export {
  obtenerCuadricula,
  ocupacionDelBloque,
  type CuadriculaVista,
  type ClaseVista,
  type CursoDelHorario,
  type VersionVista,
  type OcupacionVista,
} from "./application/cuadricula";
export { asignarClase, quitarClase, crearBorrador, type Celda } from "./application/clases";
export { publicarHorario, type HorarioPublicado, type AvisoPublicacion } from "./application/publicacion";
export {
  horarioPublicadoDeSeccion,
  horarioPublicadoDeDocente,
  miHorarioDocente,
  type HorarioDeSeccion,
  type HorarioDeDocente,
} from "./application/consultas";
export { horarioDelAlumno, horarioDelHijo, type HorarioDeEstudiante } from "./application/portales";
export { horarioPdfDelHijo } from "./application/horarioPdf";
export { resumenDelDocente, type ResumenDelDocente } from "./domain/portales";
export {
  ESTADOS_ASISTENCIA,
  NOMBRE_ESTADO_ASISTENCIA,
  type EstadoAsistencia,
  type EstadoDia,
  type Incidencia,
} from "./domain/asistencia";
export {
  clasesDeHoy,
  abrirSesion,
  listarSesiones,
  detalleDeSesion,
  guardarAsistencia,
  corregirAsistencia,
  type ClasesDeHoy,
  type ClaseDeHoy,
  type SesionVista,
  type SesionDetalle,
  type SesionGuardada,
  type AlumnoDeSesion,
} from "./application/asistencia";
export {
  asistenciaDelHijo,
  asistenciaDelAlumno,
  type AsistenciaDelMes,
  type AsistenciaDelAlumno,
} from "./application/asistenciaPortales";
export {
  ESTADOS_ASISTENCIA_DOCENTE,
  NOMBRE_ESTADO_ASISTENCIA_DOCENTE,
  type EstadoAsistenciaDocente,
} from "./domain/asistenciaDocente";
export {
  asistenciaDocenteDelDia,
  registrarIngreso,
  registrarSalida,
  justificarFalta,
  marcarFaltasDocentes,
  type AsistenciaDocenteDelDia,
  type DocenteDelDia,
  type RegistroDelDia,
  type ResultadoFaltasDocentes,
} from "./application/asistenciaDocente";
export * as esquemasHorarios from "./schemas";
export { ROLES_HORARIOS } from "./accesos";
