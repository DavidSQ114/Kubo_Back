// Pruebas de la consolidación de logros (US12, RF10): moda con desempate, promedio ponderado con redondeo y
// versiones de la regla. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  bimestresDeVersion,
  consolidarLogro,
  frecuencias,
  logroDeValor,
  logrosMasFrecuentes,
  promedioPonderado,
  textoAlcance,
  verificarRigeDesde,
  versionAplicable,
  type Logro,
  type ReglaCalculo,
} from "@/modules/academico/domain/consolidacion";

function esperarError(fn: () => void, codigo: string) {
  expect(fn).toThrowError(expect.objectContaining({ codigo }));
}

const MODA_MAYOR: ReglaCalculo = { metodo: "MODA", criterioDesempate: "MAYOR_JERARQUIA" };
const MODA_MENOR: ReglaCalculo = { metodo: "MODA", criterioDesempate: "MENOR_JERARQUIA" };
const PONDERADO: ReglaCalculo = { metodo: "PONDERADO", criterioDesempate: "MAYOR_JERARQUIA" };

describe("moda de los logros (US12)", () => {
  it("devuelve el logro que más se repite", () => {
    expect(consolidarLogro(["A", "B", "A", "C", "A"], MODA_MAYOR)).toBe("A");
    expect(consolidarLogro(["C", "C", "AD"], MODA_MENOR)).toBe("C");
  });
  it("con un solo logro devuelve ese logro", () => {
    expect(consolidarLogro(["B"], MODA_MAYOR)).toBe("B");
  });
  it("empate de 2: mayor jerarquía elige AD y menor jerarquía elige A", () => {
    const logros: Logro[] = ["AD", "A", "AD", "A"];
    expect(consolidarLogro(logros, MODA_MAYOR)).toBe("AD");
    expect(consolidarLogro(logros, MODA_MENOR)).toBe("A");
  });
  it("empate de 3: mayor jerarquía elige A y menor jerarquía elige C", () => {
    const logros: Logro[] = ["B", "C", "A", "C", "A", "B"];
    expect(logrosMasFrecuentes(logros)).toEqual(["A", "B", "C"]);
    expect(consolidarLogro(logros, MODA_MAYOR)).toBe("A");
    expect(consolidarLogro(logros, MODA_MENOR)).toBe("C");
  });
  it("empate de los 4 logros", () => {
    const logros: Logro[] = ["C", "B", "A", "AD"];
    expect(consolidarLogro(logros, MODA_MAYOR)).toBe("AD");
    expect(consolidarLogro(logros, MODA_MENOR)).toBe("C");
  });
  it("último registro elige al empatado que aparece más tarde", () => {
    expect(consolidarLogro(["AD", "B", "B", "AD"], { metodo: "MODA", criterioDesempate: "ULTIMO_REGISTRO" })).toBe(
      "AD",
    );
    expect(consolidarLogro(["AD", "B", "AD", "B"], { metodo: "MODA", criterioDesempate: "ULTIMO_REGISTRO" })).toBe("B");
  });
  it("el criterio de desempate no cambia una moda clara", () => {
    expect(consolidarLogro(["C", "C", "AD"], MODA_MAYOR)).toBe("C");
  });
  it("en la moda los pesos no cuentan", () => {
    expect(consolidarLogro(["C", "C", "AD"], MODA_MAYOR, [1, 1, 50])).toBe("C");
  });
  it("cuenta la frecuencia de cada logro", () => {
    expect(frecuencias(["AD", "A", "AD", "A"])).toEqual({ AD: 2, A: 2, B: 0, C: 0 });
  });
});

describe("promedio ponderado (US12): AD=4, A=3, B=2, C=1", () => {
  it("sin pesos, todos pesan igual", () => {
    expect(promedioPonderado(["AD", "A", "B", "C"])).toBe(2.5);
    expect(consolidarLogro(["AD", "AD", "A"], PONDERADO)).toBe("AD"); // 3,67
  });
  it("con pesos distintos cambia el resultado", () => {
    // (4·1 + 2·3) / 4 = 2,5 → A ; (4·3 + 2·1) / 4 = 3,5 → AD
    expect(consolidarLogro(["AD", "B"], PONDERADO, [1, 3])).toBe("A");
    expect(consolidarLogro(["AD", "B"], PONDERADO, [3, 1])).toBe("AD");
    // (1·10 + 4·30 + 3·60) / 100 = 3,1 → A
    expect(consolidarLogro(["C", "AD", "A"], PONDERADO, [10, 30, 60])).toBe("A");
  });
  it("los pesos son relativos: 25/25/50 da lo mismo que 1/1/2", () => {
    const logros: Logro[] = ["C", "B", "AD"];
    expect(promedioPonderado(logros, [25, 25, 50])).toBe(promedioPonderado(logros, [1, 1, 2]));
  });
  it("redondea al logro más cercano", () => {
    expect(logroDeValor(3.49)).toBe("A");
    expect(logroDeValor(3.51)).toBe("AD");
    expect(logroDeValor(1.2)).toBe("C");
    expect(logroDeValor(2.7)).toBe("A");
  });
  it("los empates ,5 suben al logro mayor", () => {
    expect(logroDeValor(1.5)).toBe("B");
    expect(logroDeValor(2.5)).toBe("A");
    expect(logroDeValor(3.5)).toBe("AD");
  });
  it("un ,5 con error de coma flotante también sube", () => {
    // (4·0,1 + 4·0,2 + 3·0,3) / 0,6 = 3,5 exacto, pero en coma flotante da 3,4999999999999996
    expect(promedioPonderado(["AD", "AD", "A"], [0.1, 0.2, 0.3])).toBeLessThan(3.5);
    expect(consolidarLogro(["AD", "AD", "A"], PONDERADO, [0.1, 0.2, 0.3])).toBe("AD");
  });
  it("todos los pesos null equivale a sin pesos", () => {
    expect(consolidarLogro(["AD", "B"], PONDERADO, [null, null])).toBe("A");
  });
  it("rechaza pesos incompletos, de otra cantidad o no positivos", () => {
    esperarError(() => consolidarLogro(["AD", "B"], PONDERADO, [2, null]), "PESOS_INCOMPLETOS");
    esperarError(() => consolidarLogro(["AD", "B"], PONDERADO, [2]), "PESOS_NO_CORRESPONDEN");
    esperarError(() => consolidarLogro(["AD", "B"], PONDERADO, [2, 0]), "PESO_INVALIDO");
    esperarError(() => consolidarLogro(["AD", "B"], PONDERADO, [2, -1]), "PESO_INVALIDO");
  });
});

describe("entradas inválidas (US12)", () => {
  it("una lista vacía es un error en ambos métodos", () => {
    esperarError(() => consolidarLogro([], MODA_MAYOR), "LOGROS_VACIOS");
    esperarError(() => consolidarLogro([], PONDERADO), "LOGROS_VACIOS");
  });
  it("rechaza un logro que no es AD, A, B ni C", () => {
    esperarError(() => consolidarLogro(["A", "D" as Logro], MODA_MAYOR), "LOGRO_INVALIDO");
  });
});

describe("versiones de la regla (US12)", () => {
  const versiones = [
    { version: 1, rigeDesdeNumero: null },
    { version: 2, rigeDesdeNumero: 3 },
  ];
  it("cada bimestre usa la versión más reciente que ya regía", () => {
    expect(versionAplicable(versiones, 1)?.version).toBe(1);
    expect(versionAplicable(versiones, 2)?.version).toBe(1);
    expect(versionAplicable(versiones, 3)?.version).toBe(2);
    expect(versionAplicable(versiones, 4)?.version).toBe(2);
    expect(versionAplicable([], 1)).toBeNull();
  });
  it("calcula a qué bimestres se aplicó cada versión", () => {
    expect(textoAlcance(bimestresDeVersion(versiones, 1))).toBe("Bimestres I y II");
    expect(textoAlcance(bimestresDeVersion(versiones, 2))).toBe("Desde Bimestre III");
    expect(textoAlcance(bimestresDeVersion([{ version: 1, rigeDesdeNumero: null }], 1))).toBe("Todo el año");
    const reemplazada = [...versiones, { version: 3, rigeDesdeNumero: 3 }];
    expect(textoAlcance(bimestresDeVersion(reemplazada, 2))).toBe("Sin aplicar (reemplazada)");
    expect(textoAlcance([1])).toBe("Bimestre I");
    expect(textoAlcance([1, 2, 3])).toBe("Bimestres I, II y III");
  });
  const periodos = [
    { id: "b1", numero: 1, cerrado: true },
    { id: "b2", numero: 2, cerrado: false },
  ];
  it("la nueva versión rige desde un bimestre abierto del año", () => {
    expect(verificarRigeDesde(periodos, "b2")).toBe("b2");
  });
  it("rechaza un bimestre cerrado, ajeno o no elegido", () => {
    esperarError(() => verificarRigeDesde(periodos, "b1"), "RIGE_DESDE_CERRADO");
    esperarError(() => verificarRigeDesde(periodos, "otro"), "RIGE_DESDE_INVALIDO");
    esperarError(() => verificarRigeDesde(periodos, null), "RIGE_DESDE_REQUERIDO");
  });
  it("sin bimestres registrados rige desde el inicio del año", () => {
    expect(verificarRigeDesde([], undefined)).toBeNull();
  });
});
