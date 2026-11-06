// Pruebas de las reglas de la matrícula en sección (US18, RF14), su anulación (M-19) y los montos del año (US21).
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  textoMotivoAnulacion,
  verificarAnioMatriculable,
  verificarAnulable,
  verificarCompleta,
  verificarConfirmable,
  verificarCupo,
  verificarResponsable,
} from "@/modules/matricula/domain/matriculas";
import { aCentimos, deCentimos, montoGuardado, normalizarMonto } from "@/modules/academico/domain/montos";
import { esquemasMatricula } from "@/modules/matricula";

const codigo = (c: string) => expect.objectContaining({ codigo: c });

describe("datos para confirmar la matrícula (US18)", () => {
  it("exige sección y apoderado responsable", () => {
    expect(() => verificarCompleta({ seccionId: "s1", vinculoResponsableId: "v1" })).not.toThrow();
    const mensaje = "Complete la sección y el apoderado responsable para confirmar la matrícula";
    expect(() => verificarCompleta({ seccionId: "s1" })).toThrowError(
      expect.objectContaining({ codigo: "MATRICULA_INCOMPLETA", message: mensaje }),
    );
    expect(() => verificarCompleta({ vinculoResponsableId: "v1", seccionId: null })).toThrowError(
      codigo("MATRICULA_INCOMPLETA"),
    );
  });
  it("el responsable debe ser uno de los apoderados vinculados", () => {
    expect(() => verificarResponsable("v1", ["v1", "v2"])).not.toThrow();
    expect(() => verificarResponsable("v9", ["v1", "v2"])).toThrowError(codigo("RESPONSABLE_NO_VINCULADO"));
  });
  it("el esquema deja pasar la falta de sección para responder con el mensaje del Backlog", () => {
    const r = esquemasMatricula.MatricularSchema.parse({
      estudianteId: "6f0b3c2e-8a51-4b8e-9d0e-3c1a2b4d5e6f",
      anioAcademicoId: "1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    });
    expect(r.modalidadPago).toBe("MENSUAL");
    expect(r.seccionId).toBeUndefined();
  });
});

describe("vacantes al confirmar (US18)", () => {
  it("acepta mientras haya al menos una vacante", () => {
    expect(() => verificarCupo(29, 30)).not.toThrow();
  });
  it("sección llena: «Sección sin vacantes disponibles»", () => {
    expect(() => verificarCupo(30, 30)).toThrowError(
      expect.objectContaining({
        codigo: "SECCION_SIN_VACANTES",
        message: "Sección sin vacantes disponibles",
        detalles: { matriculados: 30, aforo: 30 },
      }),
    );
  });
});

describe("estados de la matrícula (US18)", () => {
  it("sin matrícula vigente se crea; una En proceso se confirma", () => {
    expect(verificarConfirmable(null)).toBe("CREAR");
    expect(verificarConfirmable({ id: "m1", estado: "EN_PROCESO", seccionId: null })).toBe("CONFIRMAR");
  });
  it("ya matriculado en el año: mensaje del Backlog y sugerencia de traslado", () => {
    expect(() => verificarConfirmable({ id: "m1", estado: "MATRICULADO", seccionId: "s1" })).toThrowError(
      expect.objectContaining({
        codigo: "YA_MATRICULADO",
        message: "Este estudiante ya está matriculado en el periodo actual",
        detalles: expect.objectContaining({ matriculaId: "m1", sugerencia: expect.stringContaining("Traslado") }),
      }),
    );
  });
  it("solo se matricula en un año En matrícula o En curso", () => {
    expect(() => verificarAnioMatriculable({ anio: 2027, estado: "EN_MATRICULA" }, "En matrícula")).not.toThrow();
    expect(() => verificarAnioMatriculable({ anio: 2026, estado: "EN_CURSO" }, "En curso")).not.toThrow();
    expect(() => verificarAnioMatriculable({ anio: 2028, estado: "PLANIFICADO" }, "Planificado")).toThrowError(
      codigo("ANIO_NO_MATRICULABLE"),
    );
  });
  it("se anula una matrícula En proceso o Matriculado sin pagos", () => {
    expect(() => verificarAnulable("EN_PROCESO", 0)).not.toThrow();
    expect(() => verificarAnulable("MATRICULADO", 0)).not.toThrow();
  });
  it("no se anula con pagos ni desde Anulado, Retirado o Finalizado", () => {
    expect(() => verificarAnulable("MATRICULADO", 2)).toThrowError(codigo("MATRICULA_CON_PAGOS"));
    expect(() => verificarAnulable("ANULADO", 0)).toThrowError(codigo("MATRICULA_NO_ANULABLE"));
    expect(() => verificarAnulable("RETIRADO", 0)).toThrowError(codigo("MATRICULA_NO_ANULABLE"));
  });
  it("guarda el motivo con su código", () => {
    expect(textoMotivoAnulacion("ERROR_DIGITACION", " Se eligió otro estudiante ")).toBe(
      "ERROR_DIGITACION: Se eligió otro estudiante",
    );
  });
  it("el esquema de anulación exige motivo y detalle", () => {
    const error = (d: object) => esquemasMatricula.AnularSchema.safeParse(d).error?.issues[0]?.message;
    expect(error({ detalle: "Error al digitar" })).toBe("Elige el motivo de la anulación");
    expect(error({ motivo: "OTRO", detalle: "" })).toBe("Describe por qué se anula esta matrícula");
    expect(error({ motivo: "PAGO_DUPLICADO", detalle: "Duplicado" })).toBe("Elige el motivo de la anulación");
  });
});

describe("montos del año (US21)", () => {
  it("convierte a céntimos sin float y normaliza a dos decimales", () => {
    expect(aCentimos("350")).toBe(35000);
    expect(aCentimos("450.5")).toBe(45050);
    expect(aCentimos("0.1")).toBe(10);
    expect(deCentimos(485000)).toBe("4850.00");
    expect(normalizarMonto("450.5")).toBe("450.50");
  });
  it("rechaza cero, negativos, más de dos decimales o texto", () => {
    for (const m of ["0", "0.00", "-5", "350.123", "abc", "100000.00"]) {
      expect(() => aCentimos(m)).toThrowError(codigo("MONTO_INVALIDO"));
    }
  });
  it("lee el valor guardado como texto o número; si no es válido, el año no tiene monto", () => {
    expect(montoGuardado("350.00")).toBe("350.00");
    expect(montoGuardado(450)).toBe("450.00");
    expect(montoGuardado(null)).toBeNull();
    expect(montoGuardado("gratis")).toBeNull();
  });
});
