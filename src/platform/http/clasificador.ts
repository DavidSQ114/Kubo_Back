// platform/http: clasifica las excepciones de una ruta (US05, RNF04) para decidir la respuesta y qué se registra:
// - error interno (500): log ERROR con stack trace completo y fila ERROR en log_error;
// - validación (400): solo un evento INFO, sin stack trace (en el log y en log_error);
// - otros rechazos esperados (401, 403, 404, 409, 422…): solo un evento INFO en el log.
import { ZodError } from "zod";
import { ErrorApp } from "./errores";

export type TipoError = "NEGOCIO" | "VALIDACION" | "INTERNO";

export interface ErrorClasificado {
  tipo: TipoError;
  estado: number;
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

export interface PoliticaRegistro {
  nivel: "INFO" | "ERROR";
  /** ¿Se guarda una fila en log_error? */
  enTabla: boolean;
  /** ¿Se guarda el stack trace? Solo en los errores internos. */
  conStack: boolean;
}

const ESTADO_VALIDACION = 400;
const ESTADO_INTERNO = 500;

export const MENSAJE_ERROR_INTERNO = "Ocurrió un error inesperado. Inténtalo nuevamente en unos minutos.";

function detallesZod(e: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of e.issues) {
    const clave = issue.path.join(".") || "_";
    if (!campos[clave]) campos[clave] = issue.message;
  }
  return campos;
}

const MENSAJES_BD: Record<string, string> = {
  AFORO_EXCEDE_AULA: "El aforo de la sección supera la capacidad del aula.",
  RESPONSABLE_NO_VINCULADO: "El apoderado responsable no está vinculado a este estudiante.",
  DETALLE_INCOHERENTE: "La sección o el docente no coinciden con la asignación.",
  REGISTRO_AUDITORIA_INMUTABLE: "La bitácora de auditoría no se puede modificar.",
};

/** Convierte errores lanzados por la base de datos (triggers con código al inicio). */
export function errorDeBaseDeDatos(e: unknown): ErrorApp | null {
  const texto = String((e as { message?: string })?.message ?? "");
  const m = texto.match(
    /\b(AFORO_EXCEDE_AULA|RESPONSABLE_NO_VINCULADO|DETALLE_INCOHERENTE|REGISTRO_AUDITORIA_INMUTABLE)\b/,
  );
  if (!m) return null;
  // El trigger de aforo informa ambos números: «el aforo de la sección (32) supera el del aula (28)».
  const aforos = m[1] === "AFORO_EXCEDE_AULA" ? texto.match(/secci\S*n \((\d+)\) supera el del aula \((\d+)\)/) : null;
  if (aforos) {
    const [, seccion, aula] = aforos;
    return new ErrorApp(m[1], `El aforo de la sección (${seccion}) supera el del aula (${aula}).`, 422, {
      aforoSeccion: Number(seccion),
      aforoAula: Number(aula),
    });
  }
  return new ErrorApp(m[1], MENSAJES_BD[m[1]], 422);
}

/** Qué respuesta corresponde a la excepción. Todo lo que no se reconoce es un error interno (500). */
export function clasificarError(e: unknown): ErrorClasificado {
  const app = e instanceof ErrorApp ? e : errorDeBaseDeDatos(e);
  if (app) {
    return {
      tipo: app.estadoHttp === ESTADO_VALIDACION ? "VALIDACION" : "NEGOCIO",
      estado: app.estadoHttp,
      codigo: app.codigo,
      mensaje: app.message,
      detalles: app.detalles,
    };
  }
  if (e instanceof ZodError) {
    return {
      tipo: "VALIDACION",
      estado: ESTADO_VALIDACION,
      codigo: "DATOS_INVALIDOS",
      mensaje: "Revisa los datos ingresados.",
      detalles: detallesZod(e),
    };
  }
  if (e instanceof SyntaxError) {
    return {
      tipo: "VALIDACION",
      estado: ESTADO_VALIDACION,
      codigo: "JSON_INVALIDO",
      mensaje: "La solicitud no tiene un formato válido.",
    };
  }
  return { tipo: "INTERNO", estado: ESTADO_INTERNO, codigo: "ERROR_INTERNO", mensaje: MENSAJE_ERROR_INTERNO };
}

/** US05: un 500 se registra completo; un 400 de validación, solo como evento informativo sin stack trace. */
export function politicaDeRegistro(c: ErrorClasificado): PoliticaRegistro {
  if (c.tipo === "INTERNO") return { nivel: "ERROR", enTabla: true, conStack: true };
  if (c.tipo === "VALIDACION") return { nivel: "INFO", enTabla: true, conStack: false };
  return { nivel: "INFO", enTabla: false, conStack: false };
}
