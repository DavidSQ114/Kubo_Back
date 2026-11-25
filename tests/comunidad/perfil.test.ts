// Pruebas de las reglas puras de «Mi perfil» (bloque M1): qué cambia y qué se audita. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { cambiosDePerfilPropio } from "@/modules/comunidad/domain/perfil";

describe("cambios del propio perfil (bloque M1)", () => {
  const actual = { telefono: "987654321", direccion: "Av. Ficticia 123, Lima" };

  it("solo audita los campos que cambian, con el valor anterior y el nuevo", () => {
    expect(cambiosDePerfilPropio(actual, { telefono: "912345678", direccion: "Av. Ficticia 123, Lima" })).toEqual({
      anterior: { telefono: "987654321" },
      nuevo: { telefono: "912345678" },
    });
  });

  it("un campo vacío o null se borra; uno que no se envía no cambia", () => {
    expect(cambiosDePerfilPropio(actual, { direccion: "  " })).toEqual({
      anterior: { direccion: "Av. Ficticia 123, Lima" },
      nuevo: { direccion: null },
    });
    expect(cambiosDePerfilPropio(actual, { telefono: null })).toEqual({
      anterior: { telefono: "987654321" },
      nuevo: { telefono: null },
    });
  });

  it("sin cambios no hay nada que guardar ni auditar", () => {
    expect(cambiosDePerfilPropio(actual, {})).toEqual({ anterior: {}, nuevo: {} });
    expect(cambiosDePerfilPropio(actual, { telefono: "987654321" })).toEqual({ anterior: {}, nuevo: {} });
  });
});
