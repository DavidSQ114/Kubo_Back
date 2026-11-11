// Prueba de integración (US70, US71): aviso de la pasarela con la pasarela falsa. Firma inválida (401 en la ruta), aviso
// duplicado (un solo pago), cuota ya pagada (Observado y devolución), carrera con un pago manual (solo uno cobra la
// cuota) y conciliación de un intento pendiente.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/pasarela.integracion
// Crea sus propios datos ficticios en un año 2096 y los borra al terminar (la bitácora es inmutable y se conserva).
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/platform/db/prisma";
import {
  conciliarIntentosPendientes,
  confirmarMatricula,
  consultarIntento,
  crearIntentoPago,
  procesarOrdenPasarela,
  registrarDevolucion,
  registrarPago,
} from "@/modules/matricula";
import { simularPagoFalso } from "@/modules/matricula/infrastructure/pasarela";
import { POST as avisoPasarela } from "@/app/api/v1/matricula/pagos/webhooks/pasarela/route";
import type { Autenticado } from "@/modules/identidad";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2096;
const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const meta = { requestId: "prueba-pasarela", ip: null, userAgent: null };
const URL_BASE = "http://localhost:3000";
const ONCE_MINUTOS_MS = 11 * 60_000;

// la pasarela falsa se configura antes de cualquier consulta (la configuración se lee en cada llamada)
process.env.PASARELA = "falsa";
process.env.MP_WEBHOOK_SECRET = "secreto-de-prueba-integracion-0123";

const sesion = (usuarioId: string, personaId: string, rol: Autenticado["rol"]): Autenticado => ({
  usuarioId,
  sesionId: "prueba",
  personaId,
  email: "prueba@kubo.test",
  rol,
  debeCambiarPassword: false,
});

describe.skipIf(!ACTIVA)("aviso de la pasarela y conciliación (US70, US71)", () => {
  let admin: Autenticado;
  let apoderado: Autenticado;
  let anioId: string;
  let estudianteId: string;
  const personas: string[] = [];
  let usuarioApoderadoId: string;
  let cuotas: { id: string; monto: string }[] = [];

  beforeAll(async () => {
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    admin = sesion(u.id, u.personaId, "ADMINISTRADOR");
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 3 } });
    const anio = await prisma.anioAcademico.create({
      data: {
        anio: ANIO,
        fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
        fechaFin: new Date(`${ANIO}-12-15T00:00:00Z`),
        estado: "EN_MATRICULA",
      },
    });
    anioId = anio.id;
    for (const [clave, valor] of [
      ["MONTO_MATRICULA", "300.00"],
      ["MONTO_PENSION", "400.00"],
    ]) {
      await prisma.parametroInstitucion.create({
        data: { anioAcademicoId: anioId, clave, valor, actualizadoPorId: u.id },
      });
    }
    const seccion = await prisma.seccion.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "W", aforoMaximo: 5 },
    });
    const ap = await prisma.persona.create({
      data: { dni: "90000061", nombres: "Prueba", apellidos: "Apoderado Pasarela", apoderado: { create: {} } },
      include: { apoderado: true },
    });
    const es = await prisma.persona.create({
      data: {
        dni: "90000062",
        nombres: "Prueba",
        apellidos: "Estudiante Pasarela",
        estudiante: { create: { gradoIngresoId: grado.id } },
      },
      include: { estudiante: true },
    });
    personas.push(ap.id, es.id);
    const usuario = await prisma.usuario.create({
      data: { personaId: ap.id, email: "apoderado.pasarela@kubo.test", passwordHash: "-", estado: "ACTIVO" },
    });
    usuarioApoderadoId = usuario.id;
    apoderado = sesion(usuario.id, ap.id, "APODERADO");
    estudianteId = es.estudiante!.id;
    const v = await prisma.vinculoApoderado.create({
      data: { estudianteId, apoderadoId: ap.apoderado!.id, parentesco: "Padre", esPrincipal: true },
    });
    const m = await confirmarMatricula(
      admin,
      {
        estudianteId,
        anioAcademicoId: anioId,
        seccionId: seccion.id,
        vinculoResponsableId: v.id,
        modalidadPago: "MENSUAL",
      },
      meta,
    );
    cuotas = m.cronograma.cuotas.filter((c) => c.tipo === "PENSION").map((c) => ({ id: c.id!, monto: c.monto }));
  });

  afterAll(async () => {
    if (!anioId) return;
    const matriculas = { matricula: { anioAcademicoId: anioId } };
    await prisma.intentoPago.deleteMany({ where: matriculas });
    const ops = await prisma.operacionPago.findMany({
      where: { pagos: { some: { conceptoCobro: matriculas } } },
      select: { id: true },
    });
    const ids = ops.map((o) => o.id);
    await prisma.comprobante.deleteMany({ where: { operacionPagoId: { in: ids } } });
    await prisma.operacionPago.deleteMany({ where: { id: { in: ids } } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioApoderadoId } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  });

  /** Crea un intento para la cuota y devuelve el id de la order falsa. */
  async function intentoPara(cuota: { id: string }) {
    const r = await crearIntentoPago(apoderado, { estudianteId, conceptoIds: [cuota.id], urlBase: URL_BASE });
    const intento = await prisma.intentoPago.findUniqueOrThrow({ where: { id: r.intentoId } });
    return { intentoId: r.intentoId, ordenId: intento.ordenExternaId!, urlCheckout: r.urlCheckout };
  }

  const operacionesDe = (ordenId: string) => prisma.operacionPago.findMany({ where: { referenciaExterna: ordenId } });

  it("la ruta del webhook responde 401 con una firma inválida y no registra nada", async () => {
    const { ordenId } = await intentoPara(cuotas[0]);
    simularPagoFalso(ordenId, "APROBADO");
    const req = new NextRequest(`${URL_BASE}/api/v1/matricula/pagos/webhooks/pasarela?data.id=${ordenId}&type=order`, {
      method: "POST",
      headers: { "x-signature": "ts=1742505638,v1=firma-falsa", "x-request-id": "req-falso" },
      body: JSON.stringify({ type: "order", action: "order.processed", data: { id: ordenId } }),
    });
    const res = await avisoPasarela(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("FIRMA_INVALIDA");
    expect(await operacionesDe(ordenId)).toHaveLength(0);
  });

  it("un aviso duplicado (también simultáneo) registra el pago una sola vez", async () => {
    const { intentoId, ordenId } = await intentoPara(cuotas[1]);
    simularPagoFalso(ordenId, "APROBADO");
    const resultados = await Promise.all([
      procesarOrdenPasarela(ordenId, meta),
      procesarOrdenPasarela(ordenId, meta),
      procesarOrdenPasarela(ordenId, meta),
    ]);
    expect(resultados.filter((r) => r === "REGISTRADO")).toHaveLength(1);
    expect(await procesarOrdenPasarela(ordenId, meta)).toBe("REPETIDO");
    const ops = await operacionesDe(ordenId);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      estado: "CONFIRMADO",
      origen: "PASARELA",
      medioPago: "PASARELA",
      registradoPorId: null,
    });
    const cuota = await prisma.conceptoCobro.findUniqueOrThrow({ where: { id: cuotas[1].id } });
    expect(cuota.estado).toBe("PAGADO");
    const intento = await consultarIntento(apoderado, intentoId, meta);
    expect(intento.estado).toBe("APROBADO");
    expect(intento.comprobante).toMatch(/^R-\d{4}-\d{6}$/);
    const auditoria = await prisma.registroAuditoria.findFirstOrThrow({
      where: { entidadId: ops[0].id, accion: "REGISTRAR_PAGO" },
    });
    expect(auditoria.usuarioId).toBeNull();
    expect(auditoria.valorNuevo).toMatchObject({ actor: "SISTEMA", origen: "PASARELA" });
  });

  it("si la cuota ya se pagó por otro medio, queda Observado y tesorería registra la devolución", async () => {
    const cuota = cuotas[2];
    const { intentoId, ordenId } = await intentoPara(cuota);
    await registrarPago(
      admin,
      {
        conceptoIds: [cuota.id],
        monto: cuota.monto,
        medioPago: "EFECTIVO",
        numeroOperacion: "PAS-EFE-1",
        fechaPago: HOY,
      },
      meta,
    );
    simularPagoFalso(ordenId, "APROBADO");
    expect(await procesarOrdenPasarela(ordenId, meta)).toBe("OBSERVADO");
    const [op] = await operacionesDe(ordenId);
    expect(op).toMatchObject({ estado: "OBSERVADO", motivoObservacion: "Cuota pagada por otro medio" });
    expect((await consultarIntento(apoderado, intentoId, meta)).estado).toBe("OBSERVADO");

    const r = await registrarDevolucion(admin, op.id, { detalle: "Devolución ficticia" }, meta);
    expect(r.operacion).toMatchObject({ estado: "ANULADO", anulacion: { motivo: "DEVUELTO" } });
    const evento = await prisma.registroAuditoria.findFirstOrThrow({
      where: { entidadId: op.id, accion: "REGISTRAR_DEVOLUCION" },
    });
    expect(evento.motivo).toBe("Devuelto: Devolución ficticia");
    await expect(registrarDevolucion(admin, op.id, {}, meta)).rejects.toMatchObject({
      codigo: "DEVOLUCION_NO_PERMITIDA",
    });
  });

  it("en una carrera con un pago manual, solo uno cobra la cuota", async () => {
    const cuota = cuotas[3];
    const { ordenId } = await intentoPara(cuota);
    simularPagoFalso(ordenId, "APROBADO");
    const [manual, enLinea] = await Promise.allSettled([
      registrarPago(
        admin,
        {
          conceptoIds: [cuota.id],
          monto: cuota.monto,
          medioPago: "EFECTIVO",
          numeroOperacion: "PAS-EFE-2",
          fechaPago: HOY,
        },
        meta,
      ),
      procesarOrdenPasarela(ordenId, meta),
    ]);
    const confirmadas = await prisma.operacionPago.count({
      where: { estado: "CONFIRMADO", pagos: { some: { conceptoCobroId: cuota.id } } },
    });
    expect(confirmadas).toBe(1);
    const [op] = await operacionesDe(ordenId);
    if (manual.status === "fulfilled") {
      expect(op).toMatchObject({ estado: "OBSERVADO", motivoObservacion: "Cuota pagada por otro medio" });
    } else {
      expect(manual.reason).toMatchObject({ codigo: "CUOTA_YA_PAGADA" });
      expect(enLinea).toMatchObject({ status: "fulfilled", value: "REGISTRADO" });
      expect(op.estado).toBe("CONFIRMADO");
    }
  });

  it("la conciliación registra un intento pendiente de más de 10 minutos y expira los vencidos sin pago", async () => {
    const aprobado = await intentoPara(cuotas[4]);
    const sinPago = await intentoPara(cuotas[5]);
    const antes = new Date(Date.now() - ONCE_MINUTOS_MS);
    await prisma.intentoPago.updateMany({
      where: { id: { in: [aprobado.intentoId, sinPago.intentoId] } },
      data: { createdAt: antes, expiraEn: antes },
    });
    simularPagoFalso(aprobado.ordenId, "APROBADO");
    const resumen = await conciliarIntentosPendientes();
    expect(resumen.revisados).toBeGreaterThanOrEqual(2);
    expect((await consultarIntento(apoderado, aprobado.intentoId, meta)).estado).toBe("APROBADO");
    expect((await consultarIntento(apoderado, sinPago.intentoId, meta)).estado).toBe("EXPIRADO");
  });

  it("un pago acreditado por otro monto no se registra y el intento queda en revisión", async () => {
    const { intentoId, ordenId } = await intentoPara(cuotas[6]);
    simularPagoFalso(ordenId, "APROBADO", 100);
    expect(await procesarOrdenPasarela(ordenId, meta)).toBe("OBSERVADO");
    expect(await operacionesDe(ordenId)).toHaveLength(0);
    expect((await consultarIntento(apoderado, intentoId, meta)).estado).toBe("OBSERVADO");
  });

  it("un apoderado no consulta el intento de otro", async () => {
    const { intentoId } = await intentoPara(cuotas[7]);
    await expect(consultarIntento(admin, intentoId, meta)).rejects.toMatchObject({ codigo: "INTENTO_NO_ENCONTRADO" });
  });
});
