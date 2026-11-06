// matricula/schemas: validación de entradas (RNF16) de la matrícula en sección (US18) y su anulación (M-19).
import { z } from "zod";
import { ESTADOS_MATRICULA, MODALIDADES_PAGO, MOTIVOS_ANULACION_MATRICULA } from "./domain/matriculas";

const id = (mensaje: string) => z.string({ message: mensaje }).uuid(mensaje);

export const IdSchema = id("Identificador no válido");

/** La sección y el responsable pueden faltar: el caso de uso responde «Complete la sección y el apoderado…». */
export const MatricularSchema = z.object({
  estudianteId: id("Elige el estudiante"),
  anioAcademicoId: id("Elige el año académico"),
  seccionId: id("Sección no válida").nullable().optional(),
  vinculoResponsableId: id("Apoderado responsable no válido").nullable().optional(),
  modalidadPago: z.enum(MODALIDADES_PAGO, { message: "Elige la modalidad de pago" }).default("MENSUAL"),
});

export const AnularSchema = z.object({
  motivo: z.enum(MOTIVOS_ANULACION_MATRICULA, { message: "Elige el motivo de la anulación" }),
  detalle: z
    .string({ message: "Describe por qué se anula esta matrícula" })
    .trim()
    .min(5, "Describe por qué se anula esta matrícula")
    .max(200, "Motivo demasiado largo"),
});

export const FiltroMatriculasSchema = z.object({
  anioId: id("Elige el año académico"),
  estado: z.enum(ESTADOS_MATRICULA).optional(),
  gradoId: id("Grado no válido").optional(),
  seccionId: id("Sección no válida").optional(),
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
});

export const ConsultaAnioSchema = z.object({ anioId: id("Elige el año académico") });
