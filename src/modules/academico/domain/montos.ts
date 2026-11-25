// academico/domain: montos de matrícula, pensión, cuota de ingreso y mora de cada año académico (requisito de US21,
// AD-10 y bloque M4).
// Se guardan en parametro_institucion con el año (anio_academico_id) y como texto «350.00»: nunca como float.
import { erroresAcademico as E } from "./errores";
import type { EstadoAnio } from "./tipos";

/** Claves de parametro_institucion. Son las mismas del parámetro general del seed, pero por año. */
export const CLAVE_MONTO_MATRICULA = "MONTO_MATRICULA";
export const CLAVE_MONTO_PENSION = "MONTO_PENSION";
/** Cuota de ingreso que paga una sola vez el alumno nuevo en el colegio (bloque M4). */
export const CLAVE_MONTO_INGRESO = "MONTO_INGRESO";
/** Mora: monto fijo que se cobra por cada pensión vencida (bloque M4). */
export const CLAVE_MONTO_MORA = "MONTO_MORA";

/** S/ 99 999.99: cabe en Decimal(10, 2) con holgura y evita montos absurdos por error de digitación. */
const MONTO_MAXIMO_CENTIMOS = 9_999_999;
const MONTO = /^(\d{1,7})(?:\.(\d{1,2}))?$/;

export interface MontosAnio {
  /** Cuota de matrícula, «350.00» (null si el año aún no la tiene). */
  montoMatricula: string | null;
  /** Cada pensión mensual, «450.00» (null si el año aún no la tiene). */
  montoPension: string | null;
  /** Cuota de ingreso del alumno nuevo, «500.00»; «0.00» o null si el año no la cobra (bloque M4). */
  montoIngreso: string | null;
  /** Mora por cada pensión vencida, «20.00»; «0.00» o null si el año no la cobra (bloque M4). */
  montoMora: string | null;
}

/** «350» · «350.5» · «350.50» → 35050 céntimos. Lanza MONTO_INVALIDO si no es un monto positivo válido. */
export function aCentimos(monto: string): number {
  const m = MONTO.exec(monto.trim());
  if (!m) throw E.montoInvalido();
  const centimos = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (centimos <= 0 || centimos > MONTO_MAXIMO_CENTIMOS) throw E.montoInvalido();
  return centimos;
}

/**
 * Como aCentimos, pero acepta 0: la cuota de ingreso y la mora son opcionales (con 0 no se generan).
 *   aCentimosOCero("0") // 0 · aCentimosOCero("20.5") // 2050
 */
export function aCentimosOCero(monto: string): number {
  if (/^0+(?:\.0{1,2})?$/.test(monto.trim())) return 0;
  return aCentimos(monto);
}

/** 35050 → «350.50». */
export const deCentimos = (centimos: number) =>
  `${Math.trunc(centimos / 100)}.${String(centimos % 100).padStart(2, "0")}`;

/** «350.5» → «350.50»: el formato con que se guarda y se muestra. */
export const normalizarMonto = (monto: string) => deCentimos(aCentimos(monto));

/** «0» → «0.00» · «20.5» → «20.50»: para los montos opcionales (ingreso y mora). */
export const normalizarMontoOpcional = (monto: string) => deCentimos(aCentimosOCero(monto));

/** Los montos de un año cerrado ya no cambian (su cronograma ya está generado). */
export function verificarMontosEditables(estado: EstadoAnio) {
  if (estado === "CERRADO") throw E.anioCerrado();
}

/** El valor guardado en el JSON del parámetro («"350.00"» o 350) como texto con dos decimales, o null. */
export function montoGuardado(valor: unknown): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  try {
    return normalizarMonto(String(valor));
  } catch {
    return null;
  }
}

/** Igual que montoGuardado, pero un 0 guardado se lee «0.00» (cuota de ingreso y mora). */
export function montoOpcionalGuardado(valor: unknown): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  try {
    return normalizarMontoOpcional(String(valor));
  } catch {
    return null;
  }
}
