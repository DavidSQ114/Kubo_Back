// Pruebas de los textos del banner «No se puede publicar» y del panel «Validaciones» de AD-13 (US31, defecto D-10).
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { lineasRechazo, textoAvanceCurso, type DetallesRechazo } from "@/lib/horarios";
import { verificarPublicable, type ClaseAsignada } from "@/modules/horarios/domain/publicacion";
import type { Bloque } from "@/modules/horarios/domain/tipos";

const bloques: Bloque[] = [
  { id: "b1", orden: 1, horaInicio: "07:45", horaFin: "08:30", tipo: "CLASE", etiqueta: "1.ª hora" },
  { id: "b2", orden: 2, horaInicio: "08:30", horaFin: "09:15", tipo: "CLASE", etiqueta: "2.ª hora" },
];

const clases = (cursoId: string, cursoNombre: string, cantidad: number, activa = true): ClaseAsignada[] =>
  Array.from({ length: cantidad }, () => ({
    dia: "LUNES",
    bloqueId: "b1",
    cursoId,
    cursoNombre,
    asignacionActiva: activa,
  }));

/** Detalles reales del error de dominio, tal como llegan al banner en el JSON de la API. */
function detallesDelRechazo(fn: () => void): DetallesRechazo {
  try {
    fn();
  } catch (e) {
    return JSON.parse(JSON.stringify((e as { detalles: unknown }).detalles)) as DetallesRechazo;
  }
  throw new Error("Se esperaba un rechazo");
}

describe("banner del rechazo al publicar (US31, D-10)", () => {
  it("describe los cursos con bloques de más sin «undefined» (1° A: Comunicación 19 de 5, Matemática 16 de 6)", () => {
    const plan = [
      { cursoId: "com", nombre: "Comunicación", horasSemanales: 5 },
      { cursoId: "mat", nombre: "Matemática", horasSemanales: 6 },
    ];
    const detalles = detallesDelRechazo(() =>
      verificarPublicable(plan, [...clases("com", "Comunicación", 19), ...clases("mat", "Matemática", 16)], bloques),
    );

    const lineas = lineasRechazo(detalles);

    expect(lineas.join(" ")).not.toContain("undefined");
    expect(lineas).toEqual(["Comunicación: 19 de 5 bloques (sobran 14) · Matemática: 16 de 6 bloques (sobran 10)"]);
  });

  it("describe los cursos con bloques de menos y los bloques libres", () => {
    const plan = [{ cursoId: "mat", nombre: "Matemática", horasSemanales: 2 }];
    const detalles = detallesDelRechazo(() => verificarPublicable(plan, clases("mat", "Matemática", 1), bloques));

    expect(lineasRechazo(detalles)).toEqual([
      "Matemática: 1 de 2 bloques (falta 1)",
      expect.stringContaining("Bloques libres: Lunes 08:30 – 09:15"),
    ]);
  });

  it("lista las clases cuyo docente ya no tiene el curso", () => {
    const plan = [{ cursoId: "mat", nombre: "Matemática", horasSemanales: 1 }];
    const detalles = detallesDelRechazo(() =>
      verificarPublicable(plan, clases("mat", "Matemática", 1, false), bloques),
    );

    expect(lineasRechazo(detalles)).toEqual(["Clases por reasignar: Lunes 07:45 – 08:30"]);
  });

  it("no agrega líneas si el rechazo no trae detalle", () => {
    expect(lineasRechazo({})).toEqual([]);
    expect(lineasRechazo(null)).toEqual([]);
  });
});

describe("avance de un curso, compartido por el banner y el panel «Validaciones» (US31)", () => {
  it("usa singular y plural según la diferencia", () => {
    expect(textoAvanceCurso({ nombre: "Arte", asignados: 2, horasSemanales: 1 })).toBe("Arte: 2 de 1 bloque (sobra 1)");
    expect(textoAvanceCurso({ nombre: "Arte", asignados: 0, horasSemanales: 3 })).toBe(
      "Arte: 0 de 3 bloques (faltan 3)",
    );
    expect(textoAvanceCurso({ nombre: "Arte", asignados: 3, horasSemanales: 3 })).toBe("Arte: 3 de 3 bloques");
  });
});
