// Prueba de integración del bloque M4 (fases 1 a 4): cuota de ingreso del alumno nuevo, orden de pago con ingreso y
// mora, mora idempotente (también condonada y con monto 0) y lote de cuotas extraordinarias con vista previa, avisos
// y anulación.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/cuotasM4.integracion
// Crea sus propios datos ficticios en el año 2074 (DNI 900026xx) y los borra al terminar. Lo auditado lo firma el
// administrador del seed (la bitácora es inmutable y no deja borrar a su actor).
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import type { Autenticado } from "@/modules/identidad";
import {
  anularCuotaExtraordinaria,
  anularLote,
  condonarMora,
  confirmarMatricula,
  crearLote,
  generarMoras,
  registrarPago,
  vistaPreviaLote,
} from "@/modules/matricula";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2074;
const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const meta = { requestId: `prueba-cuotas-m4-${Date.now()}`, ip: null, userAgent: null };

interface Cuota {
  id: string;
  tipo: string;
  monto: string;
  concepto: string;
  fechaVencimiento: string;
}

const error = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    return e as { codigo: string; message: string };
  }
  throw new Error("Se esperaba un error");
};

describe.skipIf(!ACTIVA)("cuotas de ingreso, mora y extraordinarias (bloque M4)", () => {
  let admin: Autenticado;
  let anioId: string;
  let seccionId: string;
  let usuarioApoderado: string;
  const personas: string[] = [];
  const matriculas: string[] = [];
  let cuotas: Cuota[] = [];
  let numero = 0;

  const pagar = (lista: Cuota[]) =>
    registrarPago(
      admin,
      {
        conceptoIds: lista.map((c) => c.id),
        monto: (lista.reduce((t, c) => t + Math.round(Number(c.monto) * 100), 0) / 100).toFixed(2),
        medioPago: "TRANSFERENCIA",
        numeroOperacion: `M4-${Date.now()}-${++numero}`,
        fechaPago: HOY,
      },
      meta,
    );
  const deTipo = (tipo: string) => cuotas.filter((c) => c.tipo === tipo);
  const cuotasDe = async (matriculaId: string) =>
    (await prisma.conceptoCobro.findMany({ where: { matriculaId }, orderBy: [{ fechaVencimiento: "asc" }] })).map(
      (c) => ({
        id: c.id,
        tipo: c.tipo,
        monto: c.monto.toFixed(2),
        concepto: c.concepto,
        fechaVencimiento: c.fechaVencimiento.toISOString().slice(0, 10),
        estado: c.estado,
        cuotaOrigenId: c.cuotaOrigenId,
      }),
    );
  const parametro = (clave: string, valor: string) =>
    prisma.parametroInstitucion.upsert({
      where: { clave_anioAcademicoId: { clave, anioAcademicoId: anioId } },
      create: { anioAcademicoId: anioId, clave, valor, actualizadoPorId: admin.usuarioId },
      update: { valor },
    });

  beforeAll(async () => {
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    admin = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "COORDINADOR",
      debeCambiarPassword: false,
    };
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 3 } });
    anioId = (
      await prisma.anioAcademico.create({
        data: {
          anio: ANIO,
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-12-15T00:00:00Z`),
          estado: "EN_MATRICULA",
        },
      })
    ).id;
    for (const [clave, valor] of [
      ["MONTO_MATRICULA", "300.00"],
      ["MONTO_PENSION", "400.00"],
      ["MONTO_INGRESO", "150.00"],
      ["MONTO_MORA", "20.00"],
    ]) {
      await parametro(clave, valor);
    }
    seccionId = (
      await prisma.seccion.create({ data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "M", aforoMaximo: 5 } })
    ).id;
    const apoderado = await prisma.persona.create({
      data: {
        dni: "90002601",
        nombres: "Prueba",
        apellidos: "Apoderada Cuotas",
        email: "90002601@prueba.kubo.test",
        apoderado: { create: {} },
      },
      include: { apoderado: true },
    });
    personas.push(apoderado.id);
    usuarioApoderado = (
      await prisma.usuario.create({
        data: {
          personaId: apoderado.id,
          email: apoderado.email!,
          passwordHash: "sin-acceso",
          estado: "ACTIVO",
          debeCambiarPassword: false,
        },
      })
    ).id;
    for (const [dni, nombre] of [
      ["90002602", "Lucas"],
      ["90002603", "Mara"],
    ]) {
      const e = await prisma.persona.create({
        data: {
          dni,
          nombres: nombre,
          apellidos: "Cuotas Prueba",
          estudiante: { create: { gradoIngresoId: grado.id } },
        },
        include: { estudiante: true },
      });
      personas.push(e.id);
      const v = await prisma.vinculoApoderado.create({
        data: {
          estudianteId: e.estudiante!.id,
          apoderadoId: apoderado.apoderado!.id,
          parentesco: "Madre",
          esPrincipal: true,
        },
      });
      const m = await confirmarMatricula(
        admin,
        {
          estudianteId: e.estudiante!.id,
          anioAcademicoId: anioId,
          seccionId,
          vinculoResponsableId: v.id,
          modalidadPago: "MENSUAL",
        },
        meta,
      );
      matriculas.push(m.matriculaId);
    }
    cuotas = await cuotasDe(matriculas[0]);
  });

  afterAll(async () => {
    if (!anioId) return;
    const ops = await prisma.operacionPago.findMany({
      where: { pagos: { some: { conceptoCobro: { matricula: { anioAcademicoId: anioId } } } } },
      select: { id: true },
    });
    const ids = ops.map((o) => o.id);
    await prisma.comprobante.deleteMany({ where: { operacionPagoId: { in: ids } } });
    await prisma.operacionPago.deleteMany({ where: { id: { in: ids } } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.loteCuotaExtraordinaria.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.notificacion.deleteMany({ where: { usuarioId: usuarioApoderado } });
    await prisma.usuario.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  });

  it("al alumno nuevo se le genera la cuota de ingreso con el vencimiento de la matrícula", () => {
    const [ingreso] = deTipo("INGRESO");
    expect(ingreso).toMatchObject({ concepto: `Cuota de ingreso ${ANIO}`, monto: "150.00" });
    expect(ingreso.fechaVencimiento).toBe(deTipo("MATRICULA")[0].fechaVencimiento);
  });

  it("la matrícula sin la cuota de ingreso responde INGRESO_CON_MATRICULA; juntas se pagan", async () => {
    const e = await error(() => pagar(deTipo("MATRICULA")));
    expect(e.codigo).toBe("INGRESO_CON_MATRICULA");
    const r = await pagar([...deTipo("MATRICULA"), ...deTipo("INGRESO")]);
    expect(r.operacion.estado).toBe("CONFIRMADO");
  });

  it("genera una mora por pensión vencida y no la duplica al correr otra vez", async () => {
    const [primera] = deTipo("PENSION");
    await prisma.conceptoCobro.update({
      where: { id: primera.id },
      data: { fechaVencimiento: new Date("2026-09-05T00:00:00Z") },
    });
    await generarMoras();
    await generarMoras();
    const moras = (await cuotasDe(matriculas[0])).filter((c) => c.tipo === "MORA");
    expect(moras).toHaveLength(1);
    expect(moras[0]).toMatchObject({ monto: "20.00", fechaVencimiento: HOY, cuotaOrigenId: primera.id });
    cuotas = await cuotasDe(matriculas[0]);
  });

  it("la pensión sin su mora responde MORA_CON_PENSION; juntas se pagan", async () => {
    const [pension] = deTipo("PENSION");
    const [mora] = deTipo("MORA");
    expect((await error(() => pagar([pension]))).codigo).toBe("MORA_CON_PENSION");
    expect((await error(() => pagar([mora]))).codigo).toBe("MORA_CON_PENSION");
    expect((await pagar([pension, mora])).operacion.estado).toBe("CONFIRMADO");
  });

  it("una mora condonada no se vuelve a generar y con monto 0 no se generan moras", async () => {
    const pensiones = deTipo("PENSION");
    await prisma.conceptoCobro.update({
      where: { id: pensiones[1].id },
      data: { fechaVencimiento: new Date("2026-10-05T00:00:00Z") },
    });
    await generarMoras();
    const mora = (await cuotasDe(matriculas[0])).find((c) => c.tipo === "MORA" && c.cuotaOrigenId === pensiones[1].id)!;
    const r = await condonarMora(admin, mora.id, { motivo: "Acuerdo con la familia" }, meta);
    expect(r.estado).toBe("ANULADO");
    expect((await error(() => condonarMora(admin, mora.id, { motivo: "otra vez" }, meta))).codigo).toBe(
      "MORA_YA_CONDONADA",
    );
    await generarMoras();
    const deLaPension = (await cuotasDe(matriculas[0])).filter((c) => c.cuotaOrigenId === pensiones[1].id);
    expect(deLaPension).toHaveLength(1);
    expect(deLaPension[0].estado).toBe("ANULADO");

    await parametro("MONTO_MORA", "0.00");
    await prisma.conceptoCobro.update({
      where: { id: pensiones[2].id },
      data: { fechaVencimiento: new Date("2026-10-05T00:00:00Z") },
    });
    await generarMoras();
    expect((await cuotasDe(matriculas[0])).filter((c) => c.cuotaOrigenId === pensiones[2].id)).toHaveLength(0);
  });

  it("el lote extraordinario muestra la vista previa, genera una cuota por matrícula y avisa al apoderado", async () => {
    const datos = {
      anioAcademicoId: anioId,
      concepto: "Paseo de prueba",
      monto: "45.50",
      fechaVencimiento: HOY,
      destino: "SECCION" as const,
      destinoId: seccionId,
    };
    const previa = await vistaPreviaLote(datos);
    expect(previa).toMatchObject({ cantidad: 2, total: "91.00", destinoNombre: "3° M" });
    const antes = await prisma.notificacion.count({ where: { usuarioId: usuarioApoderado } });
    const lote = await crearLote(admin, datos, meta);
    expect(lote.resumen).toMatchObject({ cuotas: 2, pendientes: 2, total: "91.00" });
    expect(await prisma.notificacion.count({ where: { usuarioId: usuarioApoderado } })).toBe(antes + 2);

    // la extraordinaria no entra en el orden: se paga sola aunque haya pensiones pendientes
    const extra = (await cuotasDe(matriculas[0])).find((c) => c.tipo === "EXTRAORDINARIA")!;
    expect((await pagar([extra])).operacion.estado).toBe("CONFIRMADO");

    const anulado = await anularLote(admin, lote.loteId, { motivo: "Actividad cancelada" }, meta);
    expect(anulado.estado).toBe("ANULADO");
    expect(anulado.resumen).toMatchObject({ pagadas: 1, anuladas: 1 });
    expect((await error(() => anularLote(admin, lote.loteId, { motivo: "otra vez" }, meta))).codigo).toBe(
      "LOTE_YA_ANULADO",
    );
    expect((await error(() => anularCuotaExtraordinaria(admin, extra.id, { motivo: "ya pagada" }, meta))).codigo).toBe(
      "CUOTA_PAGADA",
    );
  });

  it("un lote sin alumnos matriculados en el destino responde LOTE_SIN_MATRICULAS", async () => {
    const grado4 = await prisma.grado.findFirstOrThrow({ where: { numero: 4 } });
    const e = await error(() =>
      vistaPreviaLote({
        anioAcademicoId: anioId,
        concepto: "Sin alumnos",
        monto: "10.00",
        fechaVencimiento: HOY,
        destino: "GRADO",
        destinoId: grado4.id,
      }),
    );
    expect(e.codigo).toBe("LOTE_SIN_MATRICULAS");
  });
});
