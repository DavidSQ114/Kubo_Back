// academico/domain: montos de matrícula y pensión de cada año académico (requisito de US21, AD-10).
// Se guardan en parametro_institucion con el año (anio_academico_id) y como texto «350.00»: nunca como float.
import { erroresAcademico as E } from "./errores";
import type { EstadoAnio } from "./tipos";

/** Claves de parametro_institucion. Son las mismas del parámetro general del seed, pero por año. */
export const CLAVE_MONTO_MATRICULA = "MONTO_MATRICULA";
export const CLAVE_MONTO_PENSION = "MONTO_PENSION";

/** S/ 99 999.99: cabe en Decimal(10, 2) con holgura y evita montos absurdos por error de digitación. */
const MONTO_MAXIMO_CENTIMOS = 9_999_999;
const MONTO = /^(\d{1,7})(?:\.(\d{1,2}))?$/;

export interface MontosAnio {
  /** Cuota de matrícula, «350.00» (null si el año aún no la tiene). */
  montoMatricula: string | null;
  /** Cada pensión mensual, «450.00» (null si el año aún no la tiene). */
  montoPension: string | null;
}

/** «350» · «350.5» · «350.50» → 35050 céntimos. Lanza MONTO_INVALIDO si no es un monto positivo válido. */
export function aCentimos(monto: string): number {
  const m = MONTO.exec(monto.trim());
  if (!m) throw E.montoInvalido();
  const centimos = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (centimos <= 0 || centimos > MONTO_MAXIMO_CENTIMOS) throw E.montoInvalido();
  return centimos;
}

/** 35050 → «350.50». */
export const deCentimos = (centimos: number) =>
  `${Math.trunc(centimos / 100)}.${String(centimos % 100).padStart(2, "0")}`;

/** «350.5» → «350.50»: el formato con que se guarda y se muestra. */
export const normalizarMonto = (monto: string) => deCentimos(aCentimos(monto));

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
