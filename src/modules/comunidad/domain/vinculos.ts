// comunidad/domain: reglas puras de los perfiles Apoderado y Estudiante y de sus vínculos (US15, US17, RF12, RF13).
// El parentesco, el apoderado principal y la autorización pertenecen al vínculo (VinculoApoderado), no al apoderado.
import type { ErrorApp } from "@/platform/http/errores";
import { erroresComunidad as E } from "./errores";

export const PARENTESCOS = [
  "Madre",
  "Padre",
  "Abuela",
  "Abuelo",
  "Tía",
  "Tío",
  "Hermana",
  "Hermano",
  "Tutor legal",
  "Otro",
] as const;
export type Parentesco = (typeof PARENTESCOS)[number];

/** Qué hacer con un perfil (Docente, Apoderado, Estudiante) de la persona del DNI: crearlo o reactivarlo. */
export type AccionPerfil = "CREAR" | "REACTIVAR";

/**
 * Un perfil activo no se registra otra vez: se lanza el error del perfil (409). Si la persona no lo tiene, se crea;
 * si lo tiene inactivo, se reactiva. Los demás perfiles de la persona no importan (se agrega sin duplicar datos).
 */
export function accionPerfil(perfil: { activo: boolean } | null, errorSiExiste: () => ErrorApp): AccionPerfil {
  if (perfil?.activo) throw errorSiExiste();
  return perfil ? "REACTIVAR" : "CREAR";
}

export interface VinculoPropuesto {
  apoderadoId: string;
  esPrincipal: boolean;
}

/**
 * Apoderados de un estudiante nuevo (US17): al menos uno, sin repetir y exactamente uno principal.
 *   verificarVinculosIniciales([{ apoderadoId: "a1", esPrincipal: true }]); // ok
 */
export function verificarVinculosIniciales(vinculos: VinculoPropuesto[]) {
  if (!vinculos.length) throw E.sinApoderado();
  if (new Set(vinculos.map((v) => v.apoderadoId)).size !== vinculos.length) throw E.apoderadoRepetido();
  if (vinculos.filter((v) => v.esPrincipal).length !== 1) throw E.principalInvalido();
}

export interface VinculoActual {
  id: string;
  apoderadoId: string;
  esPrincipal: boolean;
}

export interface PlanVinculo {
  /** El nuevo vínculo queda como principal. */
  esPrincipal: boolean;
  /** Vínculo que deja de ser principal para que siga habiendo uno solo (null si no cambia ninguno). */
  quitarPrincipalA: string | null;
}

/**
 * Vincular un apoderado más a un estudiante que ya tiene vínculos (US15 «Vincular a un estudiante»).
 * No se repite el apoderado (409). Si el nuevo es principal, el anterior deja de serlo; si el estudiante no tenía
 * principal, el nuevo lo es aunque no se haya marcado. Así siempre queda exactamente uno.
 */
export function planVinculoNuevo(actuales: VinculoActual[], nuevo: VinculoPropuesto): PlanVinculo {
  if (actuales.some((v) => v.apoderadoId === nuevo.apoderadoId)) throw E.vinculoExistente();
  const principal = actuales.find((v) => v.esPrincipal) ?? null;
  if (!principal) return { esPrincipal: true, quitarPrincipalA: null };
  if (!nuevo.esPrincipal) return { esPrincipal: false, quitarPrincipalA: null };
  return { esPrincipal: true, quitarPrincipalA: principal.id };
}

/** Estudiantes que se vinculan al registrar un apoderado (US15): sin repetir. */
export function verificarEstudiantesSinRepetir(estudianteIds: string[]) {
  if (new Set(estudianteIds).size !== estudianteIds.length) throw E.estudianteRepetido();
}

/**
 * Al agregar un perfil a una persona ya registrada solo se completan los datos que le faltan: nunca se
 * reemplaza lo registrado (sin duplicar ni pisar sus datos personales, US15).
 *   datosFaltantes({ telefono: null, email: "a@b.pe" }, { telefono: "987654321", email: "c@d.pe" })
 *   // → { telefono: "987654321" }
 */
export function datosFaltantes<T extends Record<string, unknown>>(
  registrados: { [K in keyof T]?: unknown },
  enviados: T,
): Partial<T> {
  const faltantes: Partial<T> = {};
  for (const clave of Object.keys(enviados) as (keyof T)[]) {
    const valor = enviados[clave];
    if (valor != null && valor !== "" && registrados[clave] == null) faltantes[clave] = valor;
  }
  return faltantes;
}

/** Una fecha AAAA-MM-DD (de un campo date) como Date en UTC a medianoche, para columnas @db.Date. */
export const fechaSinHora = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);
