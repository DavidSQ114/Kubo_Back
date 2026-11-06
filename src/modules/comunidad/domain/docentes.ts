// comunidad/domain: reglas puras del registro de docentes (US13, RF11).
import { erroresComunidad as E } from "./errores";
import { accionPerfil, type AccionPerfil } from "./vinculos";

/** Qué hacer con el perfil Docente de la persona del DNI: crearlo o reactivarlo. */
export type AccionPerfilDocente = AccionPerfil;

/**
 * Un DNI con perfil Docente activo no se registra otra vez (409).
 * Si la persona tiene otro perfil (administrador, apoderado…) o un perfil Docente inactivo, se le agrega o reactiva.
 */
export const accionPerfilDocente = (perfil: { activo: boolean } | null): AccionPerfilDocente =>
  accionPerfil(perfil, E.docenteExistente);

/** «987 654 321» → «987654321»: el teléfono se guarda solo con dígitos. */
export const normalizarTelefono = (telefono: string) => telefono.replace(/[\s-]/g, "");
