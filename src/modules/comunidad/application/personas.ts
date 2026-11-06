// comunidad/application: búsqueda de una persona por DNI antes de registrarle un perfil (defecto D-07, AD-07).
// Reutilizable: el registro de apoderados y estudiantes (bloque 2) usará buscarPersonaPorDni y personaParaPerfil.
import type { Tx } from "@/platform/db/tipos";
import type { Rol } from "@/modules/identidad";
import { verificarMismaPersona } from "../domain/personas";
import { personas, rolesActivos } from "../infrastructure/repositorio";

export interface PersonaEncontrada {
  personaId: string;
  dni: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  /** Correo de la persona o, si no tiene, el de su cuenta. null si no tiene ninguno. */
  email: string | null;
  /** Perfiles activos: «Apoderado, Administrador». */
  perfiles: Rol[];
  /** Tiene cuenta para ingresar al sistema. */
  tieneCuenta: boolean;
}

/** Persona registrada con ese DNI, con sus perfiles activos, o null si el DNI es nuevo. */
export async function buscarPersonaPorDni(dni: string): Promise<PersonaEncontrada | null> {
  const p = await personas.detallePorDni(dni);
  if (!p) return null;
  return {
    personaId: p.id,
    dni: p.dni,
    nombres: p.nombres,
    apellidos: p.apellidos,
    nombreCompleto: `${p.nombres} ${p.apellidos}`,
    email: p.email ?? p.usuario?.email ?? null,
    perfiles: rolesActivos(p),
    tieneCuenta: Boolean(p.usuario),
  };
}

/**
 * Dentro de la transacción de un registro: la persona del DNI si ya existe (verificando que los nombres
 * coincidan, 409 PERSONA_NO_COINCIDE) o null para que el registro la cree. No cambia los datos de la existente.
 *   const existente = await personaParaPerfil(tx, datos); // datos: { dni, nombres, apellidos }
 */
export async function personaParaPerfil(tx: Tx, datos: { dni: string; nombres: string; apellidos: string }) {
  const existente = await personas.porDni(datos.dni, tx);
  if (existente) verificarMismaPersona(existente, datos);
  return existente;
}
