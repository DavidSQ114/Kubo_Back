// matricula/domain: reglas puras de los datos de demostración de morosidad (US24, US26, US59) que prepara
// scripts/demoMorosidad.ts. Solo para datos ficticios (RNF14). Fechas «AAAA-MM-DD» y montos en céntimos enteros.
import { diaVencimientoValido, generarCronograma, type CuotaCronograma } from "./cronograma";
import { erroresMatricula as E } from "./errores";
import { estaVencida } from "./morosidad";

/** Fecha de matrícula que se usa si no se indica --desde: deja vencidas las pensiones de setiembre en adelante. */
export const FECHA_DEMO_POR_DEFECTO = "2026-09-01";

export interface CuotaExistente {
  tipo: "MATRICULA" | "PENSION";
  mes: number | null;
  montoCentimos: number;
  fechaVencimiento: string;
}

/**
 * La matrícula admite el ajuste si no está retirada ni anulada, ninguna cuota tiene pagos y la fecha nueva es del
 * mismo año y no posterior a la actual (solo se adelanta: así una segunda ejecución no cambia nada).
 */
export function verificarAjusteDemo(d: {
  estado: string;
  fechaMatricula: string;
  pagos: number;
  anio: number;
  desde: string;
}) {
  if (d.estado === "RETIRADO" || d.estado === "ANULADO") throw E.demoMatriculaNoVigente(d.estado);
  if (d.pagos > 0) throw E.demoCuotasConPagos(d.pagos);
  if (!d.desde.startsWith(`${d.anio}-`)) throw E.demoFechaFueraDelAnio(d.anio);
  if (d.desde > d.fechaMatricula) throw E.demoFechaPosterior(d.fechaMatricula);
}

/** Día de vencimiento y monto de las pensiones que ya tiene la matrícula; null si no tiene ninguna. */
export function referenciaPension(existentes: CuotaExistente[]): { dia: number; montoCentimos: number } | null {
  const pension = existentes.find((c) => c.tipo === "PENSION");
  if (!pension) return null;
  return { dia: diaVencimientoValido(pension.fechaVencimiento.slice(8, 10)), montoCentimos: pension.montoCentimos };
}

/**
 * Pensiones que generarCronograma daría con la fecha de matrícula nueva y que la matrícula aún no tiene (por mes).
 * No toca las existentes ni la cuota de matrícula.
 *   pensionesFaltantes({ anio: 2026, desde: "2026-09-01", dia: 5, montoCentimos: 40000, existentes }) // set., oct., nov.
 */
export function pensionesFaltantes(d: {
  anio: number;
  desde: string;
  dia: number;
  montoCentimos: number;
  existentes: CuotaExistente[];
}): CuotaCronograma[] {
  const meses = new Set(d.existentes.filter((c) => c.tipo === "PENSION").map((c) => c.mes));
  return generarCronograma({
    anio: d.anio,
    fechaMatricula: d.desde,
    montoMatriculaCentimos: 0,
    montoPensionCentimos: d.montoCentimos,
    diaVencimiento: d.dia,
  }).filter((c) => c.tipo === "PENSION" && !meses.has(c.mes));
}

/** Pensiones Pendiente con vencimiento anterior a hoy (la misma regla del panel de morosidad). */
export const pensionesVencidas = (cuotas: { tipo: string; estado: string; fechaVencimiento: string }[], hoy: string) =>
  cuotas.filter((c) => c.tipo === "PENSION" && estaVencida(c, hoy)).length;

/**
 * D-14: la cuota de matrícula vence el día de la matrícula (como en generarCronograma). Devuelve el vencimiento
 * actual si hay que moverlo a `desde`, o null si ya coincide o la matrícula no tiene esa cuota.
 */
export function vencimientoMatriculaAMover(existentes: CuotaExistente[], desde: string): string | null {
  const cuota = existentes.find((c) => c.tipo === "MATRICULA");
  return cuota && cuota.fechaVencimiento !== desde ? cuota.fechaVencimiento : null;
}
