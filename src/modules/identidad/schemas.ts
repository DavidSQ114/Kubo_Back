// identidad/schemas: validación de entradas (RNF16). Mensajes en español claro (RNF09).
import { z } from "zod";
import { ROLES } from "./domain/reglas";

const email = z
  .string({ message: "Ingresa tu correo" })
  .trim()
  .min(1, "Ingresa tu correo")
  .max(254, "Correo demasiado largo")
  .email("Ingresa un correo válido");
const password = z
  .string({ message: "Ingresa tu contraseña" })
  .min(1, "Ingresa tu contraseña")
  .max(200, "Contraseña demasiado larga");
const rol = z.enum(ROLES, { message: "Perfil no válido" });

export const LoginSchema = z.object({
  email,
  password,
  recordar: z.boolean().optional().default(false),
});

export const SeleccionPerfilSchema = z.object({
  tokenSeleccion: z.string().min(1, "Falta el token de selección"),
  rol,
});

export const CambioPerfilSchema = z.object({ rol });

export const CambioPasswordSchema = z
  .object({
    actual: password,
    nueva: z.string().min(1, "Ingresa la nueva contraseña").max(200, "Contraseña demasiado larga"),
    confirmacion: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((d) => d.nueva === d.confirmacion, { message: "Las contraseñas no coinciden", path: ["confirmacion"] });

export const RecuperacionSchema = z.object({ email });

export const RestablecerSchema = z
  .object({
    token: z.string().min(20, "Enlace no válido").max(200, "Enlace no válido"),
    nueva: z.string().min(1, "Ingresa la nueva contraseña").max(200, "Contraseña demasiado larga"),
    confirmacion: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((d) => d.nueva === d.confirmacion, { message: "Las contraseñas no coinciden", path: ["confirmacion"] });

export const SuspensionSchema = z.object({
  motivo: z.string().trim().min(3, "Indica el motivo").max(200, "Motivo demasiado largo"),
  detalle: z.string().trim().max(1000, "Detalle demasiado largo").optional().nullable(),
  notificar: z.boolean().optional().default(false),
});

export const ReactivacionSchema = z.object({
  motivo: z.string().trim().max(500, "Motivo demasiado largo").optional().nullable(),
});

export const IdSchema = z.string().uuid("Identificador no válido");
