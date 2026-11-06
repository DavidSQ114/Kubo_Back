// Prueba de integración (US42, US44): el portal del apoderado autoriza por vínculo (IDOR). Dos familias ficticias con
// un hijo cada una: un apoderado no ve, no elige ni descarga nada del hijo de la otra aunque use su id real.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/portalApoderado
// Crea sus propios datos en un año 2095 y los borra al terminar (la bitácora es inmutable y se conserva).
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import {
  comprobanteDeCuota,
  confirmarMatricula,
  elegirHijo,
  hijosDelApoderado,
  pagosDelHijo,
} from "@/modules/matricula";
import type { Autenticado } from "@/modules/identidad";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2095;
const meta = { requestId: "prueba-portal-apoderado", ip: null, userAgent: null };

const sesionDe = (personaId: string, rol: Autenticado["rol"], usuarioId = `usuario-${personaId}`): Autenticado => ({
  usuarioId,
  sesionId: "prueba",
  personaId,
  email: "prueba@kubo.test",
  rol,
  debeCambiarPassword: false,
});

describe.skipIf(!ACTIVA)("portal del apoderado: autorización por vínculo (US42, IDOR)", () => {
  let anioId: string;
  const personas: string[] = [];
  const familias: { apoderado: Autenticado; estudianteId: string; cuotaId: string }[] = [];

  beforeAll(async () => {
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    const admin = sesionDe(u.personaId, "ADMINISTRADOR", u.id);
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 2 } });
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
      data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "Q", aforoMaximo: 5 },
    });
    for (const n of [1, 2]) {
      const ap = await prisma.persona.create({
        data: { dni: `9000004${n}`, nombres: "Prueba", apellidos: `Apoderado ${n}`, apoderado: { create: {} } },
        include: { apoderado: true },
      });
      const es = await prisma.persona.create({
        data: {
          dni: `9000005${n}`,
          nombres: "Prueba",
          apellidos: `Estudiante ${n}`,
          estudiante: { create: { gradoIngresoId: grado.id } },
        },
        include: { estudiante: true },
      });
      personas.push(ap.id, es.id);
      const v = await prisma.vinculoApoderado.create({
        data: {
          estudianteId: es.estudiante!.id,
          apoderadoId: ap.apoderado!.id,
          parentesco: "Madre",
          esPrincipal: true,
        },
      });
      const m = await confirmarMatricula(
        admin,
        {
          estudianteId: es.estudiante!.id,
          anioAcademicoId: anioId,
          seccionId: seccion.id,
          vinculoResponsableId: v.id,
          modalidadPago: "MENSUAL",
        },
        meta,
      );
      familias.push({
        apoderado: sesionDe(ap.id, "APODERADO"),
        estudianteId: es.estudiante!.id,
        cuotaId: m.cronograma.cuotas[0].id!,
      });
    }
  });

  afterAll(async () => {
    if (!anioId) return;
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

  it("cada apoderado ve solo a su hijo, que queda elegido por ser el único", async () => {
    const [a, b] = familias;
    const r = await hijosDelApoderado(a.apoderado, null);
    expect(r.hijos.map((h) => h.estudianteId)).toEqual([a.estudianteId]);
    expect(r.seleccionadoId).toBe(a.estudianteId);
    expect(r.hijos.map((h) => h.estudianteId)).not.toContain(b.estudianteId);
  });

  it("con el id real del hijo de otra familia: 403 en pagos, en la elección y en el comprobante", async () => {
    const [a, b] = familias;
    const denegado = { codigo: "ESTUDIANTE_NO_VINCULADO", estadoHttp: 403 };
    await expect(pagosDelHijo(a.apoderado, b.estudianteId)).rejects.toMatchObject(denegado);
    await expect(elegirHijo(a.apoderado, b.estudianteId)).rejects.toMatchObject(denegado);
    await expect(comprobanteDeCuota(a.apoderado, b.estudianteId, b.cuotaId, meta)).rejects.toMatchObject(denegado);
  });

  it("con su propio hijo y la cuota de otra familia: no la encuentra", async () => {
    const [a, b] = familias;
    await expect(comprobanteDeCuota(a.apoderado, a.estudianteId, b.cuotaId, meta)).rejects.toMatchObject({
      codigo: "CUOTA_NO_ENCONTRADA",
    });
  });

  it("su propia cuota pendiente no tiene comprobante", async () => {
    const [a] = familias;
    await expect(comprobanteDeCuota(a.apoderado, a.estudianteId, a.cuotaId, meta)).rejects.toMatchObject({
      codigo: "RECIBO_NO_CONFIRMADO",
    });
  });
});
