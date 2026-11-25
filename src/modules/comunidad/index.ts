// comunidad: interfaz pública (usuarios, administradores RF46 y coordinadores académicos M1, docentes US13, búsqueda de personas por DNI D-07,
// apoderados US15, estudiantes US17 y sus vínculos, edición y baja de personas US69 y acceso del alumno al portal
// US49), los correos de los administradores para el aviso del cierre de notas (US39) y las personas que reciben las
// notificaciones internas (US55), y los vínculos del detalle de una persona (D-12).
export {
  listarUsuarios,
  resumenUsuarios,
  registrarAdministrador,
  registrarCoordinador,
  contactosDeAdministradores,
  personasDeAdministradores,
  contactosDeCoordinadores,
  personasDeCoordinadores,
  type UsuarioListado,
  type DatosPerfilGestion,
  type ContactoAdministrador,
  type ContactoCoordinador,
} from "./application/usuarios";
export { perfilesProviderComunidad } from "./infrastructure/perfilesProvider";
export * as esquemasComunidad from "./schemas";
export {
  listarDocentesActivos,
  personalDocente,
  registrarDocente,
  contactosDeDocentes,
  personasDeDocentes,
  type DatosDocente,
  type ContactoDocente,
  type DocenteDelPersonal,
} from "./application/docentes";
export { buscarPersonaPorDni, personaParaPerfil, type PersonaEncontrada } from "./application/personas";
export { enmascararDni } from "./domain/edicion";
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
export { vinculosDePersona, type VinculoDePersona, type VinculosDePersona } from "./application/vinculosPersona";
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
  apoderadosDeEstudiantes,
  nombresDeUsuarios,
  responsablesDeVinculos,
  resumenEstudiantes,
  idsEstudiantesPorBusqueda,
  type ApoderadoDelEstudiante,
  type ContactoDeAsistencia,
  type ApoderadosDeEstudiante,
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
  type MatriculaReciente,
} from "./puertos";
