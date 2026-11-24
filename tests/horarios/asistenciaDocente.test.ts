// Pruebas de las reglas puras del registro de ingreso de docentes (US32, AD-14): Puntual y Tardanza en los límites
// exactos de hora, hora límite, día no lectivo, fecha pasada, falta automática idempotente, salida y justificación.
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { motivoDiaNoLectivo } from "@/modules/horarios/domain/asistencia";
import {
  alcanzoHoraLimite,
  docentesSinMarcar,
  estadoDeIngreso,
  horaEnLima,
  ingresoPara,
  minutosParaLimite,
  resumenAsistenciaDocente,
  verificarDiaActual,
  verificarJustificable,
  verificarSalida,
  type RegistroDocente,
} from "@/modules/horarios/domain/asistenciaDocente";

function esperarError(fn: () => void, codigo: string, mensaje?: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo, ...(mensaje ? { message: mensaje } : {}) }));
}

const INICIO = "07:30";
const LIMITE = "08:00";
const registro = (r: Partial<RegistroDocente>): RegistroDocente => ({
  estado: "PUNTUAL",
  horaIngreso: "07:20:00",
  horaSalida: null,
  ...r,
});

describe("estado del ingreso según HORA_INICIO_JORNADA_DOCENTE (US32, criterio 1)", () => {
  it("es Puntual hasta las 07:30 inclusive, en el límite exacto", () => {
    expect(estadoDeIngreso("07:29:59", INICIO)).toBe("PUNTUAL");
    expect(estadoDeIngreso("07:30:00", INICIO)).toBe("PUNTUAL");
    // se compara al minuto, como se muestra en la pantalla: 07:30:59 todavía se ve «07:30»
    expect(estadoDeIngreso("07:30:59", INICIO)).toBe("PUNTUAL");
  });

  it("es Tardanza desde el minuto siguiente", () => {
    expect(estadoDeIngreso("07:31:00", INICIO)).toBe("TARDANZA");
    expect(estadoDeIngreso("09:15:00", INICIO)).toBe("TARDANZA");
  });

  it("respeta otra hora de inicio configurada por el colegio", () => {
    expect(estadoDeIngreso("07:45:00", "07:45")).toBe("PUNTUAL");
    expect(estadoDeIngreso("07:46:00", "07:45")).toBe("TARDANZA");
  });

  it("toma la hora exacta en la hora de Lima (UTC−5)", () => {
    expect(horaEnLima(new Date("2026-09-16T12:31:05Z"))).toBe("07:31:05");
    expect(horaEnLima(new Date("2026-09-17T04:59:59Z"))).toBe("23:59:59");
  });
});

describe("hora límite HORA_LIMITE_ASISTENCIA_DOCENTE (US32, criterio 2)", () => {
  it("se alcanza justo a las 08:00, no un segundo antes", () => {
    expect(alcanzoHoraLimite("07:59:59", LIMITE)).toBe(false);
    expect(alcanzoHoraLimite("08:00:00", LIMITE)).toBe(true);
    expect(alcanzoHoraLimite("10:00:00", LIMITE)).toBe(true);
  });

  it("cuenta los minutos que faltan y nunca da un número negativo", () => {
    expect(minutosParaLimite("07:46", LIMITE)).toBe(14);
    expect(minutosParaLimite("08:00", LIMITE)).toBe(0);
    expect(minutosParaLimite("09:30", LIMITE)).toBe(0);
  });
});

describe("solo el día actual (US32, criterio 3)", () => {
  const hoy = "2026-09-16";

  it("acepta la fecha de hoy", () => {
    expect(() => verificarDiaActual(hoy, hoy)).not.toThrow();
  });

  it("bloquea una fecha pasada con el mensaje del backlog", () => {
    esperarError(
      () => verificarDiaActual("2026-09-15", hoy),
      "SOLO_DIA_ACTUAL",
      "Solo se puede registrar la asistencia del día actual",
    );
  });

  it("bloquea también una fecha futura", () => {
    esperarError(() => verificarDiaActual("2026-09-17", hoy), "SOLO_DIA_ACTUAL");
  });
});

describe("día lectivo para la asistencia docente", () => {
  const bimestres = [{ fechaInicio: "2026-03-09", fechaFin: "2026-05-08" }];

  it("un día de semana dentro de un bimestre es lectivo", () => {
    expect(motivoDiaNoLectivo("2026-04-15", bimestres)).toBeNull();
  });

  it("sábado, vacaciones entre bimestres o sin año en curso no lo son", () => {
    expect(motivoDiaNoLectivo("2026-04-18", bimestres)).toBe("FIN_DE_SEMANA");
    expect(motivoDiaNoLectivo("2026-05-13", bimestres)).toBe("FUERA_DE_BIMESTRE");
    expect(motivoDiaNoLectivo("2026-04-15", null)).toBe("SIN_ANIO_EN_CURSO");
  });
});

describe("marcar «Asistió» (US32, criterios 1 y 2)", () => {
  it("sin registro, crea Puntual o Tardanza según la hora", () => {
    expect(ingresoPara(null, "07:25:10", INICIO)).toEqual({ estado: "PUNTUAL", reemplazaFalta: false });
    expect(ingresoPara(null, "07:40:00", INICIO)).toEqual({ estado: "TARDANZA", reemplazaFalta: false });
  });

  it("con la falta automática, pasa a Tardanza con la hora real", () => {
    expect(ingresoPara(registro({ estado: "FALTA", horaIngreso: null }), "08:20:00", INICIO)).toEqual({
      estado: "TARDANZA",
      reemplazaFalta: true,
    });
  });

  it("no vuelve a marcar un ingreso ya registrado", () => {
    esperarError(
      () => ingresoPara(registro({ horaIngreso: "07:31:00" }), "07:50:00", INICIO),
      "INGRESO_YA_REGISTRADO",
      "El ingreso de este docente ya se registró a las 07:31.",
    );
  });

  it("no marca el ingreso sobre una falta ya justificada", () => {
    esperarError(
      () => ingresoPara(registro({ estado: "FALTA_JUSTIFICADA", horaIngreso: null }), "09:00:00", INICIO),
      "FALTA_YA_JUSTIFICADA",
    );
  });
});

describe("verificación automática idempotente (US32, criterio 2)", () => {
  it("marca solo a los docentes activos sin registro del día", () => {
    expect(docentesSinMarcar(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });

  it("una segunda ejecución ya no encuentra a nadie por marcar", () => {
    const primera = docentesSinMarcar(["a", "b", "c"], ["b"]);
    expect(docentesSinMarcar(["a", "b", "c"], ["b", ...primera])).toEqual([]);
  });
});

describe("salida y justificación (US32)", () => {
  it("registra la salida después del ingreso", () => {
    expect(() => verificarSalida(registro({}), "13:25:00")).not.toThrow();
  });

  it("no registra la salida sin ingreso, dos veces ni antes del ingreso", () => {
    esperarError(() => verificarSalida(null, "13:00:00"), "SIN_INGRESO");
    esperarError(() => verificarSalida(registro({ estado: "FALTA", horaIngreso: null }), "13:00:00"), "SIN_INGRESO");
    esperarError(() => verificarSalida(registro({ horaSalida: "13:20:00" }), "13:30:00"), "SALIDA_YA_REGISTRADA");
    esperarError(() => verificarSalida(registro({ horaIngreso: "07:20:00" }), "07:10:00"), "SALIDA_ANTES_DEL_INGRESO");
  });

  it("solo justifica una inasistencia", () => {
    expect(() => verificarJustificable(registro({ estado: "FALTA", horaIngreso: null }))).not.toThrow();
    for (const estado of ["PUNTUAL", "TARDANZA", "FALTA_JUSTIFICADA"] as const) {
      esperarError(() => verificarJustificable(registro({ estado })), "NO_ES_INASISTENCIA");
    }
  });
});

describe("contadores de AD-14", () => {
  it("cuenta puntuales, tardanzas, faltas (con las justificadas) y sin marcar", () => {
    expect(
      resumenAsistenciaDocente(["PUNTUAL", "PUNTUAL", "TARDANZA", "FALTA", "FALTA_JUSTIFICADA", null, null]),
    ).toEqual({ total: 7, puntuales: 2, tardanzas: 1, faltas: 2, justificadas: 1, sinMarcar: 2 });
  });

  it("sin docentes, todo en cero", () => {
    expect(resumenAsistenciaDocente([])).toEqual({
      total: 0,
      puntuales: 0,
      tardanzas: 0,
      faltas: 0,
      justificadas: 0,
      sinMarcar: 0,
    });
  });
});
