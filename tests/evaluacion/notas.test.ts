// Pruebas del registro de notas (US37), del cierre y la consolidación del bimestre (US39) y del bloqueo del registro
// cerrado (US40): valores permitidos, bimestre activo, completitud, consolidación con la versión de la regla que
// rige en el bimestre (moda y promedio ponderado) y rechazo de escrituras tras el cierre. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { ErrorApp } from "@/platform/http/errores";
import { clasificarError } from "@/platform/http/clasificador";
import { versionAplicable, type ReglaDelBimestre } from "@/modules/academico";
import { esquemasEvaluacion } from "@/modules/evaluacion";
import { consolidarAlumno } from "@/modules/evaluacion/application/registroNotas";
import {
  avanceDelRegistro,
  cambiosDeNotas,
  entradaDeConsolidacion,
  esBimestreActivo,
  esLogroNota,
  MENSAJE_CORRECCION,
  pendientesDelRegistro,
  situacionDelRegistro,
  verificarCeldas,
  verificarCompletitud,
  verificarEditable,
  verificarValores,
  type LogroNota,
} from "@/modules/evaluacion/domain/notas";

const M1 = "11111111-1111-4111-8111-111111111111";
const M2 = "22222222-2222-4222-8222-222222222222";
const C1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const C2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const alumnos = [
  { matriculaId: M1, nombre: "Castillo Ramos, Bruno" },
  { matriculaId: M2, nombre: "Quispe Rojas, Valeria" },
];
const competencias = [
  { competenciaPlanId: C1, codigo: "MAT-C1", nombre: "Resuelve problemas de cantidad", peso: 2 },
  { competenciaPlanId: C2, codigo: "MAT-C2", nombre: "Resuelve problemas de regularidad", peso: 1 },
  { competenciaPlanId: C3, codigo: "MAT-C3", nombre: "Resuelve problemas de forma", peso: 1 },
];

/** Error de negocio lanzado por `fn`, para revisar su código, estado y detalles. */
function errorDe(fn: () => unknown): ErrorApp {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorApp) return e;
    throw e;
  }
  throw new Error("Se esperaba un error de negocio");
}

describe("valores permitidos: solo AD, A, B o C (US37, criterio 2)", () => {
  it("acepta los cuatro logros de la escala", () => {
    for (const l of ["AD", "A", "B", "C"]) expect(esLogroNota(l)).toBe(true);
    expect(() => verificarValores([{ matriculaId: M1, competenciaPlanId: C1, logro: "AD" }])).not.toThrow();
  });

  it("rechaza números, minúsculas y otros textos con el mensaje del backlog y la celda rechazada", () => {
    for (const valor of [15, "15", "ad", "D", "", null, "A+"]) expect(esLogroNota(valor)).toBe(false);
    const e = errorDe(() => verificarValores([{ matriculaId: M1, competenciaPlanId: C2, logro: "15" }]));
    expect(e).toMatchObject({ codigo: "VALOR_NO_PERMITIDO", estadoHttp: 400 });
    expect(e.message).toBe("Solo se permiten los valores AD, A, B o C");
    expect(e.detalles).toEqual({ celdas: [{ matriculaId: M1, competenciaPlanId: C2, valor: "15" }] });
  });

  it("el esquema del servidor (Zod) responde con el mismo mensaje si el problema es el logro", () => {
    const cuerpo = {
      notas: [
        { matriculaId: M1, competenciaPlanId: C1, logro: "A" },
        { matriculaId: M2, competenciaPlanId: C2, logro: 15 },
      ],
    };
    const e = errorDe(() => esquemasEvaluacion.GuardarNotasSchema.parse(cuerpo));
    expect(e.codigo).toBe("VALOR_NO_PERMITIDO");
    expect(e.message).toBe("Solo se permiten los valores AD, A, B o C");
    expect(e.detalles).toEqual({ celdas: [{ matriculaId: M2, competenciaPlanId: C2, valor: "15" }] });
  });

  it("otros problemas del cuerpo siguen siendo DATOS_INVALIDOS (celda repetida, ids no válidos)", () => {
    const repetida = { notas: [0, 1].map(() => ({ matriculaId: M1, competenciaPlanId: C1, logro: "A" })) };
    expect(() => esquemasEvaluacion.GuardarNotasSchema.parse(repetida)).toThrow("La misma nota aparece dos veces");
    expect(clasificarError(captura(() => esquemasEvaluacion.GuardarNotasSchema.parse({ notas: [] })))).toMatchObject({
      estado: 400,
      codigo: "DATOS_INVALIDOS",
    });
    expect(() =>
      esquemasEvaluacion.GuardarNotasSchema.parse({ notas: [{ matriculaId: "x", competenciaPlanId: C1, logro: "A" }] }),
    ).toThrow("Identificador no válido");
  });
});

function captura(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
}

describe("bimestre activo y solo lectura (US37, criterio 3)", () => {
  const bimestre = {
    id: "b3",
    numero: 3,
    nombre: "Bimestre III",
    fechaInicio: "2026-08-10",
    fechaFin: "2026-10-09",
    estado: "ACTIVO",
  };

  it("se califica dentro de las fechas del bimestre, con el año en curso y sin finalizar", () => {
    expect(esBimestreActivo(bimestre, "EN_CURSO", "2026-08-10")).toBe(true);
    expect(esBimestreActivo(bimestre, "EN_CURSO", "2026-10-09")).toBe(true);
    expect(situacionDelRegistro("ABIERTO", true)).toEqual({
      editable: true,
      motivoSoloLectura: null,
      mensaje: null,
      correccion: null,
    });
  });

  it("fuera de fechas, con el bimestre finalizado o el año no en curso es de solo lectura", () => {
    expect(esBimestreActivo(bimestre, "EN_CURSO", "2026-10-10")).toBe(false);
    expect(esBimestreActivo(bimestre, "EN_CURSO", "2026-08-09")).toBe(false);
    expect(esBimestreActivo({ ...bimestre, estado: "FINALIZADO" }, "EN_CURSO", "2026-09-01")).toBe(false);
    expect(esBimestreActivo(bimestre, "CERRADO", "2026-09-01")).toBe(false);
    const s = situacionDelRegistro("ABIERTO", false);
    expect(s).toMatchObject({ editable: false, motivoSoloLectura: "PERIODO_NO_ACTIVO" });
    expect(s.mensaje).toBe("Este periodo de evaluación no está activo.");
    const e = errorDe(() => verificarEditable(s));
    expect(e).toMatchObject({ codigo: "PERIODO_NO_ACTIVO", estadoHttp: 422 });
    expect(e.message).toBe("Este periodo de evaluación no está activo.");
  });
});

describe("guardado parcial y cambios con el valor anterior (US37)", () => {
  const guardadas = [{ id: "n1", matriculaId: M1, competenciaPlanId: C1, logro: "A" as LogroNota }];

  it("separa notas nuevas, cambios (con el logro anterior) y valores que no cambian", () => {
    const cambios = cambiosDeNotas(guardadas, [
      { matriculaId: M1, competenciaPlanId: C1, logro: "AD" },
      { matriculaId: M1, competenciaPlanId: C2, logro: "B" },
    ]);
    expect(cambios.nuevas).toEqual([{ matriculaId: M1, competenciaPlanId: C2, logro: "B" }]);
    expect(cambios.modificadas).toEqual([{ id: "n1", anterior: "A", logro: "AD" }]);
    expect(cambiosDeNotas(guardadas, [{ matriculaId: M1, competenciaPlanId: C1, logro: "A" }])).toEqual({
      nuevas: [],
      modificadas: [],
      sinCambio: 1,
    });
  });

  it("solo se califican los alumnos de la lista en las competencias del curso", () => {
    expect(() =>
      verificarCeldas([{ matriculaId: M1, competenciaPlanId: C3, logro: "A" }], alumnos, competencias),
    ).not.toThrow();
    const otro = "99999999-9999-4999-8999-999999999999";
    for (const celda of [
      { matriculaId: otro, competenciaPlanId: C1 },
      { matriculaId: M1, competenciaPlanId: otro },
    ]) {
      expect(errorDe(() => verificarCeldas([{ ...celda, logro: "A" }], alumnos, competencias)).codigo).toBe(
        "NOTA_FUERA_DEL_REGISTRO",
      );
    }
  });

  it("calcula el avance del registro y los alumnos con competencias pendientes", () => {
    const notas = [
      { matriculaId: M1, competenciaPlanId: C1 },
      { matriculaId: M1, competenciaPlanId: C2 },
      { matriculaId: M1, competenciaPlanId: C3 },
      { matriculaId: M2, competenciaPlanId: C1 },
    ];
    expect(avanceDelRegistro(alumnos, competencias, notas)).toEqual({
      calificadas: 4,
      total: 6,
      porcentaje: 66,
      alumnosPendientes: 1,
    });
    expect(avanceDelRegistro([], competencias, [])).toMatchObject({ total: 0, porcentaje: 0 });
  });
});

describe("completitud antes del cierre (US39, criterio 2)", () => {
  it("con todas las competencias de todos los alumnos se puede cerrar", () => {
    const todas = alumnos.flatMap((a) => competencias.map((c) => ({ matriculaId: a.matriculaId, ...c })));
    expect(pendientesDelRegistro(alumnos, competencias, todas)).toEqual([]);
    expect(() => verificarCompletitud(alumnos, competencias, todas)).not.toThrow();
  });

  it("si falta alguna, indica «Existen registros de notas incompletos» con los alumnos y competencias", () => {
    const notas = [
      { matriculaId: M1, competenciaPlanId: C1 },
      { matriculaId: M1, competenciaPlanId: C3 },
      { matriculaId: M2, competenciaPlanId: C1 },
      { matriculaId: M2, competenciaPlanId: C2 },
      { matriculaId: M2, competenciaPlanId: C3 },
    ];
    const e = errorDe(() => verificarCompletitud(alumnos, competencias, notas));
    expect(e).toMatchObject({ codigo: "NOTAS_INCOMPLETAS", estadoHttp: 422 });
    expect(e.message).toBe("Existen registros de notas incompletos");
    expect(e.detalles).toEqual({
      pendientes: [
        {
          matriculaId: M1,
          nombre: "Castillo Ramos, Bruno",
          competencias: [{ competenciaPlanId: C2, codigo: "MAT-C2", nombre: "Resuelve problemas de regularidad" }],
        },
      ],
    });
  });

  it("una sección sin alumnos no tiene registro que cerrar", () => {
    expect(errorDe(() => verificarCompletitud([], competencias, [])).codigo).toBe("REGISTRO_SIN_ALUMNOS");
  });
});

describe("consolidación con la versión de la regla que rige en el bimestre (US39 con US12)", () => {
  // v1: moda desde el inicio del año; v2: promedio ponderado desde el bimestre III
  const v1: ReglaDelBimestre & { rigeDesdeNumero: number | null } = {
    id: "r1",
    version: 1,
    nombre: "Moda de los logros",
    metodo: "MODA",
    criterioDesempate: "MAYOR_JERARQUIA",
    rigeDesdeNumero: null,
  };
  const v2: ReglaDelBimestre & { rigeDesdeNumero: number | null } = {
    id: "r2",
    version: 2,
    nombre: "Promedio ponderado",
    metodo: "PONDERADO",
    criterioDesempate: "MAYOR_JERARQUIA",
    rigeDesdeNumero: 3,
  };
  const t = (min: number) => new Date(Date.UTC(2026, 8, 1, 10, min));
  // C1 = C (peso 2), C2 = AD (peso 1), C3 = AD (peso 1)
  const notas = [
    { competenciaPlanId: C1, logro: "C" as LogroNota, createdAt: t(0), modificadoEn: null },
    { competenciaPlanId: C2, logro: "AD" as LogroNota, createdAt: t(1), modificadoEn: null },
    { competenciaPlanId: C3, logro: "AD" as LogroNota, createdAt: t(2), modificadoEn: null },
  ];
  const conOrden = competencias.map((c, i) => ({ ...c, orden: i + 1 }));

  it("en los bimestres I y II rige la v1 (moda): AD, aunque C pese el doble", () => {
    const regla = versionAplicable([v1, v2], 2)!;
    expect(regla.version).toBe(1);
    const r = consolidarAlumno(regla, conOrden, notas);
    expect(r.logro).toBe("AD");
    expect(r.detalle.regla).toMatchObject({ version: 1, metodo: "MODA" });
  });

  it("desde el bimestre III rige la v2 (ponderado): (1×2 + 4 + 4) / 4 = 2,5 → A, y se guarda la versión", () => {
    const regla = versionAplicable([v1, v2], 3)!;
    expect(regla.version).toBe(2);
    const r = consolidarAlumno(regla, conOrden, notas);
    expect(r.logro).toBe("A");
    expect(r.detalle).toEqual({
      regla: {
        id: "r2",
        version: 2,
        nombre: "Promedio ponderado",
        metodo: "PONDERADO",
        criterioDesempate: "MAYOR_JERARQUIA",
      },
      logros: [
        { competencia: "MAT-C1", logro: "C", peso: 2 },
        { competencia: "MAT-C2", logro: "AD", peso: 1 },
        { competencia: "MAT-C3", logro: "AD", peso: 1 },
      ],
    });
  });

  it("la moda resuelve el empate con el criterio de la versión (mayor o menor jerarquía)", () => {
    const empate = [
      { competenciaPlanId: C1, logro: "A" as LogroNota, createdAt: t(0), modificadoEn: null },
      { competenciaPlanId: C2, logro: "B" as LogroNota, createdAt: t(1), modificadoEn: null },
    ];
    const dos = conOrden.slice(0, 2);
    expect(consolidarAlumno(v1, dos, empate).logro).toBe("A");
    expect(consolidarAlumno({ ...v1, criterioDesempate: "MENOR_JERARQUIA" }, dos, empate).logro).toBe("B");
  });

  it("ordena los logros por fecha del último cambio (criterio ULTIMO_REGISTRO) e ignora competencias ajenas", () => {
    const entrada = entradaDeConsolidacion(competencias, [
      { competenciaPlanId: C1, logro: "B", fecha: t(5) },
      { competenciaPlanId: C2, logro: "A", fecha: t(1) },
      { competenciaPlanId: "otra", logro: "C", fecha: t(0) },
    ]);
    expect(entrada.logros).toEqual(["A", "B"]);
    expect(entrada.pesos).toEqual([1, 2]);
  });
});

describe("bloqueo del registro cerrado (US40)", () => {
  it("un registro cerrado es de solo lectura aunque su bimestre siga activo, e indica cómo corregir", () => {
    for (const estado of ["CERRADO", "PUBLICADO"] as const) {
      const s = situacionDelRegistro(estado, true);
      expect(s).toMatchObject({
        editable: false,
        motivoSoloLectura: "REGISTRO_CERRADO",
        correccion: MENSAJE_CORRECCION,
      });
      expect(s.mensaje).toBe("Este registro está cerrado y no puede modificarse directamente.");
      const e = errorDe(() => verificarEditable(s));
      expect(e).toMatchObject({ codigo: "REGISTRO_CERRADO", estadoHttp: 409 });
    }
    expect(MENSAJE_CORRECCION).toContain("envía una solicitud de rectificación a la administración");
  });

  it("si la escritura llega directo a la base, el trigger responde 409 con el mismo mensaje", () => {
    const c = clasificarError(
      new Error("REGISTRO_CERRADO: el registro de notas está cerrado y no puede modificarse directamente"),
    );
    expect(c).toMatchObject({
      estado: 409,
      codigo: "REGISTRO_CERRADO",
      mensaje: "Este registro está cerrado y no puede modificarse directamente.",
    });
  });
});
