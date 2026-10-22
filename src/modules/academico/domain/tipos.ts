// academico/domain: estados, tipos y formatos compartidos por las reglas y los errores del módulo (US06, US07).
// Las fechas sin hora viajan como texto "AAAA-MM-DD": así se comparan sin problemas de zona horaria.

export const ESTADOS_ANIO = ["PLANIFICADO", "EN_MATRICULA", "EN_CURSO", "EN_CIERRE", "CERRADO"] as const;
export type EstadoAnio = (typeof ESTADOS_ANIO)[number];

export const NOMBRE_ESTADO_ANIO: Record<EstadoAnio, string> = {
  PLANIFICADO: "Planificado",
  EN_MATRICULA: "En matrícula",
  EN_CURSO: "En curso",
  EN_CIERRE: "En cierre",
  CERRADO: "Cerrado",
};

export const ESTADOS_PERIODO = ["INACTIVO", "ACTIVO", "EN_CIERRE", "FINALIZADO"] as const;
export type EstadoPeriodo = (typeof ESTADOS_PERIODO)[number];

export interface RangoFechas {
  fechaInicio: string;
  fechaFin: string;
}

/** "2026-03-01" → "01/03/2026" (mensajes al usuario). */
export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}
