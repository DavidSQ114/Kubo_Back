// Pruebas de las reglas puras de la publicación y de las versiones de un horario (US31, RF24). Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  avancePorCurso,
  bloquesLibres,
  borradorDe,
  pendientesDePublicar,
  planDePublicacion,
  publicadaDe,
  resumenAvance,
  siguienteVersion,
  verificarPublicable,
  versionVigente,
  type ClaseAsignada,
  type Version,
} from "@/modules/horarios/domain/publicacion";
import type { Bloque, Dia } from "@/modules/horarios/domain/tipos";

function capturar(fn: () => void): { codigo?: string; message?: string; detalles?: Record<string, unknown> } {
  try {
    fn();
  } catch (e) {
    return e as { codigo: string; message: string; detalles?: Record<string, unknown> };
  }
  return {};
}

const bloques: Bloque[] = [
  { id: "b1", orden: 1, horaInicio: "07:45", horaFin: "08:30", tipo: "CLASE", etiqueta: "1.ª hora" },
  { id: "r", orden: 2, horaInicio: "08:30", horaFin: "08:50", tipo: "RECREO", etiqueta: "Recreo" },
  { id: "b2", orden: 3, horaInicio: "08:50", horaFin: "09:35", tipo: "CLASE", etiqueta: "2.ª hora" },
];
const plan = [
  { cursoId: "mat", nombre: "Matemática", horasSemanales: 2 },
  { cursoId: "com", nombre: "Comunicación", horasSemanales: 1 },
];
const clase = (dia: Dia, bloqueId: string, cursoId: string, activa = true): ClaseAsignada => ({
  dia,
  bloqueId,
  cursoId,
  cursoNombre: cursoId === "mat" ? "Matemática" : cursoId === "com" ? "Comunicación" : "Arte y Cultura",
  asignacionActiva: activa,
});
const completo = [clase("LUNES", "b1", "mat"), clase("MARTES", "b1", "mat"), clase("LUNES", "b2", "com")];

describe("completitud del horario frente al plan de estudios (US31)", () => {
  it("cuenta los bloques de cada curso y lo que falta o sobra", () => {
    const avance = avancePorCurso(plan, [clase("LUNES", "b1", "mat")]);
    expect(avance).toEqual([
      { cursoId: "mat", nombre: "Matemática", horasSemanales: 2, asignados: 1, faltan: 1, sobran: 0 },
      { cursoId: "com", nombre: "Comunicación", horasSemanales: 1, asignados: 0, faltan: 1, sobran: 0 },
    ]);
    expect(resumenAvance(avance)).toEqual({ asignados: 1, requeridos: 3 });
  });
  it("lista las celdas de clase vacías en el orden de la cuadrícula, sin el recreo", () => {
    const libres = bloquesLibres(bloques, completo);
    expect(libres).toHaveLength(10 - 3);
    expect(libres[0]).toEqual({ dia: "MARTES", bloqueId: "b2", horaInicio: "08:50", horaFin: "09:35" });
    expect(libres.some((l) => l.bloqueId === "r")).toBe(false);
  });
  it("publica cuando cada curso del plan tiene tantos bloques como horas semanales", () => {
    expect(() => verificarPublicable(plan, completo, bloques)).not.toThrow();
    expect(pendientesDePublicar(plan, completo, bloques)).toEqual({ cursos: [], bloquesLibres: [] });
  });
  it("no publica si falta algún bloque y lista los cursos y los bloques pendientes", () => {
    const error = capturar(() => verificarPublicable(plan, [clase("LUNES", "b1", "mat")], bloques));
    expect(error.codigo).toBe("HORARIO_INCOMPLETO");
    expect(error.message).toBe("No se puede publicar: existen bloques horarios sin asignar");
    expect(error.detalles?.cursos).toEqual([
      { cursoId: "mat", nombre: "Matemática", horasSemanales: 2, asignados: 1, faltan: 1 },
      { cursoId: "com", nombre: "Comunicación", horasSemanales: 1, asignados: 0, faltan: 1 },
    ]);
    expect(error.detalles?.bloquesLibres).toHaveLength(9);
  });
  it("no publica un horario vacío ni el de un grado sin plan de estudios", () => {
    expect(capturar(() => verificarPublicable(plan, [], bloques)).codigo).toBe("HORARIO_INCOMPLETO");
    expect(capturar(() => verificarPublicable([], [], bloques)).codigo).toBe("PLAN_SIN_CURSOS");
  });
  it("no publica si un curso tiene más bloques que horas o ya no está en el plan", () => {
    const deMas = capturar(() => verificarPublicable(plan, [...completo, clase("JUEVES", "b1", "com")], bloques));
    expect(deMas.codigo).toBe("HORARIO_CON_EXCESO");
    expect(deMas.detalles?.cursos).toEqual([
      { cursoId: "com", nombre: "Comunicación", horasSemanales: 1, asignados: 2, sobran: 1 },
    ]);
    const fuera = capturar(() => verificarPublicable(plan, [...completo, clase("JUEVES", "b1", "arte")], bloques));
    expect(fuera.detalles?.cursos).toEqual([
      { cursoId: "arte", nombre: "Arte y Cultura", horasSemanales: 0, asignados: 1, sobran: 1 },
    ]);
  });
  it("no publica si una clase quedó con un docente que ya no tiene asignado el curso", () => {
    const clases = [clase("LUNES", "b1", "mat"), clase("MARTES", "b1", "mat", false), clase("LUNES", "b2", "com")];
    const error = capturar(() => verificarPublicable(plan, clases, bloques));
    expect(error.codigo).toBe("CLASES_SIN_DOCENTE_VIGENTE");
    expect(error.detalles?.clases).toEqual([{ dia: "MARTES", bloqueId: "b1", horaInicio: "07:45", horaFin: "08:30" }]);
  });
});

describe("versiones del horario de una sección (US31)", () => {
  const v = (version: number, estado: Version["estado"]): Version => ({ id: `h${version}`, version, estado });

  it("la primera versión es la 1 y las siguientes continúan la numeración", () => {
    expect(siguienteVersion([])).toBe(1);
    expect(siguienteVersion([v(1, "ARCHIVADO"), v(2, "PUBLICADO")])).toBe(3);
  });
  it("muestra el borrador en edición y, si no hay, la versión publicada", () => {
    const conBorrador = [v(1, "ARCHIVADO"), v(2, "PUBLICADO"), v(3, "BORRADOR")];
    expect(versionVigente(conBorrador)?.version).toBe(3);
    expect(borradorDe(conBorrador)?.version).toBe(3);
    expect(publicadaDe(conBorrador)?.version).toBe(2);
    expect(versionVigente([v(1, "ARCHIVADO"), v(2, "PUBLICADO")])?.version).toBe(2);
    expect(versionVigente([v(1, "ARCHIVADO")])).toBeNull();
    expect(versionVigente([])).toBeNull();
  });
  it("la primera publicación no archiva nada", () => {
    expect(planDePublicacion([v(1, "BORRADOR")])).toEqual({ publicar: v(1, "BORRADOR"), archivar: null });
  });
  it("publicar una versión nueva archiva la publicada anterior", () => {
    const plan = planDePublicacion([v(1, "ARCHIVADO"), v(2, "PUBLICADO"), v(3, "BORRADOR")]);
    expect(plan.publicar.version).toBe(3);
    expect(plan.archivar?.version).toBe(2);
  });
  it("sin borrador no hay cambios por publicar", () => {
    expect(capturar(() => planDePublicacion([v(1, "PUBLICADO")])).codigo).toBe("SIN_CAMBIOS_POR_PUBLICAR");
    expect(capturar(() => planDePublicacion([])).codigo).toBe("SIN_CAMBIOS_POR_PUBLICAR");
  });
});
