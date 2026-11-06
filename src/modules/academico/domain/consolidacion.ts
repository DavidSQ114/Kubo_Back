// academico/domain: reglas de consolidación de logros (US12, RF10, AD-05). Funciones puras: las usa el cierre de
// bimestre del módulo de evaluación (US39) para calcular un logro a partir de varios.
import { erroresAcademico as E } from "./errores";

/** Escala de logros del CNEB, de mayor a menor jerarquía. */
export const LOGROS = ["AD", "A", "B", "C"] as const;
export type Logro = (typeof LOGROS)[number];

export const METODOS_CONSOLIDACION = ["MODA", "PONDERADO"] as const;
export type MetodoConsolidacion = (typeof METODOS_CONSOLIDACION)[number];

export const CRITERIOS_DESEMPATE = ["MAYOR_JERARQUIA", "MENOR_JERARQUIA", "ULTIMO_REGISTRO"] as const;
export type CriterioDesempate = (typeof CRITERIOS_DESEMPATE)[number];

/** Criterios que se configuran en AD-05 (ULTIMO_REGISTRO existe en el modelo, pero no se ofrece en US12). */
export const CRITERIOS_CONFIGURABLES = ["MAYOR_JERARQUIA", "MENOR_JERARQUIA"] as const satisfies CriterioDesempate[];

export const ESTADOS_REGLA = ["BORRADOR", "VIGENTE", "ARCHIVADA"] as const;
export type EstadoRegla = (typeof ESTADOS_REGLA)[number];

/** Valor numérico de cada logro en el promedio ponderado. */
export const VALOR_LOGRO: Record<Logro, number> = { AD: 4, A: 3, B: 2, C: 1 };

/**
 * Redondeo del promedio ponderado: al logro más cercano y, si queda justo a la mitad (x,5), hacia el logro
 * MAYOR. Ejemplo: 2,5 (entre B y A) → A. Así un estudiante a medio camino no baja de nivel.
 */
export const REDONDEO_PONDERADO = "MITAD_HACIA_ARRIBA";

/** Decimales que se conservan antes de redondear: evita que 2,4999999 (error de coma flotante) baje a B. */
const DECIMALES_PRECISION = 6;

export interface ReglaCalculo {
  metodo: MetodoConsolidacion;
  criterioDesempate: CriterioDesempate;
}

/** Configuración que se guarda con cada versión (columna configuracion): hace reproducible el cálculo. */
export function configuracionDeRegla(metodo: MetodoConsolidacion) {
  return metodo === "PONDERADO"
    ? { escala: VALOR_LOGRO, redondeo: REDONDEO_PONDERADO, pesos: "competencia_plan.peso" }
    : { escala: [...LOGROS] };
}

export const NOMBRE_METODO: Record<MetodoConsolidacion, string> = {
  MODA: "Moda de los logros",
  PONDERADO: "Promedio ponderado",
};

const jerarquia = (l: Logro) => LOGROS.length - LOGROS.indexOf(l); // AD = 4 … C = 1

/** Cuántas veces aparece cada logro (AD, A, B, C, en ese orden). */
export function frecuencias(logros: Logro[]): Record<Logro, number> {
  const conteo: Record<Logro, number> = { AD: 0, A: 0, B: 0, C: 0 };
  for (const l of logros) conteo[l] += 1;
  return conteo;
}

/** Logros que comparten la frecuencia más alta (más de uno = empate). */
export function logrosMasFrecuentes(logros: Logro[]): Logro[] {
  const conteo = frecuencias(logros);
  const maximo = Math.max(...Object.values(conteo));
  return LOGROS.filter((l) => conteo[l] === maximo && maximo > 0);
}

function desempatar(empatados: Logro[], logros: Logro[], criterio: CriterioDesempate): Logro {
  if (criterio === "ULTIMO_REGISTRO") {
    // el empatado que aparece más tarde en la lista (los logros llegan en orden cronológico)
    return [...logros].reverse().find((l) => empatados.includes(l))!;
  }
  const ordenados = [...empatados].sort((a, b) => jerarquia(b) - jerarquia(a));
  return criterio === "MAYOR_JERARQUIA" ? ordenados[0] : ordenados[ordenados.length - 1];
}

/** Moda: el logro que más se repite; si hay empate, decide el criterio de la regla. */
function porModa(logros: Logro[], criterio: CriterioDesempate): Logro {
  const empatados = logrosMasFrecuentes(logros);
  return empatados.length === 1 ? empatados[0] : desempatar(empatados, logros, criterio);
}

/** Pesos válidos: uno por logro y mayores a 0. Sin pesos (o todos null), todos pesan igual. */
function pesosEfectivos(cantidad: number, pesos?: (number | null)[]): number[] {
  if (!pesos || pesos.every((p) => p == null)) return Array<number>(cantidad).fill(1);
  if (pesos.length !== cantidad) throw E.pesosNoCorresponden();
  if (pesos.some((p) => p == null)) throw E.pesosIncompletos();
  if (pesos.some((p) => !Number.isFinite(p) || p! <= 0)) throw E.pesoInvalido();
  return pesos as number[];
}

/** Valor del promedio ponderado (de 1 a 4) → logro, con el redondeo de REDONDEO_PONDERADO. */
export function logroDeValor(valor: number): Logro {
  const factor = 10 ** DECIMALES_PRECISION;
  const redondeado = Math.floor(Math.round(valor * factor) / factor + 0.5);
  const acotado = Math.min(VALOR_LOGRO.AD, Math.max(VALOR_LOGRO.C, redondeado));
  return LOGROS.find((l) => VALOR_LOGRO[l] === acotado)!;
}

/** Promedio ponderado de los logros con AD=4, A=3, B=2 y C=1. */
export function promedioPonderado(logros: Logro[], pesos?: (number | null)[]): number {
  const efectivos = pesosEfectivos(logros.length, pesos);
  const total = efectivos.reduce((s, p) => s + p, 0);
  return logros.reduce((s, l, i) => s + VALOR_LOGRO[l] * efectivos[i], 0) / total;
}

/**
 * Consolida varios logros en uno según la regla vigente (US12). Los logros van en orden cronológico y
 * `pesos[i]` es el peso de `logros[i]` (CompetenciaPlan.peso); los pesos solo cuentan en PONDERADO.
 *   consolidarLogro(["AD", "A", "AD", "A"], { metodo: "MODA", criterioDesempate: "MAYOR_JERARQUIA" }) // "AD"
 *   consolidarLogro(["AD", "B"], { metodo: "PONDERADO", criterioDesempate: "MAYOR_JERARQUIA" }, [3, 1]) // "A" (3,5)
 * Sin logros lanza LOGROS_VACIOS.
 */
export function consolidarLogro(logros: Logro[], regla: ReglaCalculo, pesos?: (number | null)[]): Logro {
  if (logros.length === 0) throw E.logrosVacios();
  if (logros.some((l) => !LOGROS.includes(l))) throw E.logroInvalido();
  return regla.metodo === "MODA"
    ? porModa(logros, regla.criterioDesempate)
    : logroDeValor(promedioPonderado(logros, pesos));
}

// ---------- Versiones de la regla ----------

export interface PeriodoParaRegla {
  id: string;
  numero: number;
  /** FINALIZADO o con cierres de calificación cerrados o publicados. */
  cerrado: boolean;
}

/**
 * Bimestre desde el que rige una nueva versión. Si el año ya tiene bimestres, hay que elegir uno que no esté
 * cerrado; sin bimestres, rige desde el inicio del año (null).
 */
export function verificarRigeDesde(periodos: PeriodoParaRegla[], rigeDesdeId: string | null | undefined) {
  if (periodos.length === 0) return null;
  if (!rigeDesdeId) throw E.rigeDesdeRequerido();
  const elegido = periodos.find((p) => p.id === rigeDesdeId);
  if (!elegido) throw E.rigeDesdeInvalido();
  if (elegido.cerrado) throw E.rigeDesdeCerrado();
  return elegido.id;
}

const NUMERALES = ["I", "II", "III", "IV"];
const TOTAL_BIMESTRES = 4;

/**
 * Bimestres en que se aplica cada versión (columna «Aplicada a» del historial): desde su «rige desde» hasta antes
 * de que empiece una versión posterior. Devuelve, por versión, los números de bimestre.
 */
export function bimestresDeVersion(
  versiones: { version: number; rigeDesdeNumero: number | null }[],
  version: number,
): number[] {
  const numeros = Array.from({ length: TOTAL_BIMESTRES }, (_, i) => i + 1);
  return numeros.filter((n) => versionAplicable(versiones, n)?.version === version);
}

/** [3, 4] → «Desde Bimestre III»; [1, 2] → «Bimestres I y II»; [] → «Sin aplicar (reemplazada)». */
export function textoAlcance(numeros: number[]): string {
  if (numeros.length === 0) return "Sin aplicar (reemplazada)";
  if (numeros.length === TOTAL_BIMESTRES) return "Todo el año";
  const nombres = numeros.map((n) => NUMERALES[n - 1]);
  if (numeros[numeros.length - 1] === TOTAL_BIMESTRES) return `Desde Bimestre ${nombres[0]}`;
  if (nombres.length === 1) return `Bimestre ${nombres[0]}`;
  return `Bimestres ${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/**
 * Versión que se aplica a un bimestre: la más reciente cuyo «rige desde» es ese bimestre o uno anterior.
 * Las versiones sin «rige desde» valen desde el inicio del año. Para el cierre de notas (US39).
 */
export function versionAplicable<T extends { version: number; rigeDesdeNumero: number | null }>(
  versiones: T[],
  numeroBimestre: number,
): T | null {
  const aplicables = versiones.filter((v) => (v.rigeDesdeNumero ?? 1) <= numeroBimestre);
  return aplicables.sort((a, b) => b.version - a.version)[0] ?? null;
}
