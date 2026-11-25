// Pruebas de los ítems de evaluación con pesos (bloque M2): suma de pesos, cálculo de la nota de la competencia con la
// función de la regla PONDERADO de académico, alumno incompleto, recálculo, confirmación y validación de la lista.
// Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { consolidarLogro } from "@/modules/academico";
import {
  analizarCsvCalificaciones,
  cambiosDeCalificaciones,
  notaDeItems,
  pesosCompletos,
  prepararItems,
  recalcularNotas,
  sumaDePesos,
  verificarCalificaciones,
  verificarConfirmacion,
  verificarSinItems,
  type CalcularNota,
  type ItemDeCompetencia,
} from "@/modules/evaluacion/domain/items";
import type { LogroNota } from "@/modules/evaluacion/domain/notas";

const calcular: CalcularNota = (valores, pesos) =>
  consolidarLogro(valores, { metodo: "PONDERADO", criterioDesempate: "MAYOR_JERARQUIA" }, pesos);

function esperarError(fn: () => void, codigo: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo }));
}

const C1 = "comp-1";
const C2 = "comp-2";
const item = (id: string, peso: number, orden: number, competenciaPlanId = C1): ItemDeCompetencia => ({
  id,
  competenciaPlanId,
  nombre: `Ítem ${id}`,
  peso,
  orden,
});

describe("suma de pesos de los ítems (bloque M2)", () => {
  it("suma en centésimas: 33,33 + 33,33 + 33,34 es exactamente 100", () => {
    expect(sumaDePesos([33.33, 33.33, 33.34])).toBe(100);
    expect(pesosCompletos([33.33, 33.33, 33.34])).toBe(true);
  });

  it("90 o 110 no están completos", () => {
    expect(pesosCompletos([40, 50])).toBe(false);
    expect(pesosCompletos([60, 50])).toBe(false);
    expect(pesosCompletos([])).toBe(false);
  });
});

describe("nota de la competencia calculada por ítems (bloque M2)", () => {
  const items = [item("p", 40, 1), item("e", 60, 2)];

  it("promedio ponderado AD=4 … C=1: AD (40) y B (60) dan 2,8 → A", () => {
    const r = notaDeItems(
      items,
      new Map<string, LogroNota>([
        ["p", "AD"],
        ["e", "B"],
      ]),
      calcular,
    );
    expect(r).toEqual({ estado: "CALCULADA", logro: "A" });
  });

  it("redondeo MITAD_HACIA_ARRIBA: A y B con pesos iguales (2,5) suben a A", () => {
    const r = notaDeItems(
      [item("a", 50, 1), item("b", 50, 2)],
      new Map<string, LogroNota>([
        ["a", "A"],
        ["b", "B"],
      ]),
      calcular,
    );
    expect(r).toEqual({ estado: "CALCULADA", logro: "A" });
  });

  it("alumno incompleto: sin nota y dice qué ítem falta", () => {
    const r = notaDeItems(items, new Map<string, LogroNota>([["p", "AD"]]), calcular);
    expect(r).toMatchObject({ estado: "SIN_NOTA", motivo: "ITEMS_PENDIENTES", faltan: ["Ítem e"] });
    expect(r.estado === "SIN_NOTA" && r.mensaje).toBe("Falta calificar el ítem: Ítem e.");
  });

  it("pesos que no suman 100: sin nota aunque estén todos calificados", () => {
    const r = notaDeItems(
      [item("p", 40, 1), item("e", 50, 2)],
      new Map<string, LogroNota>([
        ["p", "AD"],
        ["e", "AD"],
      ]),
      calcular,
    );
    expect(r).toMatchObject({ estado: "SIN_NOTA", motivo: "PESOS_INCOMPLETOS" });
    expect(r.estado === "SIN_NOTA" && r.mensaje).toBe("Los pesos de los ítems suman 90 %; deben sumar 100 %.");
  });
});

describe("recálculo de las notas del registro (bloque M2)", () => {
  const items = [item("p", 40, 1), item("e", 60, 2)];
  const base = { competenciaPlanIds: [C1, C2], items, matriculaIds: ["m1", "m2", "m3"], calcular };

  it("crea la nota del completo, cambia la que difiere y quita la del incompleto", () => {
    const r = recalcularNotas({
      ...base,
      calificaciones: [
        { itemId: "p", matriculaId: "m1", valor: "AD" },
        { itemId: "e", matriculaId: "m1", valor: "AD" },
        { itemId: "p", matriculaId: "m2", valor: "C" },
        { itemId: "e", matriculaId: "m2", valor: "C" },
        { itemId: "p", matriculaId: "m3", valor: "A" },
      ],
      notas: [
        { id: "n2", matriculaId: "m2", competenciaPlanId: C1, logro: "B" },
        { id: "n3", matriculaId: "m3", competenciaPlanId: C1, logro: "A" },
      ],
    });
    expect(r.crear).toEqual([{ matriculaId: "m1", competenciaPlanId: C1, logro: "AD" }]);
    expect(r.cambiar).toEqual([{ id: "n2", matriculaId: "m2", competenciaPlanId: C1, anterior: "B", logro: "C" }]);
    expect(r.quitar).toEqual([{ id: "n3", matriculaId: "m3", competenciaPlanId: C1, anterior: "A" }]);
  });

  it("una competencia sin ítems se califica directo: su nota no se toca", () => {
    const r = recalcularNotas({
      ...base,
      calificaciones: [],
      notas: [{ id: "n9", matriculaId: "m1", competenciaPlanId: C2, logro: "AD" }],
    });
    expect(r).toEqual({ crear: [], cambiar: [], quitar: [] });
  });
});

describe("lista de ítems de una competencia (bloque M2)", () => {
  it("asigna el orden de la lista y conserva los ids existentes", () => {
    const r = prepararItems(
      [
        { id: "x", nombre: " Examen ", peso: 60 },
        { nombre: "Práctica", peso: 40 },
      ],
      [{ id: "x" }],
    );
    expect(r).toEqual([
      { id: "x", nombre: "Examen", peso: 60, orden: 1 },
      { id: null, nombre: "Práctica", peso: 40, orden: 2 },
    ]);
  });

  it("rechaza nombres vacíos, largos o repetidos y pesos fuera de rango", () => {
    esperarError(() => prepararItems([{ nombre: "  ", peso: 10 }], []), "ITEM_NOMBRE_REQUERIDO");
    esperarError(() => prepararItems([{ nombre: "x".repeat(101), peso: 10 }], []), "ITEM_NOMBRE_LARGO");
    esperarError(
      () =>
        prepararItems(
          [
            { nombre: "Examen", peso: 50 },
            { nombre: "examen", peso: 50 },
          ],
          [],
        ),
      "ITEM_NOMBRE_REPETIDO",
    );
    esperarError(() => prepararItems([{ nombre: "A", peso: 0 }], []), "ITEM_PESO_INVALIDO");
    esperarError(() => prepararItems([{ nombre: "A", peso: 101 }], []), "ITEM_PESO_INVALIDO");
    esperarError(() => prepararItems([{ nombre: "A", peso: 10.555 }], []), "ITEM_PESO_INVALIDO");
  });

  it("un id que no es de la competencia no se acepta", () => {
    esperarError(() => prepararItems([{ id: "ajeno", nombre: "A", peso: 100 }], [{ id: "x" }]), "NO_ENCONTRADO");
  });

  it("pide confirmación solo si se borran calificaciones o se quitan notas", () => {
    const sinPerdida = { itemsEliminados: [], calificacionesBorradas: 0, notasQuitadas: 0, evidenciasBorradas: 0 };
    expect(() => verificarConfirmacion(sinPerdida, false)).not.toThrow();
    const conPerdida = { ...sinPerdida, itemsEliminados: ["Examen"], calificacionesBorradas: 3 };
    esperarError(() => verificarConfirmacion(conPerdida, false), "CONFIRMAR_CAMBIO_ITEMS");
    expect(() => verificarConfirmacion(conPerdida, true)).not.toThrow();
  });
});

describe("calificaciones de ítems y notas directas (bloque M2)", () => {
  it("una competencia con ítems no recibe nota directa", () => {
    const columnas = new Map([[C1, { columna: 1 }]]);
    esperarError(
      () => verificarSinItems([{ competenciaPlanId: C1 }], [item("p", 100, 1)], columnas),
      "COMPETENCIA_CON_ITEMS",
    );
    expect(() => verificarSinItems([{ competenciaPlanId: C2 }], [item("p", 100, 1)], columnas)).not.toThrow();
  });

  it("solo califica ítems del registro para alumnos de la lista", () => {
    expect(() =>
      verificarCalificaciones([{ itemId: "p", matriculaId: "m1", logro: "A" }], [{ id: "p" }], ["m1"]),
    ).not.toThrow();
    esperarError(
      () => verificarCalificaciones([{ itemId: "otro", matriculaId: "m1", logro: "A" }], [{ id: "p" }], ["m1"]),
      "NOTA_FUERA_DEL_REGISTRO",
    );
    esperarError(
      () => verificarCalificaciones([{ itemId: "p", matriculaId: "m9", logro: "A" }], [{ id: "p" }], ["m1"]),
      "NOTA_FUERA_DEL_REGISTRO",
    );
  });

  it("separa nuevas, modificadas y sin cambio", () => {
    const r = cambiosDeCalificaciones(
      [
        { id: "c1", itemId: "p", matriculaId: "m1", valor: "A" },
        { id: "c2", itemId: "p", matriculaId: "m2", valor: "B" },
      ],
      [
        { itemId: "p", matriculaId: "m1", logro: "AD" },
        { itemId: "p", matriculaId: "m2", logro: "B" },
        { itemId: "p", matriculaId: "m3", logro: "C" },
      ],
    );
    expect(r.nuevas).toEqual([{ itemId: "p", matriculaId: "m3", logro: "C" }]);
    expect(r.modificadas).toEqual([{ id: "c1", anterior: "A", logro: "AD", itemId: "p", matriculaId: "m1" }]);
    expect(r.sinCambio).toBe(1);
  });
});

describe("importar calificaciones de un ítem desde CSV (bloque M2, fase 7)", () => {
  const alumnos = [
    { matriculaId: "m1", nombre: "Álvarez, Ana", dni: "90002421" },
    { matriculaId: "m2", nombre: "Castillo, Bruno", dni: "90002422" },
  ];

  it("acepta la cabecera, «;» y minúsculas, y marca cada fila válida con su alumno", () => {
    const filas = analizarCsvCalificaciones("dni;calificativo\r\n90002421;ad\n\n90002422;B\n", alumnos);
    expect(filas.map((f) => [f.linea, f.matriculaId, f.calificativo, f.motivo])).toEqual([
      [2, "m1", "AD", null],
      [4, "m2", "B", null],
    ]);
  });

  it("rechaza cada fila con su motivo sin perder las válidas", () => {
    const filas = analizarCsvCalificaciones(
      ["90002421,A", "9000242,A", "90002422,15", "90002421,B", "90009999,C", "90002422,A,extra"].join("\n"),
      alumnos,
    );
    expect(filas.map((f) => f.motivo)).toEqual([
      null,
      "El DNI debe tener 8 dígitos.",
      "Solo se permiten los valores AD, A, B o C.",
      "El DNI aparece más de una vez en el archivo.",
      "No hay un alumno con ese DNI en este registro.",
      "La fila tiene más de dos columnas: usa «dni,calificativo».",
    ]);
  });

  it("un archivo vacío o con solo la cabecera se rechaza", () => {
    esperarError(() => analizarCsvCalificaciones("dni,calificativo\n", alumnos), "CSV_VACIO");
    esperarError(() => analizarCsvCalificaciones("   ", alumnos), "CSV_VACIO");
  });
});
