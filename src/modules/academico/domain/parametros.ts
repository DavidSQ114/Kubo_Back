// academico/domain: parámetros generales del sistema (bloque M1, «Parámetros del sistema» del Administrador).
// Qué claves de parametro_institucion se editan, de qué tipo es cada una y cómo se valida el texto que se escribe.
// Los montos de cada año siguen en el portal del Coordinador académico; aquí solo los montos generales sugeridos.
import { erroresAcademico as E } from "./errores";
import { normalizarMonto } from "./montos";

export const TIPOS_PARAMETRO = ["HORA", "ENTERO", "PROPORCION", "MONTO"] as const;
export type TipoParametro = (typeof TIPOS_PARAMETRO)[number];

export interface DefinicionParametro {
  tipo: TipoParametro;
  grupo: string;
  /** Texto para el administrador (se usa si la fila no tiene descripción). */
  descripcion: string;
  /** Solo para ENTERO: límites inclusivos. */
  minimo?: number;
  maximo?: number;
}

/** Parámetros generales editables. BLOQUES_HORARIO (la jornada de clases) no se edita aquí: cambia la cuadrícula. */
export const PARAMETROS_SISTEMA: Record<string, DefinicionParametro> = {
  MAX_INTENTOS_LOGIN: {
    tipo: "ENTERO",
    grupo: "Seguridad",
    descripcion: "Intentos fallidos antes del bloqueo",
    minimo: 3,
    maximo: 10,
  },
  MINUTOS_BLOQUEO: {
    tipo: "ENTERO",
    grupo: "Seguridad",
    descripcion: "Minutos de bloqueo tras superar los intentos",
    minimo: 1,
    maximo: 1440,
  },
  HORA_INICIO_JORNADA_DOCENTE: {
    tipo: "HORA",
    grupo: "Jornada docente",
    descripcion: "Hasta esta hora el ingreso del docente es Puntual; después, Tardanza",
  },
  HORA_LIMITE_ASISTENCIA_DOCENTE: {
    tipo: "HORA",
    grupo: "Jornada docente",
    descripcion: "Hora límite: el docente sin marcar queda con Inasistencia",
  },
  PLAZO_CORRECCION_ASISTENCIA_H: {
    tipo: "ENTERO",
    grupo: "Asistencia de alumnos",
    descripcion: "Horas que tiene el docente para corregir la asistencia",
    minimo: 1,
    maximo: 168,
  },
  UMBRAL_INASISTENCIA_AVISO: {
    tipo: "PROPORCION",
    grupo: "Asistencia de alumnos",
    descripcion: "Porcentaje anual de faltas que activa el aviso previo",
  },
  UMBRAL_INASISTENCIA: {
    tipo: "PROPORCION",
    grupo: "Asistencia de alumnos",
    descripcion: "Porcentaje anual de faltas que activa la alerta de riesgo",
  },
  UMBRAL_FALTAS_MES: {
    tipo: "ENTERO",
    grupo: "Asistencia de alumnos",
    descripcion: "Faltas injustificadas en un mes que activan la alerta mensual",
    minimo: 1,
    maximo: 31,
  },
  MONTO_MATRICULA: {
    tipo: "MONTO",
    grupo: "Pagos",
    descripcion: "Cuota de matrícula sugerida al configurar un año (S/)",
  },
  MONTO_PENSION: {
    tipo: "MONTO",
    grupo: "Pagos",
    descripcion: "Pensión mensual sugerida al configurar un año (S/)",
  },
  DIA_VENCIMIENTO: {
    tipo: "ENTERO",
    grupo: "Pagos",
    descripcion: "Día del mes en que vence cada pensión",
    minimo: 1,
    maximo: 28,
  },
  PENSIONES_VENCIDAS_RESTRINGEN_LIBRETA: {
    tipo: "ENTERO",
    grupo: "Pagos",
    descripcion: "Pensiones vencidas a partir de las que el apoderado no ve la libreta de notas",
    minimo: 1,
    maximo: 10,
  },
};

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const ENTERO = /^-?\d+$/;
const DECIMAL = /^\d+(?:[.,]\d+)?$/;

export const esParametroEditable = (clave: string) => Object.hasOwn(PARAMETROS_SISTEMA, clave);

/**
 * Valida el texto escrito para un parámetro y lo convierte al valor que se guarda (JSON): «07:30» (hora), 5 (entero),
 * 0.15 (proporción entre 0 y 1) o «350.00» (monto, como texto para no perder decimales). Lanza PARAMETRO_INVALIDO
 * con un mensaje claro si no corresponde al tipo.
 */
export function valorDeParametro(clave: string, texto: string): string | number {
  const def = PARAMETROS_SISTEMA[clave];
  if (!def) throw E.parametroNoEditable(clave);
  const v = texto.trim();
  if (def.tipo === "HORA") {
    if (!HORA.test(v)) throw E.parametroInvalido("Ingresa una hora válida en formato HH:MM (por ejemplo, 07:30).");
    return v;
  }
  if (def.tipo === "ENTERO") {
    const n = Number(v);
    if (!ENTERO.test(v) || n < (def.minimo ?? 0) || n > (def.maximo ?? Number.MAX_SAFE_INTEGER)) {
      throw E.parametroInvalido(`Ingresa un número entero entre ${def.minimo} y ${def.maximo}.`);
    }
    return n;
  }
  if (def.tipo === "PROPORCION") {
    const n = Number(v.replace(",", "."));
    if (!DECIMAL.test(v) || !(n > 0 && n < 1)) {
      throw E.parametroInvalido("Ingresa un decimal mayor que 0 y menor que 1 (por ejemplo, 0.15 para 15 %).");
    }
    return n;
  }
  try {
    return normalizarMonto(v.replace(",", "."));
  } catch {
    throw E.parametroInvalido("Ingresa un monto mayor a 0 con hasta dos decimales (por ejemplo, 350.00).");
  }
}

/** Pares que deben respetar un orden: el primero, menor que el segundo. */
const ORDEN: [string, string, string][] = [
  [
    "HORA_INICIO_JORNADA_DOCENTE",
    "HORA_LIMITE_ASISTENCIA_DOCENTE",
    "La hora de inicio de la jornada debe ser anterior a la hora límite de asistencia.",
  ],
  [
    "UMBRAL_INASISTENCIA_AVISO",
    "UMBRAL_INASISTENCIA",
    "El umbral del aviso previo debe ser menor que el umbral de la alerta de riesgo.",
  ],
];

/** Comprueba que el valor nuevo no rompa el orden con el parámetro que lo acompaña (con los valores vigentes). */
export function verificarCoherencia(clave: string, valor: string | number, vigentes: Record<string, unknown>) {
  for (const [menor, mayor, mensaje] of ORDEN) {
    if (clave !== menor && clave !== mayor) continue;
    const a = clave === menor ? valor : vigentes[menor];
    const b = clave === mayor ? valor : vigentes[mayor];
    if (a == null || b == null) continue;
    // las horas «HH:MM» se ordenan como texto; las proporciones, como números
    const enOrden = PARAMETROS_SISTEMA[clave].tipo === "HORA" ? String(a) < String(b) : Number(a) < Number(b);
    if (!enOrden) throw E.parametroInvalido(mensaje);
  }
}
