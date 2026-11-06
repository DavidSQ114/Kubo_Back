// Pruebas del traslado de sección (US19), el retiro del estudiante (US57), la ficha de matrícula (US20) y la sección
// en una fecha por historial. Ejecutar: npm test
import { describe, expect, it } from "vitest";
import {
  cuotasAnulablesPorRetiro,
  instanteDeRetiro,
  pendientesFicha,
  seccionEnFecha,
  textoMotivoRetiro,
  verificarCupoDestino,
  verificarDestino,
  verificarFechaRetiro,
  verificarFechaTraslado,
  verificarFichaCompleta,
  verificarFichaDisponible,
  verificarMotivoRetiro,
  verificarRetirable,
  verificarTrasladable,
  type CuotaParaRetiro,
  type DatosObligatoriosFicha,
} from "@/modules/matricula/domain/cambios";
import { esquemasMatricula } from "@/modules/matricula";

const codigo = (c: string) => expect.objectContaining({ codigo: c });

describe("traslado de sección (US19)", () => {
  const origen = { id: "3B", anioAcademicoId: "2026", gradoId: "3ro", estado: "ACTIVA" };

  it("permite otra sección activa del mismo grado y año", () => {
    expect(() => verificarDestino(origen, { ...origen, id: "3A" })).not.toThrow();
  });
  it("rechaza otro grado con el mensaje del Backlog", () => {
    expect(() => verificarDestino(origen, { ...origen, id: "4A", gradoId: "4to" })).toThrowError(
      expect.objectContaining({
        codigo: "TRASLADO_OTRO_GRADO",
        message: "Solo se permite el traslado entre secciones del mismo grado",
      }),
    );
  });
  it("rechaza una sección del mismo grado de otro año", () => {
    expect(() => verificarDestino(origen, { ...origen, id: "3A-2027", anioAcademicoId: "2027" })).toThrowError(
      codigo("TRASLADO_OTRO_GRADO"),
    );
  });
  it("rechaza la misma sección y una sección inactiva", () => {
    expect(() => verificarDestino(origen, origen)).toThrowError(codigo("MISMA_SECCION"));
    expect(() => verificarDestino(origen, { ...origen, id: "3C", estado: "INACTIVA" })).toThrowError(
      codigo("SECCION_INACTIVA"),
    );
  });
  it("sin vacantes en el destino: «La sección destino no tiene vacantes disponibles»", () => {
    expect(() => verificarCupoDestino(29, 30)).not.toThrow();
    expect(() => verificarCupoDestino(30, 30)).toThrowError(
      expect.objectContaining({
        codigo: "DESTINO_SIN_VACANTES",
        message: "La sección destino no tiene vacantes disponibles",
        detalles: { matriculados: 30, aforo: 30 },
      }),
    );
  });
  it("solo se traslada una matrícula Matriculado (no una Retirado)", () => {
    expect(() => verificarTrasladable("MATRICULADO")).not.toThrow();
    expect(() => verificarTrasladable("RETIRADO")).toThrowError(codigo("MATRICULA_NO_TRASLADABLE"));
    expect(() => verificarTrasladable("EN_PROCESO")).toThrowError(codigo("MATRICULA_NO_TRASLADABLE"));
  });
  it("la fecha efectiva va desde el ingreso a la sección actual hasta el fin del año", () => {
    const limites = { inicioSeccionActual: "2026-03-02", finAnio: "2026-12-18" };
    expect(() => verificarFechaTraslado("2026-03-02", limites)).not.toThrow();
    expect(() => verificarFechaTraslado("2026-12-18", limites)).not.toThrow();
    expect(() => verificarFechaTraslado("2026-03-01", limites)).toThrowError(codigo("FECHA_TRASLADO_INVALIDA"));
    expect(() => verificarFechaTraslado("2026-12-19", limites)).toThrowError(codigo("FECHA_TRASLADO_INVALIDA"));
  });
});

describe("sección en una fecha por historial (asistencia y notas)", () => {
  const tramos = [
    { seccionId: "3B", fechaInicio: "2026-03-02", fechaFin: "2026-09-21" },
    { seccionId: "3A", fechaInicio: "2026-09-21", fechaFin: null },
  ];
  it("antes del traslado está en la sección de origen y desde la fecha del traslado en la destino", () => {
    expect(seccionEnFecha(tramos, "2026-09-20")).toBe("3B");
    expect(seccionEnFecha(tramos, "2026-09-21")).toBe("3A");
    expect(seccionEnFecha(tramos, "2026-12-01")).toBe("3A");
  });
  it("antes de matricularse o desde el retiro no está en ninguna", () => {
    expect(seccionEnFecha(tramos, "2026-03-01")).toBeNull();
    const retirado = [{ seccionId: "3B", fechaInicio: "2026-03-02", fechaFin: "2026-10-15" }];
    expect(seccionEnFecha(retirado, "2026-10-14")).toBe("3B");
    expect(seccionEnFecha(retirado, "2026-10-15")).toBeNull();
  });
  it("un tramo cerrado el mismo día que empezó no cuenta", () => {
    const mismoDia = [
      { seccionId: "3B", fechaInicio: "2026-03-02", fechaFin: "2026-03-02" },
      { seccionId: "3A", fechaInicio: "2026-03-02", fechaFin: null },
    ];
    expect(seccionEnFecha(mismoDia, "2026-03-02")).toBe("3A");
  });
});

describe("retiro del estudiante (US57)", () => {
  it("sin motivo: «Seleccione el motivo del retiro»; el detalle es opcional", () => {
    expect(verificarMotivoRetiro("MOTIVOS_SALUD")).toBe("MOTIVOS_SALUD");
    expect(() => verificarMotivoRetiro(null)).toThrowError(
      expect.objectContaining({ codigo: "MOTIVO_RETIRO_REQUERIDO", message: "Seleccione el motivo del retiro" }),
    );
    expect(() => verificarMotivoRetiro(undefined)).toThrowError(codigo("MOTIVO_RETIRO_REQUERIDO"));
    expect(textoMotivoRetiro("TRASLADO", "  Se muda a Arequipa ")).toBe("TRASLADO: Se muda a Arequipa");
    expect(textoMotivoRetiro("OTRO", "  ")).toBe("OTRO");
  });
  it("la fecha no es anterior a la matrícula ni posterior al fin del año", () => {
    const limites = { fechaMatricula: "2026-03-02", finAnio: "2026-12-18" };
    expect(() => verificarFechaRetiro("2026-03-02", limites)).not.toThrow();
    expect(() => verificarFechaRetiro("2026-12-18", limites)).not.toThrow();
    expect(() => verificarFechaRetiro("2026-03-01", limites)).toThrowError(codigo("FECHA_RETIRO_INVALIDA"));
    expect(() => verificarFechaRetiro("2026-12-19", limites)).toThrowError(codigo("FECHA_RETIRO_INVALIDA"));
  });
  it("después de un traslado, no antes de su ingreso a la sección actual", () => {
    const limites = { fechaMatricula: "2026-03-02", finAnio: "2026-12-18", inicioSeccionActual: "2026-09-21" };
    expect(() => verificarFechaRetiro("2026-09-20", limites)).toThrowError(codigo("FECHA_RETIRO_INVALIDA"));
    expect(() => verificarFechaRetiro("2026-09-21", limites)).not.toThrow();
  });
  it("una matrícula Retirado no se retira otra vez", () => {
    expect(() => verificarRetirable("MATRICULADO")).not.toThrow();
    expect(() => verificarRetirable("RETIRADO")).toThrowError(codigo("MATRICULA_NO_RETIRABLE"));
    expect(() => verificarRetirable("ANULADO")).toThrowError(codigo("MATRICULA_NO_RETIRABLE"));
  });

  describe("qué cuotas se anulan", () => {
    const cuota = (id: string, fechaVencimiento: string, estado: CuotaParaRetiro["estado"], pagos = 0) => ({
      id,
      fechaVencimiento,
      estado,
      pagos,
    });
    const cuotas = [
      cuota("matricula", "2026-03-02", "PAGADO", 1),
      cuota("setiembre", "2026-09-05", "PENDIENTE"), // vencida antes del retiro
      cuota("octubre", "2026-10-05", "PENDIENTE"),
      cuota("noviembre", "2026-11-05", "PENDIENTE"),
      cuota("diciembre", "2026-12-05", "PAGADO", 1), // pagada por adelantado
      cuota("abono", "2026-11-05", "PENDIENTE", 1), // con un pago parcial
      cuota("anulada", "2026-12-05", "ANULADO"),
    ];
    it("anula solo las pendientes, sin pagos, que vencen después de la fecha de retiro", () => {
      expect(cuotasAnulablesPorRetiro(cuotas, "2026-10-15").map((c) => c.id)).toEqual(["noviembre"]);
    });
    it("la que vence el mismo día del retiro se conserva (ya vencida)", () => {
      expect(cuotasAnulablesPorRetiro(cuotas, "2026-10-05").map((c) => c.id)).toEqual(["noviembre"]);
      expect(cuotasAnulablesPorRetiro(cuotas, "2026-10-04").map((c) => c.id)).toEqual(["octubre", "noviembre"]);
    });
  });

  it("retirado_en guarda la medianoche de Lima de la fecha de retiro", () => {
    expect(instanteDeRetiro("2026-10-15").toISOString()).toBe("2026-10-15T05:00:00.000Z");
  });
});

describe("ficha de matrícula en PDF (US20)", () => {
  const completa: DatosObligatoriosFicha = {
    dni: "71234567",
    nombres: "Valeria",
    apellidos: "Quispe Rojas",
    fechaNacimiento: "2013-05-14",
    grado: "3° de secundaria",
    seccion: "B",
    fechaMatricula: "2026-03-02",
    modalidadPago: "MENSUAL",
    apoderados: 1,
    responsablePago: "Carmen Rojas Medina",
  };
  it("con todos los datos obligatorios se genera", () => {
    expect(pendientesFicha(completa)).toEqual([]);
    expect(() => verificarFichaCompleta(completa)).not.toThrow();
  });
  it("con datos pendientes: «No se puede generar la ficha: existen datos obligatorios pendientes»", () => {
    const incompleta = { ...completa, fechaNacimiento: null, responsablePago: undefined, apoderados: 0 };
    expect(pendientesFicha(incompleta)).toEqual([
      "Fecha de nacimiento",
      "Apoderado responsable del pago",
      "Apoderados",
    ]);
    expect(() => verificarFichaCompleta(incompleta)).toThrowError(
      expect.objectContaining({
        codigo: "FICHA_DATOS_PENDIENTES",
        message: "No se puede generar la ficha: existen datos obligatorios pendientes",
      }),
    );
  });
  it("solo para Matriculado y, como constancia, Retirado", () => {
    expect(() => verificarFichaDisponible("MATRICULADO")).not.toThrow();
    expect(() => verificarFichaDisponible("RETIRADO")).not.toThrow();
    expect(() => verificarFichaDisponible("EN_PROCESO")).toThrowError(codigo("FICHA_DATOS_PENDIENTES"));
    expect(() => verificarFichaDisponible("ANULADO")).toThrowError(codigo("FICHA_NO_DISPONIBLE"));
  });
});

describe("esquemas de traslado y retiro (RNF16)", () => {
  const uuid = "3f1c2a4e-1111-4b2c-9d3e-123456789abc";
  it("el traslado exige la sección destino; la fecha y el motivo son opcionales", () => {
    expect(esquemasMatricula.TrasladoSchema.safeParse({ seccionDestinoId: uuid }).success).toBe(true);
    expect(esquemasMatricula.TrasladoSchema.safeParse({}).success).toBe(false);
    expect(esquemasMatricula.TrasladoSchema.safeParse({ seccionDestinoId: uuid, fecha: "2026-02-30" }).success).toBe(
      false,
    );
  });
  it("el retiro acepta llegar sin motivo para responder el mensaje del Backlog", () => {
    expect(esquemasMatricula.RetiroSchema.safeParse({ fecha: "2026-10-15" }).success).toBe(true);
    expect(esquemasMatricula.RetiroSchema.safeParse({ motivo: "VACACIONES" }).success).toBe(false);
  });
});
