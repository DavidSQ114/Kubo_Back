// horarios/schemas: validación de las entradas de la API de horarios (US27–US31) y de asistencia de alumnos (US35,
// US36, US45, US52), RNF16. Mensajes en español.
import { z } from "zod";
import { ESTADOS_ASISTENCIA } from "./domain/asistencia";
import { DIAS } from "./domain/tipos";

export const IdSchema = z.string().uuid("Identificador no válido");

export const DiaSchema = z.enum(DIAS, { message: "Día no válido: usa LUNES, MARTES, MIERCOLES, JUEVES o VIERNES" });

/** Celda de la cuadrícula en la ruta: /clases/{dia}/{bloqueId}. */
export const CeldaSchema = z.object({ dia: DiaSchema, bloqueId: IdSchema });

/**
 * Clase de un bloque (M-06). Los tres campos se aceptan vacíos (null o "") para responder con el mensaje del
 * backlog «Debe completar curso, docente y aula antes de guardar» (regla verificarClaseCompleta) y no con un
 * error genérico.
 */
const idOpcional = z.preprocess((v) => (v === "" ? null : v), IdSchema.nullish());

export const ClaseSchema = z.object({ cursoId: idOpcional, docenteId: idOpcional, aulaId: idOpcional });

/** ?version=2: versión del horario que se quiere ver (por defecto, el borrador o la publicada). */
export const ConsultaVersionSchema = z.object({
  version: z.coerce
    .number({ message: "La versión debe ser un número" })
    .int("La versión debe ser un número entero")
    .min(1, "La versión debe ser 1 o mayor")
    .optional(),
});

/** ?dia=LUNES&bloqueId=…: bloque del que se consulta la ocupación. */
export const ConsultaOcupacionSchema = z.object({ dia: DiaSchema, bloqueId: IdSchema });

/** ?anioId=…: año del horario del docente (por defecto, el año en curso). */
export const ConsultaAnioSchema = z.object({ anioId: IdSchema.optional() });

// ---------- Asistencia de alumnos ----------

const LARGO_MAXIMO_OBSERVACION = 200;
const LARGO_MINIMO_MOTIVO = 5;
const LARGO_MAXIMO_MOTIVO = 300;
/** Tope de alumnos en una lista: muy por encima del aforo de cualquier sección. */
const MAXIMO_ALUMNOS_POR_LISTA = 200;

const esFechaReal = (texto: string) => {
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
};

export const FechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida: usa el formato AAAA-MM-DD")
  .refine(esFechaReal, "Fecha no válida: ese día no existe");

export const MesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes no válido: usa el formato AAAA-MM");

export const EstadoAsistenciaSchema = z.enum(ESTADOS_ASISTENCIA, {
  message: "Estado no válido: usa PRESENTE, TARDANZA, FALTA o FALTA_JUSTIFICADA",
});

/** Observación opcional del docente («Cita médica con constancia»). Vacía equivale a no tenerla. */
const ObservacionSchema = z
  .string()
  .trim()
  .max(LARGO_MAXIMO_OBSERVACION, `La observación no puede superar los ${LARGO_MAXIMO_OBSERVACION} caracteres`)
  .transform((texto) => texto || null)
  .nullable();

/** Abrir la sesión de una clase del horario publicado. La fecha solo se acepta si es la de hoy. */
export const AbrirSesionSchema = z.object({ claseId: IdSchema, fecha: FechaSchema.optional() });

/**
 * Lista de asistencia de una sesión (DO-03). El estado se acepta vacío para responder con el mensaje del backlog
 * «Existen alumnos sin estado de asistencia registrado» (regla verificarListaCompleta) y señalar a quiénes falta.
 */
export const ListaAsistenciaSchema = z.object({
  alumnos: z
    .array(
      z.object({
        matriculaId: IdSchema,
        estado: z.preprocess((v) => (v === "" || v === undefined ? null : v), EstadoAsistenciaSchema.nullable()),
        observacion: z.preprocess((v) => (v === undefined ? null : v), ObservacionSchema),
      }),
    )
    .min(1, "La lista de asistencia está vacía")
    .max(MAXIMO_ALUMNOS_POR_LISTA, "La lista de asistencia tiene demasiados alumnos"),
});

/** Corrección del administrador (M-20): nuevo estado, motivo obligatorio y, si se envía, la observación. */
export const CorreccionAsistenciaSchema = z.object({
  estado: EstadoAsistenciaSchema,
  observacion: ObservacionSchema.optional(),
  motivo: z
    .string({ message: "El motivo de la corrección es obligatorio" })
    .trim()
    .min(LARGO_MINIMO_MOTIVO, `Indica el motivo de la corrección (mínimo ${LARGO_MINIMO_MOTIVO} caracteres)`)
    .max(LARGO_MAXIMO_MOTIVO, "Motivo demasiado largo"),
});

/** ?fecha=2026-09-16: fecha de las sesiones que se listan. */
export const ConsultaSesionesSchema = z.object({ fecha: FechaSchema.optional() });

/** ?mes=2026-09: mes de la asistencia que consulta el apoderado (por defecto, el mes actual). */
export const ConsultaMesSchema = z.object({ mes: MesSchema.optional() });

// ---------- Asistencia del personal docente (US32) ----------

/** ?fecha=2026-09-16: día del listado de AD-14 (por defecto, hoy). */
export const ConsultaAsistenciaDocenteSchema = z.object({ fecha: FechaSchema.optional() });

/** «Asistió» o la salida de un docente. La fecha se valida en el servidor: solo se acepta la de hoy en Lima. */
export const MarcacionDocenteSchema = z.object({ docenteId: IdSchema, fecha: FechaSchema });

/** Justificación de una inasistencia: el motivo es obligatorio. */
export const JustificacionDocenteSchema = z.object({
  motivo: z
    .string({ message: "El motivo de la justificación es obligatorio" })
    .trim()
    .min(LARGO_MINIMO_MOTIVO, `Indica el motivo de la justificación (mínimo ${LARGO_MINIMO_MOTIVO} caracteres)`)
    .max(LARGO_MAXIMO_MOTIVO, "Motivo demasiado largo"),
});
