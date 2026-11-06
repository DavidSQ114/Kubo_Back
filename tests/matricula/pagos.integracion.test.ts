// Prueba de integración (US23, US25): pagos simultáneos. Dos pagos de la misma cuota: solo uno pasa. Dos pagos con
// el mismo número de operación: uno queda Observado. Dos pagos distintos a la vez: correlativos seguidos y sin huecos.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/pagos.integracion
// Crea sus propios datos ficticios en un año 2094 y los borra al terminar (la bitácora es inmutable y se conserva).
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { confirmarMatricula, registrarPago } from "@/modules/matricula";
import type { Autenticado } from "@/modules/identidad";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2094;
const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const meta = { requestId: "prueba-pagos-concurrentes", ip: null, userAgent: null };

describe.skipIf(!ACTIVA)("pagos simultáneos (US23, US25)", () => {
  let admin: Autenticado;
  let anioId: string;
  const personas: string[] = [];
  let pensiones: { id: string; monto: string }[] = [];

  beforeAll(async () => {
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    admin = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "ADMINISTRADOR",
      debeCambiarPassword: false,
    };
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 1 } });
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
      data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "P", aforoMaximo: 5 },
    });
    const apoderado = await prisma.persona.create({
      data: { dni: "90000031", nombres: "Prueba", apellidos: "Apoderado Pagos", apoderado: { create: {} } },
      include: { apoderado: true },
    });
    const p = await prisma.persona.create({
      data: {
        dni: "90000032",
        nombres: "Prueba",
        apellidos: "Estudiante Pagos",
        estudiante: { create: { gradoIngresoId: grado.id } },
      },
      include: { estudiante: true },
    });
    personas.push(apoderado.id, p.id);
    const v = await prisma.vinculoApoderado.create({
      data: {
        estudianteId: p.estudiante!.id,
        apoderadoId: apoderado.apoderado!.id,
        parentesco: "Madre",
        esPrincipal: true,
      },
    });
    const m = await confirmarMatricula(
      admin,
      {
        estudianteId: p.estudiante!.id,
        anioAcademicoId: anioId,
        seccionId: seccion.id,
        vinculoResponsableId: v.id,
        modalidadPago: "MENSUAL",
      },
      meta,
    );
    pensiones = m.cronograma.cuotas.filter((c) => c.tipo === "PENSION").map((c) => ({ id: c.id!, monto: c.monto }));
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
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  });

  const pagar = (cuota: { id: string; monto: string }, numero: string) =>
    registrarPago(
      admin,
      {
        conceptoIds: [cuota.id],
        monto: cuota.monto,
        medioPago: "TRANSFERENCIA",
        numeroOperacion: numero,
        fechaPago: HOY,
      },
      meta,
    );

  it("dos pagos simultáneos de la misma cuota: uno pasa y el otro recibe «Esta pensión ya fue cancelada el …»", async () => {
    const r = await Promise.allSettled([pagar(pensiones[0], "PRUEBA-A1"), pagar(pensiones[0], "PRUEBA-A2")]);
    const rechazados = r.filter((x): x is PromiseRejectedResult => x.status === "rejected");
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(rechazados).toHaveLength(1);
    expect(rechazados[0].reason).toMatchObject({ codigo: "CUOTA_YA_PAGADA" });
    expect(String(rechazados[0].reason.message)).toMatch(/^Esta pensión ya fue cancelada el \d{2}\/\d{2}\/\d{4}$/);
    expect(await prisma.pago.count({ where: { conceptoCobroId: pensiones[0].id } })).toBe(1);
  });

  it("dos pagos simultáneos con el mismo número de operación: uno Confirmado y otro Observado", async () => {
    const r = await Promise.all([pagar(pensiones[1], "PRUEBA-B"), pagar(pensiones[2], "PRUEBA-B")]);
    expect(r.map((x) => x.operacion.estado).sort()).toEqual(["CONFIRMADO", "OBSERVADO"]);
    const observado = r.find((x) => x.operacion.estado === "OBSERVADO")!;
    expect(observado.aviso).toBe("Este número de operación ya fue utilizado en otro pago");
    expect(observado.operacion.comprobante).toBeNull();
  });

  it("dos pagos simultáneos distintos: comprobantes con correlativos seguidos y sin repetir", async () => {
    const r = await Promise.all([pagar(pensiones[3], "PRUEBA-C1"), pagar(pensiones[4], "PRUEBA-C2")]);
    const numeros = r.map((x) => x.operacion.comprobante!.numero).sort();
    const [a, b] = numeros.map((n) => Number(n.split("-")[2]));
    expect(numeros[0]).toMatch(/^R-\d{4}-\d{6}$/);
    expect(b - a).toBe(1);
  });
});
