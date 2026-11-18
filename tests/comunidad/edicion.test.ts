// Pruebas de las reglas puras de la edición y la baja de personas (US69, AD-06). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  cambiaIdentidad,
  cambiosDePersona,
  enmascararDni,
  motivosParaConservar,
  planDeBaja,
  resumenDeEvento,
  valoresDeAuditoria,
  verificarEdicion,
  type DatosEditables,
  type RegistrosDePersona,
} from "@/modules/comunidad/domain/edicion";
import { esquemasComunidad } from "@/modules/comunidad";

const apoderada: DatosEditables = {
  dni: "42345678",
  nombres: "Rosa Elvira",
  apellidos: "Huamán Peña",
  email: "rosa.huaman@corre.pe",
  telefono: "987654320",
  direccion: "Jr. Ayacucho 456, Breña",
  fechaNacimiento: "1979-08-15",
  sexo: null,
  ocupacion: "Enfermera",
  especialidad: null,
  colegioProcedencia: null,
};
const contexto = { perfiles: ["APODERADO" as const], tieneCuenta: true };
const sinRegistros: RegistrosDePersona = { cuentaUsada: false, vinculos: 0, matriculas: 0, pagos: 0, asignaciones: 0 };

describe("campos que cambian al editar una persona (US69)", () => {
  it("devuelve solo los campos enviados con un valor distinto, con el valor anterior y el nuevo", () => {
    const cambios = cambiosDePersona(apoderada, { email: "rosa.huaman@correo.pe", telefono: "987654320" });
    expect(cambios).toEqual([{ campo: "email", anterior: "rosa.huaman@corre.pe", nuevo: "rosa.huaman@correo.pe" }]);
  });
  it("no cambia lo que no se envía y trata null como «dejar vacío»", () => {
    expect(cambiosDePersona(apoderada, {})).toEqual([]);
    expect(cambiosDePersona(apoderada, { sexo: null })).toEqual([]);
    expect(cambiosDePersona({ ...apoderada, direccion: null }, { direccion: "Av. Brasil 100" })).toEqual([
      { campo: "direccion", anterior: null, nuevo: "Av. Brasil 100" },
    ]);
  });
  it("distingue los cambios de identidad (DNI, nombres y apellidos) de los demás", () => {
    expect(cambiaIdentidad(cambiosDePersona(apoderada, { telefono: "912345678" }))).toBe(false);
    expect(cambiaIdentidad(cambiosDePersona(apoderada, { apellidos: "Huamán Pena" }))).toBe(true);
  });
});

describe("validación de la edición (US69)", () => {
  it("acepta correo, teléfono, dirección, fecha de nacimiento y ocupación de un apoderado sin motivo", () => {
    const cambios = cambiosDePersona(apoderada, {
      email: "rosa.huaman@correo.pe",
      telefono: "912345678",
      direccion: "Av. Brasil 100",
      fechaNacimiento: "1979-08-16",
      ocupacion: "Médica",
    });
    expect(cambios).toHaveLength(5);
    expect(() => verificarEdicion(cambios, contexto)).not.toThrow();
  });
  it("exige un motivo para cambiar el DNI, los nombres o los apellidos", () => {
    for (const enviados of [{ dni: "42345679" }, { nombres: "Rosa Elvíra" }, { apellidos: "Huamán Pena" }]) {
      const cambios = cambiosDePersona(apoderada, enviados);
      for (const motivo of [undefined, null, "   "]) {
        expect(() => verificarEdicion(cambios, { ...contexto, motivo })).toThrowError(
          expect.objectContaining({ codigo: "MOTIVO_REQUERIDO", estadoHttp: 422 }),
        );
      }
      expect(() => verificarEdicion(cambios, { ...contexto, motivo: "DNI mal digitado" })).not.toThrow();
    }
  });
  it("rechaza un dato de un perfil que la persona no tiene", () => {
    for (const enviados of [{ especialidad: "Matemática" }, { colegioProcedencia: "I.E. 1" }]) {
      expect(() => verificarEdicion(cambiosDePersona(apoderada, enviados), contexto)).toThrowError(
        expect.objectContaining({ codigo: "PERFIL_NO_APLICA", estadoHttp: 422 }),
      );
    }
    const docente = { ...contexto, perfiles: ["DOCENTE" as const] };
    expect(() => verificarEdicion(cambiosDePersona(apoderada, { especialidad: "Matemática" }), docente)).not.toThrow();
  });
  it("acepta el sexo de cualquier persona, no solo de estudiantes, y lo deja en la auditoría", () => {
    for (const perfiles of [["APODERADO"], ["DOCENTE"], ["ADMINISTRADOR"], ["ALUMNO"]] as const) {
      const cambios = cambiosDePersona(apoderada, { sexo: "FEMENINO" });
      expect(() => verificarEdicion(cambios, { perfiles: [...perfiles], tieneCuenta: true })).not.toThrow();
    }
    const cambios = cambiosDePersona({ ...apoderada, sexo: "FEMENINO" }, { sexo: null });
    expect(() => verificarEdicion(cambios, contexto)).not.toThrow();
    expect(valoresDeAuditoria(cambios)).toEqual({ anterior: { sexo: "FEMENINO" }, nuevo: { sexo: null } });
  });
  it("no deja vacío el correo de una persona con cuenta, pero sí el de una sin cuenta", () => {
    const cambios = cambiosDePersona(apoderada, { email: null });
    expect(() => verificarEdicion(cambios, contexto)).toThrowError(
      expect.objectContaining({ codigo: "CORREO_REQUERIDO", estadoHttp: 422 }),
    );
    expect(() => verificarEdicion(cambios, { perfiles: ["ALUMNO"], tieneCuenta: false })).not.toThrow();
  });
  it("no deja vacíos los datos que el registro del perfil exige", () => {
    expect(() => verificarEdicion(cambiosDePersona(apoderada, { telefono: null }), contexto)).toThrowError(
      expect.objectContaining({
        codigo: "DATO_OBLIGATORIO",
        message: "«Teléfono» es obligatorio para el perfil de Apoderado.",
      }),
    );
    const docente = { perfiles: ["DOCENTE" as const], tieneCuenta: true };
    expect(() => verificarEdicion(cambiosDePersona(apoderada, { telefono: null }), docente)).not.toThrow();
  });
});

describe("valores que se guardan en la auditoría EDITAR_PERSONA (US69, RF03)", () => {
  it("enmascara el DNI salvo los 2 últimos dígitos", () => {
    expect(enmascararDni("42345678")).toBe("******78");
    expect(enmascararDni("7")).toBe("7");
  });
  it("guarda el valor anterior y el nuevo de cada campo cambiado, con el DNI enmascarado", () => {
    const cambios = cambiosDePersona(apoderada, { dni: "42345699", email: "rosa.huaman@correo.pe" });
    expect(valoresDeAuditoria(cambios)).toEqual({
      anterior: { dni: "******78", email: "rosa.huaman@corre.pe" },
      nuevo: { dni: "******99", email: "rosa.huaman@correo.pe" },
    });
  });
  it("convierte un evento de la bitácora en los cambios del historial", () => {
    const r = resumenDeEvento("EDITAR_PERSONA", { telefono: null, dni: "******78" }, { telefono: "912345678" });
    expect(r).toEqual({
      cambios: [
        { campo: "dni", anterior: "******78", nuevo: null },
        { campo: "telefono", anterior: null, nuevo: "912345678" },
      ],
      perfil: null,
    });
    expect(resumenDeEvento("DESACTIVAR_PERFIL", { perfil: "DOCENTE" }, { perfil: "DOCENTE", activo: false })).toEqual({
      cambios: [],
      perfil: "DOCENTE",
    });
    expect(resumenDeEvento("OTRA_ACCION", null, "texto")).toEqual({ cambios: [], perfil: null });
  });
});

describe("baja de una persona: eliminar o desactivar (US69)", () => {
  const base = { esPropia: false, perfilesActivos: ["APODERADO" as const], registros: sinRegistros };

  it("elimina a quien no tiene cuenta usada, vínculos, matrículas, pagos ni asignaciones", () => {
    expect(planDeBaja(base)).toEqual({ accion: "ELIMINAR" });
    expect(planDeBaja({ ...base, perfilesActivos: [] })).toEqual({ accion: "ELIMINAR" });
    expect(planDeBaja({ ...base, perfil: "APODERADO" })).toEqual({ accion: "ELIMINAR" });
  });
  it("con cualquier registro asociado desactiva los perfiles activos y explica por qué", () => {
    const casos: [Partial<RegistrosDePersona>, string][] = [
      [{ cuentaUsada: true }, "ya ingresó al sistema con su cuenta"],
      [{ vinculos: 1 }, "tiene 1 vínculo entre estudiante y apoderado"],
      [{ matriculas: 2 }, "tiene 2 matrículas"],
      [{ pagos: 1 }, "tiene 1 pago registrado"],
      [{ asignaciones: 3 }, "tiene 3 asignaciones de cursos o secciones"],
    ];
    for (const [registro, motivo] of casos) {
      const registros = { ...sinRegistros, ...registro };
      expect(motivosParaConservar(registros)).toEqual([motivo]);
      expect(planDeBaja({ ...base, perfilesActivos: ["DOCENTE", "APODERADO"], registros })).toEqual({
        accion: "DESACTIVAR",
        perfiles: ["DOCENTE", "APODERADO"],
        motivos: [motivo],
      });
    }
  });
  it("retira solo el perfil pedido y conserva los demás", () => {
    const varios = { ...base, perfilesActivos: ["DOCENTE" as const, "APODERADO" as const] };
    expect(planDeBaja({ ...varios, perfil: "DOCENTE" })).toEqual({
      accion: "DESACTIVAR",
      perfiles: ["DOCENTE"],
      motivos: [],
    });
    expect(() => planDeBaja({ ...varios, perfil: "ALUMNO" })).toThrowError(
      expect.objectContaining({ codigo: "PERFIL_NO_ACTIVO", estadoHttp: 422 }),
    );
  });
  it("nadie se da de baja a sí mismo", () => {
    expect(() => planDeBaja({ ...base, esPropia: true })).toThrowError(
      expect.objectContaining({ codigo: "OPERACION_NO_PERMITIDA", estadoHttp: 422 }),
    );
  });
  it("rechaza la baja si tiene registros y ya no le quedan perfiles activos", () => {
    const registros = { ...sinRegistros, matriculas: 1 };
    expect(() => planDeBaja({ ...base, perfilesActivos: [], registros })).toThrowError(
      expect.objectContaining({ codigo: "PERFILES_YA_INACTIVOS", estadoHttp: 409 }),
    );
  });
});

describe("esquema de PATCH /comunidad/personas/{id} (US69, RNF16)", () => {
  const { EditarPersonaSchema, BajaPersonaSchema } = esquemasComunidad;

  it("acepta solo los campos que cambian y los normaliza", () => {
    expect(EditarPersonaSchema.parse({ email: "  Rosa.Huaman@Correo.PE ", telefono: "987 654-320" })).toEqual({
      email: "rosa.huaman@correo.pe",
      telefono: "987654320",
    });
    expect(EditarPersonaSchema.parse({})).toEqual({});
    expect(EditarPersonaSchema.parse({ direccion: null, sexo: null, colegioProcedencia: " " })).toEqual({
      direccion: null,
      sexo: null,
      colegioProcedencia: null,
    });
  });
  it("valida el DNI con el mismo formato de 8 dígitos del registro", () => {
    expect(EditarPersonaSchema.parse({ dni: " 42345678 ", motivo: "DNI mal digitado" }).dni).toBe("42345678");
    for (const dni of ["4234567", "423456789", "4234567A"]) {
      expect(EditarPersonaSchema.safeParse({ dni }).success).toBe(false);
    }
  });
  it("rechaza formatos inválidos con mensajes en español", () => {
    const r = EditarPersonaSchema.safeParse({
      email: "rosa@",
      telefono: "98765432",
      fechaNacimiento: "2999-01-01",
      ocupacion: "",
      motivo: "no",
    });
    expect(r.success).toBe(false);
    const mensajes = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(mensajes).toEqual(
      expect.arrayContaining([
        "Formato de correo electrónico inválido",
        "El número de teléfono debe tener 9 dígitos",
        "La fecha de nacimiento no puede ser futura",
        "Ingresa la ocupación",
        "Describe el motivo del cambio",
      ]),
    );
  });
  it("el perfil a retirar es opcional y debe ser un rol", () => {
    expect(BajaPersonaSchema.parse({})).toEqual({});
    expect(BajaPersonaSchema.parse({ perfil: "DOCENTE" })).toEqual({ perfil: "DOCENTE" });
    expect(BajaPersonaSchema.safeParse({ perfil: "ROOT" }).success).toBe(false);
  });
});
