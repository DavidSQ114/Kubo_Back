// identidad/puertos: lo que identidad necesita de módulos superiores, sin importarlos.
// comunidad implementa PerfilesProvider y src/server/wiring.ts lo conecta al arrancar.
import type { Rol } from "./domain/reglas";

export interface DatosPersona {
  personaId: string;
  nombres: string;
  apellidos: string;
}

export interface PerfilesProvider {
  /** Perfiles activos de una persona (Administrador, Docente, Apoderado, Alumno). */
  perfilesActivos(personaId: string): Promise<Rol[]>;
  /** Nombre para mostrar en la barra superior. */
  datosPersona(personaId: string): Promise<DatosPersona | null>;
}

let perfiles: PerfilesProvider | null = null;

export function configurarPerfilesProvider(p: PerfilesProvider) {
  perfiles = p;
}

export function perfilesProvider(): PerfilesProvider {
  if (!perfiles) {
    throw new Error("PerfilesProvider no configurado: falta importar '@/server/wiring' en la ruta");
  }
  return perfiles;
}
