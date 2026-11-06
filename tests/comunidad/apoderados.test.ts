// Pruebas de las reglas puras del registro de apoderados (US15, RF12). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { accionPerfil, datosFaltantes, verificarEstudiantesSinRepetir } from "@/modules/comunidad/domain/vinculos";
import { erroresComunidad as E } from "@/modules/comunidad/domain/errores";
import { esquemasComunidad } from "@/modules/comunidad";

const valido = {
  dni: "40125578",
  nombres: "Carmen Julia",
  apellidos: "Rojas Medina",
  fechaNacimiento: "1984-11-03",
  email: "carmen.rojas@correo.pe",
  telefono: "987654321",
  direccion: "Av. Universitaria 1801, San Miguel, Lima",
  ocupacion: "Contadora",
};
const ESTUDIANTE = "6f0b3c2e-8a51-4b8e-9d0e-3c1a2b4d5e6f";

describe("perfil Apoderado según el DNI (US15)", () => {
  const apoderadoExistente = () =>
    E.apoderadoExistente({ apoderadoId: "a1", nombreCompleto: "Carmen", estudiantes: 2 });

  it("crea el perfil si la persona es nueva o solo tiene otro perfil (por ejemplo, Docente)", () => {
    expect(accionPerfil(null, apoderadoExistente)).toBe("CREAR");
  });
  it("reactiva un perfil Apoderado inactivo", () => {
    expect(accionPerfil({ activo: false }, apoderadoExistente)).toBe("REACTIVAR");
  });
  it("rechaza un DNI que ya es apoderado y entrega su id para ofrecer «Vincular a un estudiante»", () => {
    expect(() => accionPerfil({ activo: true }, apoderadoExistente)).toThrowError(
      expect.objectContaining({
        codigo: "APODERADO_EXISTENTE",
        message: "Ya existe un apoderado registrado con este DNI",
        estadoHttp: 409,
        detalles: expect.objectContaining({ apoderadoId: "a1" }),
      }),
    );
  });
});

describe("datos de una persona ya registrada (US15, D-07)", () => {
  it("completa solo los datos que faltaban", () => {
    const registrados = { telefono: null, email: "carmen@kubo.edu.pe", direccion: null };
    const enviados = { telefono: "987654321", email: "otro@correo.pe", direccion: "Jr. Lima 123" };
    expect(datosFaltantes(registrados, enviados)).toEqual({ telefono: "987654321", direccion: "Jr. Lima 123" });
  });
  it("no cambia nada si la persona ya tiene todos sus datos", () => {
    expect(datosFaltantes({ telefono: "912345678" }, { telefono: "987654321" })).toEqual({});
  });
});

describe("datos del apoderado (US15)", () => {
  const { RegistrarApoderadoSchema } = esquemasComunidad;
  const error = (datos: object) =>
    RegistrarApoderadoSchema.safeParse({ ...valido, ...datos }).error?.issues[0]?.message;

  it("acepta los datos completos, sin estudiantes, y deja el teléfono solo con dígitos", () => {
    const r = RegistrarApoderadoSchema.parse({ ...valido, telefono: "987 654 321" });
    expect(r.telefono).toBe("987654321");
    expect(r.vinculos).toEqual([]);
  });
  it("rechaza un teléfono con menos de 9 dígitos", () => {
    expect(error({ telefono: "98765432" })).toBe("El número de teléfono debe tener 9 dígitos");
  });
  it("exige un DNI de 8 dígitos y un correo válido", () => {
    expect(error({ dni: "4012557" })).toBe("El DNI debe tener 8 dígitos");
    expect(error({ email: "carmen@" })).toBe("Formato de correo electrónico inválido");
  });
  it("exige la dirección, la ocupación y una fecha de nacimiento que no sea futura", () => {
    expect(error({ direccion: "" })).toBe("Ingresa la dirección");
    expect(error({ ocupacion: "" })).toBe("Ingresa la ocupación");
    expect(error({ fechaNacimiento: "2999-01-01" })).toBe("La fecha de nacimiento no puede ser futura");
  });
  it("pide el parentesco al vincular un estudiante y lo marca autorizado por defecto", () => {
    expect(error({ vinculos: [{ estudianteId: ESTUDIANTE }] })).toBe("Elige el parentesco");
    const r = RegistrarApoderadoSchema.parse({
      ...valido,
      vinculos: [{ estudianteId: ESTUDIANTE, parentesco: "Madre" }],
    });
    expect(r.vinculos[0]).toEqual({
      estudianteId: ESTUDIANTE,
      parentesco: "Madre",
      esPrincipal: false,
      autorizado: true,
    });
  });
  it("no acepta el mismo estudiante dos veces", () => {
    expect(() => verificarEstudiantesSinRepetir(["e1", "e2"])).not.toThrow();
    expect(() => verificarEstudiantesSinRepetir(["e1", "e1"])).toThrowError(
      expect.objectContaining({ codigo: "ESTUDIANTE_REPETIDO" }),
    );
  });
});
