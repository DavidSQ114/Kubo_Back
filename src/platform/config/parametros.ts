// platform/config: lee ParametroInstitucion. Primero el valor del año indicado y, si no existe, el general.
import { prisma } from "@/platform/db/prisma";

export const PARAMETROS_POR_DEFECTO = {
  MAX_INTENTOS_LOGIN: 5,
  MINUTOS_BLOQUEO: 15,
  // Asistencia de alumnos (US36, US45, US52): los mismos valores del seed y de la migración que los carga
  PLAZO_CORRECCION_ASISTENCIA_H: 24,
  UMBRAL_FALTAS_MES: 3,
  UMBRAL_INASISTENCIA_AVISO: 0.15,
  UMBRAL_INASISTENCIA: 0.2,
  // Restricción de la libreta por deuda (US26): pensiones vencidas a partir de las que el apoderado no la ve
  PENSIONES_VENCIDAS_RESTRINGEN_LIBRETA: 2,
} as const;

type ClaveConocida = keyof typeof PARAMETROS_POR_DEFECTO;

/** Horas «HH:MM» de la jornada docente (US32): los mismos valores del seed y de la migración que los carga. */
export const HORAS_POR_DEFECTO = {
  HORA_INICIO_JORNADA_DOCENTE: "07:30",
  HORA_LIMITE_ASISTENCIA_DOCENTE: "08:00",
} as const;

type ClaveHora = keyof typeof HORAS_POR_DEFECTO;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function obtenerParametro<T = unknown>(clave: string, anioAcademicoId?: string): Promise<T | undefined> {
  const filas = await prisma.parametroInstitucion.findMany({
    where: { clave, OR: [{ anioAcademicoId: anioAcademicoId ?? null }, { anioAcademicoId: null }] },
    select: { valor: true, anioAcademicoId: true },
  });
  const delAnio = filas.find((f) => f.anioAcademicoId && f.anioAcademicoId === anioAcademicoId);
  const general = filas.find((f) => f.anioAcademicoId === null);
  return (delAnio ?? general)?.valor as T | undefined;
}

/** Parámetro numérico con valor por defecto si no está configurado o no es un número válido. */
export async function parametroNumero(clave: ClaveConocida, anioAcademicoId?: string): Promise<number> {
  const valor = Number(await obtenerParametro(clave, anioAcademicoId));
  return Number.isFinite(valor) && valor > 0 ? valor : PARAMETROS_POR_DEFECTO[clave];
}

/** Parámetro de hora «HH:MM» (por ejemplo «07:30»), con valor por defecto si falta o no tiene ese formato. */
export async function parametroHora(clave: ClaveHora, anioAcademicoId?: string): Promise<string> {
  const valor = await obtenerParametro(clave, anioAcademicoId);
  return typeof valor === "string" && FORMATO_HORA.test(valor) ? valor : HORAS_POR_DEFECTO[clave];
}
