// AD-11 (M-01 Registrar pago manual) y AP-02 (modal «Pagar en línea»): selección de cuotas en el orden de pago de
// D-14. La matrícula pendiente va marcada y fija; una pensión solo se marca si las anteriores lo están y al desmarcar
// una se desmarcan las posteriores. El servidor valida igual (MATRICULA_PENDIENTE, CUOTAS_ANTERIORES_PENDIENTES).

export const AYUDA_ORDEN_CUOTAS =
  "Las cuotas se pagan en orden: primero la matrícula y luego las pensiones por fecha de vencimiento.";

export interface CuotaOrdenable {
  id: string;
  tipo: "MATRICULA" | "PENSION";
  /** «AAAA-MM-DD». */
  fechaVencimiento: string;
  /** false: pendiente pero no se puede elegir (por ejemplo, con un pago en revisión); bloquea las posteriores. */
  pagable: boolean;
}

/** Cuotas pendientes en orden de pago: la matrícula primero y luego por vencimiento. */
export function ordenarParaPago<T extends CuotaOrdenable>(cuotas: T[]): T[] {
  const peso = (c: T) => (c.tipo === "MATRICULA" ? 0 : 1);
  return [...cuotas].sort((a, b) => peso(a) - peso(b) || a.fechaVencimiento.localeCompare(b.fechaVencimiento));
}

/** La matrícula pendiente y pagable va siempre marcada. */
export const esFija = (c: CuotaOrdenable) => c.tipo === "MATRICULA" && c.pagable;

/** ¿Se puede marcar la cuota? Solo si todas las anteriores (en `orden`) son pagables y están marcadas. */
export function puedeMarcarse(orden: CuotaOrdenable[], elegidas: Set<string>, id: string) {
  const i = orden.findIndex((c) => c.id === id);
  if (i < 0 || !orden[i].pagable) return false;
  return orden.slice(0, i).every((c) => c.pagable && elegidas.has(c.id));
}

/**
 * Selección inicial: la matrícula pendiente y todas las cuotas hasta la última deseada (si se pide pagar noviembre,
 * se marcan también setiembre y octubre). Se detiene en la primera que no es pagable.
 */
export function seleccionEnOrden(orden: CuotaOrdenable[], deseadas: string[]): Set<string> {
  const ultima = Math.max(-1, ...deseadas.map((id) => orden.findIndex((c) => c.id === id)));
  const elegidas = new Set<string>();
  for (const [i, c] of orden.entries()) {
    if (!c.pagable) break;
    if (esFija(c) || i <= ultima) elegidas.add(c.id);
  }
  return elegidas;
}

/** Marca (si las anteriores están marcadas) o desmarca la cuota y todas las posteriores. La matrícula no se desmarca. */
export function alternarEnOrden(orden: CuotaOrdenable[], elegidas: Set<string>, id: string, marcar: boolean) {
  if (marcar) {
    return puedeMarcarse(orden, elegidas, id) ? new Set([...elegidas, id]) : elegidas;
  }
  const i = orden.findIndex((c) => c.id === id);
  if (i < 0 || esFija(orden[i])) return elegidas;
  const posteriores = new Set(orden.slice(i).map((c) => c.id));
  return new Set([...elegidas].filter((x) => !posteriores.has(x)));
}

/** Primera cuota pendiente que no se puede elegir (tiene un pago en revisión); null si no hay ninguna. */
export function cuotaEnRevision<T extends CuotaOrdenable>(orden: T[]): T | null {
  return orden.find((c) => !c.pagable) ?? null;
}

/** Cuotas que se pueden elegir: las anteriores a la primera en revisión (ninguna si es la matrícula). */
export function cuotasElegibles<T extends CuotaOrdenable>(orden: T[]): T[] {
  const i = orden.findIndex((c) => !c.pagable);
  return i < 0 ? orden : orden.slice(0, i);
}

/**
 * Aviso de AP-02 cuando una cuota tiene un pago en revisión y bloquea las siguientes:
 *   avisoEnRevision("Pensión de setiembre 2026") // «La pensión de setiembre 2026 tiene un pago en revisión. …»
 */
export const avisoEnRevision = (concepto: string) =>
  `La ${concepto.charAt(0).toLowerCase()}${concepto.slice(1)} tiene un pago en revisión. Las cuotas siguientes se podrán pagar cuando se confirme.`;
