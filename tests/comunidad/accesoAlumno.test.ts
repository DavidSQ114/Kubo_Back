// Regla de «Crear acceso al portal» de un estudiante (US49, AD-06). Sin base de datos.
import { describe, expect, it } from "vitest";
import { ErrorApp } from "@/platform/http/errores";
import { verificarAccesoCreable, type SituacionDeAcceso } from "@/modules/comunidad/domain/acceso";

const CREABLE: SituacionDeAcceso = { estudianteActivo: true, tieneCuenta: false, matriculaVigente: true };

function errorDe(situacion: SituacionDeAcceso): { codigo: string; estado: number; mensaje: string } | null {
  try {
    verificarAccesoCreable(situacion);
    return null;
  } catch (e) {
    if (!(e instanceof ErrorApp)) throw e;
    return { codigo: e.codigo, estado: e.estadoHttp, mensaje: e.message };
  }
}

describe("crear el acceso de un estudiante al portal (US49)", () => {
  it("se puede crear a un estudiante activo, sin cuenta y con matrícula vigente", () => {
    expect(errorDe(CREABLE)).toBeNull();
  });

  it("no se crea a un estudiante dado de baja: 404", () => {
    expect(errorDe({ ...CREABLE, estudianteActivo: false })).toMatchObject({
      codigo: "ESTUDIANTE_NO_ENCONTRADO",
      estado: 404,
    });
  });

  it("no se crea dos veces: si la persona ya tiene cuenta responde 409", () => {
    expect(errorDe({ ...CREABLE, tieneCuenta: true })).toEqual({
      codigo: "ACCESO_EXISTENTE",
      estado: 409,
      mensaje: "El estudiante ya tiene una cuenta para ingresar al portal.",
    });
  });

  it("no se crea a un estudiante retirado o con la matrícula anulada (sin matrícula vigente): 422", () => {
    expect(errorDe({ ...CREABLE, matriculaVigente: false })).toMatchObject({
      codigo: "SIN_MATRICULA_VIGENTE",
      estado: 422,
    });
  });

  it("si ya tiene cuenta, ese es el motivo aunque tampoco tenga matrícula vigente", () => {
    expect(errorDe({ ...CREABLE, tieneCuenta: true, matriculaVigente: false })?.codigo).toBe("ACCESO_EXISTENTE");
  });
});
