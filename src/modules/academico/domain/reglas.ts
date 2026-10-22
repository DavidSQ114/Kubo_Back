// academico/domain: reglas puras del año académico (US06) y de sus periodos de evaluación (US07).
import { erroresAcademico as E } from "./errores";
import { ESTADOS_ANIO, type EstadoAnio, type EstadoPeriodo, type RangoFechas } from "./tipos";

export const CANTIDAD_BIMESTRES = 4;
const NUMERALES_BIMESTRE = ["I", "II", "III", "IV"] as const;
const ZONA_COLEGIO = "America/Lima";

export interface AnioExistente extends RangoFechas {
  id: string;
  estado: EstadoAnio;
}

export interface PeriodoEntrada extends RangoFechas {
  numero: number;
}

export interface PeriodoGuardado extends PeriodoEntrada {
  estado: EstadoPeriodo;
}

/** "Bimestre I" … "Bimestre IV". */
export const nombreBimestre = (numero: number) => `Bimestre ${NUMERALES_BIMESTRE[numero - 1] ?? numero}`;

/** Día del calendario en Lima ("AAAA-MM-DD") de un instante. El formato en-CA da justo AAAA-MM-DD. */
export function fechaEnLima(instante: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_COLEGIO }).format(instante);
}

export const tieneFechasValidas = (r: RangoFechas) => r.fechaFin > r.fechaInicio;

/** Rangos inclusivos: compartir un solo día ya es solaparse. */
export const seSolapan = (a: RangoFechas, b: RangoFechas) => a.fechaInicio <= b.fechaFin && b.fechaInicio <= a.fechaFin;

export const contiene = (exterior: RangoFechas, interior: RangoFechas) =>
  interior.fechaInicio >= exterior.fechaInicio && interior.fechaFin <= exterior.fechaFin;

// ---------- Año académico (US06) ----------

/** Todo año nace PLANIFICADO; la matrícula se abre después (EN_MATRICULA). */
export const ESTADO_INICIAL_ANIO: EstadoAnio = "PLANIFICADO";

/** Fechas del año válidas y sin chocar con otro año que siga abierto (los CERRADO no cuentan). */
export function verificarRangoAnio(rango: RangoFechas, otros: AnioExistente[], exceptoId?: string) {
  if (!tieneFechasValidas(rango)) throw E.fechasInvalidas();
  const choca = otros.some((o) => o.id !== exceptoId && o.estado !== "CERRADO" && seSolapan(rango, o));
  if (choca) throw E.anioSolapado();
}

/** Los estados solo avanzan, de uno en uno: PLANIFICADO → EN_MATRICULA → EN_CURSO → EN_CIERRE → CERRADO. */
export function siguienteEstado(estado: EstadoAnio): EstadoAnio | null {
  return ESTADOS_ANIO[ESTADOS_ANIO.indexOf(estado) + 1] ?? null;
}

export function verificarTransicion(actual: EstadoAnio, destino: EstadoAnio) {
  if (siguienteEstado(actual) !== destino) throw E.transicionNoPermitida(actual, destino);
}

/** El año se cierra solo si hay cierres de calificación y todos están publicados. */
export const puedeCerrarse = (cierres: { total: number; publicados: number }) =>
  cierres.total > 0 && cierres.publicados === cierres.total;

// ---------- Periodos de evaluación (US07) ----------

/** Los 4 bimestres juntos: numerados del 1 al 4, con fechas válidas, dentro del año y sin solaparse. */
export function verificarPeriodos(anio: RangoFechas, periodos: PeriodoEntrada[]) {
  const numeros = new Set(periodos.map((p) => p.numero));
  const completos =
    periodos.length === CANTIDAD_BIMESTRES &&
    numeros.size === CANTIDAD_BIMESTRES &&
    [...numeros].every((n) => Number.isInteger(n) && n >= 1 && n <= CANTIDAD_BIMESTRES);
  if (!completos) throw E.periodosIncompletos();

  const ordenados = [...periodos].sort((a, b) => a.numero - b.numero);
  for (const p of ordenados) {
    if (!tieneFechasValidas(p)) throw E.periodoFechasInvalidas(nombreBimestre(p.numero));
    if (!contiene(anio, p)) throw E.periodoFueraDelAnio(nombreBimestre(p.numero), anio);
  }
  const haySolapamiento = ordenados.some((p, i) => ordenados.slice(i + 1).some((q) => seSolapan(p, q)));
  if (haySolapamiento) throw E.periodosSolapados();
}

/** Un bimestre FINALIZADO no se edita: sus fechas deben llegar iguales. */
export function verificarCambiosPermitidos(guardados: PeriodoGuardado[], nuevos: PeriodoEntrada[]) {
  for (const g of guardados) {
    const n = nuevos.find((p) => p.numero === g.numero);
    const cambia = n !== undefined && (n.fechaInicio !== g.fechaInicio || n.fechaFin !== g.fechaFin);
    if (g.estado === "FINALIZADO" && cambia) throw E.periodoFinalizado(nombreBimestre(g.numero));
  }
}

/** Bimestre cuyo rango incluye el día indicado y que aún no está finalizado (registro de notas). */
export function buscarPeriodoVigente<T extends PeriodoGuardado>(periodos: T[], dia: string): T | null {
  return periodos.find((p) => p.estado !== "FINALIZADO" && p.fechaInicio <= dia && dia <= p.fechaFin) ?? null;
}
