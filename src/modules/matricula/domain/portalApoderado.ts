// matricula/domain: reglas puras del portal del apoderado. Qué hijos se muestran (US42, AC-05), autorización por
// vínculo, estado «Pagado / Pendiente / Vencido» y resumen de pagos (US43, AP-02) y nombre del comprobante (US44).
// Fechas «AAAA-MM-DD» con el día de Lima y montos en céntimos enteros.
import { erroresMatricula as E } from "./errores";

export type EstadoCuotaPortal = "PAGADO" | "PENDIENTE" | "VENCIDO" | "ANULADO";

export const NOMBRE_ESTADO_CUOTA_PORTAL: Record<EstadoCuotaPortal, string> = {
  PAGADO: "Pagado",
  PENDIENTE: "Pendiente",
  VENCIDO: "Vencido",
  ANULADO: "Anulado",
};

/** Años cuya matrícula «Matriculado» se muestra: el que está en matrícula, en curso o en cierre. */
const ANIOS_CON_MATRICULADO = ["EN_MATRICULA", "EN_CURSO", "EN_CIERRE"];
/** Un retiro solo se muestra en el año en curso (o en su cierre): sus cuotas pagadas siguen siendo consultables. */
const ANIOS_CON_RETIRADO = ["EN_CURSO", "EN_CIERRE"];
/** Si el hijo tiene matrícula en dos años abiertos, se muestra primero el que está en curso. */
const PRIORIDAD_ANIO: Record<string, number> = { EN_CURSO: 0, EN_CIERRE: 1, EN_MATRICULA: 2 };

export interface MatriculaDelHijo {
  estado: string;
  estadoAnio: string;
  anio: number;
}

/** ¿El apoderado ve esta matrícula? «Matriculado» de un año abierto, o «Retirado» del año en curso (US42). */
export const matriculaVisibleEnPortal = (m: Pick<MatriculaDelHijo, "estado" | "estadoAnio">) =>
  (m.estado === "MATRICULADO" && ANIOS_CON_MATRICULADO.includes(m.estadoAnio)) ||
  (m.estado === "RETIRADO" && ANIOS_CON_RETIRADO.includes(m.estadoAnio));

/** Matrículas visibles, la del año en curso primero; sin ninguna, el hijo no aparece en la selección. */
export function matriculasDelPortal<T extends MatriculaDelHijo>(lista: T[]): T[] {
  return lista
    .filter(matriculaVisibleEnPortal)
    .sort((a, b) => (PRIORIDAD_ANIO[a.estadoAnio] ?? 9) - (PRIORIDAD_ANIO[b.estadoAnio] ?? 9) || b.anio - a.anio);
}

/**
 * Autorización por vínculo (US42, RNF01): el estudiante debe estar entre los hijos que el servidor calculó para la
 * persona en sesión. Si no, 403 aunque el id exista (evita que se consulte a otro estudiante cambiando la URL).
 */
export function verificarHijoAutorizado(idsAutorizados: readonly string[], estudianteId: string): void {
  if (!idsAutorizados.includes(estudianteId)) throw E.estudianteNoVinculado();
}

/**
 * Estado que ve el apoderado (US43). «Vencido» se calcula y no se guarda: Pendiente con vencimiento anterior a hoy
 * (el mismo día del vencimiento todavía es «Pendiente»). Un pago «Observado» no cambia la cuota: sigue sin pagar.
 */
export function estadoCuotaPortal(c: { estado: string; fechaVencimiento: string }, hoy: string): EstadoCuotaPortal {
  if (c.estado === "PAGADO") return "PAGADO";
  if (c.estado === "ANULADO") return "ANULADO";
  return c.fechaVencimiento < hoy ? "VENCIDO" : "PENDIENTE";
}

export interface ResumenPagos {
  pagadoCentimos: number;
  cuotasPagadas: number;
  pendienteCentimos: number;
  cuotasPendientes: number;
  vencidoCentimos: number;
  cuotasVencidas: number;
  /** Sin cuotas pendientes ni vencidas: «Estás al día con tus pagos». */
  alDia: boolean;
}

/** Totales de AP-02: pagado, pendiente y vencido. Las cuotas anuladas no cuentan. */
export function resumenPagos(cuotas: { estadoPortal: EstadoCuotaPortal; montoCentimos: number }[]): ResumenPagos {
  const de = (estado: EstadoCuotaPortal) => cuotas.filter((c) => c.estadoPortal === estado);
  const suma = (lista: { montoCentimos: number }[]) => lista.reduce((t, c) => t + c.montoCentimos, 0);
  const [pagadas, pendientes, vencidas] = [de("PAGADO"), de("PENDIENTE"), de("VENCIDO")];
  return {
    pagadoCentimos: suma(pagadas),
    cuotasPagadas: pagadas.length,
    pendienteCentimos: suma(pendientes),
    cuotasPendientes: pendientes.length,
    vencidoCentimos: suma(vencidas),
    cuotasVencidas: vencidas.length,
    alDia: pendientes.length === 0 && vencidas.length === 0,
  };
}

/** El comprobante solo se descarga de una cuota «Pagado» (US44); si no, el mensaje de US25. */
export function verificarComprobanteDisponible(estado: EstadoCuotaPortal): void {
  if (estado !== "PAGADO") throw E.reciboNoConfirmado();
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/** «María José» → «MariaJose»: sin tildes, sin ñ, sin espacios ni signos. */
const sinTildes = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]/g, "");

const primeraPalabra = (texto: string) => {
  const palabra = sinTildes(texto.trim().split(/\s+/)[0] ?? "");
  return palabra.charAt(0).toUpperCase() + palabra.slice(1);
};

/**
 * Nombre del comprobante que descarga el apoderado (US44): Recibo_<Mes><Año>_<NombreApellido>.pdf, sin tildes ni
 * espacios. La cuota de matrícula usa «Matricula» y el pago anual adelantado (US58), «Anual».
 *   nombreArchivoComprobante({ tipo: "PENSION", mes: 3, anio: 2026, anual: false, nombres: "Valeria",
 *     apellidos: "Quispe Rojas" }) // "Recibo_Marzo2026_ValeriaQuispe.pdf"
 */
export function nombreArchivoComprobante(datos: {
  tipo: "MATRICULA" | "PENSION";
  mes: number | null;
  anio: number;
  anual: boolean;
  nombres: string;
  apellidos: string;
}): string {
  const periodo = datos.anual
    ? "Anual"
    : datos.tipo === "MATRICULA" || datos.mes == null
      ? "Matricula"
      : MESES[datos.mes - 1];
  return `Recibo_${periodo}${datos.anio}_${primeraPalabra(datos.nombres)}${primeraPalabra(datos.apellidos)}.pdf`;
}
