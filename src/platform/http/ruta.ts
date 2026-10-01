// platform/http: envoltorio de cada Route Handler.
// - Genera un requestId y lo devuelve en la cabecera x-request-id.
// - Convierte errores en la respuesta estándar { error: { code, message, details } }.
// - 4xx se registran como INFO; errores no controlados como ERROR en log y en la tabla log_error (RNF04).
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/platform/db/prisma";
import { logger } from "@/platform/logger";
import { ErrorApp } from "./errores";

export interface MetaSolicitud {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
}

export interface ContextoRuta {
  meta: MetaSolicitud;
  params: Record<string, string>;
}

type Manejador = (req: NextRequest, ctx: ContextoRuta) => Promise<Response>;

/** Respuesta de éxito: { data }. */
export function ok<T>(data: T, estado = 200): NextResponse {
  return NextResponse.json({ data }, { status: estado });
}

function respuestaError(codigo: string, mensaje: string, estado: number, detalles?: unknown) {
  return NextResponse.json({ error: { code: codigo, message: mensaje, details: detalles ?? {} } }, { status: estado });
}

function detallesZod(e: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of e.issues) {
    const clave = issue.path.join(".") || "_";
    if (!campos[clave]) campos[clave] = issue.message;
  }
  return campos;
}

/** Convierte errores lanzados por la base de datos (triggers con código al inicio). */
function errorDeBaseDeDatos(e: unknown): ErrorApp | null {
  const texto = String((e as { message?: string })?.message ?? "");
  const m = texto.match(
    /\b(AFORO_EXCEDE_AULA|RESPONSABLE_NO_VINCULADO|DETALLE_INCOHERENTE|REGISTRO_AUDITORIA_INMUTABLE)\b/,
  );
  if (!m) return null;
  const mensajes: Record<string, string> = {
    AFORO_EXCEDE_AULA: "El aforo de la sección supera la capacidad del aula.",
    RESPONSABLE_NO_VINCULADO: "El apoderado responsable no está vinculado a este estudiante.",
    DETALLE_INCOHERENTE: "La sección o el docente no coinciden con la asignación.",
    REGISTRO_AUDITORIA_INMUTABLE: "La bitácora de auditoría no se puede modificar.",
  };
  return new ErrorApp(m[1], mensajes[m[1]], 422);
}

export function ruta(manejador: Manejador) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: NextRequest, contexto: { params: Promise<any> }): Promise<Response> => {
    const meta: MetaSolicitud = {
      requestId: req.headers.get("x-request-id") ?? randomUUID(),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    };
    const endpoint = new URL(req.url).pathname;
    let respuesta: Response;
    try {
      const params = ((await contexto?.params) ?? {}) as Record<string, string>;
      respuesta = await manejador(req, { meta, params });
    } catch (e) {
      const app = e instanceof ErrorApp ? e : errorDeBaseDeDatos(e);
      if (app) {
        logger.info("Solicitud rechazada", {
          requestId: meta.requestId,
          endpoint,
          metodo: req.method,
          codigo: app.codigo,
          estado: app.estadoHttp,
        });
        respuesta = respuestaError(app.codigo, app.message, app.estadoHttp, app.detalles);
      } else if (e instanceof ZodError) {
        logger.info("Datos inválidos", { requestId: meta.requestId, endpoint, metodo: req.method });
        respuesta = respuestaError("DATOS_INVALIDOS", "Revisa los datos ingresados.", 400, detallesZod(e));
      } else if (e instanceof SyntaxError) {
        respuesta = respuestaError("JSON_INVALIDO", "La solicitud no tiene un formato válido.", 400);
      } else {
        const err = e as Error;
        logger.error("Error no controlado", {
          requestId: meta.requestId,
          endpoint,
          metodo: req.method,
          error: err?.message,
          stack: err?.stack,
        });
        await prisma.logError
          .create({
            data: {
              requestId: meta.requestId,
              endpoint,
              metodoHttp: req.method,
              codigoHttp: 500,
              nivel: "ERROR",
              mensaje: (err?.message ?? "Error desconocido").slice(0, 2000),
              stackTrace: err?.stack?.slice(0, 8000) ?? null,
              ipOrigen: meta.ip,
            },
          })
          .catch(() => undefined);
        respuesta = respuestaError(
          "ERROR_INTERNO",
          "Ocurrió un error inesperado. Inténtalo nuevamente en unos minutos.",
          500,
          { requestId: meta.requestId },
        );
      }
    }
    respuesta.headers.set("x-request-id", meta.requestId);
    return respuesta;
  };
}

/** Lee y valida el cuerpo JSON con un esquema Zod (lanza ZodError si no cumple). */
export async function leerCuerpo<T>(req: NextRequest, esquema: { parse: (v: unknown) => T }): Promise<T> {
  const texto = await req.text();
  return esquema.parse(texto ? JSON.parse(texto) : {});
}

/** URL pública de la aplicación (para enlaces en correos). En producción se define APP_URL. */
export function urlBase(req: NextRequest): string {
  return process.env.APP_URL ?? new URL(req.url).origin;
}
