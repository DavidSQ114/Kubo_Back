// Pruebas de las reglas puras de las notificaciones internas y de la bandeja de salida de correos (US55).
import { describe, expect, it } from "vitest";
import {
  esEnlaceInterno,
  finDeReserva,
  inicioVentana,
  MAX_INTENTOS_CORREO,
  minutosDeEspera,
  normalizarAvisos,
  recortar,
  resultadoDelIntento,
  verificarPropias,
  type AvisoInterno,
} from "@/platform/notificaciones/reglas";

const ahora = new Date("2026-11-18T15:00:00Z");
const USUARIO_A = "11111111-1111-4111-8111-111111111111";
const USUARIO_B = "22222222-2222-4222-8222-222222222222";

const aviso = (c: Partial<AvisoInterno> = {}): AvisoInterno => ({
  usuarioId: USUARIO_A,
  tipo: "NOTAS",
  titulo: "Notas publicadas",
  mensaje: "Valeria: Matemática · Bimestre II",
  enlace: "/apoderado/notas",
  ...c,
});

describe("panel de notificaciones (US55, M-11 a M-14)", () => {
  it("muestra los avisos de los últimos 30 días", () => {
    expect(inicioVentana(ahora).toISOString()).toBe("2026-10-19T15:00:00.000Z");
  });

  it("recorta los textos largos con «…» y normaliza los espacios", () => {
    expect(recortar("  Horario   de 3° B  ", 50)).toBe("Horario de 3° B");
    expect(recortar("abcdefghij", 6)).toBe("abcde…");
    expect(recortar("abcdef", 6)).toBe("abcdef");
  });

  it("acepta solo enlaces internos del portal", () => {
    expect(esEnlaceInterno("/apoderado/pagos")).toBe(true);
    expect(esEnlaceInterno("/admin/notas?pestana=rectificaciones")).toBe(true);
    expect(esEnlaceInterno("https://otro.sitio/robo")).toBe(false);
    expect(esEnlaceInterno("//otro.sitio")).toBe(false);
    expect(esEnlaceInterno("javascript:alert(1)")).toBe(false);
  });
});

describe("notificaciones listas para guardar (US55)", () => {
  it("una persona no recibe dos veces el mismo aviso", () => {
    const r = normalizarAvisos([aviso(), aviso(), aviso({ usuarioId: USUARIO_B })]);
    expect(r.map((a) => a.usuarioId)).toEqual([USUARIO_A, USUARIO_B]);
  });

  it("avisos distintos al mismo usuario se conservan", () => {
    expect(normalizarAvisos([aviso(), aviso({ mensaje: "Diego: Comunicación · Bimestre II" })])).toHaveLength(2);
  });

  it("recorta el título a 120 y el mensaje a 300 caracteres y descarta un enlace externo", () => {
    const [r] = normalizarAvisos([aviso({ titulo: "t".repeat(200), mensaje: "m".repeat(500), enlace: "https://x.y" })]);
    expect(r.titulo).toHaveLength(120);
    expect(r.mensaje).toHaveLength(300);
    expect(r.enlace).toBeNull();
  });
});

describe("solo el destinatario marca sus notificaciones (US55, seguridad)", () => {
  it("deja marcar las propias", () => {
    expect(() => verificarPropias(["a", "b"], ["a", "b", "c"])).not.toThrow();
  });

  it("una notificación ajena o inexistente responde 404 sin revelar de quién es", () => {
    expect(() => verificarPropias(["a", "ajena"], ["a"])).toThrowError(
      expect.objectContaining({ codigo: "NOTIFICACION_NO_ENCONTRADA", estadoHttp: 404 }),
    );
  });
});

describe("reintento del correo sin revertir la operación (US55, criterio 3)", () => {
  it("un envío correcto deja el correo PROCESADO", () => {
    expect(resultadoDelIntento(0, true, ahora)).toEqual({ estado: "PROCESADO", intentos: 1, proximoIntento: null });
  });

  it("un fallo deja el correo PENDIENTE con una espera creciente", () => {
    expect(minutosDeEspera(1)).toBe(5);
    expect(minutosDeEspera(2)).toBe(10);
    expect(minutosDeEspera(4)).toBe(40);
    const r = resultadoDelIntento(0, false, ahora);
    expect(r).toMatchObject({ estado: "PENDIENTE", intentos: 1 });
    expect(r.proximoIntento?.toISOString()).toBe("2026-11-18T15:05:00.000Z");
    expect(resultadoDelIntento(3, false, ahora).proximoIntento?.toISOString()).toBe("2026-11-18T15:40:00.000Z");
  });

  it("al quinto intento fallido queda FALLIDO y no se reintenta más", () => {
    expect(MAX_INTENTOS_CORREO).toBe(5);
    expect(resultadoDelIntento(4, false, ahora)).toEqual({ estado: "FALLIDO", intentos: 5, proximoIntento: null });
  });

  it("el quinto intento todavía puede enviarse", () => {
    expect(resultadoDelIntento(4, true, ahora).estado).toBe("PROCESADO");
  });

  it("un correo tomado para enviar queda reservado 10 minutos", () => {
    expect(finDeReserva(ahora).toISOString()).toBe("2026-11-18T15:10:00.000Z");
  });
});
