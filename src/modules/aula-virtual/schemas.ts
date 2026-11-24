// aula-virtual/schemas: validación de las entradas de la API del aula virtual (unidades didácticas, US61 materiales,
// US62 enlaces y US67 curso del alumno), RNF16. Mensajes en español. La URL se valida en el dominio (`validarUrl`) para
// responder ENLACE_INVALIDO con «Ingresa un enlace válido», como pide US62.
import { z } from "zod";
import { DIRECCIONES, LARGO_MAXIMO_TITULO, LARGO_MAXIMO_URL, TIPOS_ENLACE } from "./domain/reglas";

export const IdSchema = z.string().uuid("Identificador no válido");

/** Ruta /asignaciones/{asignacionId}. */
export const AsignacionParamsSchema = z.object({ asignacionId: IdSchema });

const TituloSchema = z
  .string({ message: "Ingresa el título" })
  .trim()
  .min(1, "Ingresa el título")
  .max(LARGO_MAXIMO_TITULO, `El título admite hasta ${LARGO_MAXIMO_TITULO} caracteres`);

const UrlSchema = z
  .string({ message: "Ingresa el enlace" })
  .trim()
  .min(1, "Ingresa el enlace")
  .max(LARGO_MAXIMO_URL, "El enlace es demasiado largo");

// ---------- Unidades didácticas ----------

export const NuevaUnidadSchema = z.object({ titulo: TituloSchema });

/** Renombrar y/o activar o desactivar una unidad. */
export const EditarUnidadSchema = z
  .object({
    titulo: TituloSchema.optional(),
    activo: z.boolean({ message: "Indica si la unidad está activa" }).optional(),
  })
  .refine((d) => d.titulo !== undefined || d.activo !== undefined, { message: "No hay cambios que guardar" });

export const MoverUnidadSchema = z.object({
  direccion: z.enum(DIRECCIONES, { message: "Indica si la unidad sube o baja" }),
});

// ---------- Materiales (US61, multipart/form-data) ----------

/** «true» o «false» de una casilla del formulario multipart. */
const BooleanoDeFormulario = z.enum(["true", "false"], { message: "Indica si es visible para los alumnos" });

/**
 * Campos de texto del formulario de M-16: unidad, título, tipo («ARCHIVO» con el campo `archivo` o «ENLACE» con `url`)
 * y «Visible para los alumnos».
 */
export const NuevoMaterialSchema = z
  .object({
    unidadId: z.string({ message: "Elige la unidad" }).uuid("Elige la unidad"),
    titulo: TituloSchema,
    tipo: z.enum(["ARCHIVO", "ENLACE"], { message: "Elige el tipo de material" }),
    url: z.string().nullish(),
    visible: BooleanoDeFormulario,
  })
  .transform(({ visible, url, ...resto }) => ({ ...resto, url: url?.trim() || null, visible: visible === "true" }));

// ---------- Enlaces de clase virtual (US62) ----------

const FechaHoraLimaSchema = (que: string) =>
  z
    .string({ message: `Ingresa la fecha y hora de ${que}` })
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, `Ingresa la fecha y hora de ${que}`);

/** Cuerpo de M-17: tipo, título, URL, inicio y fin en la hora de Lima («2026-11-24T10:00») y visibilidad. */
export const EnlaceSchema = z.object({
  tipo: z.enum(TIPOS_ENLACE, { message: "Elige el tipo de enlace" }),
  titulo: TituloSchema,
  url: UrlSchema,
  inicio: FechaHoraLimaSchema("inicio"),
  fin: FechaHoraLimaSchema("fin"),
  visible: z.boolean({ message: "Indica si es visible para los alumnos" }),
});

// ---------- Curso del alumno (US67) ----------

export const CursoParamsSchema = z.object({ cursoId: IdSchema });
