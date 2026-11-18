// Pruebas de las reglas de los recordatorios de pago a apoderados morosos (US59, AD-12, M-24).
import { describe, expect, it } from "vitest";
import { motivoDeOmision, textoRecordatorio } from "@/modules/matricula/domain/recordatorios";

const HOY = "2026-10-12";

describe("a quién se omite el recordatorio (US59, criterio 3)", () => {
  it("con cuotas vencidas y un apoderado con cuenta o correo, se envía", () => {
    expect(motivoDeOmision({ cuotasVencidas: 2, tieneCuenta: true, tieneCorreo: true })).toBeNull();
    expect(motivoDeOmision({ cuotasVencidas: 1, tieneCuenta: false, tieneCorreo: true })).toBeNull();
    expect(motivoDeOmision({ cuotasVencidas: 1, tieneCuenta: true, tieneCorreo: false })).toBeNull();
  });

  it("quien ya no tiene cuotas vencidas no recibe el recordatorio", () => {
    expect(motivoDeOmision({ cuotasVencidas: 0, tieneCuenta: true, tieneCorreo: true })).toBe("SIN_CUOTAS_VENCIDAS");
  });

  it("sin cuenta ni correo del apoderado responsable no hay a quién enviarlo", () => {
    expect(motivoDeOmision({ cuotasVencidas: 3, tieneCuenta: false, tieneCorreo: false })).toBe("SIN_DESTINATARIO");
  });
});

describe("detalle de la deuda en la notificación y el correo (US59, criterio 1)", () => {
  const datos = {
    apoderado: "Carmen",
    estudiante: "Valeria Quispe Rojas",
    cuotas: [
      { concepto: "Pensión de setiembre", monto: "450.00", fechaVencimiento: "2026-09-30" },
      { concepto: "Pensión de agosto", monto: "450.00", fechaVencimiento: "2026-08-31" },
    ],
    total: "900.00",
    hoy: HOY,
  };

  it("resume la deuda con los días de atraso desde el primer vencimiento", () => {
    const t = textoRecordatorio(datos);
    expect(t.titulo).toBe("Recordatorio de pago");
    expect(t.mensaje).toBe("Valeria: 2 cuotas vencidas · S/ 900.00 · 42 días de atraso");
    expect(t.diasAtraso).toBe(42);
    expect(t.asunto).toBe("Kubo · Recordatorio de pago de Valeria Quispe Rojas");
  });

  it("el correo lista cada cuota vencida con su monto y sus días de atraso, de la más antigua a la más reciente", () => {
    const { cuerpo } = textoRecordatorio(datos);
    expect(cuerpo).toContain("Hola, Carmen:");
    expect(cuerpo).toContain("Valeria Quispe Rojas tiene 2 cuotas vencidas por un total de S/ 900.00:");
    const agosto = cuerpo.indexOf("- Pensión de agosto · venció el 31/08/2026 · S/ 450.00 · 42 días de atraso");
    const setiembre = cuerpo.indexOf("- Pensión de setiembre · venció el 30/09/2026 · S/ 450.00 · 12 días de atraso");
    expect(agosto).toBeGreaterThan(0);
    expect(setiembre).toBeGreaterThan(agosto);
  });

  it("usa el singular con una sola cuota y un solo día de atraso", () => {
    const t = textoRecordatorio({
      ...datos,
      cuotas: [{ concepto: "Pensión de octubre", monto: "450.00", fechaVencimiento: "2026-10-11" }],
      total: "450.00",
    });
    expect(t.mensaje).toBe("Valeria: 1 cuota vencida · S/ 450.00 · 1 día de atraso");
    expect(t.cuerpo).toContain("1 día de atraso");
  });
});
