// Pruebas de las reglas puras de identidad (sin base de datos). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { randomInt } from "node:crypto";
import {
  esRol,
  expiracionSesion,
  generarPasswordTemporal,
  incumplimientosPassword,
  minutosRestantes,
  normalizarEmail,
  puedeIniciarSesion,
  registrarIntentoFallido,
} from "@/modules/identidad/domain/reglas";

describe("política de contraseñas (AC-06)", () => {
  it("acepta una contraseña con 8+ caracteres, mayúscula y número", () => {
    expect(incumplimientosPassword("Colegio2026")).toEqual([]);
  });
  it("informa cada requisito que falta", () => {
    expect(incumplimientosPassword("abc")).toEqual(["Mínimo 8 caracteres", "Al menos una mayúscula", "Al menos un número"]);
    expect(incumplimientosPassword("colegio2026")).toEqual(["Al menos una mayúscula"]);
    expect(incumplimientosPassword("ColegioKubo")).toEqual(["Al menos un número"]);
  });
  it("rechaza más de 72 bytes (límite de bcrypt)", () => {
    expect(incumplimientosPassword("A1" + "x".repeat(71))).toContain("Máximo 72 caracteres");
  });
});

describe("contraseña temporal (RF43)", () => {
  it("siempre cumple la política y tiene 12 caracteres", () => {
    for (let i = 0; i < 500; i++) {
      const p = generarPasswordTemporal(randomInt);
      expect(p).toHaveLength(12);
      expect(incumplimientosPassword(p)).toEqual([]);
    }
  });
});

describe("bloqueo por intentos fallidos (RF01, AC-03)", () => {
  const ahora = new Date("2026-10-01T10:00:00Z");
  it("suma intentos sin bloquear antes del máximo", () => {
    expect(registrarIntentoFallido(3, 5, 15, ahora)).toEqual({ intentosFallidos: 4, bloqueadoHasta: null });
  });
  it("bloquea al llegar al máximo y reinicia el contador", () => {
    const r = registrarIntentoFallido(4, 5, 15, ahora);
    expect(r.intentosFallidos).toBe(0);
    expect(r.bloqueadoHasta?.toISOString()).toBe("2026-10-01T10:15:00.000Z");
  });
  it("redondea hacia arriba los minutos restantes, mínimo 1", () => {
    expect(minutosRestantes(new Date("2026-10-01T10:14:30Z"), ahora)).toBe(15);
    expect(minutosRestantes(new Date("2026-10-01T10:00:10Z"), ahora)).toBe(1);
  });
});

describe("otras reglas", () => {
  it("solo ACTIVO y PENDIENTE_ACTIVACION pueden iniciar sesión", () => {
    expect(puedeIniciarSesion("ACTIVO")).toBe(true);
    expect(puedeIniciarSesion("PENDIENTE_ACTIVACION")).toBe(true);
    expect(puedeIniciarSesion("SUSPENDIDO")).toBe(false);
    expect(puedeIniciarSesion("DADO_DE_BAJA")).toBe(false);
  });
  it("normaliza correos", () => {
    expect(normalizarEmail("  Rosa.Huaman@Kubo.EDU.pe ")).toBe("rosa.huaman@kubo.edu.pe");
  });
  it("valida roles", () => {
    expect(esRol("DOCENTE")).toBe(true);
    expect(esRol("ROOT")).toBe(false);
  });
  it("la sesión dura 12 horas o 7 días con «Recordarme»", () => {
    const t = new Date("2026-10-01T00:00:00Z");
    expect(expiracionSesion(false, t).toISOString()).toBe("2026-10-01T12:00:00.000Z");
    expect(expiracionSesion(true, t).toISOString()).toBe("2026-10-08T00:00:00.000Z");
  });
});
