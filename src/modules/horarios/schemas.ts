// horarios/schemas: validación de las entradas de la API de horarios (US27–US31, RNF16). Mensajes en español.
import { z } from "zod";
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
