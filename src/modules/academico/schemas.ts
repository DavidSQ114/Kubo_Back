// academico/schemas: validación de entradas de año, periodos, secciones, aulas, cursos y competencias (RNF16).
// Mensajes en español (RNF09).
import { z } from "zod";
import { ESTADOS_CURSO } from "./domain/cursos";
import { CANTIDAD_BIMESTRES } from "./domain/reglas";
import { ESTADOS_SECCION } from "./domain/secciones";
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

// ---------- Secciones y aulas (US08, US09) ----------

const MENSAJE_AFORO = "El aforo debe ser un número entero mayor a 0";
const aforo = z.number({ message: MENSAJE_AFORO }).int(MENSAJE_AFORO).positive(MENSAJE_AFORO);
const idOpcional = (que: string) => z.string().uuid(`${que} no válido`).nullable().optional();

export const SeccionSchema = z.object({
  anioAcademicoId: z.string({ message: "Elige el año académico" }).uuid("Año académico no válido"),
  gradoId: z.string({ message: "Elige el grado" }).uuid("Grado no válido"),
  nombre: z
    .string({ message: "Ingresa el nombre de la sección" })
    .trim()
    .min(1, "Ingresa el nombre de la sección")
    .max(3),
  aforoMaximo: aforo,
  aulaId: idOpcional("Aula"),
  tutorId: idOpcional("Tutor"),
});

export const EditarSeccionSchema = SeccionSchema.omit({ anioAcademicoId: true })
  .partial()
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "Indica qué quieres cambiar" });

export const EstadoSeccionSchema = z.object({
  estado: z.enum(ESTADOS_SECCION, { message: "Estado no válido" }),
});

export const AulaSchema = z.object({
  nombre: z.string({ message: "Ingresa el nombre del aula" }).trim().min(1, "Ingresa el nombre del aula").max(60),
  ubicacion: z.string().trim().max(100, "Ubicación demasiado larga").nullable().optional(),
  aforo,
});

export const EditarAulaSchema = AulaSchema.partial().refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: "Indica qué quieres cambiar",
});

export const EstadoAulaSchema = z.object({ activo: z.boolean({ message: "Indica si el aula queda activa" }) });

export const ConsultaAnioSchema = z.object({ anioId: z.string().uuid("Año académico no válido").optional() });

// ---------- Cursos y competencias (US10, US11) ----------

const MENSAJE_AREA = "Debe seleccionar el área curricular del curso";
const MENSAJE_HORAS = "Las horas semanales deben ser un número entero mayor a 0";
const MAXIMO_HORAS_SEMANALES = 40; // una semana escolar completa
const horas = z
  .number({ message: MENSAJE_HORAS })
  .int(MENSAJE_HORAS)
  .positive(MENSAJE_HORAS)
  .max(MAXIMO_HORAS_SEMANALES, `Máximo ${MAXIMO_HORAS_SEMANALES} horas semanales`);
const gradosPlan = z
  .array(z.object({ gradoId: z.string().uuid("Grado no válido"), horasSemanales: horas }), {
    message: "Envía la lista de grados",
  })
  .max(10);

const DatosCursoSchema = z.object({
  codigo: z.string({ message: "Ingresa el código del curso" }).trim().min(1, "Ingresa el código del curso").max(12),
  nombre: z
    .string({ message: "Ingresa el nombre del curso" })
    .trim()
    .min(1, "Ingresa el nombre del curso")
    .max(100, "Nombre demasiado largo"),
  descripcion: z.string().trim().max(500, "Descripción demasiado larga").nullable().optional(),
  areaCurricularId: z.string({ message: MENSAJE_AREA }).uuid(MENSAJE_AREA),
});

export const CursoSchema = DatosCursoSchema.extend({
  /** Opcional: grados del año con sus horas y las competencias que evaluará (paso 2 de «Registrar nuevo curso»). */
  plan: z
    .object({
      anioAcademicoId: z.string({ message: "Elige el año académico" }).uuid("Año académico no válido"),
      grados: gradosPlan,
      competencias: z.array(z.string().uuid("Competencia no válida")).max(20),
    })
    .optional(),
});

export const EditarCursoSchema = DatosCursoSchema.partial().refine(
  (d) => Object.values(d).some((v) => v !== undefined),
  { message: "Indica qué quieres cambiar" },
);

export const EstadoCursoSchema = z.object({ estado: z.enum(ESTADOS_CURSO, { message: "Estado no válido" }) });

export const ConsultaCursosSchema = z.object({
  areaId: z.string().uuid("Área no válida").optional(),
  estado: z.enum(ESTADOS_CURSO, { message: "Estado no válido" }).optional(),
  anioId: z.string().uuid("Año académico no válido").optional(),
});

export const PlanesSchema = z.object({ planes: gradosPlan });

export const CompetenciasPlanSchema = z.object({
  competencias: z
    .array(
      z.object({
        competenciaId: z.string().uuid("Competencia no válida"),
        orden: z.number().int().positive("El orden debe ser mayor a 0").optional(),
        peso: z
          .number({ message: "El peso debe ser un número mayor a 0" })
          .positive("El peso debe ser un número mayor a 0")
          .max(999)
          .nullable()
          .optional(),
      }),
      { message: "Envía la lista de competencias" },
    )
    .max(20),
});

// ---------- Asignación de cursos a docentes (US14) ----------

export const AsignacionSchema = z.object({
  docenteId: z.string({ message: "Elige el docente" }).uuid("Docente no válido"),
  seccionId: z.string({ message: "Elige la sección" }).uuid("Sección no válida"),
  cursoId: z.string({ message: "Elige el curso" }).uuid("Curso no válido"),
});

export const ConsultaAsignacionesSchema = z.object({
  docenteId: z.string({ message: "Indica el docente" }).uuid("Docente no válido"),
  anioId: z.string().uuid("Año académico no válido").optional(),
});
