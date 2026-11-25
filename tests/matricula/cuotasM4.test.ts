// Pruebas del bloque M4 · fase 1: cuota de ingreso del alumno nuevo, montos opcionales (ingreso y mora) y nombre del
// recibo de los tipos de cuota nuevos. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import { aCentimosOCero, montoOpcionalGuardado, normalizarMontoOpcional } from "@/modules/academico/domain/montos";
import { generarCronograma, totalCentimos } from "@/modules/matricula/domain/cronograma";
import { esAlumnoNuevo } from "@/modules/matricula/domain/matriculas";
import { nombreArchivoComprobante } from "@/modules/matricula/domain/portalApoderado";

const base = { anio: 2026, montoMatriculaCentimos: 35000, montoPensionCentimos: 45000, fechaMatricula: "2026-02-20" };

describe("cuota de ingreso en el cronograma (bloque M4)", () => {
  it("al alumno nuevo le agrega la cuota de ingreso con el vencimiento de la matrícula", () => {
    const cuotas = generarCronograma({ ...base, montoIngresoCentimos: 50000, esAlumnoNuevo: true });
    expect(cuotas).toHaveLength(12);
    expect(cuotas[1]).toEqual({
      tipo: "INGRESO",
      mes: null,
      concepto: "Cuota de ingreso 2026",
      montoCentimos: 50000,
      fechaVencimiento: "2026-02-20",
    });
    expect(totalCentimos(cuotas)).toBe(485000 + 50000);
  });
  it("al alumno que ya estudió en el colegio no le cobra ingreso", () => {
    const cuotas = generarCronograma({ ...base, montoIngresoCentimos: 50000, esAlumnoNuevo: false });
    expect(cuotas.some((c) => c.tipo === "INGRESO")).toBe(false);
  });
  it("con el monto de ingreso en 0 no la genera aunque el alumno sea nuevo", () => {
    const cuotas = generarCronograma({ ...base, montoIngresoCentimos: 0, esAlumnoNuevo: true });
    expect(cuotas).toHaveLength(11);
  });
});

describe("alumno nuevo en el colegio (bloque M4)", () => {
  it("es nuevo si no tiene otras matrículas", () => {
    expect(esAlumnoNuevo([])).toBe(true);
  });
  it("una matrícula anulada no cuenta: sigue siendo nuevo", () => {
    expect(esAlumnoNuevo([{ estado: "ANULADO" }])).toBe(true);
  });
  it("con una matrícula finalizada o retirada de otro año ya no es nuevo", () => {
    expect(esAlumnoNuevo([{ estado: "FINALIZADO" }])).toBe(false);
    expect(esAlumnoNuevo([{ estado: "ANULADO" }, { estado: "RETIRADO" }])).toBe(false);
  });
});

describe("montos opcionales de ingreso y mora (bloque M4)", () => {
  it("aceptan 0 y lo guardan como «0.00»", () => {
    expect(aCentimosOCero("0")).toBe(0);
    expect(aCentimosOCero("0.00")).toBe(0);
    expect(normalizarMontoOpcional("0")).toBe("0.00");
    expect(normalizarMontoOpcional("20.5")).toBe("20.50");
  });
  it("rechazan montos negativos o con más de dos decimales", () => {
    expect(() => aCentimosOCero("-5")).toThrow("Ingresa un monto");
    expect(() => aCentimosOCero("20.555")).toThrow("Ingresa un monto");
  });
  it("leen el valor guardado o null si no hay uno válido", () => {
    expect(montoOpcionalGuardado("0")).toBe("0.00");
    expect(montoOpcionalGuardado(15)).toBe("15.00");
    expect(montoOpcionalGuardado(undefined)).toBeNull();
    expect(montoOpcionalGuardado("abc")).toBeNull();
  });
});

describe("nombre del recibo de las cuotas nuevas (US44, bloque M4)", () => {
  const datos = { mes: null, anio: 2026, anual: false, nombres: "Valeria", apellidos: "Quispe Rojas" };
  it("usa el tipo de cuota en lugar del mes", () => {
    expect(nombreArchivoComprobante({ ...datos, tipo: "INGRESO" })).toBe("Recibo_Ingreso2026_ValeriaQuispe.pdf");
    expect(nombreArchivoComprobante({ ...datos, tipo: "MORA", mes: 9 })).toBe("Recibo_Mora2026_ValeriaQuispe.pdf");
    expect(nombreArchivoComprobante({ ...datos, tipo: "EXTRAORDINARIA" })).toBe(
      "Recibo_Extraordinaria2026_ValeriaQuispe.pdf",
    );
  });
  it("la pensión sigue usando el mes", () => {
    expect(nombreArchivoComprobante({ ...datos, tipo: "PENSION", mes: 3 })).toBe("Recibo_Marzo2026_ValeriaQuispe.pdf");
  });
});
