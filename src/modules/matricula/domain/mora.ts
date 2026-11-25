// matricula/domain: mora de las pensiones vencidas (bloque M4). La tarea programada genera una cuota MORA por cada
// pensión Pendiente vencida que todavía no la tiene, con el monto fijo del año y vencimiento hoy. El coordinador puede
// condonar una mora pendiente. Montos en céntimos enteros; fechas «AAAA-MM-DD» (día de Lima).
import { erroresMatricula as E } from "./errores";
import { estaVencida } from "./morosidad";

/** Largo máximo del motivo de condonación o anulación de una cuota. */
export const LARGO_MAXIMO_MOTIVO_CUOTA = 200;

export interface PensionParaMora {
  id: string;
  matriculaId: string;
  tipo: string;
  mes: number | null;
  concepto: string;
  estado: string;
  fechaVencimiento: string;
  /** true si la pensión ya tiene su mora (en cualquier estado: una condonada no se vuelve a generar). */
  tieneMora: boolean;
}

export interface MoraNueva {
  cuotaOrigenId: string;
  matriculaId: string;
  mes: number | null;
  concepto: string;
  montoCentimos: number;
  fechaVencimiento: string;
}

/** «Pensión de setiembre 2026» → «Mora de la pensión de setiembre 2026». */
export const conceptoMora = (conceptoPension: string) =>
  `Mora de la ${conceptoPension.charAt(0).toLowerCase()}${conceptoPension.slice(1)}`;

/**
 * Moras que faltan generar: una por cada pensión Pendiente vencida (mismo criterio del panel de morosidad, US24) que
 * todavía no tiene mora. Con el monto de mora en 0 no genera ninguna.
 *   morasPorGenerar([pensionSetiembre], 2000, "2026-09-06") // [{ concepto: "Mora de la pensión de setiembre 2026", … }]
 */
export function morasPorGenerar(pensiones: PensionParaMora[], montoCentimos: number, hoy: string): MoraNueva[] {
  if (montoCentimos <= 0) return [];
  return pensiones
    .filter((p) => p.tipo === "PENSION" && !p.tieneMora && estaVencida(p, hoy))
    .map((p) => ({
      cuotaOrigenId: p.id,
      matriculaId: p.matriculaId,
      mes: p.mes,
      concepto: conceptoMora(p.concepto),
      montoCentimos,
      fechaVencimiento: hoy,
    }));
}

/** Solo se condona una mora Pendiente: una pagada o ya anulada, no. */
export function verificarMoraCondonable(cuota: { tipo: string; estado: string }) {
  if (cuota.tipo !== "MORA") throw E.cuotaNoEsMora();
  if (cuota.estado === "PAGADO") throw E.moraPagada();
  if (cuota.estado === "ANULADO") throw E.moraYaCondonada();
}

/** El motivo es obligatorio y se guarda sin espacios sobrantes. */
export function motivoValido(motivo: string | null | undefined): string {
  const limpio = (motivo ?? "").trim().replace(/\s+/g, " ");
  if (!limpio) throw E.motivoRequerido();
  return limpio.slice(0, LARGO_MAXIMO_MOTIVO_CUOTA);
}
