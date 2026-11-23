// Pruebas de las reglas de las evidencias pedagógicas (US38) y de cómo se muestran en la libreta (US47): comentario y/o
// archivo, comentario vacío o de más de 1000 caracteres, registro cerrado o publicado en solo lectura, enlace «Ver
// evidencia» o «Ver comentario» y evidencias en la libreta solo de calificaciones publicadas. Sin base de datos.
import { describe, expect, it } from "vitest";
import {
  accionDeEvidencias,
  evidenciasPorNota,
  LARGO_MAXIMO_COMENTARIO_EVIDENCIA,
  MENSAJE_ARCHIVO_EVIDENCIA,
  normalizarComentario,
  verificarContenidoEvidencia,
  verificarEvidenciasEditables,
  type EvidenciaVista,
} from "@/modules/evaluacion/domain/evidencias";
import { cursosDelBimestre, type CursoPublicadoEntrada } from "@/modules/evaluacion/domain/libreta";
import { NuevaEvidenciaSchema } from "@/modules/evaluacion/schemas";

function esperarError(fn: () => void, codigo: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo }));
}

const ID = "3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const CON_ARCHIVO: EvidenciaVista = {
  id: "e1",
  comentario: "Resolvió el problema con dos estrategias.",
  archivo: { nombre: "ficha.pdf", tipo: "PDF", mime: "application/pdf", tamanoBytes: 2048 },
  subidoEn: "2026-09-02T15:00:00.000Z",
};
const SOLO_COMENTARIO: EvidenciaVista = { ...CON_ARCHIVO, id: "e2", archivo: null };

describe("contenido de la evidencia (US38, criterio 1)", () => {
  it("el mensaje de formato y tamaño es el del Product Backlog", () => {
    expect(MENSAJE_ARCHIVO_EVIDENCIA).toBe(
      "Formato no permitido o archivo demasiado pesado (máx. 5 MB, formatos PDF/JPG)",
    );
  });

  it("acepta solo un comentario, solo un archivo o ambos", () => {
    expect(() => verificarContenidoEvidencia({ comentario: "Muy bien", tieneArchivo: false })).not.toThrow();
    expect(() => verificarContenidoEvidencia({ comentario: null, tieneArchivo: true })).not.toThrow();
    expect(() => verificarContenidoEvidencia({ comentario: "Muy bien", tieneArchivo: true })).not.toThrow();
  });

  it("rechaza un comentario vacío (o de solo espacios) sin archivo", () => {
    esperarError(() => verificarContenidoEvidencia({ comentario: null, tieneArchivo: false }), "EVIDENCIA_VACIA");
    const vacio = normalizarComentario("   \n\t ");
    expect(vacio).toBeNull();
    esperarError(() => verificarContenidoEvidencia({ comentario: vacio, tieneArchivo: false }), "EVIDENCIA_VACIA");
  });

  it("el comentario admite hasta 1000 caracteres (contados como caracteres, no como bytes)", () => {
    const justo = "á".repeat(LARGO_MAXIMO_COMENTARIO_EVIDENCIA);
    expect(() => verificarContenidoEvidencia({ comentario: justo, tieneArchivo: false })).not.toThrow();
    esperarError(
      () => verificarContenidoEvidencia({ comentario: `${justo}a`, tieneArchivo: false }),
      "COMENTARIO_DEMASIADO_LARGO",
    );
    // un emoji ocupa dos unidades UTF-16 pero es un solo carácter, como en char_length de PostgreSQL
    expect(() =>
      verificarContenidoEvidencia({ comentario: "👍".repeat(LARGO_MAXIMO_COMENTARIO_EVIDENCIA), tieneArchivo: false }),
    ).not.toThrow();
  });

  it("normaliza el comentario quitando los espacios de los extremos", () => {
    expect(normalizarComentario("  Buen avance.  ")).toBe("Buen avance.");
    expect(normalizarComentario(undefined)).toBeNull();
  });
});

describe("formulario de la evidencia (Zod)", () => {
  it("acepta los ids y un comentario opcional", () => {
    expect(NuevaEvidenciaSchema.parse({ matriculaId: ID, competenciaPlanId: ID, comentario: null })).toEqual({
      matriculaId: ID,
      competenciaPlanId: ID,
      comentario: null,
    });
  });

  it("rechaza ids inválidos y un comentario de más de 1000 caracteres", () => {
    expect(NuevaEvidenciaSchema.safeParse({ matriculaId: "x", competenciaPlanId: ID }).success).toBe(false);
    const largo = NuevaEvidenciaSchema.safeParse({
      matriculaId: ID,
      competenciaPlanId: ID,
      comentario: "a".repeat(1001),
    });
    expect(largo.success).toBe(false);
  });
});

describe("evidencias en solo lectura con el registro cerrado o publicado (US38, criterio 3)", () => {
  it("con el registro abierto se agregan y eliminan", () => {
    expect(() => verificarEvidenciasEditables("ABIERTO")).not.toThrow();
  });

  it("con el registro cerrado o publicado se rechaza con REGISTRO_CERRADO", () => {
    esperarError(() => verificarEvidenciasEditables("CERRADO"), "REGISTRO_CERRADO");
    esperarError(() => verificarEvidenciasEditables("PUBLICADO"), "REGISTRO_CERRADO");
  });
});

describe("enlace de la evidencia en la libreta (US47)", () => {
  it("«Ver evidencia» si alguna trae archivo; «Ver comentario» si solo hay comentarios", () => {
    expect(accionDeEvidencias([CON_ARCHIVO])).toBe("VER_EVIDENCIA");
    expect(accionDeEvidencias([SOLO_COMENTARIO, CON_ARCHIVO])).toBe("VER_EVIDENCIA");
    expect(accionDeEvidencias([SOLO_COMENTARIO])).toBe("VER_COMENTARIO");
  });

  it("sin evidencias no hay ninguna opción (US47, criterio 2)", () => {
    expect(accionDeEvidencias([])).toBeNull();
  });

  it("agrupa las evidencias por nota en el orden en que se subieron", () => {
    const filas = [
      { id: "b", notaId: "n1", createdAt: new Date("2026-09-03T10:00:00Z") },
      { id: "c", notaId: "n2", createdAt: new Date("2026-09-01T10:00:00Z") },
      { id: "a", notaId: "n1", createdAt: new Date("2026-09-02T10:00:00Z") },
    ];
    const grupos = evidenciasPorNota(filas);
    expect(grupos.get("n1")?.map((f) => f.id)).toEqual(["a", "b"]);
    expect(grupos.get("n2")?.map((f) => f.id)).toEqual(["c"]);
    expect(grupos.get("n3")).toBeUndefined();
  });

  it("la libreta lleva las evidencias de cada competencia calificada y ninguna en los cursos pendientes", () => {
    const publicado: CursoPublicadoEntrada = {
      cursoId: "mat",
      codigo: "MAT",
      nombre: "Matemática",
      docente: "Juan Pérez Salazar",
      publicadoEn: new Date("2026-07-27T15:00:00Z"),
      consolidado: "AD",
      competencias: [
        { competenciaPlanId: "c1", codigo: "C1", nombre: "Cantidad", orden: 1 },
        { competenciaPlanId: "c2", codigo: "C2", nombre: "Regularidad", orden: 2 },
      ],
      notas: { c1: "AD", c2: "A" },
      evidencias: { c1: [CON_ARCHIVO] },
    };
    const plan = [{ cursoId: "com", codigo: "COM", nombre: "Comunicación", docente: null }];
    const [com, mat] = cursosDelBimestre([publicado], plan);
    expect(mat.competencias.map((c) => [c.codigo, c.evidencias.map((e) => e.id)])).toEqual([
      ["C1", ["e1"]],
      ["C2", []],
    ]);
    expect(com).toMatchObject({ publicado: false, competencias: [] });
  });
});
