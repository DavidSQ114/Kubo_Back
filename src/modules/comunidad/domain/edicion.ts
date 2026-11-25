// comunidad/domain: reglas puras para editar los datos de una persona y para darla de baja (US69, AD-06).
// Qué campos cambian, cuáles exigen motivo, qué se escribe en la bitácora y cuándo se elimina o se desactiva.
import { erroresComunidad as E } from "./errores";

/** Perfiles de una persona. Son los mismos valores que los roles de identidad. */
export type Perfil = "ADMINISTRADOR" | "COORDINADOR" | "DOCENTE" | "APODERADO" | "ALUMNO";

export const NOMBRE_PERFIL: Record<Perfil, string> = {
  ADMINISTRADOR: "Administrador",
  COORDINADOR: "Coordinador académico",
  DOCENTE: "Docente",
  APODERADO: "Apoderado",
  ALUMNO: "Estudiante",
};

/** Datos que se pueden editar. Las fechas van como «AAAA-MM-DD» y lo que no está registrado, como null. */
export interface DatosEditables {
  dni: string;
  nombres: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  ocupacion: string | null;
  especialidad: string | null;
  colegioProcedencia: string | null;
}

export type CampoEditable = keyof DatosEditables;

export const ETIQUETA_CAMPO: Record<CampoEditable, string> = {
  dni: "DNI",
  nombres: "Nombres",
  apellidos: "Apellidos",
  email: "Correo",
  telefono: "Teléfono",
  direccion: "Dirección",
  fechaNacimiento: "Fecha de nacimiento",
  sexo: "Sexo",
  ocupacion: "Ocupación",
  especialidad: "Especialidad",
  colegioProcedencia: "Colegio de procedencia",
};

const CAMPOS = Object.keys(ETIQUETA_CAMPO) as CampoEditable[];

/** Datos que identifican a la persona: solo cambian con un motivo. */
export const CAMPOS_IDENTIDAD: readonly CampoEditable[] = ["dni", "nombres", "apellidos"];

/** Datos que pertenecen a un perfil: solo se editan si la persona lo tiene. */
export const PERFIL_DEL_CAMPO: Partial<Record<CampoEditable, Perfil>> = {
  ocupacion: "APODERADO",
  especialidad: "DOCENTE",
  colegioProcedencia: "ALUMNO",
};

/** Datos que el registro de cada perfil exige (US15, US17): al editar no pueden quedar vacíos. */
const OBLIGATORIOS_POR_PERFIL: Partial<Record<Perfil, readonly CampoEditable[]>> = {
  APODERADO: ["telefono", "direccion", "fechaNacimiento"],
  ALUMNO: ["fechaNacimiento"],
};

export interface CambioCampo {
  campo: CampoEditable;
  anterior: string | null;
  nuevo: string | null;
}

/**
 * Campos enviados cuyo valor es distinto del registrado. Lo que no se envía (undefined) no cambia.
 *   cambiosDePersona(actual, { telefono: "987654321" }) // → [{ campo: "telefono", anterior: null, nuevo: "987654321" }]
 */
export function cambiosDePersona(actual: DatosEditables, enviados: Partial<DatosEditables>): CambioCampo[] {
  const cambios: CambioCampo[] = [];
  for (const campo of CAMPOS) {
    const enviado = enviados[campo];
    if (enviado === undefined) continue;
    const anterior = actual[campo] ?? null;
    const nuevo = enviado ?? null;
    if (anterior !== nuevo) cambios.push({ campo, anterior, nuevo });
  }
  return cambios;
}

export const cambiaIdentidad = (cambios: CambioCampo[]) => cambios.some((c) => CAMPOS_IDENTIDAD.includes(c.campo));

export interface ContextoEdicion {
  /** Perfiles que la persona tiene registrados, activos o no. */
  perfiles: Perfil[];
  tieneCuenta: boolean;
  motivo?: string | null;
}

/**
 * Valida los cambios antes de guardarlos:
 * - un dato de perfil (ocupación, especialidad, colegio de procedencia) exige que la persona tenga ese perfil;
 * - el correo de una persona con cuenta y los datos obligatorios de su perfil no pueden quedar vacíos;
 * - el DNI, los nombres y los apellidos solo cambian con un motivo (queda en la bitácora).
 */
export function verificarEdicion(cambios: CambioCampo[], contexto: ContextoEdicion) {
  for (const c of cambios) {
    const perfil = PERFIL_DEL_CAMPO[c.campo];
    if (perfil && !contexto.perfiles.includes(perfil)) {
      throw E.perfilNoAplica(ETIQUETA_CAMPO[c.campo], NOMBRE_PERFIL[perfil]);
    }
    if (c.nuevo !== null) continue;
    if (c.campo === "email" && contexto.tieneCuenta) throw E.correoRequerido();
    const exige = contexto.perfiles.find((p) => OBLIGATORIOS_POR_PERFIL[p]?.includes(c.campo));
    if (exige) throw E.datoObligatorio(ETIQUETA_CAMPO[c.campo], NOMBRE_PERFIL[exige]);
  }
  if (cambiaIdentidad(cambios) && !contexto.motivo?.trim()) throw E.motivoRequerido();
}

/** «45872136» → «******36»: en la bitácora el DNI solo deja ver sus 2 últimos dígitos. */
export const enmascararDni = (dni: string) => `${"*".repeat(Math.max(0, dni.length - 2))}${dni.slice(-2)}`;

type ValoresAuditoria = Partial<Record<CampoEditable, string | null>>;

/** Valor anterior y nuevo de cada campo cambiado, como se guardan en EDITAR_PERSONA (el DNI, enmascarado). */
export function valoresDeAuditoria(cambios: CambioCampo[]): { anterior: ValoresAuditoria; nuevo: ValoresAuditoria } {
  const anterior: ValoresAuditoria = {};
  const nuevo: ValoresAuditoria = {};
  const valor = (c: CambioCampo, v: string | null) => (c.campo === "dni" && v ? enmascararDni(v) : v);
  for (const c of cambios) {
    anterior[c.campo] = valor(c, c.anterior);
    nuevo[c.campo] = valor(c, c.nuevo);
  }
  return { anterior, nuevo };
}

// ---------- Historial de cambios (leído de la bitácora) ----------

export interface ResumenEvento {
  /** Campos cambiados en un EDITAR_PERSONA (vacío en los demás eventos). */
  cambios: CambioCampo[];
  /** Perfil desactivado en un DESACTIVAR_PERFIL (null en los demás eventos). */
  perfil: Perfil | null;
}

const comoRegistro = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const comoTexto = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Convierte el valor anterior y el nuevo de un evento de la bitácora en lo que muestra el historial de la persona. */
export function resumenDeEvento(accion: string, anterior: unknown, nuevo: unknown): ResumenEvento {
  const antes = comoRegistro(anterior);
  const despues = comoRegistro(nuevo);
  if (accion === "DESACTIVAR_PERFIL") {
    const perfil = comoTexto(despues.perfil);
    return { cambios: [], perfil: perfil && perfil in NOMBRE_PERFIL ? (perfil as Perfil) : null };
  }
  if (accion !== "EDITAR_PERSONA") return { cambios: [], perfil: null };
  const cambios = CAMPOS.filter((campo) => campo in antes || campo in despues).map((campo) => ({
    campo,
    anterior: comoTexto(antes[campo]),
    nuevo: comoTexto(despues[campo]),
  }));
  return { cambios, perfil: null };
}

// ---------- Baja: eliminar o desactivar ----------

/** Registros de otros módulos que dependen de la persona. Con alguno, no se elimina. */
export interface RegistrosDePersona {
  /** Ingresó al sistema al menos una vez con su cuenta. */
  cuentaUsada: boolean;
  /** Vínculos estudiante–apoderado, como estudiante o como apoderado. */
  vinculos: number;
  matriculas: number;
  pagos: number;
  /** Cursos asignados y secciones a su cargo como tutor. */
  asignaciones: number;
}

const cantidad = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

/** Por qué la persona no se puede eliminar, en frases para mostrar («tiene 2 matrículas»). Vacío si no hay nada. */
export function motivosParaConservar(r: RegistrosDePersona): string[] {
  const motivos: string[] = [];
  if (r.cuentaUsada) motivos.push("ya ingresó al sistema con su cuenta");
  if (r.vinculos) motivos.push(`tiene ${cantidad(r.vinculos, "vínculo", "vínculos")} entre estudiante y apoderado`);
  if (r.matriculas) motivos.push(`tiene ${cantidad(r.matriculas, "matrícula", "matrículas")}`);
  if (r.pagos) motivos.push(`tiene ${cantidad(r.pagos, "pago registrado", "pagos registrados")}`);
  if (r.asignaciones) {
    motivos.push(`tiene ${cantidad(r.asignaciones, "asignación", "asignaciones")} de cursos o secciones`);
  }
  return motivos;
}

export type PlanDeBaja = { accion: "ELIMINAR" } | { accion: "DESACTIVAR"; perfiles: Perfil[]; motivos: string[] };

/**
 * Qué hacer al dar de baja a una persona (US69):
 * - sin cuenta usada, vínculos, matrículas, pagos ni asignaciones, se ELIMINA;
 * - con alguno de esos registros se DESACTIVAN sus perfiles activos (o solo el indicado) y se conserva la persona;
 * - si se pide retirar un solo perfil de una persona que tiene varios activos, se desactiva ese y no se elimina.
 * Nadie se da de baja a sí mismo.
 */
export function planDeBaja(datos: {
  esPropia: boolean;
  perfilesActivos: Perfil[];
  perfil?: Perfil;
  registros: RegistrosDePersona;
}): PlanDeBaja {
  if (datos.esPropia) throw E.bajaPropia();
  if (datos.perfil && !datos.perfilesActivos.includes(datos.perfil)) {
    throw E.perfilNoActivo(NOMBRE_PERFIL[datos.perfil]);
  }
  const motivos = motivosParaConservar(datos.registros);
  const conservaOtrosPerfiles = Boolean(datos.perfil) && datos.perfilesActivos.length > 1;
  if (!motivos.length && !conservaOtrosPerfiles) return { accion: "ELIMINAR" };

  const perfiles = datos.perfil ? [datos.perfil] : datos.perfilesActivos;
  if (!perfiles.length) throw E.perfilesYaInactivos();
  return { accion: "DESACTIVAR", perfiles, motivos };
}
