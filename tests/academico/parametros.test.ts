// Pruebas de las reglas puras de «Parámetros del sistema» (bloque M1): validación por tipo y coherencia entre
// parámetros que van juntos. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { valorDeParametro, verificarCoherencia } from "@/modules/academico/domain/parametros";

const invalido = (mensaje: RegExp) =>
  expect.objectContaining({ codigo: "PARAMETRO_INVALIDO", message: expect.stringMatching(mensaje) });

describe("validación por tipo de los parámetros del sistema (bloque M1)", () => {
  it("hora HH:MM: acepta 07:30 y rechaza 7:30, 25:00 y texto", () => {
    expect(valorDeParametro("HORA_INICIO_JORNADA_DOCENTE", " 07:30 ")).toBe("07:30");
    for (const v of ["7:30", "25:00", "07:60", "temprano"]) {
      expect(() => valorDeParametro("HORA_INICIO_JORNADA_DOCENTE", v)).toThrow(invalido(/HH:MM/));
    }
  });

  it("entero: dentro de sus límites se guarda como número", () => {
    expect(valorDeParametro("MAX_INTENTOS_LOGIN", "5")).toBe(5);
    expect(valorDeParametro("DIA_VENCIMIENTO", "28")).toBe(28);
  });

  it("entero: rechaza decimales, texto y valores fuera de los límites", () => {
    for (const v of ["2", "11", "4.5", "cinco", ""]) {
      expect(() => valorDeParametro("MAX_INTENTOS_LOGIN", v)).toThrow(invalido(/entero entre 3 y 10/));
    }
    expect(() => valorDeParametro("DIA_VENCIMIENTO", "31")).toThrow(invalido(/entre 1 y 28/));
  });

  it("decimal entre 0 y 1: acepta 0.15 y 0,2; rechaza 0, 1, 15 y negativos", () => {
    expect(valorDeParametro("UMBRAL_INASISTENCIA_AVISO", "0.15")).toBe(0.15);
    expect(valorDeParametro("UMBRAL_INASISTENCIA", "0,2")).toBe(0.2);
    for (const v of ["0", "1", "15", "-0.1", "abc"]) {
      expect(() => valorDeParametro("UMBRAL_INASISTENCIA", v)).toThrow(invalido(/mayor que 0 y menor que 1/));
    }
  });

  it("monto: se guarda como texto con dos decimales; rechaza 0, negativos y tres decimales", () => {
    expect(valorDeParametro("MONTO_PENSION", "450")).toBe("450.00");
    expect(valorDeParametro("MONTO_MATRICULA", "350,5")).toBe("350.50");
    for (const v of ["0", "-10", "350.555", "mucho"]) {
      expect(() => valorDeParametro("MONTO_PENSION", v)).toThrow(invalido(/monto mayor a 0/));
    }
  });

  it("una clave que no es parámetro del sistema no se edita (BLOQUES_HORARIO tampoco)", () => {
    for (const clave of ["BLOQUES_HORARIO", "CUALQUIERA"]) {
      expect(() => valorDeParametro(clave, "1")).toThrow(
        expect.objectContaining({ codigo: "PARAMETRO_NO_EDITABLE", estadoHttp: 404 }),
      );
    }
  });
});

describe("coherencia entre parámetros (bloque M1)", () => {
  const vigentes = {
    HORA_INICIO_JORNADA_DOCENTE: "07:30",
    HORA_LIMITE_ASISTENCIA_DOCENTE: "08:00",
    UMBRAL_INASISTENCIA_AVISO: 0.15,
    UMBRAL_INASISTENCIA: 0.2,
  };

  it("la hora de inicio debe quedar antes que la hora límite", () => {
    expect(() => verificarCoherencia("HORA_INICIO_JORNADA_DOCENTE", "07:45", vigentes)).not.toThrow();
    expect(() => verificarCoherencia("HORA_INICIO_JORNADA_DOCENTE", "08:00", vigentes)).toThrow(invalido(/anterior/));
    expect(() => verificarCoherencia("HORA_LIMITE_ASISTENCIA_DOCENTE", "07:00", vigentes)).toThrow(
      invalido(/anterior/),
    );
  });

  it("el aviso previo debe ser menor que la alerta de riesgo", () => {
    expect(() => verificarCoherencia("UMBRAL_INASISTENCIA_AVISO", 0.1, vigentes)).not.toThrow();
    expect(() => verificarCoherencia("UMBRAL_INASISTENCIA_AVISO", 0.25, vigentes)).toThrow(invalido(/menor/));
    expect(() => verificarCoherencia("UMBRAL_INASISTENCIA", 0.15, vigentes)).toThrow(invalido(/menor/));
  });

  it("los demás parámetros no dependen de otro", () => {
    expect(() => verificarCoherencia("MAX_INTENTOS_LOGIN", 3, vigentes)).not.toThrow();
  });
});
