// platform/http: envoltorio de cada Route Handler.
// - Genera un requestId y lo devuelve en la cabecera x-request-id.
// - Convierte errores en la respuesta estándar { error: { code, message, details } }.
// - 4xx se registran como INFO (los 400 de validación también en log_error, sin stack trace); los errores no
//   controlados, como ERROR con el stack trace completo en el log y en la tabla log_error (US05, RNF04).
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { leerTokenAcceso } from "@/platform/auth/cookies";
import { verificarAcceso } from "@/platform/auth/jwt";
import { prisma } from "@/platform/db/prisma";
import { logger, redactarTexto } from "@/platform/logger";
import { clasificarError, politicaDeRegistro, type ErrorClasificado } from "./clasificador";

/** Largo máximo del mensaje en log_error (el stack trace se guarda completo). */
const LARGO_MAXIMO_MENSAJE = 2000;

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

/**
 * Respuesta con un PDF (US20, US25). `nombreArchivo` no debe llevar datos personales (DNI, nombres): se usa en la
 * cabecera Content-Disposition, que pueden registrar los proxies.
 */
export function pdf(bytes: Uint8Array, nombreArchivo: string, disposicion: "attachment" | "inline" = "attachment") {
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposicion}; filename="${nombreArchivo.replace(/[^\w.-]/g, "_")}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

function respuestaError(codigo: string, mensaje: string, estado: number, detalles?: unknown) {
  return NextResponse.json({ error: { code: codigo, message: mensaje, details: detalles ?? {} } }, { status: estado });
}

/** Usuario de la sesión, si la petición trae un token de acceso válido (para el log de un 500, US05). */
async function usuarioDeLaPeticion(req: NextRequest): Promise<string | null> {
  try {
    const token = leerTokenAcceso(req);
    return token ? ((await verificarAcceso(token))?.sub ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Registra la excepción según su clasificación (US05, RNF04):
 * - 500: log ERROR con timestamp, endpoint, método, usuario, requestId y stack trace completo, y fila ERROR en
 *   log_error;
 * - 400 de validación: evento INFO sin stack trace (en el log y en log_error);
 * - otros rechazos esperados: solo un evento INFO en el log.
 * Los textos pasan por el redactor (DNI, correos y tokens) y los campos sensibles se ocultan por nombre.
 */
async function registrarExcepcion(req: NextRequest, meta: MetaSolicitud, e: unknown, c: ErrorClasificado) {
  const politica = politicaDeRegistro(c);
  const endpoint = new URL(req.url).pathname;
  const usuarioId = politica.enTabla ? await usuarioDeLaPeticion(req) : null;
  const err = e as Error;
  const mensaje = redactarTexto(politica.conStack ? (err?.message ?? "Error desconocido") : c.mensaje);
  const stack = politica.conStack && err?.stack ? redactarTexto(err.stack) : null;
  const evento = {
    requestId: meta.requestId,
    endpoint,
    metodo: req.method,
    estado: c.estado,
    codigo: c.codigo,
    usuarioId,
    ...(politica.conStack ? { error: mensaje, stack } : {}),
  };
  if (politica.nivel === "ERROR") logger.error("Error no controlado", evento);
  else logger.info(c.tipo === "VALIDACION" ? "Datos inválidos" : "Solicitud rechazada", evento);
  if (!politica.enTabla) return;
  await prisma.logError
    .create({
      data: {
        requestId: meta.requestId,
        usuarioId,
        endpoint,
        metodoHttp: req.method,
        codigoHttp: c.estado,
        nivel: politica.nivel,
        mensaje: mensaje.slice(0, LARGO_MAXIMO_MENSAJE),
        stackTrace: stack,
        metadatos: { codigo: c.codigo },
        ipOrigen: meta.ip,
      },
    })
    .catch(() => undefined);
}

export function ruta(manejador: Manejador) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js entrega params sin tipo
  return async (req: NextRequest, contexto: { params: Promise<any> }): Promise<Response> => {
    const meta: MetaSolicitud = {
      requestId: req.headers.get("x-request-id") ?? randomUUID(),
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    };
    let respuesta: Response;
    try {
      const params = ((await contexto?.params) ?? {}) as Record<string, string>;
      respuesta = await manejador(req, { meta, params });
    } catch (e) {
      const c = clasificarError(e);
      await registrarExcepcion(req, meta, e, c);
      respuesta =
        c.tipo === "INTERNO"
          ? respuestaError(c.codigo, c.mensaje, c.estado, { requestId: meta.requestId })
          : respuestaError(c.codigo, c.mensaje, c.estado, c.detalles);
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
