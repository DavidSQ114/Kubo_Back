// Prueba de integración (M-19, US18): anular una matrícula «En proceso» sin sección ni responsable (borrador de US17).
// Reproduce el error corregido por la migración 20261106120000_anular_matricula_en_proceso (el CHECK lo impedía).
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/anulacion
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { anularMatricula } from "@/modules/matricula";
import type { Autenticado } from "@/modules/identidad";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2093;
const meta = { requestId: "prueba-anulacion-borrador", ip: null, userAgent: null };

describe.skipIf(!ACTIVA)("anular un borrador «En proceso» (M-19)", () => {
  let admin: Autenticado;
  let anioId: string;
  let personaId: string;
  let matriculaId: string;

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
    const p = await prisma.persona.create({
      data: {
        dni: "90000021",
        nombres: "Prueba",
        apellidos: "Estudiante Borrador",
        estudiante: { create: { gradoIngresoId: grado.id } },
      },
      include: { estudiante: true },
    });
    personaId = p.id;
    const m = await prisma.matricula.create({
      data: { estudianteId: p.estudiante!.id, anioAcademicoId: anioId, registradoPorId: u.id },
    });
    matriculaId = m.id;
  });

  afterAll(async () => {
    if (!anioId) return;
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.estudiante.deleteMany({ where: { personaId } });
    await prisma.persona.deleteMany({ where: { id: personaId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  });

  it("la deja Anulado aunque no tenga sección ni responsable de pago", async () => {
    const d = await anularMatricula(
      admin,
      matriculaId,
      { motivo: "ERROR_DIGITACION", detalle: "Borrador de prueba" },
      meta,
    );
    expect(d.estado).toBe("ANULADO");
    expect(d.seccion).toBeNull();
  });
});
