// Pruebas de las reglas puras de la asignación de cursos a docentes (US14, RF11). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  modoQuitar,
  verificarAsignable,
  verificarConflicto,
  type CandidatoAsignacion,
} from "@/modules/academico/domain/asignaciones";

function esperarError(fn: () => void, codigo: string, mensaje?: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo, ...(mensaje ? { message: mensaje } : {}) }));
}

const valido: CandidatoAsignacion = {
  anioEstado: "EN_CURSO",
  docenteActivo: true,
  seccion: { estado: "ACTIVA", gradoId: "g1", anioAcademicoId: "a26" },
  cursoEstado: "ACTIVO",
  plan: { gradoId: "g1", anioAcademicoId: "a26" },
};

describe("curso asignable a un docente (US14)", () => {
  it("acepta un curso del plan del grado y año de la sección", () => {
    expect(() => verificarAsignable(valido)).not.toThrow();
  });
  it("rechaza un curso que no se dicta en el grado o el año de la sección", () => {
    const mensaje = "El curso no corresponde al grado de la sección";
    esperarError(() => verificarAsignable({ ...valido, plan: null }), "CURSO_NO_CORRESPONDE", mensaje);
    esperarError(
      () => verificarAsignable({ ...valido, plan: { gradoId: "g3", anioAcademicoId: "a26" } }),
      "CURSO_NO_CORRESPONDE",
    );
    esperarError(
      () => verificarAsignable({ ...valido, plan: { gradoId: "g1", anioAcademicoId: "a25" } }),
      "CURSO_NO_CORRESPONDE",
    );
  });
  it("rechaza un docente, una sección o un curso inactivos y un año cerrado", () => {
    esperarError(() => verificarAsignable({ ...valido, docenteActivo: false }), "DOCENTE_INACTIVO");
    esperarError(
      () => verificarAsignable({ ...valido, seccion: { ...valido.seccion, estado: "INACTIVA" } }),
      "SECCION_INACTIVA",
    );
    esperarError(() => verificarAsignable({ ...valido, cursoEstado: "INACTIVO" }), "CURSO_INACTIVO");
    esperarError(() => verificarAsignable({ ...valido, anioEstado: "CERRADO" }), "ANIO_CERRADO");
  });
});

describe("un solo docente activo por curso y sección (US14, uq_asignacion_activa)", () => {
  it("sin asignación activa, se puede asignar", () => {
    expect(() => verificarConflicto(null, "d1")).not.toThrow();
  });
  it("el mismo docente no repite el curso en la sección", () => {
    esperarError(
      () => verificarConflicto({ docenteId: "d1" }, "d1"),
      "ASIGNACION_DUPLICADA",
      "Este docente ya tiene asignado este curso en esta sección",
    );
  });
  it("otro docente no toma un curso ya asignado en la sección", () => {
    esperarError(
      () => verificarConflicto({ docenteId: "d2" }, "d1"),
      "CURSO_CON_DOCENTE",
      "Este curso ya tiene otro docente asignado en esta sección",
    );
  });
});

describe("quitar una asignación (US14)", () => {
  it("se elimina si no tiene notas ni horarios", () => {
    expect(modoQuitar({ notas: 0, bloquesHorario: 0 })).toBe("ELIMINAR");
  });
  it("se desactiva si tiene notas u horarios", () => {
    expect(modoQuitar({ notas: 3, bloquesHorario: 0 })).toBe("DESACTIVAR");
    expect(modoQuitar({ notas: 0, bloquesHorario: 2 })).toBe("DESACTIVAR");
  });
});
