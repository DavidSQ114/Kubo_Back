// matricula/domain: cuotas extraordinarias (bloque M4). El Coordinador académico crea un lote (concepto, monto,
// vencimiento y destino: un alumno, una sección, un grado o todo el año) y se genera una cuota EXTRAORDINARIA por cada
// matrícula Matriculado del destino. Puede anular el lote o una cuota sin pagar. Montos en céntimos enteros.
import { erroresMatricula as E } from "./errores";

export const DESTINOS_LOTE = ["ALUMNO", "SECCION", "GRADO", "ANIO"] as const;
export type DestinoLote = (typeof DESTINOS_LOTE)[number];

export const NOMBRE_DESTINO_LOTE: Record<DestinoLote, string> = {
  ALUMNO: "Un alumno",
  SECCION: "Una sección",
  GRADO: "Un grado",
  ANIO: "Todo el año",
};

/** Largo máximo del concepto del lote (columna VARCHAR(100)). */
export const LARGO_MAXIMO_CONCEPTO_EXTRA = 100;

/** Solo en un año en matrícula o en curso se crean cuotas extraordinarias. */
export function verificarAnioParaLote(anio: { anio: number; estado: string }, nombreEstado: string) {
  if (anio.estado !== "EN_MATRICULA" && anio.estado !== "EN_CURSO") {
    throw E.anioSinCuotasExtra(anio.anio, nombreEstado);
  }
}

/** Concepto sin espacios sobrantes, de 1 a 100 caracteres. */
export function conceptoExtraValido(concepto: string | null | undefined): string {
  const limpio = (concepto ?? "").trim().replace(/\s+/g, " ");
  if (!limpio || limpio.length > LARGO_MAXIMO_CONCEPTO_EXTRA) throw E.conceptoExtraRequerido();
  return limpio;
}

/** El vencimiento («AAAA-MM-DD») no puede ser anterior a hoy. */
export function verificarVencimientoLote(fechaVencimiento: string, hoy: string) {
  if (fechaVencimiento < hoy) throw E.vencimientoPasado();
}

/** Un destino distinto de «Todo el año» necesita su id (alumno, sección o grado). */
export function verificarDestino(destino: DestinoLote, destinoId: string | null | undefined) {
  if (destino !== "ANIO" && !destinoId) throw E.destinoRequerido();
}

export interface MatriculaParaLote {
  id: string;
  estudianteId: string;
  seccionId: string | null;
  estado: string;
}

/**
 * Matrículas Matriculado del destino. `gradoDeSeccion` da el grado de cada sección del año.
 *   matriculasDelDestino(lista, { destino: "GRADO", destinoId: "g3" }, grados) // las Matriculado de 3.er grado
 */
export function matriculasDelDestino<T extends MatriculaParaLote>(
  matriculas: T[],
  d: { destino: DestinoLote; destinoId?: string | null },
  gradoDeSeccion: Map<string, string>,
): T[] {
  const coincide: Record<DestinoLote, (m: T) => boolean> = {
    ALUMNO: (m) => m.estudianteId === d.destinoId,
    SECCION: (m) => m.seccionId === d.destinoId,
    GRADO: (m) => Boolean(m.seccionId && gradoDeSeccion.get(m.seccionId) === d.destinoId),
    ANIO: () => true,
  };
  return matriculas.filter((m) => m.estado === "MATRICULADO" && coincide[d.destino](m));
}

/** Vista previa y creación: sin matrículas en el destino no se crea el lote. */
export function verificarConMatriculas(cantidad: number) {
  if (cantidad < 1) throw E.loteSinMatriculas();
}

/** Un lote anulado no se vuelve a anular. */
export function verificarLoteAnulable(estado: string) {
  if (estado === "ANULADO") throw E.loteYaAnulado();
}

/** Solo se anula una cuota extraordinaria Pendiente. */
export function verificarExtraordinariaAnulable(cuota: { tipo: string; estado: string }) {
  if (cuota.tipo !== "EXTRAORDINARIA") throw E.cuotaNoEsExtraordinaria();
  if (cuota.estado === "PAGADO") throw E.extraordinariaPagada();
  if (cuota.estado === "ANULADO") throw E.extraordinariaAnulada();
}

/** Resumen de las cuotas de un lote: cuántas hay en cada estado y cuánto suman las vigentes (no anuladas). */
export function resumenLote(cuotas: { estado: string; montoCentimos: number }[]) {
  const cuenta = (estado: string) => cuotas.filter((c) => c.estado === estado).length;
  return {
    cuotas: cuotas.length,
    pendientes: cuenta("PENDIENTE"),
    pagadas: cuenta("PAGADO"),
    anuladas: cuenta("ANULADO"),
    totalCentimos: cuotas.filter((c) => c.estado !== "ANULADO").reduce((t, c) => t + c.montoCentimos, 0),
  };
}
