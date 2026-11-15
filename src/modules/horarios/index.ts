// horarios: interfaz pública. Otros módulos y las rutas importan SOLO desde aquí (US27 cuadrícula por sección,
// US28 asignación de clases, US29 y US30 cruces de docente y de aula, US31 publicación por versiones, y el puerto
// que académico usa para no borrar cursos ni asignaciones con horario, US10 y US14).
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
export * as esquemasHorarios from "./schemas";
