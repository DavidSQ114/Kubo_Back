// Pruebas de las reglas puras de la asistencia del tutor (bloque M3): bimestre en curso, avisos por umbral solo con
// faltas sin justificar, justificación de faltas y tardanzas y el reporte por bimestre. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import type { EstadoAsistencia } from "@/modules/horarios/domain/asistencia";
import {
  bimestreEnCurso,
  conteoDeAsistencia,
  esJustificable,
  estadoJustificado,
  inicioDelPlazoDeJustificacion,
  ordenarReporte,
  situacionDeAlumno,
  totalDeAsistencia,
  verificarFechaDeTutoria,
  verificarJustificacionDelApoderado,
  verificarJustificacionPendiente,
} from "@/modules/horarios/domain/tutoria";

function esperarError(fn: () => void, codigo: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo }));
}

const BIMESTRES = [
  { numero: 1, nombre: "Bimestre I", fechaInicio: "2026-03-09", fechaFin: "2026-05-08" },
  { numero: 2, nombre: "Bimestre II", fechaInicio: "2026-05-18", fechaFin: "2026-07-17" },
];

describe("bimestre en curso de la tutoría (bloque M3)", () => {
  it("es el bimestre que contiene hoy y no hay en vacaciones", () => {
    expect(bimestreEnCurso(BIMESTRES, "2026-05-20")?.numero).toBe(2);
    expect(bimestreEnCurso(BIMESTRES, "2026-05-12")).toBeNull();
  });

  it("acepta un día de clases del bimestre en curso hasta hoy", () => {
    // 2026-05-25 es lunes
    expect(() => verificarFechaDeTutoria("2026-05-25", BIMESTRES[1], "2026-05-27")).not.toThrow();
    expect(() => verificarFechaDeTutoria("2026-05-27", BIMESTRES[1], "2026-05-27")).not.toThrow();
  });

  it("rechaza fechas futuras, de otro bimestre, fines de semana o sin bimestre en curso", () => {
    esperarError(() => verificarFechaDeTutoria("2026-05-28", BIMESTRES[1], "2026-05-27"), "FECHA_FUTURA");
    esperarError(
      () => verificarFechaDeTutoria("2026-05-04", BIMESTRES[1], "2026-05-27"),
      "FUERA_DEL_BIMESTRE_EN_CURSO",
    );
    esperarError(() => verificarFechaDeTutoria("2026-05-23", BIMESTRES[1], "2026-05-27"), "DIA_SIN_CLASES");
    esperarError(() => verificarFechaDeTutoria("2026-05-12", null, "2026-05-12"), "SIN_BIMESTRE_EN_CURSO");
  });
});

describe("alumnos con aviso por umbral: solo faltas sin justificar (bloque M3, US52)", () => {
  const umbrales = { faltasMes: 3, aviso: 0.15, riesgo: 0.2 };
  // tres días de mayo en que faltó a todas sus clases
  const dias = ["2026-05-18", "2026-05-19", "2026-05-20"];
  const registros = (estado: EstadoAsistencia) =>
    dias.flatMap((fecha) => [
      { fecha, estado },
      { fecha, estado },
    ]);
  const datos = { bimestres: BIMESTRES, fechaMatricula: "2026-03-01", hoy: "2026-05-27", umbrales };

  it("con 3 faltas sin justificar en el mes tiene la alerta del mes", () => {
    const s = situacionDeAlumno(registros("FALTA"), datos);
    expect(s).toMatchObject({ faltasDelMes: 3, faltasDelAnio: 3, alertaDelMes: true, conAviso: true });
  });

  it("las faltas justificadas no cuentan: sale de la lista de avisos", () => {
    const s = situacionDeAlumno(registros("FALTA_JUSTIFICADA"), datos);
    expect(s).toMatchObject({ faltasDelMes: 0, faltasDelAnio: 0, alertaDelMes: false, conAviso: false });
  });

  it("un día con una tardanza (justificada o no) no es falta", () => {
    const conTardanza = dias.flatMap((fecha) => [
      { fecha, estado: "FALTA" as const },
      { fecha, estado: "TARDANZA_JUSTIFICADA" as const },
    ]);
    expect(situacionDeAlumno(conTardanza, datos).faltasDelMes).toBe(0);
  });

  it("marca el riesgo del año al llegar al porcentaje", () => {
    // 90 días de clase en los dos bimestres; 22 faltas entre marzo y abril son el 24 % (riesgo desde el 20 %)
    const marzo = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 2, 9 + i));
      return d.toISOString().slice(0, 10);
    }).filter((f) => ![0, 6].includes(new Date(`${f}T00:00:00Z`).getUTCDay()));
    const s = situacionDeAlumno(
      marzo.map((fecha) => ({ fecha, estado: "FALTA" as const })),
      datos,
    );
    expect(s.alertaDelMes).toBe(false);
    expect(s.nivel).toBe("RIESGO");
    expect(s.conAviso).toBe(true);
  });
});

describe("justificación del tutor (bloque M3)", () => {
  it("una falta pasa a falta justificada y una tardanza, a tardanza justificada", () => {
    expect(estadoJustificado("FALTA")).toBe("FALTA_JUSTIFICADA");
    expect(estadoJustificado("TARDANZA")).toBe("TARDANZA_JUSTIFICADA");
    expect(esJustificable("FALTA")).toBe(true);
    expect(esJustificable("PRESENTE")).toBe(false);
  });

  it("no se justifica una asistencia ni algo ya justificado", () => {
    esperarError(() => estadoJustificado("PRESENTE"), "NO_JUSTIFICABLE");
    esperarError(() => estadoJustificado("FALTA_JUSTIFICADA"), "YA_JUSTIFICADO");
    esperarError(() => estadoJustificado("TARDANZA_JUSTIFICADA"), "YA_JUSTIFICADO");
  });
});

describe("reporte de faltas y tardanzas por bimestre (bloque M3)", () => {
  it("cuenta cada estado y el porcentaje de asistencia (la tardanza cuenta como asistencia)", () => {
    const c = conteoDeAsistencia([
      "PRESENTE",
      "PRESENTE",
      "TARDANZA",
      "TARDANZA_JUSTIFICADA",
      "FALTA",
      "FALTA_JUSTIFICADA",
      "PRESENTE",
      "PRESENTE",
    ]);
    expect(c).toEqual({
      clases: 8,
      asistencias: 4,
      tardanzas: 1,
      tardanzasJustificadas: 1,
      faltas: 1,
      faltasJustificadas: 1,
      porcentajeAsistencia: 75,
    });
  });

  it("sin clases registradas el porcentaje es null", () => {
    expect(conteoDeAsistencia([]).porcentajeAsistencia).toBeNull();
  });

  it("suma los totales con el porcentaje sobre todas las clases", () => {
    const total = totalDeAsistencia([
      conteoDeAsistencia(["PRESENTE", "FALTA"]),
      conteoDeAsistencia(["PRESENTE", "PRESENTE", "TARDANZA"]),
    ]);
    expect(total).toMatchObject({ clases: 5, asistencias: 3, tardanzas: 1, faltas: 1, porcentajeAsistencia: 80 });
  });

  it("ordena por la columna pedida, a igualdad por nombre y sin clases al final", () => {
    const filas = [
      { nombre: "Ríos, Ana", ...conteoDeAsistencia(["FALTA", "FALTA"]) },
      { nombre: "Álvarez, Beto", ...conteoDeAsistencia(["FALTA", "PRESENTE"]) },
      { nombre: "Campos, Carla", ...conteoDeAsistencia([]) },
      { nombre: "Báez, Diego", ...conteoDeAsistencia(["PRESENTE", "FALTA"]) },
    ];
    expect(ordenarReporte(filas, "faltas", false).map((f) => f.nombre)).toEqual([
      "Ríos, Ana",
      "Álvarez, Beto",
      "Báez, Diego",
      "Campos, Carla",
    ]);
    expect(ordenarReporte(filas, "porcentajeAsistencia", true).map((f) => f.nombre)).toEqual([
      "Ríos, Ana",
      "Álvarez, Beto",
      "Báez, Diego",
      "Campos, Carla",
    ]);
    expect(ordenarReporte(filas, "nombre", true)[0].nombre).toBe("Álvarez, Beto");
  });
});

describe("justificación del apoderado (bloque M3, fase 7)", () => {
  const hoy = "2026-05-27";

  it("el plazo empieza 7 días antes de hoy", () => {
    expect(inicioDelPlazoDeJustificacion(hoy)).toBe("2026-05-20");
    expect(inicioDelPlazoDeJustificacion("2026-03-03")).toBe("2026-02-24");
  });

  it("acepta faltas y tardanzas sin justificar de los últimos 7 días", () => {
    expect(() => verificarJustificacionDelApoderado({ fecha: "2026-05-20", estado: "FALTA" }, hoy)).not.toThrow();
    expect(() => verificarJustificacionDelApoderado({ fecha: hoy, estado: "TARDANZA" }, hoy)).not.toThrow();
  });

  it("rechaza registros fuera del plazo, ya justificados o que no son falta ni tardanza", () => {
    esperarError(
      () => verificarJustificacionDelApoderado({ fecha: "2026-05-19", estado: "FALTA" }, hoy),
      "JUSTIFICACION_FUERA_DE_PLAZO",
    );
    esperarError(
      () => verificarJustificacionDelApoderado({ fecha: "2026-05-28", estado: "FALTA" }, hoy),
      "JUSTIFICACION_FUERA_DE_PLAZO",
    );
    esperarError(
      () => verificarJustificacionDelApoderado({ fecha: hoy, estado: "FALTA_JUSTIFICADA" }, hoy),
      "YA_JUSTIFICADO",
    );
    esperarError(() => verificarJustificacionDelApoderado({ fecha: hoy, estado: "PRESENTE" }, hoy), "NO_JUSTIFICABLE");
  });

  it("solo se revisa una justificación pendiente", () => {
    expect(() => verificarJustificacionPendiente("PENDIENTE")).not.toThrow();
    esperarError(() => verificarJustificacionPendiente("APROBADA"), "JUSTIFICACION_YA_REVISADA");
    esperarError(() => verificarJustificacionPendiente("RECHAZADA"), "JUSTIFICACION_YA_REVISADA");
  });
});
