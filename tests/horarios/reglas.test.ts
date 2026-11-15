// Pruebas de las reglas puras de la cuadrícula y de la asignación de clases (US27, US28, US29, US30; RF22, RF23).
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { erroresHorarios } from "@/modules/horarios/domain/errores";
import {
  buscarCruces,
  esAnioActivo,
  leerJornada,
  motivoSoloLectura,
  verificarBloqueAsignable,
  verificarClaseCompleta,
  verificarDocenteDelCurso,
  verificarEditable,
  type ClaseCandidata,
  type Ocupacion,
} from "@/modules/horarios/domain/reglas";
import { describirBloque, etiquetaSeccion, type Bloque } from "@/modules/horarios/domain/tipos";

function esperarError(fn: () => void, codigo: string, mensaje?: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo, ...(mensaje ? { message: mensaje } : {}) }));
}

const JORNADA = [
  { orden: 1, horaInicio: "07:45", horaFin: "08:30", tipo: "CLASE", etiqueta: "1.ª hora" },
  { orden: 2, horaInicio: "08:30", horaFin: "09:15", tipo: "CLASE", etiqueta: "2.ª hora" },
  { orden: 3, horaInicio: "09:15", horaFin: "09:35", tipo: "RECREO", etiqueta: "Recreo" },
];

describe("periodo académico activo y solo lectura (US27, criterio 3)", () => {
  it("permite editar una sección activa de un año que no está cerrado", () => {
    for (const anioEstado of ["PLANIFICADO", "EN_MATRICULA", "EN_CURSO", "EN_CIERRE"]) {
      expect(esAnioActivo(anioEstado)).toBe(true);
      expect(motivoSoloLectura({ estado: "ACTIVA", anioEstado })).toBeNull();
      expect(() => verificarEditable({ estado: "ACTIVA", anioEstado })).not.toThrow();
    }
  });
  it("deja en solo lectura la sección de un año cerrado, con el mensaje del backlog", () => {
    const mensaje = "Esta sección no pertenece al periodo académico activo";
    expect(esAnioActivo("CERRADO")).toBe(false);
    expect(motivoSoloLectura({ estado: "ACTIVA", anioEstado: "CERRADO" })?.message).toBe(mensaje);
    esperarError(
      () => verificarEditable({ estado: "ACTIVA", anioEstado: "CERRADO" }),
      "SECCION_FUERA_DE_ANIO_ACTIVO",
      mensaje,
    );
  });
  it("no deja editar el horario de una sección inactiva", () => {
    esperarError(() => verificarEditable({ estado: "INACTIVA", anioEstado: "EN_CURSO" }), "SECCION_INACTIVA");
  });
});

describe("jornada por defecto del parámetro BLOQUES_HORARIO (US27)", () => {
  it("acepta una jornada válida y la devuelve ordenada", () => {
    const bloques = leerJornada([JORNADA[2], JORNADA[0], JORNADA[1]]);
    expect(bloques.map((b) => b.orden)).toEqual([1, 2, 3]);
    expect(bloques[2]).toMatchObject({ tipo: "RECREO", horaInicio: "09:15", horaFin: "09:35" });
  });
  it("rechaza una jornada vacía, con horas inválidas, tipos desconocidos, órdenes repetidos o solapes", () => {
    const invalidas: unknown[] = [
      undefined,
      [],
      [{ ...JORNADA[0], horaFin: "07:45" }],
      [{ ...JORNADA[0], horaInicio: "7:45" }],
      [{ ...JORNADA[0], tipo: "ALMUERZO" }],
      [{ ...JORNADA[0], etiqueta: " " }],
      [JORNADA[0], { ...JORNADA[1], orden: 1 }],
      [JORNADA[0], { ...JORNADA[1], horaInicio: "08:00" }],
    ];
    for (const valor of invalidas) esperarError(() => leerJornada(valor), "JORNADA_NO_CONFIGURADA");
  });
});

describe("asignación manual de una clase (US28, M-06)", () => {
  const plan = [
    { cursoId: "mat", asignacion: { id: "asig-mat", docenteId: "castro" } },
    { cursoId: "arte", asignacion: null },
  ];
  const bloque: Bloque = { id: "b1", orden: 1, horaInicio: "07:45", horaFin: "08:30", tipo: "CLASE", etiqueta: "1" };

  it("acepta curso, docente y aula completos", () => {
    expect(verificarClaseCompleta({ cursoId: "mat", docenteId: "castro", aulaId: "a305" })).toEqual({
      cursoId: "mat",
      docenteId: "castro",
      aulaId: "a305",
    });
  });
  it("rechaza guardar si falta el curso, el docente o el aula", () => {
    const mensaje = "Debe completar curso, docente y aula antes de guardar";
    esperarError(() => verificarClaseCompleta({ docenteId: "castro", aulaId: "a305" }), "CLASE_INCOMPLETA", mensaje);
    esperarError(() => verificarClaseCompleta({ cursoId: "mat", docenteId: null, aulaId: "a305" }), "CLASE_INCOMPLETA");
    esperarError(() => verificarClaseCompleta({ cursoId: "mat", docenteId: "castro", aulaId: "" }), "CLASE_INCOMPLETA");
  });
  it("devuelve la asignación del docente que tiene el curso en la sección", () => {
    expect(verificarDocenteDelCurso(plan, "mat", "castro")).toEqual({ id: "asig-mat", docenteId: "castro" });
  });
  it("rechaza a un docente que no tiene asignado el curso, o un curso sin docente", () => {
    const mensaje = "Este docente no tiene asignado el curso seleccionado";
    esperarError(() => verificarDocenteDelCurso(plan, "mat", "torres"), "DOCENTE_SIN_CURSO", mensaje);
    esperarError(() => verificarDocenteDelCurso(plan, "arte", "castro"), "DOCENTE_SIN_CURSO", mensaje);
  });
  it("rechaza un curso que no está en el plan de estudios de la sección", () => {
    esperarError(() => verificarDocenteDelCurso(plan, "fisica", "castro"), "CURSO_FUERA_DEL_PLAN");
  });
  it("solo admite clases en bloques de clase del año: el recreo queda sin asignar", () => {
    expect(verificarBloqueAsignable(bloque)).toBe(bloque);
    esperarError(() => verificarBloqueAsignable({ ...bloque, tipo: "RECREO" }), "BLOQUE_DE_RECREO");
    esperarError(() => verificarBloqueAsignable(null), "NO_ENCONTRADO");
  });
});

describe("cruces de docente y de aula entre secciones (US29, US30)", () => {
  const candidata: ClaseCandidata = {
    seccionId: "5A",
    dia: "MARTES",
    bloqueId: "b7",
    docenteId: "diaz",
    aulaId: "a305",
  };
  const ocupacion = (o: Partial<Ocupacion>): Ocupacion => ({
    seccionId: "4A",
    dia: "MARTES",
    bloqueId: "b7",
    docenteId: "otro",
    aulaId: "otra",
    estadoHorario: "PUBLICADO",
    ...o,
  });

  it("detecta al docente que ya tiene clase en otra sección en el mismo día y bloque", () => {
    const cruces = buscarCruces(candidata, [ocupacion({ docenteId: "diaz" })]);
    expect(cruces.docente).toMatchObject({ seccionId: "4A", dia: "MARTES", bloqueId: "b7" });
    expect(cruces.aula).toBeNull();
  });
  it("detecta el aula ocupada por otra sección en el mismo día y bloque", () => {
    const cruces = buscarCruces(candidata, [ocupacion({ seccionId: "5B", aulaId: "a305" })]);
    expect(cruces.aula).toMatchObject({ seccionId: "5B" });
    expect(cruces.docente).toBeNull();
  });
  it("valida contra el borrador en edición de la otra sección, no solo contra la versión publicada", () => {
    const cruces = buscarCruces(candidata, [ocupacion({ docenteId: "diaz", estadoHorario: "BORRADOR" })]);
    expect(cruces.docente?.estadoHorario).toBe("BORRADOR");
  });
  it("informa primero la versión publicada cuando chocan el borrador y la publicada de otra sección", () => {
    const cruces = buscarCruces(candidata, [
      ocupacion({ docenteId: "diaz", estadoHorario: "BORRADOR" }),
      ocupacion({ docenteId: "diaz", estadoHorario: "PUBLICADO" }),
    ]);
    expect(cruces.docente?.estadoHorario).toBe("PUBLICADO");
  });
  it("permite al mismo docente y la misma aula en bloques o días distintos", () => {
    const cruces = buscarCruces(candidata, [
      ocupacion({ docenteId: "diaz", aulaId: "a305", bloqueId: "b6" }),
      ocupacion({ docenteId: "diaz", aulaId: "a305", dia: "LUNES" }),
    ]);
    expect(cruces).toEqual({ docente: null, aula: null });
  });
  it("no cuenta las clases de la propia sección ni las de versiones archivadas", () => {
    const cruces = buscarCruces(candidata, [
      ocupacion({ seccionId: "5A", docenteId: "diaz", aulaId: "a305" }),
      ocupacion({ docenteId: "diaz", aulaId: "a305", estadoHorario: "ARCHIVADO" }),
    ]);
    expect(cruces).toEqual({ docente: null, aula: null });
  });
  it("los mensajes indican la sección, el día y el bloque del conflicto", () => {
    const cruce = {
      seccion: { id: "4A", etiqueta: etiquetaSeccion({ nombre: "A", grado: { numero: 4 } }) },
      dia: "MARTES" as const,
      bloque: { id: "b7", horaInicio: "12:35", horaFin: "13:20" },
      estadoHorario: "PUBLICADO" as const,
    };
    expect(describirBloque("MIERCOLES", cruce.bloque)).toBe("miércoles 12:35 – 13:20");
    const docente = erroresHorarios.cruceDocente(cruce);
    expect(docente).toMatchObject({ codigo: "CRUCE_DOCENTE", estadoHttp: 409, detalles: cruce });
    expect(docente.message).toBe("Error: Cruce de Docente · ya tiene clase en 4° A (martes 12:35 – 13:20)");
    const aula = erroresHorarios.aulaOcupada("Aula 305", cruce);
    expect(aula).toMatchObject({ codigo: "AULA_OCUPADA", estadoHttp: 409 });
    expect(aula.message).toBe("Error: Aula Ocupada · Aula 305 está asignada a 4° A (martes 12:35 – 13:20)");
  });
});
