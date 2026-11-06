// Pruebas del log de errores (US05): clasificador 400 frente a 500, redactor de textos y un 500 controlado en ruta()
// con la base de datos simulada (no se agrega ninguna ruta de prueba). Ejecutar: npm test
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const creado = vi.hoisted(() => ({ filas: [] as Record<string, unknown>[] }));
vi.mock("@/platform/db/prisma", () => ({
  prisma: {
    logError: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        creado.filas.push(data);
        return data;
      }),
    },
  },
}));

const { clasificarError, politicaDeRegistro } = await import("@/platform/http/clasificador");
const { ErrorApp } = await import("@/platform/http/errores");
const { ruta } = await import("@/platform/http/ruta");
const { logger, redactarTexto } = await import("@/platform/logger");
const { firmarAcceso } = await import("@/platform/auth/jwt");

describe("clasificador de errores (US05)", () => {
  it("un error no controlado es 500: ERROR, en log_error y con stack trace", () => {
    const c = clasificarError(new TypeError("Cannot read properties of undefined"));
    expect(c).toMatchObject({ tipo: "INTERNO", estado: 500, codigo: "ERROR_INTERNO" });
    expect(politicaDeRegistro(c)).toEqual({ nivel: "ERROR", enTabla: true, conStack: true });
  });
  it("un 400 de validación (Zod, JSON o ErrorApp 400) es solo un evento INFO, sin stack trace", () => {
    const zod = z.object({ email: z.string().email() }).safeParse({ email: "x" });
    for (const e of [zod.error, new SyntaxError("JSON"), new ErrorApp("MONTO_INVALIDO", "Monto no válido", 400)]) {
      const c = clasificarError(e);
      expect(c.tipo).toBe("VALIDACION");
      expect(c.estado).toBe(400);
      expect(politicaDeRegistro(c)).toEqual({ nivel: "INFO", enTabla: true, conStack: false });
    }
    expect(clasificarError(zod.error)).toMatchObject({
      codigo: "DATOS_INVALIDOS",
      detalles: { email: expect.any(String) },
    });
  });
  it("otros rechazos esperados (401, 409, 422) solo van como INFO al log, no a log_error", () => {
    for (const estado of [401, 409, 422]) {
      const c = clasificarError(new ErrorApp("RECHAZO", "Rechazado", estado));
      expect(c).toMatchObject({ tipo: "NEGOCIO", estado });
      expect(politicaDeRegistro(c)).toEqual({ nivel: "INFO", enTabla: false, conStack: false });
    }
  });
  it("un error de un trigger con código se convierte en 422 legible", () => {
    const c = clasificarError(
      new Error("ERROR: AFORO_EXCEDE_AULA: el aforo de la sección (32) supera el del aula (28)"),
    );
    expect(c).toMatchObject({ tipo: "NEGOCIO", estado: 422, codigo: "AFORO_EXCEDE_AULA" });
  });
});

describe("redactor de textos del log", () => {
  it("oculta DNI, correos y tokens en mensajes y stack traces", () => {
    const texto =
      "Fallo con DNI 71234567 de carmen.rojas@correo.pe usando Bearer abc.def-ghi y eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl";
    expect(redactarTexto(texto)).toBe("Fallo con DNI [dni] de [correo] usando Bearer [token] y [token]");
  });
  it("no toca números de línea, horas, montos ni uuids", () => {
    const stack = "at registrar (pagos.ts:88:12) 10:15 S/ 450.00 id 3f1c2a4e-1111-4b2c-9d3e-123456789abc";
    expect(redactarTexto(stack)).toBe(stack);
  });
  it("los campos con nombre sensible se ocultan", () => {
    expect(logger.ocultar({ dni: "71234567", telefono: "987654321", password: "x", monto: "450.00" })).toEqual({
      dni: "[oculto]",
      telefono: "[oculto]",
      password: "[oculto]",
      monto: "450.00",
    });
  });
});

describe("ruta() ante un 500 controlado (US05)", () => {
  const usuarioId = "ef9d38c2-d9a3-4693-ad72-d5255df662ea";
  vi.stubEnv("JWT_SECRET", "secreto-de-prueba-solo-para-vitest-0123456789");
  const espiaError = vi.spyOn(logger, "error").mockImplementation(() => undefined);
  const espiaInfo = vi.spyOn(logger, "info").mockImplementation(() => undefined);

  beforeEach(() => {
    creado.filas.length = 0;
    espiaError.mockClear();
    espiaInfo.mockClear();
  });
  afterAll(() => vi.unstubAllEnvs());

  it("registra timestamp, endpoint, método, stack trace completo, usuario y requestId, y responde 500 sin el detalle", async () => {
    const token = await firmarAcceso({ sub: usuarioId, sid: "sesion", rol: "ADMINISTRADOR" });
    const manejador = ruta(async () => {
      throw new Error("Fallo controlado para la prueba (DNI 71234567)");
    });
    const req = new NextRequest("http://localhost/api/v1/prueba/fallo", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "x-request-id": "req-prueba-500" },
    });
    const res = await manejador(req, { params: Promise.resolve({}) });
    const cuerpo = await res.json();

    expect(res.status).toBe(500);
    expect(cuerpo.error).toEqual({
      code: "ERROR_INTERNO",
      message: "Ocurrió un error inesperado. Inténtalo nuevamente en unos minutos.",
      details: { requestId: "req-prueba-500" },
    });
    expect(JSON.stringify(cuerpo)).not.toContain("at ");

    expect(creado.filas).toHaveLength(1);
    const fila = creado.filas[0];
    expect(fila).toMatchObject({
      requestId: "req-prueba-500",
      usuarioId,
      endpoint: "/api/v1/prueba/fallo",
      metodoHttp: "POST",
      codigoHttp: 500,
      nivel: "ERROR",
      mensaje: "Fallo controlado para la prueba (DNI [dni])",
    });
    expect(String(fila.stackTrace)).toContain("Error: Fallo controlado para la prueba (DNI [dni])");
    expect(String(fila.stackTrace)).toMatch(/\n\s+at /);

    expect(espiaError).toHaveBeenCalledWith(
      "Error no controlado",
      expect.objectContaining({
        requestId: "req-prueba-500",
        endpoint: "/api/v1/prueba/fallo",
        metodo: "POST",
        usuarioId,
      }),
    );
  });

  it("un 400 de validación solo deja un evento INFO, sin stack trace", async () => {
    const manejador = ruta(async () => {
      z.object({ monto: z.string() }).parse({});
      return new Response(null);
    });
    const res = await manejador(new NextRequest("http://localhost/api/v1/prueba/validacion", { method: "POST" }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
    expect(espiaError).not.toHaveBeenCalled();
    expect(espiaInfo).toHaveBeenCalledWith(
      "Datos inválidos",
      expect.not.objectContaining({ stack: expect.anything() }),
    );
    expect(creado.filas).toEqual([
      expect.objectContaining({ codigoHttp: 400, nivel: "INFO", stackTrace: null, usuarioId: null }),
    ]);
  });
});
