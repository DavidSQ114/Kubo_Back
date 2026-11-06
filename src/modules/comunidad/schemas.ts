// comunidad/schemas: validación de entradas (RNF16).
import { z } from "zod";
import { ROLES } from "@/modules/identidad";
import { PARENTESCOS } from "./domain/vinculos";

const nombre = (campo: string) =>
  z
    .string({ message: `Ingresa ${campo}` })
    .trim()
    .min(2, `Ingresa ${campo}`)
    .max(100, `${campo[0].toUpperCase()}${campo.slice(1)} demasiado largo`)
    .regex(/^[\p{L}' .-]+$/u, `${campo[0].toUpperCase()}${campo.slice(1)} solo puede tener letras`);

export const RegistrarAdministradorSchema = z.object({
  dni: z
    .string({ message: "Ingresa el DNI" })
    .trim()
    .regex(/^\d{8}$/, "El DNI debe tener 8 dígitos"),
  nombres: nombre("los nombres"),
  apellidos: nombre("los apellidos"),
  email: z.string({ message: "Ingresa el correo" }).trim().toLowerCase().max(254).email("Ingresa un correo válido"),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?\d{6,15}$/, "Teléfono no válido")
    .optional()
    .nullable(),
  cargo: z.string().trim().max(100, "Cargo demasiado largo").optional().nullable(),
});

export const FiltroUsuariosSchema = z.object({
  q: z.string().trim().max(100).optional(),
  rol: z.enum(ROLES).optional(),
  estado: z.enum(["ACTIVO", "PENDIENTE_ACTIVACION", "SUSPENDIDO", "SIN_CUENTA"]).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- Personas por DNI (D-07) ----------

export const ConsultaPersonaSchema = z.object({
  dni: z
    .string({ message: "Ingresa el DNI" })
    .trim()
    .regex(/^\d{8}$/, "El DNI debe tener 8 dígitos"),
});

// ---------- Docentes (US13) ----------

const MENSAJE_EMAIL = "Formato de correo electrónico inválido";

export const RegistrarDocenteSchema = z.object({
  dni: z
    .string({ message: "Ingresa el DNI" })
    .trim()
    .regex(/^\d{8}$/, "El DNI debe tener 8 dígitos"),
  nombres: nombre("los nombres"),
  apellidos: nombre("los apellidos"),
  email: z.string({ message: "Ingresa el correo" }).trim().toLowerCase().max(254).email(MENSAJE_EMAIL),
  especialidad: z
    .string({ message: "Elige la especialidad" })
    .trim()
    .min(2, "Elige la especialidad")
    .max(100, "Especialidad demasiado larga"),
  telefono: z
    .string()
    .transform((t) => t.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{9}$/, "El teléfono debe tener 9 dígitos"))
    .optional()
    .nullable(),
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de nacimiento debe tener el formato AAAA-MM-DD")
    .optional()
    .nullable(),
  enviarCorreo: z.boolean().optional(),
});

// ---------- Apoderados (US15) y estudiantes (US17) ----------

const dni = () =>
  z
    .string({ message: "Ingresa el DNI" })
    .trim()
    .regex(/^\d{8}$/, "El DNI debe tener 8 dígitos");

const uuid = (mensaje: string) => z.string({ message: mensaje }).uuid(mensaje);

/** Fecha AAAA-MM-DD que existe y no es futura. */
const fechaNacimiento = () =>
  z
    .string({ message: "Ingresa la fecha de nacimiento" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de nacimiento debe tener el formato AAAA-MM-DD")
    // Date.parse acepta «2012-02-31» (lo pasa a marzo): la fecha es válida solo si vuelve igual.
    .refine((f) => {
      const d = new Date(`${f}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(f);
    }, "La fecha de nacimiento no es válida")
    .refine((f) => f <= new Date().toISOString().slice(0, 10), "La fecha de nacimiento no puede ser futura");

const textoOpcional = (max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .max(max, mensaje)
    .transform((t) => t || null)
    .optional()
    .nullable();

const vinculo = {
  parentesco: z.enum(PARENTESCOS, { message: "Elige el parentesco" }),
  esPrincipal: z.boolean().default(false),
  autorizado: z.boolean().default(true),
};

export const VinculoConEstudianteSchema = z.object({
  estudianteId: uuid("Elige el estudiante"),
  ...vinculo,
});

export const VinculoConApoderadoSchema = z.object({
  apoderadoId: uuid("Elige el apoderado"),
  ...vinculo,
});

export const RegistrarApoderadoSchema = z.object({
  dni: dni(),
  nombres: nombre("los nombres"),
  apellidos: nombre("los apellidos"),
  fechaNacimiento: fechaNacimiento(),
  email: z.string({ message: "Ingresa el correo" }).trim().toLowerCase().max(254).email(MENSAJE_EMAIL),
  telefono: z
    .string({ message: "Ingresa el teléfono" })
    .transform((t) => t.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{9}$/, "El número de teléfono debe tener 9 dígitos")),
  direccion: z
    .string({ message: "Ingresa la dirección" })
    .trim()
    .min(5, "Ingresa la dirección")
    .max(200, "Dirección demasiado larga"),
  ocupacion: z
    .string({ message: "Ingresa la ocupación" })
    .trim()
    .min(2, "Ingresa la ocupación")
    .max(100, "Ocupación demasiado larga"),
  /** Estudiantes ya registrados que se vinculan en el mismo guardado (paso 2 de AD-08). */
  vinculos: z.array(VinculoConEstudianteSchema).max(10, "Vincula como máximo 10 estudiantes a la vez").default([]),
  enviarCorreo: z.boolean().optional(),
});

export const RegistrarEstudianteSchema = z.object({
  dni: dni(),
  nombres: nombre("los nombres"),
  apellidos: nombre("los apellidos"),
  fechaNacimiento: fechaNacimiento(),
  gradoIngresoId: uuid("Elige el grado de ingreso"),
  sexo: z.enum(["FEMENINO", "MASCULINO"], { message: "Elige el sexo" }).optional().nullable(),
  colegioProcedencia: textoOpcional(150, "Colegio de procedencia demasiado largo"),
  direccion: textoOpcional(200, "Dirección demasiado larga"),
  apoderados: z
    .array(VinculoConApoderadoSchema, { message: "Debe asociar al menos un apoderado antes de continuar" })
    .min(1, "Debe asociar al menos un apoderado antes de continuar")
    .max(6, "Vincula como máximo 6 apoderados"),
  /** «Guardar como borrador»: además crea su matrícula «En proceso», sin sección (US17). */
  borrador: z.boolean().default(false),
});

export const VincularSchema = VinculoConEstudianteSchema.extend({ apoderadoId: uuid("Elige el apoderado") });

export const FiltroBusquedaSchema = z.object({
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(50).default(10),
});
