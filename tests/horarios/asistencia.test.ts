// Pruebas de las reglas puras de la asistencia de alumnos (US35 toma diaria, US36 plazo de 24 horas, US45 estado del
// día y resumen mensual, US52 umbrales y aviso único). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  alcanzaUmbral,
  alertaDelMes,
  alumnosSinMarcar,
  avisosAlcanzados,
  avisosConCorreo,
  avisosPendientes,
  baseDeInasistencia,
  bimestreDeReferencia,
  calendarioDelMes,
  cambiosDeAsistencia,
  cantidad,
  dentroDelPlazo,
  diaDeClases,
  diasDeAsistencia,
  diasLectivos,
  estadoDelDia,
  faltasAntesDelUmbral,
  incidenciasDe,
  limiteDeCorreccion,
  motivoDiaNoLectivo,
  nivelDeRiesgo,
  nombreDeLista,
  porcentajeDeInasistencia,
  rangoDelMes,
  resumenDeDias,
  resumenDeSesion,
  situacionAnual,
  verificarCorreccion,
  verificarFechaDeRegistro,
  verificarListaCompleta,
  verificarPlazoDeCorreccion,
  type MarcaDeAsistencia,
  type RegistroDeClase,
  type Umbrales,
} from "@/modules/horarios/domain/asistencia";

function esperarError(fn: () => void, codigo: string, mensaje?: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo, ...(mensaje ? { message: mensaje } : {}) }));
}

const UMBRALES: Umbrales = { faltasMes: 3, aviso: 0.15, riesgo: 0.2 };
const BIMESTRES = [
  { numero: 1, nombre: "Bimestre I", fechaInicio: "2026-03-09", fechaFin: "2026-05-15" },
  { numero: 2, nombre: "Bimestre II", fechaInicio: "2026-05-25", fechaFin: "2026-07-24" },
  { numero: 3, nombre: "Bimestre III", fechaInicio: "2026-08-10", fechaFin: "2026-10-09" },
  { numero: 4, nombre: "Bimestre IV", fechaInicio: "2026-10-19", fechaFin: "2026-12-18" },
];
const ALUMNOS = [
  { matriculaId: "m1", nombre: "Álvarez Torres, Camila" },
  { matriculaId: "m2", nombre: "Lima Sánchez, Hugo" },
  { matriculaId: "m3", nombre: "Mora Díaz, Renata" },
];
const marca = (matriculaId: string, estado: MarcaDeAsistencia["estado"], observacion: string | null = null) => ({
  matriculaId,
  estado,
  observacion,
});
const clase = (curso: string, horaInicio: string) => ({ curso, horaInicio, docente: "L. Campos" });
const registro = (
  fecha: string,
  estado: RegistroDeClase["estado"],
  horaInicio = "07:45",
  observacion: string | null = null,
): RegistroDeClase => ({ fecha, estado, observacion, clase: clase("Inglés", horaInicio) });

describe("clases de hoy según el día (US35)", () => {
  it("reconoce los días de clase de lunes a viernes", () => {
    expect(diaDeClases("2026-09-14")).toBe("LUNES");
    expect(diaDeClases("2026-09-16")).toBe("MIERCOLES");
    expect(diaDeClases("2026-09-18")).toBe("VIERNES");
  });

  it("el sábado y el domingo no son días de clase", () => {
    expect(diaDeClases("2026-09-19")).toBeNull();
    expect(diaDeClases("2026-09-20")).toBeNull();
  });

  it("un día dentro de un bimestre del año en curso es lectivo", () => {
    expect(motivoDiaNoLectivo("2026-09-16", BIMESTRES)).toBeNull();
  });

  it("explica por qué no hay clases: fin de semana, sin año en curso o fuera de los bimestres", () => {
    expect(motivoDiaNoLectivo("2026-09-19", BIMESTRES)).toBe("FIN_DE_SEMANA");
    expect(motivoDiaNoLectivo("2026-09-16", null)).toBe("SIN_ANIO_EN_CURSO");
    // vacaciones de medio año: entre el bimestre II y el III
    expect(motivoDiaNoLectivo("2026-07-29", BIMESTRES)).toBe("FUERA_DE_BIMESTRE");
  });

  it("acepta registrar la asistencia del día actual", () => {
    expect(() => verificarFechaDeRegistro("2026-09-16", "2026-09-16")).not.toThrow();
  });

  it("no registra asistencia de una fecha futura ni de un día pasado", () => {
    esperarError(() => verificarFechaDeRegistro("2026-09-17", "2026-09-16"), "FECHA_FUTURA");
    esperarError(() => verificarFechaDeRegistro("2026-09-15", "2026-09-16"), "SOLO_DIA_ACTUAL");
  });

  it("ordena la lista por apellidos", () => {
    expect(nombreDeLista({ nombres: "Camila", apellidos: "Álvarez Torres" })).toBe("Álvarez Torres, Camila");
  });
});

describe("lista completa antes de guardar (US35, criterio 3)", () => {
  it("acepta la lista cuando todos los alumnos tienen estado", () => {
    const marcas = [marca("m1", "PRESENTE"), marca("m2", "FALTA"), marca("m3", "FALTA_JUSTIFICADA", "Cita médica")];
    expect(verificarListaCompleta(ALUMNOS, marcas)).toEqual(marcas);
  });

  it("si falta marcar a alguno responde el mensaje del backlog y dice quiénes faltan", () => {
    const marcas = [marca("m1", "PRESENTE"), marca("m2", null)];
    expect(alumnosSinMarcar(ALUMNOS, marcas).map((a) => a.nombre)).toEqual(["Lima Sánchez, Hugo", "Mora Díaz, Renata"]);
    try {
      verificarListaCompleta(ALUMNOS, marcas);
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({
        codigo: "ASISTENCIA_INCOMPLETA",
        estadoHttp: 422,
        message: "Existen alumnos sin estado de asistencia registrado",
        detalles: { faltantes: [ALUMNOS[1], ALUMNOS[2]] },
      });
    }
  });

  it("rechaza a un alumno que no es de la clase o que llega repetido", () => {
    const completas = ALUMNOS.map((a) => marca(a.matriculaId, "PRESENTE"));
    esperarError(
      () => verificarListaCompleta(ALUMNOS, [...completas, marca("otro", "PRESENTE")]),
      "ALUMNO_FUERA_DE_LA_CLASE",
    );
    esperarError(
      () => verificarListaCompleta(ALUMNOS, [...completas, marca("m1", "FALTA")]),
      "ALUMNO_FUERA_DE_LA_CLASE",
    );
  });

  it("cuenta presentes, tardanzas, ausentes, justificados y sin marcar", () => {
    const estados = [
      "PRESENTE",
      "PRESENTE",
      "TARDANZA",
      "FALTA",
      "FALTA_JUSTIFICADA",
      "TARDANZA_JUSTIFICADA",
      null,
      null,
    ] as const;
    expect(resumenDeSesion([...estados])).toEqual({
      presentes: 2,
      tardanzas: 1,
      ausentes: 1,
      justificados: 1,
      tardanzasJustificadas: 1,
      sinMarcar: 2,
    });
  });
});

describe("plazo de 24 horas para corregir (US36)", () => {
  const registradoEn = new Date("2026-09-16T14:20:00Z");

  it("el límite es 24 horas después del registro original", () => {
    expect(limiteDeCorreccion(registradoEn, 24).toISOString()).toBe("2026-09-17T14:20:00.000Z");
  });

  it("permite corregir dentro del plazo, incluso justo en el límite", () => {
    expect(dentroDelPlazo(registradoEn, 24, new Date("2026-09-17T09:00:00Z"))).toBe(true);
    expect(dentroDelPlazo(registradoEn, 24, new Date("2026-09-17T14:20:00Z"))).toBe(true);
    expect(() => verificarPlazoDeCorreccion(registradoEn, 24, new Date("2026-09-17T14:20:00Z"))).not.toThrow();
  });

  it("pasado el plazo responde «El plazo para modificar esta asistencia ha expirado (24 horas)»", () => {
    const despues = new Date("2026-09-17T14:20:01Z");
    expect(dentroDelPlazo(registradoEn, 24, despues)).toBe(false);
    esperarError(
      () => verificarPlazoDeCorreccion(registradoEn, 24, despues),
      "PLAZO_CORRECCION_VENCIDO",
      "El plazo para modificar esta asistencia ha expirado (24 horas)",
    );
  });

  it("el plazo sale del parámetro de la institución, no está fijo en 24", () => {
    const a36Horas = new Date("2026-09-18T02:00:00Z");
    expect(dentroDelPlazo(registradoEn, 48, a36Horas)).toBe(true);
    esperarError(
      () => verificarPlazoDeCorreccion(registradoEn, 12, a36Horas),
      "PLAZO_CORRECCION_VENCIDO",
      "El plazo para modificar esta asistencia ha expirado (12 horas)",
    );
  });

  it("separa los registros nuevos de los que cambian y no toca los que quedan igual", () => {
    const guardados = [
      { id: "r1", matriculaId: "m1", estado: "PRESENTE" as const, observacion: null },
      { id: "r2", matriculaId: "m2", estado: "FALTA" as const, observacion: null },
    ];
    const cambios = cambiosDeAsistencia(guardados, [
      marca("m1", "PRESENTE"),
      marca("m2", "FALTA_JUSTIFICADA", "Cita médica con constancia"),
      marca("m3", "TARDANZA"),
    ] as never);
    expect(cambios.nuevos).toEqual([marca("m3", "TARDANZA")]);
    expect(cambios.correcciones).toEqual([
      { registro: guardados[1], estado: "FALTA_JUSTIFICADA", observacion: "Cita médica con constancia" },
    ]);
  });

  it("la corrección del administrador debe cambiar el estado o la observación", () => {
    const actual = { id: "r1", matriculaId: "m1", estado: "FALTA" as const, observacion: null };
    expect(() => verificarCorreccion(actual, { estado: "FALTA_JUSTIFICADA", observacion: null })).not.toThrow();
    expect(() => verificarCorreccion(actual, { estado: "FALTA", observacion: "Avisó la madre" })).not.toThrow();
    esperarError(() => verificarCorreccion(actual, { estado: "FALTA", observacion: null }), "ASISTENCIA_SIN_CAMBIOS");
  });
});

describe("estado del día (US45, criterio 1)", () => {
  it("es Ausente solo si faltó a todas las clases del día", () => {
    expect(estadoDelDia(["FALTA", "FALTA", "FALTA"])).toBe("AUSENTE");
    expect(estadoDelDia(["FALTA"])).toBe("AUSENTE");
  });

  it("si asistió a alguna clase no es Ausente, aunque haya faltado a las demás", () => {
    expect(estadoDelDia(["FALTA", "PRESENTE", "FALTA"])).toBe("PRESENTE");
    expect(estadoDelDia(["FALTA", "TARDANZA"])).toBe("TARDANZA");
  });

  it("es Justificado si faltó a todas y todas las faltas están justificadas", () => {
    expect(estadoDelDia(["FALTA_JUSTIFICADA", "FALTA_JUSTIFICADA"])).toBe("JUSTIFICADO");
    // con una sola falta sin justificar el día sigue siendo una inasistencia injustificada
    expect(estadoDelDia(["FALTA_JUSTIFICADA", "FALTA"])).toBe("AUSENTE");
  });

  it("es Tardanza si llegó tarde a alguna clase y Presente si asistió a todas a tiempo", () => {
    expect(estadoDelDia(["PRESENTE", "TARDANZA", "PRESENTE"])).toBe("TARDANZA");
    expect(estadoDelDia(["PRESENTE", "PRESENTE"])).toBe("PRESENTE");
    // bloque M3: la tardanza justificada por el tutor cuenta como asistencia, no como tardanza
    expect(estadoDelDia(["PRESENTE", "TARDANZA_JUSTIFICADA"])).toBe("PRESENTE");
    expect(estadoDelDia(["FALTA", "TARDANZA_JUSTIFICADA"])).toBe("PRESENTE");
  });

  it("agrupa los registros por día, en orden, y resume el mes con su porcentaje de asistencia", () => {
    const dias = diasDeAsistencia([
      registro("2026-08-12", "TARDANZA"),
      registro("2026-08-10", "PRESENTE"),
      registro("2026-08-10", "PRESENTE", "08:30"),
      registro("2026-08-11", "FALTA"),
      registro("2026-08-11", "FALTA", "08:30"),
      registro("2026-08-13", "FALTA_JUSTIFICADA"),
    ]);
    expect(dias).toEqual([
      { fecha: "2026-08-10", estado: "PRESENTE", clases: 2 },
      { fecha: "2026-08-11", estado: "AUSENTE", clases: 2 },
      { fecha: "2026-08-12", estado: "TARDANZA", clases: 1 },
      { fecha: "2026-08-13", estado: "JUSTIFICADO", clases: 1 },
    ]);
    expect(resumenDeDias(dias)).toEqual({
      presentes: 1,
      tardanzas: 1,
      ausentes: 1,
      justificados: 1,
      diasConClases: 4,
      porcentajeAsistencia: 50,
    });
  });

  it("sin registros el resumen queda en cero y sin porcentaje", () => {
    expect(resumenDeDias([])).toMatchObject({ diasConClases: 0, porcentajeAsistencia: null });
  });

  it("lista un día completo como una sola inasistencia y las faltas parciales por clase, con su observación", () => {
    const incidencias = incidenciasDe([
      registro("2026-08-10", "PRESENTE"),
      registro("2026-08-11", "FALTA"),
      registro("2026-08-11", "FALTA", "08:30", "No avisó"),
      registro("2026-08-12", "TARDANZA", "07:45", "Llegó 07:58"),
      registro("2026-08-12", "PRESENTE", "08:30"),
      registro("2026-08-13", "PRESENTE", "07:45", "Participó en la feria"),
      registro("2026-08-14", "FALTA", "07:45"),
      registro("2026-08-14", "PRESENTE", "08:30"),
    ]);
    expect(incidencias).toEqual([
      { fecha: "2026-08-14", alcance: "CLASE", estado: "AUSENTE", clase: clase("Inglés", "07:45"), observacion: null },
      {
        fecha: "2026-08-13",
        alcance: "CLASE",
        estado: "PRESENTE",
        clase: clase("Inglés", "07:45"),
        observacion: "Participó en la feria",
      },
      {
        fecha: "2026-08-12",
        alcance: "CLASE",
        estado: "TARDANZA",
        clase: clase("Inglés", "07:45"),
        observacion: "Llegó 07:58",
      },
      { fecha: "2026-08-11", alcance: "DIA", estado: "AUSENTE", clase: null, observacion: "No avisó" },
    ]);
  });
});

describe("meses, bimestres y calendario (US45, US52)", () => {
  it("calcula el primer y el último día del mes", () => {
    expect(rangoDelMes("2026-08")).toEqual({ fechaInicio: "2026-08-01", fechaFin: "2026-08-31" });
    expect(rangoDelMes("2028-02")).toEqual({ fechaInicio: "2028-02-01", fechaFin: "2028-02-29" });
  });

  it("acumula en el bimestre que contiene la fecha y, en vacaciones, en el último que empezó", () => {
    expect(bimestreDeReferencia(BIMESTRES, "2026-09-16")?.numero).toBe(3);
    expect(bimestreDeReferencia(BIMESTRES, "2026-07-29")?.numero).toBe(2);
  });

  it("antes del primer bimestre no hay bimestre de referencia", () => {
    expect(bimestreDeReferencia(BIMESTRES, "2026-03-02")).toBeNull();
    expect(bimestreDeReferencia([], "2026-09-16")).toBeNull();
  });

  it("cuenta los días de clase de lunes a viernes dentro de los bimestres", () => {
    expect(diasLectivos([{ fechaInicio: "2026-09-14", fechaFin: "2026-09-25" }])).toBe(10);
    expect(diasLectivos([{ fechaInicio: "2026-09-19", fechaFin: "2026-09-20" }])).toBe(0);
    expect(diasLectivos(BIMESTRES)).toBe(185);
  });

  it("arma el calendario del mes con los días registrados, las vacaciones y los días sin registro", () => {
    const anio = { fechaInicio: "2026-03-09", fechaFin: "2026-12-18" };
    const dias = [{ fecha: "2026-08-10", estado: "PRESENTE" as const, clases: 3 }];
    const calendario = calendarioDelMes("2026-08", dias, anio, BIMESTRES);
    expect(calendario).toHaveLength(21);
    expect(calendario[0]).toEqual({ fecha: "2026-08-03", dia: "LUNES", estado: "VACACIONES" });
    expect(calendario.find((d) => d.fecha === "2026-08-10")?.estado).toBe("PRESENTE");
    expect(calendario.find((d) => d.fecha === "2026-08-11")?.estado).toBe("SIN_REGISTRO");
  });

  it("un mes fuera del año escolar no se muestra como vacaciones", () => {
    const anio = { fechaInicio: "2026-03-09", fechaFin: "2026-12-18" };
    expect(calendarioDelMes("2026-02", [], anio, BIMESTRES).every((d) => d.estado === "FUERA_DEL_ANIO")).toBe(true);
    expect(calendarioDelMes("2026-08", [], null, []).every((d) => d.estado === "FUERA_DEL_ANIO")).toBe(true);
  });
});

describe("umbrales de inasistencia y alertas (US45, criterio 2; US52, criterios 2 y 3)", () => {
  it("no hay riesgo por debajo del umbral de aviso", () => {
    expect(nivelDeRiesgo(9, 120, UMBRALES)).toBe("SIN_RIESGO");
    expect(porcentajeDeInasistencia(9, 120)).toBe(7.5);
    // el riesgo llega en la falta 24 (20 % de 120): con 9 aún puede sumar 14 sin alcanzarlo (D-11)
    expect(faltasAntesDelUmbral(9, 120, UMBRALES.riesgo)).toBe(14);
  });

  it("avisa al llegar al 15 % y marca riesgo al llegar al 20 %", () => {
    expect(nivelDeRiesgo(17, 120, UMBRALES)).toBe("SIN_RIESGO");
    expect(nivelDeRiesgo(18, 120, UMBRALES)).toBe("AVISO");
    expect(nivelDeRiesgo(23, 120, UMBRALES)).toBe("AVISO");
    expect(nivelDeRiesgo(24, 120, UMBRALES)).toBe("RIESGO");
    expect(faltasAntesDelUmbral(25, 120, UMBRALES.riesgo)).toBe(0);
  });

  it("el umbral exacto cuenta aunque los decimales no sean exactos en binario", () => {
    expect(alcanzaUmbral(3, 20, 0.15)).toBe(true);
    expect(alcanzaUmbral(2, 20, 0.15)).toBe(false);
  });

  it("sin días de clase configurados no hay porcentaje ni riesgo", () => {
    expect(nivelDeRiesgo(5, 0, UMBRALES)).toBe("SIN_RIESGO");
    expect(porcentajeDeInasistencia(5, 0)).toBe(0);
  });

  it("alerta del mes al llegar a las faltas injustificadas del parámetro", () => {
    expect(alertaDelMes(3, 3)).toBe("Atención: 3 inasistencias injustificadas este mes");
    expect(alertaDelMes(5, 3)).toBe("Atención: 5 inasistencias injustificadas este mes");
  });

  it("por debajo del parámetro no hay alerta del mes", () => {
    expect(alertaDelMes(2, 3)).toBeNull();
    expect(alertaDelMes(3, 4)).toBeNull();
  });
});

describe("aviso único por umbral (US52: una sola vez por cada umbral)", () => {
  const situacion = { anio: 2026, mes: "2026-09", faltasDelMes: 3, faltasDelAnio: 18, lectivos: 120 };

  it("detecta los umbrales alcanzados: faltas del mes y porcentaje de aviso", () => {
    expect(avisosAlcanzados(situacion, UMBRALES)).toEqual([
      { tipo: "FALTAS_MES", periodo: "2026-09", faltas: 3 },
      { tipo: "PORCENTAJE_AVISO", periodo: "2026", faltas: 18 },
    ]);
  });

  it("sin llegar a ningún umbral no hay avisos", () => {
    expect(avisosAlcanzados({ ...situacion, faltasDelMes: 2, faltasDelAnio: 9 }, UMBRALES)).toEqual([]);
  });

  it("no repite un aviso ya enviado en el mismo periodo", () => {
    const alcanzados = avisosAlcanzados(situacion, UMBRALES);
    const enviados = [{ tipo: "FALTAS_MES" as const, periodo: "2026-09" }];
    expect(avisosPendientes(alcanzados, enviados)).toEqual([{ tipo: "PORCENTAJE_AVISO", periodo: "2026", faltas: 18 }]);
    expect(avisosPendientes(alcanzados, [...enviados, { tipo: "PORCENTAJE_AVISO", periodo: "2026" }])).toEqual([]);
  });

  it("las faltas del mes se avisan de nuevo en otro mes, pero el porcentaje solo una vez en el año", () => {
    const octubre = avisosAlcanzados({ ...situacion, mes: "2026-10", faltasDelAnio: 21 }, UMBRALES);
    const enviados = [
      { tipo: "FALTAS_MES" as const, periodo: "2026-09" },
      { tipo: "PORCENTAJE_AVISO" as const, periodo: "2026" },
    ];
    expect(avisosPendientes(octubre, enviados)).toEqual([{ tipo: "FALTAS_MES", periodo: "2026-10", faltas: 3 }]);
  });

  it("al pasar del aviso al riesgo se envía el de riesgo, una sola vez", () => {
    const enRiesgo = avisosAlcanzados({ ...situacion, faltasDelMes: 1, faltasDelAnio: 24 }, UMBRALES);
    const pendientes = avisosPendientes(enRiesgo, [{ tipo: "PORCENTAJE_AVISO", periodo: "2026" }]);
    expect(pendientes).toEqual([{ tipo: "PORCENTAJE_RIESGO", periodo: "2026", faltas: 24 }]);
    expect(avisosPendientes(enRiesgo, [...pendientes, { tipo: "PORCENTAJE_AVISO", periodo: "2026" }])).toEqual([]);
  });

  it("si el aviso y el riesgo se alcanzan a la vez, se escribe un solo correo: el de riesgo", () => {
    const nuevos = avisosAlcanzados({ ...situacion, faltasDelMes: 0, faltasDelAnio: 30 }, UMBRALES);
    expect(nuevos.map((a) => a.tipo)).toEqual(["PORCENTAJE_AVISO", "PORCENTAJE_RIESGO"]);
    expect(avisosConCorreo(nuevos).map((a) => a.tipo)).toEqual(["PORCENTAJE_RIESGO"]);
  });
});

describe("D-11 · base de inasistencias, faltas restantes y singular o plural (US45, US52)", () => {
  // último bimestre del ejemplo del defecto: termina el 15/12/2026
  const BIMESTRES_D11 = [
    { fechaInicio: "2026-03-09", fechaFin: "2026-05-15" },
    { fechaInicio: "2026-05-25", fechaFin: "2026-07-24" },
    { fechaInicio: "2026-08-10", fechaFin: "2026-10-09" },
    { fechaInicio: "2026-10-19", fechaFin: "2026-12-15" },
  ];

  it("cuenta los días de clase desde la matrícula hasta el fin del último bimestre", () => {
    const base = baseDeInasistencia(BIMESTRES_D11, "2026-11-06");
    expect(base).toEqual({ lectivos: 28, desde: "2026-11-06", desdeMatricula: true });
  });

  it("con la matrícula anterior al inicio de clases, la base son todos los días de clase del año", () => {
    const base = baseDeInasistencia(BIMESTRES_D11, "2026-02-20");
    expect(base).toEqual({ lectivos: diasLectivos(BIMESTRES_D11), desde: "2026-03-09", desdeMatricula: false });
  });

  it("una matrícula en vacaciones cuenta desde el bimestre siguiente", () => {
    expect(baseDeInasistencia(BIMESTRES_D11, "2026-10-12").lectivos).toBe(
      diasLectivos([{ fechaInicio: "2026-10-19", fechaFin: "2026-12-15" }]),
    );
  });

  it("sin bimestres no hay días de clase", () => {
    expect(baseDeInasistencia([], "2026-11-06")).toMatchObject({ lectivos: 0, desdeMatricula: false });
  });

  it("con 28 días y 20 %, el riesgo llega en la 6.ª falta (no en la 38.ª del año completo)", () => {
    const base = baseDeInasistencia(BIMESTRES_D11, "2026-11-06");
    expect(situacionAnual(5, base, UMBRALES)).toMatchObject({ nivel: "AVISO", porcentaje: 17.9, lectivos: 28 });
    expect(situacionAnual(6, base, UMBRALES)).toMatchObject({ nivel: "RIESGO", porcentaje: 21.4 });
    expect(situacionAnual(1, base, UMBRALES)).toMatchObject({
      nivel: "SIN_RIESGO",
      desde: "2026-11-06",
      desdeMatricula: true,
      faltasAntesDelRiesgo: 4,
    });
  });

  it("los avisos por correo usan la misma base: el 15 % llega en la 5.ª falta y el 20 %, en la 6.ª", () => {
    const situacion = { anio: 2026, mes: "2026-11", faltasDelMes: 0, lectivos: 28 };
    expect(avisosAlcanzados({ ...situacion, faltasDelAnio: 4 }, UMBRALES)).toEqual([]);
    expect(avisosAlcanzados({ ...situacion, faltasDelAnio: 5 }, UMBRALES).map((a) => a.tipo)).toEqual([
      "PORCENTAJE_AVISO",
    ]);
    expect(avisosAlcanzados({ ...situacion, faltasDelAnio: 6 }, UMBRALES).map((a) => a.tipo)).toEqual([
      "PORCENTAJE_AVISO",
      "PORCENTAJE_RIESGO",
    ]);
  });

  it("«Te quedan N faltas» cuenta las faltas que todavía no llegan al umbral", () => {
    // 20 % de 187 = 37,4: el umbral se alcanza en la falta 38, así que con 1 falta quedan 36 (no 37)
    expect(faltasAntesDelUmbral(1, 187, 0.2)).toBe(36);
    expect(faltasAntesDelUmbral(36, 187, 0.2)).toBe(1);
    expect(faltasAntesDelUmbral(37, 187, 0.2)).toBe(0);
    expect(faltasAntesDelUmbral(38, 187, 0.2)).toBe(0);
    // umbral exacto: con 20 días el 20 % son 4 faltas; con 0 faltas se pueden sumar 3 sin llegar
    expect(faltasAntesDelUmbral(0, 20, 0.2)).toBe(3);
  });

  it("escribe la cantidad en singular o plural", () => {
    expect(cantidad(1, "falta", "faltas")).toBe("1 falta");
    expect(cantidad(2, "falta", "faltas")).toBe("2 faltas");
    expect(cantidad(0, "falta", "faltas")).toBe("0 faltas");
    expect(alertaDelMes(1, 1)).toBe("Atención: 1 inasistencia injustificada este mes");
    expect(alertaDelMes(2, 1)).toBe("Atención: 2 inasistencias injustificadas este mes");
  });
});
