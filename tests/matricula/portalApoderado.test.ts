// Reglas del portal del apoderado: hijos visibles (US42), autorización por vínculo (IDOR), estado «Vencido» y
// resumen (US43) y nombre del comprobante (US44). Sin base de datos y con fechas fijas.
import { describe, expect, it } from "vitest";
import { ErrorApp } from "@/platform/http/errores";
import {
  estadoCuotaPortal,
  matriculasDelPortal,
  matriculaVisibleEnPortal,
  nombreArchivoComprobante,
  resumenPagos,
  verificarComprobanteDisponible,
  verificarHijoAutorizado,
} from "@/modules/matricula/domain/portalApoderado";

const HOY = "2026-11-06";

function codigoDe(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ErrorApp ? e.codigo : "OTRO";
  }
}

describe("hijos que ve el apoderado (US42, AC-05)", () => {
  it("muestra «Matriculado» de un año abierto y «Retirado» solo del año en curso", () => {
    expect(matriculaVisibleEnPortal({ estado: "MATRICULADO", estadoAnio: "EN_CURSO" })).toBe(true);
    expect(matriculaVisibleEnPortal({ estado: "MATRICULADO", estadoAnio: "EN_MATRICULA" })).toBe(true);
    expect(matriculaVisibleEnPortal({ estado: "RETIRADO", estadoAnio: "EN_CURSO" })).toBe(true);
    expect(matriculaVisibleEnPortal({ estado: "RETIRADO", estadoAnio: "EN_MATRICULA" })).toBe(false);
    expect(matriculaVisibleEnPortal({ estado: "RETIRADO", estadoAnio: "CERRADO" })).toBe(false);
  });

  it("no muestra matrículas en proceso, anuladas ni de años cerrados", () => {
    expect(matriculaVisibleEnPortal({ estado: "EN_PROCESO", estadoAnio: "EN_CURSO" })).toBe(false);
    expect(matriculaVisibleEnPortal({ estado: "ANULADO", estadoAnio: "EN_CURSO" })).toBe(false);
    expect(matriculaVisibleEnPortal({ estado: "MATRICULADO", estadoAnio: "CERRADO" })).toBe(false);
  });

  it("pone primero la matrícula del año en curso y deja fuera a quien no tiene ninguna visible", () => {
    const lista = matriculasDelPortal([
      { estado: "MATRICULADO", estadoAnio: "EN_MATRICULA", anio: 2027 },
      { estado: "MATRICULADO", estadoAnio: "EN_CURSO", anio: 2026 },
      { estado: "ANULADO", estadoAnio: "EN_CURSO", anio: 2026 },
    ]);
    expect(lista.map((m) => m.anio)).toEqual([2026, 2027]);
    expect(matriculasDelPortal([{ estado: "EN_PROCESO", estadoAnio: "EN_MATRICULA", anio: 2027 }])).toEqual([]);
  });
});

describe("autorización por vínculo, IDOR (US42, RNF01)", () => {
  const hijos = ["est-valeria", "est-diego"];

  it("permite consultar a un hijo vinculado", () => {
    expect(codigoDe(() => verificarHijoAutorizado(hijos, "est-diego"))).toBeNull();
  });

  it("responde 403 con el id de un estudiante ajeno aunque exista", () => {
    let error: unknown;
    try {
      verificarHijoAutorizado(hijos, "est-de-otra-familia");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorApp);
    expect((error as ErrorApp).codigo).toBe("ESTUDIANTE_NO_VINCULADO");
    expect((error as ErrorApp).estadoHttp).toBe(403);
  });

  it("sin hijos vinculados, todo id es 403", () => {
    expect(codigoDe(() => verificarHijoAutorizado([], "est-valeria"))).toBe("ESTUDIANTE_NO_VINCULADO");
  });
});

describe("estado de la cuota para el apoderado (US43)", () => {
  it("«Vencido» es Pendiente con vencimiento anterior a hoy (fecha de Lima)", () => {
    expect(estadoCuotaPortal({ estado: "PENDIENTE", fechaVencimiento: "2026-11-05" }, HOY)).toBe("VENCIDO");
  });

  it("el mismo día del vencimiento todavía es «Pendiente»", () => {
    expect(estadoCuotaPortal({ estado: "PENDIENTE", fechaVencimiento: "2026-11-06" }, HOY)).toBe("PENDIENTE");
    expect(estadoCuotaPortal({ estado: "PENDIENTE", fechaVencimiento: "2026-12-05" }, HOY)).toBe("PENDIENTE");
  });

  it("una cuota pagada no vence y una anulada se aparta", () => {
    expect(estadoCuotaPortal({ estado: "PAGADO", fechaVencimiento: "2026-03-05" }, HOY)).toBe("PAGADO");
    expect(estadoCuotaPortal({ estado: "ANULADO", fechaVencimiento: "2026-03-05" }, HOY)).toBe("ANULADO");
  });
});

describe("resumen de pagos (US43, AP-02)", () => {
  it("suma pagado, pendiente y vencido en céntimos y no cuenta las anuladas", () => {
    const r = resumenPagos([
      { estadoPortal: "PAGADO", montoCentimos: 35000 },
      { estadoPortal: "PAGADO", montoCentimos: 45000 },
      { estadoPortal: "VENCIDO", montoCentimos: 45000 },
      { estadoPortal: "PENDIENTE", montoCentimos: 45010 },
      { estadoPortal: "ANULADO", montoCentimos: 45000 },
    ]);
    expect(r).toEqual({
      pagadoCentimos: 80000,
      cuotasPagadas: 2,
      pendienteCentimos: 45010,
      cuotasPendientes: 1,
      vencidoCentimos: 45000,
      cuotasVencidas: 1,
      alDia: false,
    });
  });

  it("sin pendientes ni vencidas está al día («Estás al día con tus pagos»)", () => {
    const r = resumenPagos([
      { estadoPortal: "PAGADO", montoCentimos: 35000 },
      { estadoPortal: "ANULADO", montoCentimos: 45000 },
    ]);
    expect(r.alDia).toBe(true);
    expect(r.vencidoCentimos).toBe(0);
  });
});

describe("comprobante del apoderado (US44)", () => {
  it("solo se descarga de una cuota «Pagado»", () => {
    expect(codigoDe(() => verificarComprobanteDisponible("PAGADO"))).toBeNull();
    expect(codigoDe(() => verificarComprobanteDisponible("PENDIENTE"))).toBe("RECIBO_NO_CONFIRMADO");
    expect(codigoDe(() => verificarComprobanteDisponible("VENCIDO"))).toBe("RECIBO_NO_CONFIRMADO");
  });

  const base = { anio: 2026, anual: false, nombres: "Valeria", apellidos: "Quispe Rojas" };

  it("nombra el archivo Recibo_<Mes><Año>_<NombreEstudiante>.pdf", () => {
    expect(nombreArchivoComprobante({ ...base, tipo: "PENSION", mes: 3 })).toBe("Recibo_Marzo2026_ValeriaQuispe.pdf");
    expect(nombreArchivoComprobante({ ...base, tipo: "PENSION", mes: 9 })).toBe(
      "Recibo_Setiembre2026_ValeriaQuispe.pdf",
    );
    expect(nombreArchivoComprobante({ ...base, tipo: "MATRICULA", mes: null })).toBe(
      "Recibo_Matricula2026_ValeriaQuispe.pdf",
    );
  });

  it("el pago anual usa «Anual»", () => {
    expect(nombreArchivoComprobante({ ...base, tipo: "PENSION", mes: 5, anual: true })).toBe(
      "Recibo_Anual2026_ValeriaQuispe.pdf",
    );
  });

  it("quita tildes, ñ y espacios del nombre", () => {
    expect(
      nombreArchivoComprobante({
        ...base,
        tipo: "PENSION",
        mes: 4,
        nombres: "  maría José",
        apellidos: "Muñoz Ñáñez",
      }),
    ).toBe("Recibo_Abril2026_MariaMunoz.pdf");
  });
});
