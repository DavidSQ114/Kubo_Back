// Pruebas de las reglas puras del registro de estudiantes y sus vínculos (US17, RF13). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { accionPerfil, planVinculoNuevo, verificarVinculosIniciales } from "@/modules/comunidad/domain/vinculos";
import { erroresComunidad as E } from "@/modules/comunidad/domain/errores";
import { esquemasComunidad } from "@/modules/comunidad";

const APODERADO = "1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const GRADO = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const valido = {
  dni: "78451236",
  nombres: "Valeria Sofía",
  apellidos: "Quispe Rojas",
  fechaNacimiento: "2012-04-22",
  gradoIngresoId: GRADO,
  apoderados: [{ apoderadoId: APODERADO, parentesco: "Madre", esPrincipal: true }],
};

describe("apoderados de un estudiante nuevo (US17)", () => {
  it("acepta uno o más apoderados con exactamente un principal", () => {
    expect(() => verificarVinculosIniciales([{ apoderadoId: "a1", esPrincipal: true }])).not.toThrow();
    const dos = [
      { apoderadoId: "a1", esPrincipal: false },
      { apoderadoId: "a2", esPrincipal: true },
    ];
    expect(() => verificarVinculosIniciales(dos)).not.toThrow();
  });
  it("exige al menos un apoderado", () => {
    expect(() => verificarVinculosIniciales([])).toThrowError(
      expect.objectContaining({
        codigo: "SIN_APODERADO",
        message: "Debe asociar al menos un apoderado antes de continuar",
      }),
    );
  });
  it("rechaza que no haya principal o que haya más de uno", () => {
    const sinPrincipal = [{ apoderadoId: "a1", esPrincipal: false }];
    const dosPrincipales = [
      { apoderadoId: "a1", esPrincipal: true },
      { apoderadoId: "a2", esPrincipal: true },
    ];
    const principalInvalido = expect.objectContaining({ codigo: "PRINCIPAL_INVALIDO" });
    expect(() => verificarVinculosIniciales(sinPrincipal)).toThrowError(principalInvalido);
    expect(() => verificarVinculosIniciales(dosPrincipales)).toThrowError(principalInvalido);
  });
  it("rechaza el mismo apoderado dos veces", () => {
    const repetido = [
      { apoderadoId: "a1", esPrincipal: true },
      { apoderadoId: "a1", esPrincipal: false },
    ];
    expect(() => verificarVinculosIniciales(repetido)).toThrowError(
      expect.objectContaining({ codigo: "APODERADO_REPETIDO" }),
    );
  });
});

describe("vincular un apoderado más (US15 «Vincular a un estudiante»)", () => {
  const actuales = [
    { id: "v1", apoderadoId: "a1", esPrincipal: true },
    { id: "v2", apoderadoId: "a2", esPrincipal: false },
  ];
  it("agrega un apoderado no principal sin tocar el principal", () => {
    expect(planVinculoNuevo(actuales, { apoderadoId: "a3", esPrincipal: false })).toEqual({
      esPrincipal: false,
      quitarPrincipalA: null,
    });
  });
  it("si el nuevo es principal, el anterior deja de serlo (queda uno solo)", () => {
    expect(planVinculoNuevo(actuales, { apoderadoId: "a3", esPrincipal: true })).toEqual({
      esPrincipal: true,
      quitarPrincipalA: "v1",
    });
  });
  it("si el estudiante no tenía principal, el nuevo lo es", () => {
    expect(planVinculoNuevo([], { apoderadoId: "a3", esPrincipal: false }).esPrincipal).toBe(true);
  });
  it("rechaza un apoderado ya vinculado", () => {
    expect(() => planVinculoNuevo(actuales, { apoderadoId: "a2", esPrincipal: false })).toThrowError(
      expect.objectContaining({ codigo: "VINCULO_EXISTENTE", estadoHttp: 409 }),
    );
  });
});

describe("perfil Estudiante según el DNI (US17)", () => {
  it("rechaza un DNI que ya es estudiante", () => {
    expect(() => accionPerfil({ activo: true }, E.estudianteExistente)).toThrowError(
      expect.objectContaining({
        codigo: "ESTUDIANTE_EXISTENTE",
        message: "Ya existe un estudiante registrado con este DNI",
      }),
    );
  });
  it("agrega el perfil a una persona registrada con otro perfil", () => {
    expect(accionPerfil(null, E.estudianteExistente)).toBe("CREAR");
  });
});

describe("datos del estudiante (US17)", () => {
  const { RegistrarEstudianteSchema } = esquemasComunidad;
  const error = (datos: object) =>
    RegistrarEstudianteSchema.safeParse({ ...valido, ...datos }).error?.issues[0]?.message;

  it("acepta los datos obligatorios; sexo, colegio y dirección son opcionales y no es borrador por defecto", () => {
    const r = RegistrarEstudianteSchema.parse({ ...valido, colegioProcedencia: "  " });
    expect(r.borrador).toBe(false);
    expect(r.colegioProcedencia).toBeNull();
    expect(r.apoderados[0].autorizado).toBe(true);
    expect(RegistrarEstudianteSchema.safeParse({ ...valido, sexo: "FEMENINO" }).success).toBe(true);
  });
  it("sin apoderados muestra el mensaje del Backlog", () => {
    expect(error({ apoderados: [] })).toBe("Debe asociar al menos un apoderado antes de continuar");
    expect(error({ apoderados: undefined })).toBe("Debe asociar al menos un apoderado antes de continuar");
  });
  it("exige DNI de 8 dígitos y grado de ingreso", () => {
    expect(error({ dni: "784512" })).toBe("El DNI debe tener 8 dígitos");
    expect(error({ gradoIngresoId: undefined })).toBe("Elige el grado de ingreso");
  });
  it("rechaza fechas de nacimiento inexistentes o con otro formato", () => {
    expect(error({ fechaNacimiento: "2012-02-31" })).toBe("La fecha de nacimiento no es válida");
    expect(error({ fechaNacimiento: "2012-13-01" })).toBe("La fecha de nacimiento no es válida");
    expect(error({ fechaNacimiento: "22/04/2012" })).toBe("La fecha de nacimiento debe tener el formato AAAA-MM-DD");
  });
});
