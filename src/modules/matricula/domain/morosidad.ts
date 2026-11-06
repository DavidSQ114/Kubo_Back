// matricula/domain: reglas puras del panel de morosidad (US24, AD-12): meses adeudados, días de atraso, filtro por
// meses y orden por monto o meses. Fechas «AAAA-MM-DD» con el día de Lima.

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
const MS_POR_DIA = 86_400_000;

export const ORDENES_MOROSIDAD = ["MONTO", "MESES"] as const;
export type OrdenMorosidad = (typeof ORDENES_MOROSIDAD)[number];

/** Cuota vencida: Pendiente con vencimiento anterior a hoy (el día del vencimiento todavía no es mora). */
export const estaVencida = (c: { estado: string; fechaVencimiento: string }, hoy: string) =>
  c.estado === "PENDIENTE" && c.fechaVencimiento < hoy;

/** «Matr.», «Ago», «Set»: lo que se adeuda, en el orden de vencimiento. */
export function etiquetasAdeudadas(cuotas: { tipo: string; mes: number | null }[]): string[] {
  return cuotas.map((c) => (c.tipo === "MATRICULA" || c.mes == null ? "Matr." : MESES_CORTOS[c.mes - 1]));
}

/** Meses adeudados: las pensiones vencidas (la cuota de matrícula se cuenta aparte, como cuota vencida). */
export const mesesAdeudados = (cuotas: { tipo: string }[]) => cuotas.filter((c) => c.tipo === "PENSION").length;

/** Días desde el primer vencimiento impago hasta hoy. */
export function diasAtraso(primerVencimiento: string, hoy: string): number {
  const dias = (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${primerVencimiento}T00:00:00Z`)) / MS_POR_DIA;
  return Math.max(0, Math.round(dias));
}

export interface FilaMorosidad {
  nombreCompleto: string;
  deudaCentimos: number;
  mesesAdeudados: number;
  cuotasVencidas: number;
}

/** Filtro «Meses adeudados»: con mínimo 3 entran quienes adeudan 3 o más cuotas vencidas. */
export const conMinimoDeMeses = <T extends FilaMorosidad>(lista: T[], minimo?: number) =>
  minimo ? lista.filter((f) => f.cuotasVencidas >= minimo) : lista;

/** Orden del panel: por monto o por meses, de mayor a menor; a igualdad, por nombre. */
export function ordenarMorosidad<T extends FilaMorosidad>(lista: T[], orden: OrdenMorosidad): T[] {
  const clave = (f: T) => (orden === "MONTO" ? f.deudaCentimos : f.cuotasVencidas);
  return [...lista].sort(
    (a, b) =>
      clave(b) - clave(a) || b.deudaCentimos - a.deudaCentimos || a.nombreCompleto.localeCompare(b.nombreCompleto),
  );
}
