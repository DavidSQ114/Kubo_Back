// Prueba de integración de los datos de demostración de morosidad (US24, US26, US59; scripts/demoMorosidad.ts):
// agrega las pensiones que faltan, es idempotente y se niega si alguna cuota tiene pagos.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/demoMorosidad
// Crea sus propios datos ficticios en un año 2084 En curso y los borra al terminar (la bitácora se conserva).
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { prepararDemoMorosidad } from "@/modules/matricula";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2084;
const HOY = `${ANIO}-11-18`;
const DESDE = `${ANIO}-09-01`;
const DNI_SIN_PAGOS = "90001501";
const DNI_CON_PAGOS = "90001502";
const DNI_APODERADO = "90001503";
const fecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);

describe.skipIf(!ACTIVA)("datos de demostración de morosidad (US24, US26, US59)", () => {
  let anioId: string;
  let adminId: string;
  let seccionId: string;
  let apoderadoId: string;
  const personas: string[] = [];
  const matriculas: Record<string, string> = {};

  /** Matrícula confirmada el 18/11: cuota de matrícula y pensión de diciembre, que vence el día 7. */
  async function estudianteMatriculado(dni: string, gradoId: string) {
    const p = await prisma.persona.create({
      data: {
        dni,
        nombres: "Prueba",
        apellidos: `Estudiante Demo ${dni}`,
        estudiante: { create: { gradoIngresoId: gradoId } },
      },
      include: { estudiante: true },
    });
    personas.push(p.id);
    const vinculo = await prisma.vinculoApoderado.create({
      data: { estudianteId: p.estudiante!.id, apoderadoId, parentesco: "Madre", esPrincipal: true },
    });
    const m = await prisma.matricula.create({
      data: {
        estudianteId: p.estudiante!.id,
        anioAcademicoId: anioId,
        seccionId,
        vinculoResponsableId: vinculo.id,
        registradoPorId: adminId,
        estado: "MATRICULADO",
        fechaMatricula: fecha(HOY),
        conceptosCobro: {
          create: [
            { tipo: "MATRICULA", concepto: `Matrícula ${ANIO}`, monto: "300.00", fechaVencimiento: fecha(HOY) },
            {
              tipo: "PENSION",
              mes: 12,
              concepto: `Pensión de diciembre ${ANIO}`,
              monto: "400.00",
              fechaVencimiento: fecha(`${ANIO}-12-07`),
            },
          ],
        },
      },
      include: { conceptosCobro: true },
    });
    matriculas[dni] = m.id;
    return m;
  }

  beforeAll(async () => {
    adminId = (await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } })).id;
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 1 } });
    anioId = (
      await prisma.anioAcademico.create({
        data: { anio: ANIO, fechaInicio: fecha(`${ANIO}-03-01`), fechaFin: fecha(`${ANIO}-12-15`), estado: "EN_CURSO" },
      })
    ).id;
    seccionId = (
      await prisma.seccion.create({ data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "D", aforoMaximo: 5 } })
    ).id;
    const apoderado = await prisma.persona.create({
      data: { dni: DNI_APODERADO, nombres: "Prueba", apellidos: "Apoderado Demo", apoderado: { create: {} } },
      include: { apoderado: true },
    });
    personas.push(apoderado.id);
    apoderadoId = apoderado.apoderado!.id;
    await estudianteMatriculado(DNI_SIN_PAGOS, grado.id);
    const conPagos = await estudianteMatriculado(DNI_CON_PAGOS, grado.id);
    const cuotaMatricula = conPagos.conceptosCobro.find((c) => c.tipo === "MATRICULA")!;
    await prisma.operacionPago.create({
      data: {
        numeroOperacion: "PRUEBA-DEMO-1",
        medioPago: "TRANSFERENCIA",
        fechaPago: new Date(),
        montoTotal: "300.00",
        estado: "CONFIRMADO",
        registradoPorId: adminId,
        pagos: { create: { conceptoCobroId: cuotaMatricula.id, montoAplicado: "300.00" } },
      },
    });
    await prisma.conceptoCobro.update({ where: { id: cuotaMatricula.id }, data: { estado: "PAGADO" } });
  });

  afterAll(async () => {
    if (!anioId) return;
    await prisma.operacionPago.deleteMany({ where: { numeroOperacion: "PRUEBA-DEMO-1" } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  });

  it("adelanta la fecha y agrega setiembre, octubre y noviembre con el mismo día y monto", async () => {
    const r = await prepararDemoMorosidad({ dni: DNI_SIN_PAGOS, desde: DESDE }, HOY);
    expect(r.huboCambios).toBe(true);
    expect(r.fechaAnterior).toBe(HOY);
    expect(r.dniEnmascarado).toBe("******01");
    expect(r.pensionesAgregadas.map((p) => [p.fechaVencimiento, p.monto])).toEqual([
      [`${ANIO}-09-07`, "400.00"],
      [`${ANIO}-10-07`, "400.00"],
      [`${ANIO}-11-07`, "400.00"],
    ]);
    expect(r.pensionesVencidas).toBe(3);

    const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculas[DNI_SIN_PAGOS] } });
    expect(m.fechaMatricula.toISOString().slice(0, 10)).toBe(DESDE);
    const cuotaMatricula = await prisma.conceptoCobro.findFirstOrThrow({
      where: { matriculaId: m.id, tipo: "MATRICULA" },
    });
    // D-14: la cuota de matrícula pasa a vencer el día de la matrícula, antes que las pensiones agregadas
    expect(cuotaMatricula.fechaVencimiento.toISOString().slice(0, 10)).toBe(DESDE);
    const auditoria = await prisma.registroAuditoria.findMany({ where: { entidadId: m.id, accion: "DATOS_DEMO" } });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].valorAnterior).toEqual({ fechaMatricula: HOY, vencimientoCuotaMatricula: HOY });
    expect(auditoria[0].valorNuevo).toMatchObject({
      dni: "******01",
      fechaMatricula: DESDE,
      vencimientoCuotaMatricula: DESDE,
    });
  });

  it("es idempotente: la segunda ejecución no duplica pensiones ni auditoría", async () => {
    const r = await prepararDemoMorosidad({ dni: DNI_SIN_PAGOS, desde: DESDE }, HOY);
    expect(r.huboCambios).toBe(false);
    expect(r.pensionesAgregadas).toEqual([]);
    const id = matriculas[DNI_SIN_PAGOS];
    expect(await prisma.conceptoCobro.count({ where: { matriculaId: id, tipo: "PENSION" } })).toBe(4);
    expect(await prisma.registroAuditoria.count({ where: { entidadId: id, accion: "DATOS_DEMO" } })).toBe(1);
  });

  it("se niega si alguna cuota ya tiene pagos y no cambia nada", async () => {
    await expect(prepararDemoMorosidad({ dni: DNI_CON_PAGOS, desde: DESDE }, HOY)).rejects.toMatchObject({
      codigo: "DEMO_CUOTAS_CON_PAGOS",
    });
    const id = matriculas[DNI_CON_PAGOS];
    const m = await prisma.matricula.findUniqueOrThrow({ where: { id } });
    expect(m.fechaMatricula.toISOString().slice(0, 10)).toBe(HOY);
    expect(await prisma.conceptoCobro.count({ where: { matriculaId: id, tipo: "PENSION" } })).toBe(1);
  });

  it("se niega si el DNI no es de un estudiante", async () => {
    await expect(prepararDemoMorosidad({ dni: DNI_APODERADO, desde: DESDE }, HOY)).rejects.toMatchObject({
      codigo: "DEMO_NO_ES_ESTUDIANTE",
    });
  });
});
