// comunidad: interfaz pública (usuarios y administradores RF46, docentes US13, búsqueda de personas por DNI D-07,
// apoderados US15, estudiantes US17 y sus vínculos).
export { listarUsuarios, resumenUsuarios, registrarAdministrador, type UsuarioListado } from "./application/usuarios";
export { perfilesProviderComunidad } from "./infrastructure/perfilesProvider";
export * as esquemasComunidad from "./schemas";
export { listarDocentesActivos, registrarDocente, type DatosDocente } from "./application/docentes";
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
  estudianteParaMatricula,
  resumenEstudiantes,
  idsEstudiantesPorBusqueda,
  type ApoderadoDelEstudiante,
  type EstudianteParaMatricula,
  type EstudianteResumen,
} from "./application/estudiantesMatricula";
export { configurarMatriculaBorradorProvider, type MatriculaBorrador, type MatriculaBorradorProvider } from "./puertos";
