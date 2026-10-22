// Pruebas de las reglas puras de académico: año académico (US06) y periodos de evaluación (US07). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  buscarPeriodoVigente,
  ESTADO_INICIAL_ANIO,
  fechaEnLima,
  nombreBimestre,
  puedeCerrarse,
  seSolapan,
  siguienteEstado,
  verificarCambiosPermitidos,
  verificarPeriodos,
  verificarRangoAnio,
  verificarTransicion,
  type AnioExistente,
  type PeriodoEntrada,
  type PeriodoGuardado,
} from "@/modules/academico/domain/reglas";

/** Espera que la función lance un ErrorApp con ese código. */
function esperarError(fn: () => void, codigo: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo }));
}

const ANIO_2026 = { anio: 2026, fechaInicio: "2026-03-01", fechaFin: "2026-12-18" };

const BIMESTRES_2026: PeriodoEntrada[] = [
  { numero: 1, fechaInicio: "2026-03-01", fechaFin: "2026-05-08" },
  { numero: 2, fechaInicio: "2026-05-18", fechaFin: "2026-07-24" },
  { numero: 3, fechaInicio: "2026-08-10", fechaFin: "2026-10-09" },
  { numero: 4, fechaInicio: "2026-10-19", fechaFin: "2026-12-18" },
];

describe("año académico: fechas y solapamiento (US06)", () => {
  const otros: AnioExistente[] = [
    { id: "a2025", estado: "CERRADO", fechaInicio: "2025-03-01", fechaFin: "2025-12-19" },
    { id: "a2027", estado: "PLANIFICADO", fechaInicio: "2027-03-01", fechaFin: "2027-12-17" },
  ];

  it("nace PLANIFICADO", () => {
    expect(ESTADO_INICIAL_ANIO).toBe("PLANIFICADO");
  });
  it("acepta un rango válido que no choca con otro año abierto", () => {
    expect(() => verificarRangoAnio(ANIO_2026, otros)).not.toThrow();
  });
  it("rechaza fin igual o anterior al inicio", () => {
    esperarError(
      () => verificarRangoAnio({ anio: 2026, fechaInicio: "2026-03-01", fechaFin: "2026-03-01" }, []),
      "FECHAS_INVALIDAS",
    );
    esperarError(
      () => verificarRangoAnio({ anio: 2026, fechaInicio: "2026-12-18", fechaFin: "2026-03-01" }, []),
      "FECHAS_INVALIDAS",
    );
  });
  it("rechaza solaparse con un año no CERRADO", () => {
    esperarError(
      () => verificarRangoAnio({ anio: 2026, fechaInicio: "2026-03-01", fechaFin: "2027-03-01" }, otros),
      "ANIO_SOLAPADO",
    );
  });
  it("permite solaparse con un año CERRADO", () => {
    expect(() =>
      verificarRangoAnio({ anio: 2025, fechaInicio: "2025-12-01", fechaFin: "2026-12-18" }, otros),
    ).not.toThrow();
  });
  it("al editar no se compara consigo mismo", () => {
    expect(() =>
      verificarRangoAnio({ anio: 2027, fechaInicio: "2027-02-15", fechaFin: "2027-12-17" }, otros, "a2027"),
    ).not.toThrow();
  });
  it("exige que el número del año coincida con el año de la fecha de inicio", () => {
    expect(() =>
      verificarRangoAnio({ anio: 2029, fechaInicio: "2026-03-01", fechaFin: "2026-12-18" }, []),
    ).toThrowError(
      expect.objectContaining({ codigo: "ANIO_NO_COINCIDE", message: "El año debe coincidir con la fecha de inicio" }),
    );
    // Un año puede terminar al año siguiente: solo cuenta la fecha de inicio.
    expect(() =>
      verificarRangoAnio({ anio: 2026, fechaInicio: "2026-03-01", fechaFin: "2027-01-15" }, []),
    ).not.toThrow();
  });
  it("los rangos son inclusivos: compartir un día es solaparse", () => {
    expect(seSolapan({ fechaInicio: "2026-01-01", fechaFin: "2026-03-01" }, ANIO_2026)).toBe(true);
    expect(seSolapan({ fechaInicio: "2026-01-01", fechaFin: "2026-02-28" }, ANIO_2026)).toBe(false);
  });
});

describe("año académico: transiciones de estado (US06)", () => {
  it("avanza de uno en uno hasta CERRADO", () => {
    expect(siguienteEstado("PLANIFICADO")).toBe("EN_MATRICULA");
    expect(siguienteEstado("EN_MATRICULA")).toBe("EN_CURSO");
    expect(siguienteEstado("EN_CURSO")).toBe("EN_CIERRE");
    expect(siguienteEstado("EN_CIERRE")).toBe("CERRADO");
    expect(siguienteEstado("CERRADO")).toBeNull();
  });
  it("abrir matrícula es PLANIFICADO → EN_MATRICULA", () => {
    expect(() => verificarTransicion("PLANIFICADO", "EN_MATRICULA")).not.toThrow();
  });
  it("no permite retroceder, saltar estados ni quedarse igual", () => {
    esperarError(() => verificarTransicion("EN_CURSO", "EN_MATRICULA"), "TRANSICION_NO_PERMITIDA");
    esperarError(() => verificarTransicion("PLANIFICADO", "EN_CURSO"), "TRANSICION_NO_PERMITIDA");
    esperarError(() => verificarTransicion("EN_CIERRE", "EN_CIERRE"), "TRANSICION_NO_PERMITIDA");
    esperarError(() => verificarTransicion("CERRADO", "PLANIFICADO"), "TRANSICION_NO_PERMITIDA");
  });
  it("se cierra solo con todos los cierres de calificación publicados", () => {
    expect(puedeCerrarse({ total: 12, publicados: 12 })).toBe(true);
    expect(puedeCerrarse({ total: 12, publicados: 11 })).toBe(false);
    expect(puedeCerrarse({ total: 0, publicados: 0 })).toBe(false);
  });
});

describe("periodos de evaluación (US07)", () => {
  it("acepta los 4 bimestres dentro del año y sin solaparse", () => {
    expect(() => verificarPeriodos(ANIO_2026, BIMESTRES_2026)).not.toThrow();
  });
  it("nombra los bimestres con números romanos", () => {
    expect([1, 2, 3, 4].map(nombreBimestre)).toEqual(["Bimestre I", "Bimestre II", "Bimestre III", "Bimestre IV"]);
  });
  it("exige exactamente los bimestres 1 a 4 sin repetir", () => {
    esperarError(() => verificarPeriodos(ANIO_2026, BIMESTRES_2026.slice(0, 3)), "PERIODOS_INCOMPLETOS");
    const repetido = [...BIMESTRES_2026.slice(0, 3), { ...BIMESTRES_2026[3], numero: 3 }];
    esperarError(() => verificarPeriodos(ANIO_2026, repetido), "PERIODOS_INCOMPLETOS");
    const fueraDeRango = [...BIMESTRES_2026.slice(0, 3), { ...BIMESTRES_2026[3], numero: 5 }];
    esperarError(() => verificarPeriodos(ANIO_2026, fueraDeRango), "PERIODOS_INCOMPLETOS");
  });
  it("rechaza un bimestre con fin no posterior al inicio", () => {
    const malo = BIMESTRES_2026.map((p) => (p.numero === 2 ? { ...p, fechaFin: p.fechaInicio } : p));
    expect(() => verificarPeriodos(ANIO_2026, malo)).toThrowError(
      expect.objectContaining({ codigo: "FECHAS_INVALIDAS", message: expect.stringContaining("Bimestre II") }),
    );
  });
  it("rechaza un bimestre fuera del rango del año", () => {
    const fuera = BIMESTRES_2026.map((p) => (p.numero === 4 ? { ...p, fechaFin: "2026-12-30" } : p));
    esperarError(() => verificarPeriodos(ANIO_2026, fuera), "PERIODO_FUERA_DEL_ANIO");
  });
  it("rechaza bimestres que se solapan", () => {
    const solapados = BIMESTRES_2026.map((p) => (p.numero === 2 ? { ...p, fechaInicio: "2026-05-08" } : p));
    expect(() => verificarPeriodos(ANIO_2026, solapados)).toThrowError(
      expect.objectContaining({
        codigo: "PERIODOS_SOLAPADOS",
        message: "Los periodos de evaluación no pueden solaparse",
      }),
    );
  });

  it("exige los bimestres en orden: cada uno empieza después de que termina el anterior", () => {
    // II e I intercambiados: no se solapan, pero el Bimestre II quedaría antes del I.
    const desordenados = BIMESTRES_2026.map((p) =>
      p.numero === 1
        ? { ...p, fechaInicio: "2026-05-18", fechaFin: "2026-07-24" }
        : p.numero === 2
          ? { ...p, fechaInicio: "2026-03-01", fechaFin: "2026-05-08" }
          : p,
    );
    expect(() => verificarPeriodos(ANIO_2026, desordenados)).toThrowError(
      expect.objectContaining({
        codigo: "PERIODOS_DESORDENADOS",
        message: "Los bimestres deben registrarse en orden",
      }),
    );
  });
  it("el orden se valida por número aunque lleguen mezclados en la lista", () => {
    expect(() => verificarPeriodos(ANIO_2026, [...BIMESTRES_2026].reverse())).not.toThrow();
  });

  const guardados: PeriodoGuardado[] = BIMESTRES_2026.map((p) => ({
    ...p,
    estado: p.numero === 1 ? "FINALIZADO" : p.numero === 2 ? "ACTIVO" : "INACTIVO",
  }));

  it("no permite cambiar las fechas de un bimestre FINALIZADO", () => {
    const cambiado = BIMESTRES_2026.map((p) => (p.numero === 1 ? { ...p, fechaFin: "2026-05-09" } : p));
    esperarError(() => verificarCambiosPermitidos(guardados, cambiado), "PERIODO_FINALIZADO");
  });
  it("permite reenviar un FINALIZADO sin cambios y editar los demás", () => {
    const cambiado = BIMESTRES_2026.map((p) => (p.numero === 3 ? { ...p, fechaFin: "2026-10-10" } : p));
    expect(() => verificarCambiosPermitidos(guardados, cambiado)).not.toThrow();
  });
  it("encuentra el bimestre vigente de un día, o null", () => {
    expect(buscarPeriodoVigente(guardados, "2026-06-01")?.numero).toBe(2);
    expect(buscarPeriodoVigente(guardados, "2026-08-01")).toBeNull(); // vacaciones entre bimestres
    expect(buscarPeriodoVigente(guardados, "2026-04-01")).toBeNull(); // el Bimestre I ya está finalizado
  });
  it("calcula el día en la hora de Lima", () => {
    // 03:00 UTC del 1 de junio todavía es 31 de mayo en Lima (UTC-5).
    expect(fechaEnLima(new Date("2026-06-01T03:00:00Z"))).toBe("2026-05-31");
  });
});
