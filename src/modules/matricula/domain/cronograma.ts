// matricula/domain: cronograma de pagos que se genera al confirmar la matrícula (US21, RF16).
// Fechas como texto «AAAA-MM-DD» (columnas @db.Date, sin zona horaria) y montos en céntimos enteros: nunca float.

/** Pensiones de marzo (3) a diciembre (12). */
export const MESES_PENSION = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
/** Día de vencimiento si el parámetro DIA_VENCIMIENTO no está configurado o no es válido (US21: día 5). */
export const DIA_VENCIMIENTO_POR_DEFECTO = 5;
/** Hasta el 28 existe en todos los meses. */
const DIA_VENCIMIENTO_MAXIMO = 28;

const NOMBRE_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export type TipoConcepto = "MATRICULA" | "PENSION";

export interface CuotaCronograma {
  tipo: TipoConcepto;
  /** null en la cuota de matrícula. */
  mes: number | null;
  concepto: string;
  /** Céntimos: 45000 = S/ 450.00. */
  montoCentimos: number;
  /** «AAAA-MM-DD». */
  fechaVencimiento: string;
}

export interface DatosCronograma {
  anio: number;
  /** Día de la confirmación en Lima, «AAAA-MM-DD». */
  fechaMatricula: string;
  montoMatriculaCentimos: number;
  montoPensionCentimos: number;
  diaVencimiento?: number;
}

/** Día de vencimiento válido (1 a 28); si no, el día 5. */
export function diaVencimientoValido(valor: unknown): number {
  const dia = Number(valor);
  return Number.isInteger(dia) && dia >= 1 && dia <= DIA_VENCIMIENTO_MAXIMO ? dia : DIA_VENCIMIENTO_POR_DEFECTO;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * Cuota de matrícula (vence el día de la confirmación) y pensiones de marzo a diciembre que vencen el día 5.
 * Matrícula extemporánea: solo las pensiones que vencen DESPUÉS de la fecha de matrícula.
 *   generarCronograma({ anio: 2026, fechaMatricula: "2026-09-16", … }) // matrícula + octubre, noviembre, diciembre
 */
export function generarCronograma(d: DatosCronograma): CuotaCronograma[] {
  const dia = diaVencimientoValido(d.diaVencimiento ?? DIA_VENCIMIENTO_POR_DEFECTO);
  const matricula: CuotaCronograma = {
    tipo: "MATRICULA",
    mes: null,
    concepto: `Matrícula ${d.anio}`,
    montoCentimos: d.montoMatriculaCentimos,
    fechaVencimiento: d.fechaMatricula,
  };
  const pensiones = MESES_PENSION.map((mes): CuotaCronograma => ({
    tipo: "PENSION",
    mes,
    concepto: `Pensión de ${NOMBRE_MES[mes - 1]} ${d.anio}`,
    montoCentimos: d.montoPensionCentimos,
    fechaVencimiento: `${d.anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`,
  })).filter((p) => p.fechaVencimiento > d.fechaMatricula);
  return [matricula, ...pensiones];
}

/** La matrícula es extemporánea si se pierde al menos una pensión (US21). */
export const esExtemporanea = (cuotas: CuotaCronograma[]) =>
  cuotas.filter((c) => c.tipo === "PENSION").length < MESES_PENSION.length;

/** Suma en céntimos de todas las cuotas. */
export const totalCentimos = (cuotas: { montoCentimos: number }[]) =>
  cuotas.reduce((suma, c) => suma + c.montoCentimos, 0);

/** «octubre a diciembre» para el aviso de matrícula extemporánea; null si no hay pensiones. */
export function rangoPensiones(cuotas: CuotaCronograma[]): string | null {
  const meses = cuotas.flatMap((c) => (c.mes ? [c.mes] : []));
  if (!meses.length) return null;
  const desde = NOMBRE_MES[meses[0] - 1];
  const hasta = NOMBRE_MES[meses[meses.length - 1] - 1];
  return desde === hasta ? desde : `${desde} a ${hasta}`;
}
