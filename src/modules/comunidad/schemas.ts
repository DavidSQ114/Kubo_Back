// comunidad/schemas: validación de entradas (RNF16).
import { z } from "zod";
import { ROLES } from "@/modules/identidad";

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
