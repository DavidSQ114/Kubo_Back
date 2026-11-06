// Prueba de integración (US18): dos matrículas simultáneas por la última vacante de una sección; solo una pasa.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/concurrencia
// Crea sus propios datos ficticios en un año 2091 y los borra al terminar.
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { confirmarMatricula } from "@/modules/matricula";
import type { Autenticado } from "@/modules/identidad";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2091;
const meta = { requestId: "prueba-concurrencia", ip: null, userAgent: null };

describe.skipIf(!ACTIVA)("última vacante con dos solicitudes simultáneas (US18)", () => {
  let admin: Autenticado;
  let anioId: string;
  let seccionId: string;
  const estudiantes: { estudianteId: string; vinculoId: string }[] = [];
  const personas: string[] = [];

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
    // aforo 1: la última (y única) vacante
    const seccion = await prisma.seccion.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "Z", aforoMaximo: 1 },
    });
    seccionId = seccion.id;
    const apoderado = await prisma.persona.create({
      data: { dni: "90000001", nombres: "Prueba", apellidos: "Apoderado Concurrencia", apoderado: { create: {} } },
      include: { apoderado: true },
    });
    personas.push(apoderado.id);
    for (const dni of ["90000002", "90000003"]) {
      const p = await prisma.persona.create({
        data: {
          dni,
          nombres: "Prueba",
          apellidos: `Estudiante ${dni}`,
          estudiante: { create: { gradoIngresoId: grado.id } },
        },
        include: { estudiante: true },
      });
      personas.push(p.id);
      const v = await prisma.vinculoApoderado.create({
        data: {
          estudianteId: p.estudiante!.id,
          apoderadoId: apoderado.apoderado!.id,
          parentesco: "Madre",
          esPrincipal: true,
        },
      });
      estudiantes.push({ estudianteId: p.estudiante!.id, vinculoId: v.id });
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

  it("acepta una matrícula y rechaza la otra con «Sección sin vacantes disponibles»", async () => {
    const resultados = await Promise.allSettled(
      estudiantes.map((e) =>
        confirmarMatricula(
          admin,
          {
            estudianteId: e.estudianteId,
            anioAcademicoId: anioId,
            seccionId,
            vinculoResponsableId: e.vinculoId,
            modalidadPago: "MENSUAL",
          },
          meta,
        ),
      ),
    );
    const aceptadas = resultados.filter((r) => r.status === "fulfilled");
    const rechazadas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(aceptadas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0].reason).toMatchObject({
      codigo: "SECCION_SIN_VACANTES",
      message: "Sección sin vacantes disponibles",
    });
    expect(await prisma.matricula.count({ where: { seccionId, estado: "MATRICULADO" } })).toBe(1);
    // el cronograma solo existe para la matrícula aceptada: 1 cuota de matrícula + 10 pensiones
    expect(await prisma.conceptoCobro.count({ where: { matricula: { seccionId } } })).toBe(11);
  });
});
