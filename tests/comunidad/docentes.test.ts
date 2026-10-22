// Pruebas de las reglas puras del registro de docentes (US13, RF11). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { accionPerfilDocente, normalizarTelefono } from "@/modules/comunidad/domain/docentes";
import { esquemasComunidad } from "@/modules/comunidad";

const valido = {
  dni: "45872136",
  nombres: "Juan Carlos",
  apellidos: "Pérez Salazar",
  email: "juan.perez@kubo.edu.pe",
  especialidad: "Matemática",
};

describe("perfil Docente según el DNI (US13)", () => {
  it("crea el perfil si la persona es nueva o tiene otro perfil", () => {
    expect(accionPerfilDocente(null)).toBe("CREAR");
  });
  it("reactiva un perfil Docente inactivo", () => {
    expect(accionPerfilDocente({ activo: false })).toBe("REACTIVAR");
  });
  it("rechaza un DNI que ya tiene perfil Docente activo", () => {
    expect(() => accionPerfilDocente({ activo: true })).toThrowError(
      expect.objectContaining({ codigo: "DOCENTE_EXISTENTE", message: "Ya existe un usuario registrado con este DNI" }),
    );
  });
});

describe("datos del docente (US13)", () => {
  const { RegistrarDocenteSchema } = esquemasComunidad;
  const error = (datos: object) => RegistrarDocenteSchema.safeParse({ ...valido, ...datos }).error?.issues[0]?.message;

  it("acepta los datos mínimos y el teléfono con espacios", () => {
    expect(RegistrarDocenteSchema.safeParse(valido).success).toBe(true);
    expect(RegistrarDocenteSchema.parse({ ...valido, telefono: "987 654 321" }).telefono).toBe("987654321");
  });
  it("exige un DNI de 8 dígitos", () => {
    expect(error({ dni: "4587213" })).toBe("El DNI debe tener 8 dígitos");
    expect(error({ dni: "4587213A" })).toBe("El DNI debe tener 8 dígitos");
  });
  it("rechaza un correo con formato inválido", () => {
    expect(error({ email: "juan.perez@" })).toBe("Formato de correo electrónico inválido");
  });
  it("exige un teléfono de 9 dígitos si se envía", () => {
    expect(error({ telefono: "98765432" })).toBe("El teléfono debe tener 9 dígitos");
    expect(RegistrarDocenteSchema.safeParse({ ...valido, telefono: null }).success).toBe(true);
  });
  it("exige la especialidad", () => {
    expect(error({ especialidad: "" })).toBe("Elige la especialidad");
  });
  it("guarda el teléfono solo con dígitos", () => {
    expect(normalizarTelefono("987-654 321")).toBe("987654321");
  });
});
