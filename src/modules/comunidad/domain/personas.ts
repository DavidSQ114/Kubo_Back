// comunidad/domain: reglas puras para registrar perfiles sobre una persona que ya existe (defecto D-07, AD-07).
// Las usan el registro de docentes (US13) y, en el bloque 2, el de apoderados y estudiantes.
import { erroresComunidad as E } from "./errores";

/** «  José  María » → «jose maria»: sin tildes, en minúsculas y con un solo espacio entre palabras. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export interface NombrePersona {
  nombres: string;
  apellidos: string;
}

/** Mismos nombres y apellidos, sin distinguir mayúsculas, tildes ni espacios de más. */
export const mismaPersona = (registrada: NombrePersona, enviada: NombrePersona) =>
  normalizarNombre(registrada.nombres) === normalizarNombre(enviada.nombres) &&
  normalizarNombre(registrada.apellidos) === normalizarNombre(enviada.apellidos);

/**
 * El DNI ya está registrado: los nombres enviados deben ser los de la persona registrada. Si no, es probable que
 * el DNI esté mal escrito (409 PERSONA_NO_COINCIDE) y no se le agrega el perfil a otra persona.
 */
export function verificarMismaPersona(registrada: NombrePersona, enviada: NombrePersona) {
  if (!mismaPersona(registrada, enviada)) {
    throw E.personaNoCoincide(`${registrada.nombres} ${registrada.apellidos}`);
  }
}
