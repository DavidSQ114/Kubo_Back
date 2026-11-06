// Pruebas de las reglas puras para agregar un perfil a una persona ya registrada (defecto D-07, AD-07).
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { mismaPersona, normalizarNombre, verificarMismaPersona } from "@/modules/comunidad/domain/personas";
import { esquemasComunidad } from "@/modules/comunidad";

const registrada = { nombres: "María José", apellidos: "Quispe Huamán" };

describe("misma persona por DNI (D-07)", () => {
  it("normaliza mayúsculas, tildes y espacios", () => {
    expect(normalizarNombre("  MARÍA   José ")).toBe("maria jose");
    expect(normalizarNombre("Ñuflo")).toBe("nuflo");
  });
  it("acepta los mismos nombres sin distinguir mayúsculas ni tildes", () => {
    expect(mismaPersona(registrada, { nombres: "maria jose", apellidos: "QUISPE HUAMAN" })).toBe(true);
    expect(() =>
      verificarMismaPersona(registrada, { nombres: "María  José", apellidos: "Quispe Huamán" }),
    ).not.toThrow();
  });
  it("rechaza otros nombres o apellidos con PERSONA_NO_COINCIDE y el nombre registrado", () => {
    for (const enviada of [
      { nombres: "Mario José", apellidos: "Quispe Huamán" },
      { nombres: "María José", apellidos: "Quispe Rojas" },
    ]) {
      expect(() => verificarMismaPersona(registrada, enviada)).toThrowError(
        expect.objectContaining({
          codigo: "PERSONA_NO_COINCIDE",
          message: "El DNI ya pertenece a otra persona (María José Quispe Huamán). Verifica el DNI.",
        }),
      );
    }
  });
});

describe("consulta por DNI (D-07)", () => {
  it("acepta 8 dígitos y rechaza otros formatos", () => {
    expect(esquemasComunidad.ConsultaPersonaSchema.parse({ dni: " 45872136 " }).dni).toBe("45872136");
    expect(esquemasComunidad.ConsultaPersonaSchema.safeParse({ dni: "4587213" }).success).toBe(false);
    expect(esquemasComunidad.ConsultaPersonaSchema.safeParse({}).success).toBe(false);
  });
});
