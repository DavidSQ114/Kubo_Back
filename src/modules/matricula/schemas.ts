// matricula/schemas: validación de entradas (RNF16) de la matrícula en sección (US18), su anulación (M-19), el
// traslado de sección (US19), el retiro (US57) y los pagos (US22, US23, US04).
import { z } from "zod";
import { MOTIVOS_RETIRO } from "./domain/cambios";
import { ORDENES_MOROSIDAD } from "./domain/morosidad";
import { LARGO_MAXIMO_NUMERO_OPERACION, MEDIOS_PAGO, MOTIVOS_ANULACION_PAGO } from "./domain/pagos";
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

/** «AAAA-MM-DD» que exista en el calendario. */
const fecha = (mensaje: string) =>
  z
    .string({ message: mensaje })
    .regex(/^\d{4}-\d{2}-\d{2}$/, mensaje)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00.000Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, mensaje);

export const TrasladoSchema = z.object({
  seccionDestinoId: id("Elige la sección de destino"),
  fecha: fecha("Fecha del traslado no válida").nullable().optional(),
  motivo: z.string().trim().max(200, "Motivo demasiado largo").nullable().optional(),
});

/** El motivo puede faltar: el caso de uso responde «Seleccione el motivo del retiro». */
export const RetiroSchema = z.object({
  fecha: fecha("Fecha de retiro no válida").nullable().optional(),
  motivo: z.enum(MOTIVOS_RETIRO, { message: "Seleccione el motivo del retiro" }).nullable().optional(),
  detalle: z.string().trim().max(300, "Detalle demasiado largo").nullable().optional(),
});

/** Máximo de cuotas en una operación: la matrícula y las diez pensiones del año. */
const MAXIMO_CUOTAS_POR_PAGO = 11;

/** El número de operación puede faltar: el caso de uso responde «El número de operación es obligatorio». */
export const PagoSchema = z.object({
  conceptoIds: z
    .array(id("Cuota no válida"), { message: "Selecciona al menos una cuota pendiente." })
    .min(1, "Selecciona al menos una cuota pendiente.")
    .max(MAXIMO_CUOTAS_POR_PAGO, "Demasiadas cuotas en un solo pago."),
  monto: z
    .string({ message: "Ingresa el monto de la operación" })
    .trim()
    .regex(/^\d{1,7}(\.\d{1,2})?$/, "Ingresa un monto mayor a 0 con hasta dos decimales (por ejemplo, 900.00)."),
  medioPago: z.enum(MEDIOS_PAGO, { message: "Elige el medio de pago" }),
  numeroOperacion: z
    .string()
    .max(LARGO_MAXIMO_NUMERO_OPERACION, "Número de operación demasiado largo")
    .nullable()
    .optional(),
  fechaPago: fecha("Fecha de pago no válida"),
});

/** US58: el pago anual no elige cuotas; paga todas las Pendiente de la matrícula. */
export const PagoAnualSchema = PagoSchema.omit({ conceptoIds: true });

/** El motivo puede faltar: el caso de uso responde «Selecciona el motivo de la anulación.». */
export const AnularPagoSchema = z.object({
  motivo: z.enum(MOTIVOS_ANULACION_PAGO, { message: "Selecciona el motivo de la anulación." }).nullable().optional(),
  detalle: z.string().trim().max(300, "Observación demasiado larga").nullable().optional(),
});

export const DescartarPagoSchema = z.object({
  detalle: z.string().trim().max(300, "Observación demasiado larga").nullable().optional(),
});

export const ConsultaEstadoCuentaSchema = z.object({ anioId: id("Año académico no válido").optional() });

/** Máximo del filtro «Meses adeudados» (3 = «3 o más»). */
const MESES_MINIMOS_MAXIMO = 12;

export const FiltroMorosidadSchema = z.object({
  anioId: id("Elige el año académico"),
  gradoId: id("Grado no válido").optional(),
  seccionId: id("Sección no válida").optional(),
  mesesMinimos: z.coerce.number().int().min(1).max(MESES_MINIMOS_MAXIMO).optional(),
  orden: z.enum(ORDENES_MOROSIDAD).default("MONTO"),
});

// ---------- Portal del apoderado (US42, US43) ----------

export const ElegirHijoSchema = z.object({ estudianteId: id("Elige un estudiante") });
