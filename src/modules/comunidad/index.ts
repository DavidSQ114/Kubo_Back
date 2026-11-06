// comunidad: interfaz pública (usuarios y administradores RF46, docentes US13, búsqueda de personas por DNI D-07).
export { listarUsuarios, resumenUsuarios, registrarAdministrador, type UsuarioListado } from "./application/usuarios";
export { perfilesProviderComunidad } from "./infrastructure/perfilesProvider";
export * as esquemasComunidad from "./schemas";
export { listarDocentesActivos, registrarDocente, type DatosDocente } from "./application/docentes";
export { buscarPersonaPorDni, personaParaPerfil, type PersonaEncontrada } from "./application/personas";
export { docentesProviderComunidad } from "./infrastructure/docentesProvider";
export { personasProviderComunidad } from "./infrastructure/personasProvider";
