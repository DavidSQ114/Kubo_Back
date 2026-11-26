// Pruebas de los reportes del coordinador académico (bloque M2): distribución de AD, A, B y C con porcentajes,
// agrupación por curso y competencia con el detalle por alumno, y CSV seguro para hojas de cálculo. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { campoCsv } from "@/platform/http/csv";
import { armarReporte, csvDelReporte, distribucion, nombreArchivoReporte } from "@/modules/evaluacion/domain/reportes";

describe("distribución de logros por competencia (bloque M2)", () => {
  it("cuenta cada logro y su porcentaje con un decimal; los null no cuentan", () => {
    const d = distribucion(["AD", "A", "A", null]);
    expect(d.conteo).toEqual({ AD: 1, A: 2, B: 0, C: 0 });
    expect(d.total).toBe(3);
    expect(d.porcentajes).toEqual({ AD: 33.3, A: 66.7, B: 0, C: 0 });
  });

  it("sin notas, todo en 0", () => {
    expect(distribucion([])).toEqual({
      conteo: { AD: 0, A: 0, B: 0, C: 0 },
      total: 0,
      porcentajes: { AD: 0, A: 0, B: 0, C: 0 },
    });
  });
});

describe("reporte de logro de competencias (bloque M2)", () => {
  const competencias = [
    { competenciaPlanId: "cp1", codigo: "MAT-C1", nombre: "Cantidad", orden: 1 },
    { competenciaPlanId: "cp2", codigo: "MAT-C2", nombre: "Regularidad", orden: 2 },
  ];
  const reporte = armarReporte({
    registros: [
      { cierreId: "r1", curso: { id: "mat", codigo: "MAT", nombre: "Matemática" }, seccion: "1° B", competencias },
      { cierreId: "r2", curso: { id: "mat", codigo: "MAT", nombre: "Matemática" }, seccion: "1° A", competencias },
    ],
    notas: [
      { cierreId: "r1", matriculaId: "m1", competenciaPlanId: "cp1", logro: "AD" },
      { cierreId: "r1", matriculaId: "m1", competenciaPlanId: "cp2", logro: "A" },
      { cierreId: "r2", matriculaId: "m2", competenciaPlanId: "cp1", logro: "B" },
      { cierreId: "r2", matriculaId: "m2", competenciaPlanId: "cp2", logro: "A" },
    ],
    resultados: [
      { cierreId: "r1", matriculaId: "m1", logroConsolidado: "AD" },
      { cierreId: "r2", matriculaId: "m2", logroConsolidado: "B" },
    ],
    nombres: new Map([
      ["m1", "Zapata, Ana"],
      ["m2", "Álvarez, Bruno"],
    ]),
  });

  it("junta las secciones de un curso y cuenta por competencia", () => {
    expect(reporte).toHaveLength(1);
    const mat = reporte[0];
    expect(mat.secciones).toEqual(["1° A", "1° B"]);
    expect(mat.competencias.map((c) => [c.columna, c.conteo])).toEqual([
      ["C1", { AD: 1, A: 0, B: 1, C: 0 }],
      ["C2", { AD: 0, A: 2, B: 0, C: 0 }],
    ]);
    expect(mat.consolidado.porcentajes).toEqual({ AD: 50, A: 0, B: 50, C: 0 });
  });

  it("el detalle por alumno va por sección y nombre, con su logro en cada competencia", () => {
    expect(reporte[0].alumnos.map((a) => [a.seccion, a.nombre, a.logros["MAT-C1"], a.consolidado])).toEqual([
      ["1° A", "Álvarez, Bruno", "B", "B"],
      ["1° B", "Zapata, Ana", "AD", "AD"],
    ]);
  });

  it("el CSV lleva BOM, separador «;», una fila por alumno y competencia y el logro del curso", () => {
    const texto = csvDelReporte({ anio: 2026, bimestre: "Bimestre I" }, reporte);
    expect(texto.startsWith("\uFEFFAño;Bimestre;Curso")).toBe(true);
    expect(texto.endsWith("\r\n")).toBe(true);
    const filas = texto.trim().split("\r\n");
    expect(filas).toHaveLength(1 + 2 * 3);
    expect(filas[1]).toBe('2026;Bimestre I;Matemática;1° A;"Álvarez, Bruno";C1;Cantidad;B');
    expect(filas[3]).toBe('2026;Bimestre I;Matemática;1° A;"Álvarez, Bruno";;Logro del curso;B');
    expect(nombreArchivoReporte({ anio: 2026, bimestre: "Bimestre I" }, "csv")).toBe(
      "Reporte_logro_BimestreI_2026.csv",
    );
  });

  it("un campo que empieza como fórmula se neutraliza y las comillas se duplican", () => {
    expect(campoCsv("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(campoCsv('Dice "hola"')).toBe('"Dice ""hola"""');
    expect(campoCsv(null)).toBe("");
  });
});
