// AD-11 (M-01 Registrar pago manual) y AP-02 (modal «Pagar en línea»): selección de cuotas en el orden de pago de
// D-14, extendido en el bloque M4. Las cuotas se agrupan: el inicio (matrícula y cuota de ingreso, juntas), cada
// pensión con su mora (juntas) y las libres (extraordinarias y moras cuya pensión ya no está pendiente). Los grupos de
// la cadena (inicio y pensiones) se marcan en orden: uno solo si los anteriores están marcados, y al desmarcar uno se
// desmarcan los posteriores. Las libres se marcan cuando se quiera. El servidor valida igual (MATRICULA_PENDIENTE,
// INGRESO_CON_MATRICULA, CUOTAS_ANTERIORES_PENDIENTES, MORA_CON_PENSION).

export const AYUDA_ORDEN_CUOTAS =
  "Las cuotas se pagan en orden: primero la matrícula (con la cuota de ingreso, si la hay) y luego las pensiones por " +
  "fecha de vencimiento, cada una con su mora. Las cuotas extraordinarias se pagan en cualquier momento.";

/** Tipos de cuota de la API (concepto_cobro.tipo). INGRESO, MORA y EXTRAORDINARIA: bloque M4. */
export type TipoCuota = "MATRICULA" | "PENSION" | "INGRESO" | "MORA" | "EXTRAORDINARIA";

export interface CuotaOrdenable {
  id: string;
  tipo: TipoCuota;
  /** «AAAA-MM-DD». */
  fechaVencimiento: string;
  /** false: pendiente pero no se puede elegir (por ejemplo, con un pago en revisión); bloquea las posteriores. */
  pagable: boolean;
  /** Bloque M4: en una MORA, la pensión que la originó. */
  cuotaOrigenId?: string | null;
}

interface Grupo<T> {
  cuotas: T[];
  /** true: inicio o pensión (van en orden); false: libre. */
  enCadena: boolean;
}

const esInicio = (c: CuotaOrdenable) => c.tipo === "MATRICULA" || c.tipo === "INGRESO";
const porVencimiento = (a: CuotaOrdenable, b: CuotaOrdenable) => a.fechaVencimiento.localeCompare(b.fechaVencimiento);

/** Grupos de pago en orden: inicio, cada pensión con su mora (por vencimiento) y al final las libres. */
function grupos<T extends CuotaOrdenable>(cuotas: T[]): Grupo<T>[] {
  const ids = new Set(cuotas.map((c) => c.id));
  const conPension = (c: T) => c.tipo === "MORA" && Boolean(c.cuotaOrigenId && ids.has(c.cuotaOrigenId));
  const moraDe = new Map(cuotas.filter(conPension).map((c) => [c.cuotaOrigenId!, c]));
  const inicio = cuotas.filter(esInicio).sort((a, b) => Number(a.tipo === "INGRESO") - Number(b.tipo === "INGRESO"));
  const pensiones = cuotas.filter((c) => c.tipo === "PENSION").sort(porVencimiento);
  const libres = cuotas.filter((c) => c.tipo === "EXTRAORDINARIA" || (c.tipo === "MORA" && !conPension(c)));
  return [
    ...(inicio.length ? [{ cuotas: inicio, enCadena: true }] : []),
    ...pensiones.map((p) => ({ cuotas: moraDe.has(p.id) ? [p, moraDe.get(p.id)!] : [p], enCadena: true })),
    ...libres.sort(porVencimiento).map((c) => ({ cuotas: [c], enCadena: false })),
  ];
}

const grupoDe = <T extends CuotaOrdenable>(lista: Grupo<T>[], id: string) =>
  lista.findIndex((g) => g.cuotas.some((c) => c.id === id));
const pagableEntero = (g: Grupo<CuotaOrdenable>) => g.cuotas.every((c) => c.pagable);

/** Cuotas pendientes en orden de pago: la matrícula y el ingreso, las pensiones (con su mora) y las libres. */
export function ordenarParaPago<T extends CuotaOrdenable>(cuotas: T[]): T[] {
  return grupos(cuotas).flatMap((g) => g.cuotas);
}

/** ¿Se puede marcar la cuota? Su grupo debe ser pagable y, si va en la cadena, los grupos anteriores marcados. */
export function puedeMarcarse(orden: CuotaOrdenable[], elegidas: Set<string>, id: string) {
  const lista = grupos(orden);
  const i = grupoDe(lista, id);
  if (i < 0 || !pagableEntero(lista[i])) return false;
  if (!lista[i].enCadena) return true;
  return lista
    .slice(0, i)
    .filter((g) => g.enCadena)
    .every((g) => pagableEntero(g) && g.cuotas.every((c) => elegidas.has(c.id)));
}

/**
 * Selección inicial: el inicio (matrícula e ingreso) pendiente y todos los grupos de la cadena hasta el último
 * deseado (si se pide pagar noviembre, se marcan también setiembre y octubre, con sus moras), más las libres pedidas.
 * La cadena se detiene en el primer grupo que no es pagable.
 */
export function seleccionEnOrden(orden: CuotaOrdenable[], deseadas: string[]): Set<string> {
  const lista = grupos(orden);
  const cadena = lista.filter((g) => g.enCadena);
  const ultima = Math.max(-1, ...deseadas.map((id) => grupoDe(cadena, id)));
  const elegidas = new Set<string>();
  for (const [i, g] of cadena.entries()) {
    if (!pagableEntero(g)) break;
    if (i <= ultima || g.cuotas.some(esInicio)) g.cuotas.forEach((c) => elegidas.add(c.id));
  }
  for (const g of lista.filter((x) => !x.enCadena && pagableEntero(x))) {
    if (g.cuotas.some((c) => deseadas.includes(c.id))) g.cuotas.forEach((c) => elegidas.add(c.id));
  }
  return elegidas;
}

/** Marca (si se puede) o desmarca el grupo de la cuota; en la cadena, desmarcar quita también los posteriores. */
export function alternarEnOrden(orden: CuotaOrdenable[], elegidas: Set<string>, id: string, marcar: boolean) {
  const lista = grupos(orden);
  const i = grupoDe(lista, id);
  if (i < 0) return elegidas;
  if (marcar) {
    return puedeMarcarse(orden, elegidas, id) ? new Set([...elegidas, ...lista[i].cuotas.map((c) => c.id)]) : elegidas;
  }
  const quitar = new Set(
    (lista[i].enCadena ? lista.slice(i).filter((g) => g.enCadena) : [lista[i]]).flatMap((g) =>
      g.cuotas.map((c) => c.id),
    ),
  );
  return new Set([...elegidas].filter((x) => !quitar.has(x)));
}

/** Primera cuota de la cadena que no se puede elegir (tiene un pago en revisión); null si no hay ninguna. */
export function cuotaEnRevision<T extends CuotaOrdenable>(orden: T[]): T | null {
  for (const g of grupos(orden).filter((x) => x.enCadena)) {
    const c = g.cuotas.find((x) => !x.pagable);
    if (c) return c;
  }
  return null;
}

/** Cuotas que se pueden elegir: los grupos de la cadena anteriores al primero en revisión y las libres pagables. */
export function cuotasElegibles<T extends CuotaOrdenable>(orden: T[]): T[] {
  const lista = grupos(orden);
  const cadena = lista.filter((g) => g.enCadena);
  const corte = cadena.findIndex((g) => !pagableEntero(g));
  const enCadena = (corte < 0 ? cadena : cadena.slice(0, corte)).flatMap((g) => g.cuotas);
  const libres = lista.filter((g) => !g.enCadena && pagableEntero(g)).flatMap((g) => g.cuotas);
  return [...enCadena, ...libres];
}

/**
 * Aviso de AP-02 cuando una cuota tiene un pago en revisión y bloquea las siguientes:
 *   avisoEnRevision("Pensión de setiembre 2026") // «La pensión de setiembre 2026 tiene un pago en revisión. …»
 */
export const avisoEnRevision = (concepto: string) =>
  `La ${concepto.charAt(0).toLowerCase()}${concepto.slice(1)} tiene un pago en revisión. Las cuotas siguientes se podrán pagar cuando se confirme.`;
