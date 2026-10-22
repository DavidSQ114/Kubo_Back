// Pruebas de las reglas puras de cursos (US10) y competencias por curso y grado (US11, RF09). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  compararPlanes,
  normalizarCodigoCurso,
  prepararCompetencias,
  verificarArea,
  verificarCambioArea,
  verificarCompetenciasConfiguradas,
  verificarEliminacionCurso,
  verificarGradosPlan,
  verificarQuitarCompetencias,
} from "@/modules/academico/domain/cursos";

function esperarError(fn: () => void, codigo: string, mensaje?: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo, ...(mensaje ? { message: mensaje } : {}) }));
}

const MAT = "area-mat";
const ART = "area-art";
const catalogo = [
  { id: "mat-c1", areaCurricularId: MAT, activo: true },
  { id: "mat-c2", areaCurricularId: MAT, activo: true },
  { id: "mat-c9", areaCurricularId: MAT, activo: false },
  { id: "art-c1", areaCurricularId: ART, activo: true },
];

describe("curso (US10)", () => {
  it("normaliza el código a mayúsculas", () => {
    expect(normalizarCodigoCurso(" art-2 ")).toBe("ART-2");
    expect(normalizarCodigoCurso("MAT")).toBe("MAT");
  });
  it("rechaza códigos vacíos, muy largos o con símbolos", () => {
    for (const malo of ["", "M", "MAT 1", "MATEMATICA-123", "MAT_1", "CIENCIAÑ"]) {
      esperarError(() => normalizarCodigoCurso(malo), "CODIGO_CURSO_INVALIDO");
    }
  });
  it("exige el área curricular", () => {
    expect(() => verificarArea(MAT)).not.toThrow();
    for (const vacio of ["", null, undefined]) {
      esperarError(() => verificarArea(vacio), "AREA_REQUERIDA", "Debe seleccionar el área curricular del curso");
    }
  });
  it("no se elimina si tiene docentes asignados o está en un horario publicado; sin uso, sí", () => {
    expect(() => verificarEliminacionCurso({ docentes: 0, seccionesConHorario: 0 })).not.toThrow();
    const mensaje = "No se puede eliminar un curso asignado; desactívalo en su lugar";
    esperarError(() => verificarEliminacionCurso({ docentes: 4, seccionesConHorario: 0 }), "CURSO_ASIGNADO", mensaje);
    esperarError(() => verificarEliminacionCurso({ docentes: 0, seccionesConHorario: 15 }), "CURSO_ASIGNADO", mensaje);
  });
  it("no cambia de área si ya tiene competencias configuradas (RF09)", () => {
    expect(() => verificarCambioArea(MAT, MAT, 4)).not.toThrow();
    expect(() => verificarCambioArea(MAT, ART, 0)).not.toThrow();
    esperarError(() => verificarCambioArea(MAT, ART, 4), "AREA_CON_COMPETENCIAS");
  });
});

describe("grados y horas del curso (US10)", () => {
  it("acepta grados distintos con horas enteras mayores a 0", () => {
    expect(() =>
      verificarGradosPlan([
        { gradoId: "g1", horasSemanales: 6 },
        { gradoId: "g2", horasSemanales: 5 },
      ]),
    ).not.toThrow();
    expect(() => verificarGradosPlan([])).not.toThrow();
  });
  it("rechaza horas 0, negativas o decimales", () => {
    for (const horas of [0, -2, 1.5]) {
      esperarError(() => verificarGradosPlan([{ gradoId: "g1", horasSemanales: horas }]), "HORAS_INVALIDAS");
    }
  });
  it("rechaza un grado repetido", () => {
    const repetido = [
      { gradoId: "g1", horasSemanales: 2 },
      { gradoId: "g1", horasSemanales: 3 },
    ];
    esperarError(() => verificarGradosPlan(repetido), "GRADO_REPETIDO");
  });
  it("calcula qué grados se agregan, cambian de horas o se quitan", () => {
    const actuales = [
      { planId: "p1", gradoId: "g1", horasSemanales: 6 },
      { planId: "p2", gradoId: "g2", horasSemanales: 6 },
      { planId: "p3", gradoId: "g3", horasSemanales: 6 },
    ];
    const r = compararPlanes(actuales, [
      { gradoId: "g1", horasSemanales: 6 },
      { gradoId: "g2", horasSemanales: 5 },
      { gradoId: "g4", horasSemanales: 4 },
    ]);
    expect(r.crear).toEqual([{ gradoId: "g4", horasSemanales: 4 }]);
    expect(r.actualizar).toEqual([{ planId: "p2", gradoId: "g2", horasSemanales: 5 }]);
    expect(r.quitar).toEqual([{ planId: "p3", gradoId: "g3" }]);
  });
});

describe("competencias del plan (US11, RF09)", () => {
  it("acepta competencias del área del curso y numera el orden por posición", () => {
    const r = prepararCompetencias(
      [{ competenciaId: "mat-c2" }, { competenciaId: "mat-c1", peso: 1.5 }],
      MAT,
      catalogo,
    );
    expect(r).toEqual([
      { competenciaId: "mat-c2", orden: 1, peso: null },
      { competenciaId: "mat-c1", orden: 2, peso: 1.5 },
    ]);
  });
  it("respeta el orden indicado", () => {
    expect(prepararCompetencias([{ competenciaId: "mat-c1", orden: 3 }], MAT, catalogo)[0].orden).toBe(3);
  });
  it("exige al menos una", () => {
    esperarError(() => prepararCompetencias([], MAT, catalogo), "COMPETENCIAS_REQUERIDAS");
  });
  it("rechaza competencias de otra área o inexistentes", () => {
    const mensaje = "La competencia no pertenece al área del curso";
    esperarError(
      () => prepararCompetencias([{ competenciaId: "art-c1" }], MAT, catalogo),
      "COMPETENCIA_FUERA_DEL_AREA",
      mensaje,
    );
    esperarError(() => prepararCompetencias([{ competenciaId: "x" }], MAT, catalogo), "COMPETENCIA_FUERA_DEL_AREA");
  });
  it("rechaza duplicados", () => {
    const dobles = [{ competenciaId: "mat-c1" }, { competenciaId: "mat-c1" }];
    esperarError(() => prepararCompetencias(dobles, MAT, catalogo), "COMPETENCIA_DUPLICADA");
  });
  it("rechaza un peso de 0 o negativo; sin peso es válido", () => {
    for (const peso of [0, -1]) {
      esperarError(() => prepararCompetencias([{ competenciaId: "mat-c1", peso }], MAT, catalogo), "PESO_INVALIDO");
    }
    expect(prepararCompetencias([{ competenciaId: "mat-c1", peso: null }], MAT, catalogo)[0].peso).toBeNull();
  });
  it("una competencia desactivada solo se mantiene si ya estaba en el plan", () => {
    esperarError(() => prepararCompetencias([{ competenciaId: "mat-c9" }], MAT, catalogo), "COMPETENCIA_INACTIVA");
    expect(() => prepararCompetencias([{ competenciaId: "mat-c9" }], MAT, catalogo, ["mat-c9"])).not.toThrow();
  });
  it("no se quita una competencia con notas registradas; sin notas, sí", () => {
    expect(() => verificarQuitarCompetencias([{ nombre: "Resuelve problemas de cantidad", notas: 0 }])).not.toThrow();
    esperarError(
      () => verificarQuitarCompetencias([{ nombre: "Resuelve problemas de cantidad", notas: 318 }]),
      "COMPETENCIA_CON_NOTAS",
      "No se puede eliminar una competencia con notas registradas.",
    );
  });
  it("el registro de notas rechaza un plan sin competencias", () => {
    expect(() => verificarCompetenciasConfiguradas([{}])).not.toThrow();
    esperarError(
      () => verificarCompetenciasConfiguradas([]),
      "CURSO_SIN_COMPETENCIAS",
      "Este curso no tiene competencias configuradas. Contacte al administrador.",
    );
  });
});
