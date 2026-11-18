// comunidad: interfaz pública (usuarios y administradores RF46, docentes US13, búsqueda de personas por DNI D-07,
// apoderados US15, estudiantes US17 y sus vínculos, edición y baja de personas US69 y acceso del alumno al portal
// US49) y los correos de los administradores para el aviso del cierre de notas (US39).
export {
  listarUsuarios,
  resumenUsuarios,
  registrarAdministrador,
  contactosDeAdministradores,
  type UsuarioListado,
  type ContactoAdministrador,
} from "./application/usuarios";
export { perfilesProviderComunidad } from "./infrastructure/perfilesProvider";
export * as esquemasComunidad from "./schemas";
export {
  listarDocentesActivos,
  registrarDocente,
  contactosDeDocentes,
  type DatosDocente,
  type ContactoDocente,
} from "./application/docentes";
export { buscarPersonaPorDni, personaParaPerfil, type PersonaEncontrada } from "./application/personas";
export { docentesProviderComunidad } from "./infrastructure/docentesProvider";
export { personasProviderComunidad } from "./infrastructure/personasProvider";
export { PARENTESCOS, type Parentesco } from "./domain/vinculos";
export {
  buscarApoderados,
  registrarApoderado,
  type ApoderadoListado,
  type DatosApoderado,
} from "./application/apoderados";
export {
  buscarEstudiantes,
  registrarEstudiante,
  type EstudianteListado,
  type DatosEstudiante,
} from "./application/estudiantes";
export { vincularApoderado, type DatosVinculo } from "./application/vinculos";
export {
  crearAccesoAlumno,
  estudianteDePersona,
  type DatosAccesoAlumno,
  type EstudianteEnSesion,
} from "./application/accesoAlumno";
export {
  estudianteParaMatricula,
  estudianteParaFicha,
  estudiantesVinculadosAPersona,
  contactosDeAsistencia,
  nombresDeUsuarios,
  responsablesDeVinculos,
  resumenEstudiantes,
  idsEstudiantesPorBusqueda,
  type ApoderadoDelEstudiante,
  type ContactoDeAsistencia,
  type EstudianteParaMatricula,
  type EstudianteResumen,
  type EstudianteFicha,
  type EstudianteVinculado,
  type ApoderadoFicha,
  type NombreUsuario,
  type ResponsableDePago,
} from "./application/estudiantesMatricula";
export {
  detallePersona,
  editarPersona,
  historialPersona,
  eliminarPersona,
  type DetallePersona,
  type DatosEdicion,
  type EventoHistorial,
} from "./application/edicionPersonas";
export {
  configurarMatriculaBorradorProvider,
  configurarRegistrosMatriculaProvider,
  type MatriculaBorrador,
  type MatriculaBorradorProvider,
  type RegistrosMatriculaProvider,
} from "./puertos";
