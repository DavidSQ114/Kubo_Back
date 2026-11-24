// Pruebas de las reglas del aula virtual: formatos y estados de los materiales (US61), URL y estado calculado de los
// enlaces en los límites exactos de inicio y fin (US62), orden de las unidades y lo que ve el alumno (US67). Sin base
// de datos y con fechas fijas.
import { describe, expect, it } from "vitest";
import { validarArchivo } from "@/platform/archivos";
import {
  MENSAJE_ENLACE_INVALIDO,
  MENSAJE_FORMATO_MATERIAL,
  MENSAJE_TAMANO_MATERIAL,
} from "@/modules/aula-virtual/domain/errores";
import {
  agruparPorUnidad,
  ARCHIVOS_MATERIAL,
  estadoEnlace,
  estadoInicial,
  formatoDeArchivo,
  instanteDeLima,
  materialVisibleParaAlumno,
  siguienteNumero,
  validarUrl,
  vecinaParaMover,
  verificarCambioVisibilidad,
  verificarFechasEnlace,
  verificarOcultable,
  verificarPublicable,
  type EstadoVisibilidad,
} from "@/modules/aula-virtual/domain/reglas";
import { EnlaceSchema, NuevoMaterialSchema } from "@/modules/aula-virtual/schemas";

function esperarError(fn: () => void, codigo: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo }));
}

const REGLAS = {
  permitidos: ARCHIVOS_MATERIAL,
  mensaje: MENSAJE_FORMATO_MATERIAL,
  mensajeTamano: MENSAJE_TAMANO_MATERIAL,
};
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const CINCO_MB = 5 * 1024 * 1024;

describe("formatos del material de estudio (US61, criterios 1 y 2)", () => {
  it("acepta un PDF y una imagen PNG, y guarda la imagen como IMAGEN", () => {
    const pdf = validarArchivo({ nombre: "guia.pdf", bytes: PDF }, REGLAS);
    const png = validarArchivo({ nombre: "mapa.png", bytes: PNG }, REGLAS);
    expect(formatoDeArchivo(pdf.tipo)).toBe("PDF");
    expect(formatoDeArchivo(png.tipo)).toBe("IMAGEN");
    expect(formatoDeArchivo("JPG")).toBe("IMAGEN");
    expect(formatoDeArchivo("PPTX")).toBe("PPTX");
  });

  it("rechaza un formato no permitido indicando el motivo, aunque el nombre diga .pdf", () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect(() => validarArchivo({ nombre: "guia.pdf", bytes: exe }, REGLAS)).toThrowError(
      expect.objectContaining({ codigo: "ARCHIVO_NO_PERMITIDO", message: MENSAJE_FORMATO_MATERIAL }),
    );
  });

  it("acepta exactamente 5 MB y rechaza un byte más con el motivo del tamaño", () => {
    const justo = new Uint8Array(CINCO_MB);
    justo.set(PDF);
    expect(() => validarArchivo({ nombre: "a.pdf", bytes: justo }, REGLAS)).not.toThrow();
    const pesado = new Uint8Array(CINCO_MB + 1);
    pesado.set(PDF);
    expect(() => validarArchivo({ nombre: "a.pdf", bytes: pesado }, REGLAS)).toThrowError(
      expect.objectContaining({ codigo: "ARCHIVO_DEMASIADO_GRANDE", message: MENSAJE_TAMANO_MATERIAL }),
    );
  });
});

describe("estados del material: Borrador, Publicado y Oculto (US61, criterio 3)", () => {
  it("«Visible para los alumnos» lo publica; si no, queda en borrador", () => {
    expect(estadoInicial(true)).toBe("PUBLICADO");
    expect(estadoInicial(false)).toBe("BORRADOR");
  });

  it("se publica un borrador o un oculto, pero no uno ya publicado", () => {
    expect(() => verificarPublicable("BORRADOR")).not.toThrow();
    expect(() => verificarPublicable("OCULTO")).not.toThrow();
    esperarError(() => verificarPublicable("PUBLICADO"), "MATERIAL_YA_PUBLICADO");
  });

  it("solo se oculta un material publicado", () => {
    expect(() => verificarOcultable("PUBLICADO")).not.toThrow();
    esperarError(() => verificarOcultable("BORRADOR"), "MATERIAL_NO_PUBLICADO");
    esperarError(() => verificarOcultable("OCULTO"), "MATERIAL_NO_PUBLICADO");
  });

  it("el alumno solo ve lo publicado en una unidad activa (US67)", () => {
    expect(materialVisibleParaAlumno({ estado: "PUBLICADO", unidadActiva: true })).toBe(true);
    expect(materialVisibleParaAlumno({ estado: "BORRADOR", unidadActiva: true })).toBe(false);
    expect(materialVisibleParaAlumno({ estado: "OCULTO", unidadActiva: true })).toBe(false);
    expect(materialVisibleParaAlumno({ estado: "PUBLICADO", unidadActiva: false })).toBe(false);
    expect(materialVisibleParaAlumno({ estado: "PUBLICADO", unidadActiva: null })).toBe(false);
  });
});

describe("URL de un enlace (US61 material tipo enlace, US62 criterio 2)", () => {
  it("acepta http y https", () => {
    expect(validarUrl(" https://meet.kubo.edu.pe/mat-3b ")).toBe("https://meet.kubo.edu.pe/mat-3b");
    expect(validarUrl("http://ejemplo.com/clase?id=4")).toBe("http://ejemplo.com/clase?id=4");
  });

  it.each([
    "meet.kubo.edu.pe/mat-3b",
    "javascript:alert(1)",
    "ftp://archivos.pe/a",
    "https://",
    "https://localhost",
    "https://a b.pe",
    "",
  ])("rechaza «%s» con «Ingresa un enlace válido»", (url) => {
    expect(() => validarUrl(url)).toThrowError(
      expect.objectContaining({ codigo: "ENLACE_INVALIDO", message: MENSAJE_ENLACE_INVALIDO }),
    );
  });
});

describe("estado calculado del enlace en la hora de Lima (US62, criterio 3)", () => {
  const inicio = instanteDeLima("2026-11-24T10:00");
  const fin = instanteDeLima("2026-11-24T11:30");

  it("lee la fecha y hora del docente como hora de Lima (UTC−5)", () => {
    expect(inicio.toISOString()).toBe("2026-11-24T15:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-11-24T16:30:00.000Z");
  });

  it("es Programado hasta un milisegundo antes del inicio", () => {
    expect(estadoEnlace(inicio, fin, new Date("2026-11-24T14:59:59.999Z"))).toBe("PROGRAMADO");
  });

  it("es Activo desde el inicio exacto y hasta un milisegundo antes del fin", () => {
    expect(estadoEnlace(inicio, fin, new Date("2026-11-24T15:00:00.000Z"))).toBe("ACTIVO");
    expect(estadoEnlace(inicio, fin, new Date("2026-11-24T16:29:59.999Z"))).toBe("ACTIVO");
  });

  it("es Finalizado desde el fin exacto", () => {
    expect(estadoEnlace(inicio, fin, new Date("2026-11-24T16:30:00.000Z"))).toBe("FINALIZADO");
    expect(estadoEnlace(inicio, fin, new Date("2026-11-25T00:00:00.000Z"))).toBe("FINALIZADO");
  });

  it("el fin debe ser posterior al inicio", () => {
    expect(() => verificarFechasEnlace(inicio, fin)).not.toThrow();
    esperarError(() => verificarFechasEnlace(inicio, inicio), "FECHAS_ENLACE_INVALIDAS");
    esperarError(() => verificarFechasEnlace(fin, inicio), "FECHAS_ENLACE_INVALIDAS");
  });

  it("rechaza una fecha imposible", () => {
    esperarError(() => instanteDeLima("2026-13-40T10:00"), "FECHAS_ENLACE_INVALIDAS");
  });

  it("mostrar u ocultar exige un cambio real de visibilidad", () => {
    expect(() => verificarCambioVisibilidad(false, true)).not.toThrow();
    esperarError(() => verificarCambioVisibilidad(true, true), "ENLACE_YA_VISIBLE");
    esperarError(() => verificarCambioVisibilidad(false, false), "ENLACE_YA_OCULTO");
  });
});

describe("unidades didácticas: número y orden", () => {
  const unidades = [
    { id: "u3", numero: 3 },
    { id: "u1", numero: 1 },
    { id: "u2", numero: 2 },
  ];

  it("la unidad nueva lleva el número siguiente al mayor", () => {
    expect(siguienteNumero([])).toBe(1);
    expect(siguienteNumero([1, 4, 2])).toBe(5);
  });

  it("intercambia con la vecina al subir o bajar, y no hace nada en los extremos", () => {
    expect(vecinaParaMover(unidades, "u2", "ARRIBA")?.id).toBe("u1");
    expect(vecinaParaMover(unidades, "u2", "ABAJO")?.id).toBe("u3");
    expect(vecinaParaMover(unidades, "u1", "ARRIBA")).toBeNull();
    expect(vecinaParaMover(unidades, "u3", "ABAJO")).toBeNull();
    esperarError(() => vecinaParaMover(unidades, "otra", "ARRIBA"), "NO_ENCONTRADO");
  });
});

describe("materiales del alumno agrupados por unidad (US67)", () => {
  const material = (id: string, unidadId: string | null, estado: EstadoVisibilidad, dia: number) => ({
    id,
    unidadId,
    estado,
    publicadoEn: estado === "BORRADOR" ? null : new Date(Date.UTC(2026, 10, dia)),
  });

  it("agrupa por unidad activa en su orden, del más reciente al más antiguo, sin borradores ni ocultos", () => {
    const grupos = agruparPorUnidad(
      [
        { id: "u2", numero: 2, titulo: "Álgebra", activo: true },
        { id: "u1", numero: 1, titulo: "Números", activo: true },
        { id: "u3", numero: 3, titulo: "Geometría", activo: false },
        { id: "u4", numero: 4, titulo: "Vacía", activo: true },
      ],
      [
        material("m1", "u1", "PUBLICADO", 3),
        material("m2", "u1", "PUBLICADO", 10),
        material("m3", "u2", "BORRADOR", 0),
        material("m4", "u2", "OCULTO", 5),
        material("m5", "u2", "PUBLICADO", 6),
        material("m6", "u3", "PUBLICADO", 7),
        material("m7", null, "PUBLICADO", 8),
      ],
    );
    expect(grupos.map((g) => [g.unidad.id, g.materiales.map((m) => m.id)])).toEqual([
      ["u1", ["m2", "m1"]],
      ["u2", ["m5"]],
    ]);
  });
});

describe("entradas de la API del aula virtual (RNF16)", () => {
  const enlace = {
    tipo: "CLASE_VIRTUAL",
    titulo: "Clase de Matemática",
    url: "https://meet.kubo.edu.pe/mat-3b",
    inicio: "2026-11-24T10:00",
    fin: "2026-11-24T11:30",
    visible: true,
  };

  it("acepta un enlace completo y rechaza un tipo desconocido o una fecha sin hora", () => {
    expect(EnlaceSchema.safeParse(enlace).success).toBe(true);
    expect(EnlaceSchema.safeParse({ ...enlace, tipo: "REUNION" }).success).toBe(false);
    expect(EnlaceSchema.safeParse({ ...enlace, inicio: "2026-11-24" }).success).toBe(false);
  });

  it("convierte «Visible para los alumnos» del formulario en booleano", () => {
    const r = NuevoMaterialSchema.parse({
      unidadId: "3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b",
      titulo: " Guía de fracciones ",
      tipo: "ARCHIVO",
      url: "",
      visible: "true",
    });
    expect(r).toEqual({
      unidadId: "3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b",
      titulo: "Guía de fracciones",
      tipo: "ARCHIVO",
      url: null,
      visible: true,
    });
    expect(NuevoMaterialSchema.safeParse({ ...r, visible: "si" }).success).toBe(false);
  });
});
