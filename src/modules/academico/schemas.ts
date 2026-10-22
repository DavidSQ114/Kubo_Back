// academico/schemas: validación de entradas de año académico y periodos (RNF16). Mensajes en español (RNF09).
import { z } from "zod";
import { CANTIDAD_BIMESTRES } from "./domain/reglas";
import { ESTADOS_ANIO } from "./domain/tipos";

const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;

/** Fecha sin hora "AAAA-MM-DD" que exista en el calendario (rechaza 2026-02-30). */
const fecha = (campo: string) =>
  z
    .string({ message: `Ingresa la ${campo}` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `La ${campo} debe tener el formato AAAA-MM-DD`)
    .refine((v) => new Date(`${v}T00:00:00.000Z`).toISOString().startsWith(v), `La ${campo} no existe`);

const anio = z
  .number({ message: "Ingresa el año" })
  .int("El año debe ser un número entero")
  .min(ANIO_MINIMO, `El año debe estar entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}`)
  .max(ANIO_MAXIMO, `El año debe estar entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}`);

export const CrearAnioSchema = z.object({
  anio,
  fechaInicio: fecha("fecha de inicio"),
  fechaFin: fecha("fecha de fin"),
});

export const EditarAnioSchema = z
  .object({
    anio: anio.optional(),
    fechaInicio: fecha("fecha de inicio").optional(),
    fechaFin: fecha("fecha de fin").optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "Indica qué quieres cambiar" });

export const CambioEstadoSchema = z.object({
  estado: z.enum(ESTADOS_ANIO, { message: "Estado no válido" }),
});

export const PeriodosSchema = z.object({
  periodos: z
    .array(
      z.object({
        numero: z.number({ message: "Indica el número del bimestre" }).int().min(1).max(CANTIDAD_BIMESTRES),
        fechaInicio: fecha("fecha de inicio"),
        fechaFin: fecha("fecha de fin"),
      }),
      { message: "Envía la lista de bimestres" },
    )
    .length(CANTIDAD_BIMESTRES, `Registra los ${CANTIDAD_BIMESTRES} bimestres`),
});

export const IdSchema = z.string().uuid("Identificador no válido");
