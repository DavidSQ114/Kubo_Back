// Prueba de integración (US19): dos traslados simultáneos a la última vacante de la sección destino; solo uno pasa.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/traslado
// Crea sus propios datos ficticios en un año 2092 y los borra al terminar.
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { confirmarMatricula, seccionDeMatriculaEnFecha, trasladarMatricula } from "@/modules/matricula";
import { fechaEnLima } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2092;
const meta = { requestId: "prueba-traslado-concurrente", ip: null, userAgent: null };

describe.skipIf(!ACTIVA)("dos traslados simultáneos a la última vacante (US19)", () => {
  let admin: Autenticado;
  let anioId: string;
  let origenId: string;
  let destinoId: string;
  const estudiantes: { estudianteId: string; vinculoId: string }[] = [];
  const matriculas: string[] = [];
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
    // origen con los dos estudiantes; destino con aforo 1: la última (y única) vacante
    const origen = await prisma.seccion.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "Y", aforoMaximo: 2 },
    });
    const destino = await prisma.seccion.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, nombre: "Z", aforoMaximo: 1 },
    });
    origenId = origen.id;
    destinoId = destino.id;
    const apoderado = await prisma.persona.create({
      data: { dni: "90000011", nombres: "Prueba", apellidos: "Apoderado Traslado", apoderado: { create: {} } },
      include: { apoderado: true },
    });
    personas.push(apoderado.id);
    for (const dni of ["90000012", "90000013"]) {
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
    for (const e of estudiantes) {
      const m = await confirmarMatricula(
        admin,
        {
          estudianteId: e.estudianteId,
          anioAcademicoId: anioId,
          seccionId: origenId,
          vinculoResponsableId: e.vinculoId,
          modalidadPago: "MENSUAL",
        },
        meta,
      );
      matriculas.push(m.matriculaId);
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

  it("acepta un traslado y rechaza el otro con «La sección destino no tiene vacantes disponibles»", async () => {
    const resultados = await Promise.allSettled(
      matriculas.map((id) => trasladarMatricula(admin, id, { seccionDestinoId: destinoId, motivo: "Prueba" }, meta)),
    );
    const aceptados = resultados.filter((r) => r.status === "fulfilled");
    const rechazados = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(aceptados).toHaveLength(1);
    expect(rechazados).toHaveLength(1);
    expect(rechazados[0].reason).toMatchObject({
      codigo: "DESTINO_SIN_VACANTES",
      message: "La sección destino no tiene vacantes disponibles",
    });
    expect(await prisma.matricula.count({ where: { seccionId: destinoId, estado: "MATRICULADO" } })).toBe(1);
    expect(await prisma.matricula.count({ where: { seccionId: origenId, estado: "MATRICULADO" } })).toBe(1);

    // el trasladado tiene dos tramos: el de origen cerrado hoy y el de destino abierto desde hoy
    const trasladada = await prisma.matricula.findFirstOrThrow({ where: { seccionId: destinoId } });
    const tramos = await prisma.historialSeccion.findMany({
      where: { matriculaId: trasladada.id },
      orderBy: { createdAt: "asc" },
    });
    const hoy = fechaEnLima(new Date());
    expect(tramos.map((t) => [t.seccionId, t.fechaFin?.toISOString().slice(0, 10) ?? null])).toEqual([
      [origenId, hoy],
      [destinoId, null],
    ]);
    expect(await seccionDeMatriculaEnFecha(trasladada.id, hoy)).toBe(destinoId);
    // el rechazado no cambió de sección ni de historial
    const otra = matriculas.find((id) => id !== trasladada.id)!;
    expect(await prisma.historialSeccion.count({ where: { matriculaId: otra } })).toBe(1);
  });
});
