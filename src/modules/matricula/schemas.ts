// matricula/schemas: validación de entradas (RNF16) de la matrícula en sección (US18), su anulación (M-19), el
// traslado de sección (US19), el retiro (US57), los pagos (US22, US23, US04), los recordatorios de pago (US59) y los
// argumentos del script de datos de demostración de morosidad.
import { z } from "zod";
import { MOTIVOS_RETIRO } from "./domain/cambios";
import { FECHA_DEMO_POR_DEFECTO } from "./domain/demoMorosidad";
import { DESTINOS_LOTE, LARGO_MAXIMO_CONCEPTO_EXTRA } from "./domain/extraordinarias";
import { LARGO_MAXIMO_MOTIVO_CUOTA } from "./domain/mora";
import { ORDENES_MOROSIDAD } from "./domain/morosidad";
import { LARGO_MAXIMO_NOMBRE_DOCUMENTO, MAXIMO_DOCUMENTOS_REQUERIDOS } from "./domain/proceso";
import { LARGO_MAXIMO_NUMERO_OPERACION, MEDIOS_PAGO, MOTIVOS_ANULACION_PAGO } from "./domain/pagos";
import { MAXIMO_RECORDATORIOS } from "./domain/recordatorios";
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

/**
 * Máximo de cuotas en una operación: la matrícula, la cuota de ingreso, las diez pensiones con sus diez moras y las
 * cuotas extraordinarias del año (bloque M4), con holgura.
 */
const MAXIMO_CUOTAS_POR_PAGO = 40;

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

/** «Enviar recordatorios» (US59, M-24): los estudiantes elegidos en el panel de morosidad, por su matrícula. */
export const RecordatoriosSchema = z.object({
  matriculaIds: z
    .array(id("Estudiante no válido"), { message: "Selecciona al menos un estudiante" })
    .min(1, "Selecciona al menos un estudiante")
    .max(MAXIMO_RECORDATORIOS, `Puedes enviar hasta ${MAXIMO_RECORDATORIOS} recordatorios a la vez`),
});

// ---------- Portal del apoderado (US42, US43) ----------

export const ElegirHijoSchema = z.object({ estudianteId: id("Elige un estudiante") });

// ---------- Pago en línea (US70) y devolución (US71) ----------

export const IntentoPagoSchema = z.object({
  estudianteId: id("Elige un estudiante"),
  conceptoIds: z
    .array(id("Cuota no válida"), { message: "Selecciona al menos una cuota pendiente." })
    .min(1, "Selecciona al menos una cuota pendiente.")
    .max(MAXIMO_CUOTAS_POR_PAGO, "Demasiadas cuotas en un solo pago."),
});

/** Solo con la pasarela falsa (desarrollo y pruebas). */
export const SimularPagoSchema = z.object({
  resultado: z.enum(["APROBADO", "RECHAZADO", "EN_PROCESO", "EXPIRADO"], { message: "Resultado no válido" }),
});

/** Largo máximo aceptado para el id de una order y el tipo del aviso. */
const LARGO_MAXIMO_ID_EXTERNO = 100;
const idExterno = z.string().trim().min(1).max(LARGO_MAXIMO_ID_EXTERNO);

/** Query del aviso «Order (Mercado Pago)»: ?data.id=ORD…&type=order. */
export const ConsultaAvisoPasarelaSchema = z.object({
  "data.id": idExterno.optional(),
  type: idExterno.optional(),
});

/** Cuerpo del aviso; solo se leen el tipo y data.id (el resto lo trae la consulta a la pasarela). */
export const AvisoPasarelaSchema = z.object({
  type: idExterno.optional(),
  action: idExterno.optional(),
  data: z.object({ id: z.union([idExterno, z.number().int().nonnegative()]).transform(String).optional() }).optional(),
});

export const DevolucionSchema = z.object({
  detalle: z.string().trim().max(300, "Observación demasiado larga").nullable().optional(),
});

/** Argumentos de npm run demo:morosidad (scripts/demoMorosidad.ts): --dni <8 dígitos> [--desde AAAA-MM-DD]. */
export const DemoMorosidadSchema = z.object({
  dni: z
    .string({ message: "Indica el DNI del estudiante con --dni" })
    .trim()
    .regex(/^\d{8}$/, "El DNI debe tener 8 dígitos"),
  desde: fecha("La fecha --desde debe tener el formato AAAA-MM-DD").default(FECHA_DEMO_POR_DEFECTO),
});

// ---------- Bloque M4 · Condonar una mora y anular cuotas extraordinarias ----------

/** Motivo obligatorio para condonar una mora o anular una cuota o un lote extraordinario. */
export const MotivoCuotaSchema = z.object({
  motivo: z
    .string({ message: "Escribe el motivo" })
    .trim()
    .min(1, "Escribe el motivo")
    .max(LARGO_MAXIMO_MOTIVO_CUOTA, "Motivo demasiado largo"),
});

export const CondonarMoraSchema = MotivoCuotaSchema;

/** Lote de cuotas extraordinarias (bloque M4); el mismo cuerpo sirve para la vista previa. */
export const LoteExtraordinarioSchema = z.object({
  anioAcademicoId: id("Elige el año académico"),
  concepto: z
    .string({ message: "Escribe el concepto" })
    .trim()
    .min(1, "Escribe el concepto")
    .max(LARGO_MAXIMO_CONCEPTO_EXTRA, `El concepto puede tener hasta ${LARGO_MAXIMO_CONCEPTO_EXTRA} caracteres`),
  monto: z
    .string({ message: "Ingresa el monto" })
    .trim()
    .regex(/^\d{1,7}(\.\d{1,2})?$/, "Ingresa un monto mayor a 0 con hasta dos decimales (por ejemplo, 50.00)."),
  fechaVencimiento: fecha("Fecha de vencimiento no válida"),
  destino: z.enum(DESTINOS_LOTE, { message: "Elige el destino" }),
  destinoId: id("Destino no válido").nullable().optional(),
});

// ---------- Bloque M4 · Proceso de matrícula ----------

export const ProcesoMatriculaSchema = z.object({
  fechaInicio: fecha("Fecha de inicio no válida"),
  fechaFin: fecha("Fecha de fin no válida"),
  documentos: z
    .array(
      z.object({
        id: id("Documento no válido").nullable().optional(),
        nombre: z
          .string({ message: "Escribe el nombre del documento" })
          .trim()
          .min(1, "Escribe el nombre del documento")
          .max(LARGO_MAXIMO_NOMBRE_DOCUMENTO, "Nombre demasiado largo"),
        obligatorio: z.boolean({ message: "Indica si el documento es obligatorio" }),
      }),
      { message: "Agrega los documentos requeridos" },
    )
    .min(1, "Agrega al menos un documento requerido.")
    .max(MAXIMO_DOCUMENTOS_REQUERIDOS, `Puedes pedir hasta ${MAXIMO_DOCUMENTOS_REQUERIDOS} documentos.`),
});

// ---------- Bloque M4 · Matrícula en línea del apoderado ----------

/** Campos de texto del formulario multipart «Matricular» (los archivos van en «documento:<id>»). */
export const SolicitudMatriculaSchema = z.object({
  gradoId: id("Elige el grado al que se matricula"),
  vinculoResponsableId: id("Elige el responsable del pago"),
  confirmaDatos: z
    .enum(["true", "false"], { message: "Confirma que los datos del alumno son correctos." })
    .transform((v) => v === "true"),
});

/** Prefijo de los campos de archivo del formulario: «documento:<id del documento requerido>». */
export const PREFIJO_CAMPO_DOCUMENTO = "documento:";
