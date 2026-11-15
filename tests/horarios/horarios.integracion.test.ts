// Prueba de integración (US27–US31): cuadrícula, asignación de clases, cruces de docente y de aula (también con dos
// administradores a la vez), publicación por versiones y consultas del horario publicado.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/horarios/horarios.integracion
// Crea sus propios datos ficticios en los años 2097 y 2098 y los borra al terminar.
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/platform/db/prisma";
import { enviarCorreo } from "@/platform/correo";
import {
  asignarClase,
  crearBorrador,
  horarioPublicadoDeDocente,
  horarioPublicadoDeSeccion,
  obtenerCuadricula,
  ocupacionDelBloque,
  publicarHorario,
  quitarClase,
  type Dia,
} from "@/modules/horarios";
import { esCruceEnBase } from "@/modules/horarios/infrastructure/repositorio";
import type { Autenticado } from "@/modules/identidad";

// los correos no salen de la prueba: se cuenta cuántos se pidieron y se simula un servidor caído
vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2097;
const ANIO_CERRADO = 2098;
// la bitácora es inmutable y conserva las filas de corridas anteriores: cada corrida usa su propio requestId
const meta = { requestId: `prueba-horarios-${Date.now()}`, ip: null, userAgent: null };

describe.skipIf(!ACTIVA)("horarios por sección: asignación, cruces y publicación (US27–US31)", () => {
  let admin: Autenticado;
  let anioId: string;
  let anioCerradoId: string;
  let seccionA: string;
  let seccionB: string;
  let seccionCerrada: string;
  let aula1: string;
  let aula2: string;
  let mat: string;
  let com: string;
  let castro: string;
  let torres: string;
  /** Bloques de clase del año, en orden (el catálogo se crea con la jornada por defecto del seed). */
  let b: string[];
  let recreo: string;
  const personas: string[] = [];
  const correo = vi.mocked(enviarCorreo);

  const clase = (cursoId: string | null, docenteId: string | null, aulaId: string | null) => ({
    cursoId,
    docenteId,
    aulaId,
  });
  const asignar = (seccionId: string, dia: Dia, bloqueId: string, datos: ReturnType<typeof clase>) =>
    asignarClase(admin, seccionId, { dia, bloqueId }, datos, meta);
  const auditoria = (accion: string) =>
    prisma.registroAuditoria.findMany({
      where: { accion, requestId: meta.requestId },
      orderBy: { createdAt: "asc" },
    });

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
    const crearAnio = (anio: number, estado: "EN_MATRICULA" | "CERRADO") =>
      prisma.anioAcademico.create({
        data: {
          anio,
          fechaInicio: new Date(`${anio}-03-01T00:00:00Z`),
          fechaFin: new Date(`${anio}-12-15T00:00:00Z`),
          estado,
        },
      });
    anioId = (await crearAnio(ANIO, "EN_MATRICULA")).id;
    anioCerradoId = (await crearAnio(ANIO_CERRADO, "CERRADO")).id;
    const seccion = (anioAcademicoId: string, nombre: string) =>
      prisma.seccion.create({ data: { anioAcademicoId, gradoId: grado.id, nombre, aforoMaximo: 30 } });
    seccionA = (await seccion(anioId, "HA")).id;
    seccionB = (await seccion(anioId, "HB")).id;
    seccionCerrada = (await seccion(anioCerradoId, "HC")).id;
    aula1 = (await prisma.aula.create({ data: { nombre: "Aula prueba H1", aforo: 30 } })).id;
    aula2 = (await prisma.aula.create({ data: { nombre: "Aula prueba H2", aforo: 30 } })).id;
    mat = (await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } })).id;
    com = (await prisma.curso.findFirstOrThrow({ where: { codigo: "COM" } })).id;

    const docente = async (dni: string, nombres: string, apellidos: string) => {
      const p = await prisma.persona.create({
        data: { dni, nombres, apellidos, email: `${dni}@prueba.kubo.test`, docente: { create: {} } },
        include: { docente: true },
      });
      personas.push(p.id);
      return p.docente!.id;
    };
    castro = await docente("90000271", "Elena", "Castro Prueba");
    torres = await docente("90000272", "Mónica", "Torres Prueba");

    // plan del grado: Matemática 2 horas y Comunicación 1; Castro dicta Matemática y Torres, Comunicación
    for (const [cursoId, horasSemanales, docenteId] of [
      [mat, 2, castro],
      [com, 1, torres],
    ] as const) {
      const plan = await prisma.planEstudio.create({
        data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId, horasSemanales },
      });
      for (const seccionId of [seccionA, seccionB]) {
        await prisma.asignacionDocente.create({ data: { planEstudioId: plan.id, seccionId, docenteId } });
      }
    }
  });

  afterAll(async () => {
    if (!anioId) return;
    const anios = [anioId, anioCerradoId];
    await prisma.horario.deleteMany({ where: { seccion: { anioAcademicoId: { in: anios } } } });
    await prisma.bloqueHorario.deleteMany({ where: { anioAcademicoId: { in: anios } } });
    await prisma.asignacionDocente.deleteMany({ where: { seccion: { anioAcademicoId: { in: anios } } } });
    await prisma.planEstudio.deleteMany({ where: { anioAcademicoId: { in: anios } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: { in: anios } } });
    await prisma.aula.deleteMany({ where: { id: { in: [aula1, aula2] } } });
    await prisma.docente.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.anioAcademico.deleteMany({ where: { id: { in: anios } } });
    await prisma.$disconnect();
  });

  it("muestra la cuadrícula en blanco: 5 días por los bloques del año, con el recreo sin asignar (US27)", async () => {
    const c = await obtenerCuadricula(seccionA);
    expect(c.dias).toEqual(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]);
    expect(c.bloques.map((x) => `${x.horaInicio} ${x.tipo}`)).toEqual([
      "07:45 CLASE",
      "08:30 CLASE",
      "09:15 CLASE",
      "10:00 RECREO",
      "10:20 CLASE",
      "11:05 CLASE",
      "11:50 CLASE",
      "12:35 CLASE",
    ]);
    expect(c).toMatchObject({ editable: true, motivoSoloLectura: null, horario: null, clases: [] });
    expect(c.seccion.etiqueta).toBe("1° HA");
    expect(c.avance).toEqual({ asignados: 0, requeridos: 3 });
    expect(c.plan.map((p) => [p.codigo, p.horasSemanales, p.docente?.nombreCorto])).toEqual([
      ["COM", 1, "M. Torres"],
      ["MAT", 2, "E. Castro"],
    ]);
    b = c.bloques.filter((x) => x.tipo === "CLASE").map((x) => x.id);
    recreo = c.bloques.find((x) => x.tipo === "RECREO")!.id;
    // el catálogo se crea una sola vez por año
    await obtenerCuadricula(seccionB);
    expect(await prisma.bloqueHorario.count({ where: { anioAcademicoId: anioId } })).toBe(8);
  });

  it("deja en solo lectura la sección de un año cerrado (US27, criterio 3)", async () => {
    const c = await obtenerCuadricula(seccionCerrada);
    expect(c.editable).toBe(false);
    expect(c.motivoSoloLectura).toBe("Esta sección no pertenece al periodo académico activo");
    const bloque = c.bloques.find((x) => x.tipo === "CLASE")!.id;
    await expect(asignar(seccionCerrada, "LUNES", bloque, clase(mat, castro, aula1))).rejects.toMatchObject({
      codigo: "SECCION_FUERA_DE_ANIO_ACTIVO",
      message: "Esta sección no pertenece al periodo académico activo",
    });
    expect(await prisma.horario.count({ where: { seccionId: seccionCerrada } })).toBe(0);
  });

  it("asigna una clase, la muestra con curso, docente y aula, y la audita (US28)", async () => {
    const c = await asignar(seccionA, "LUNES", b[0], clase(mat, castro, aula1));
    expect(c.horario).toMatchObject({ version: 1, estado: "BORRADOR" });
    expect(c.clases).toHaveLength(1);
    expect(c.clases[0]).toMatchObject({
      dia: "LUNES",
      bloqueId: b[0],
      curso: { codigo: "MAT" },
      docente: { id: castro, nombreCorto: "E. Castro" },
      aula: { id: aula1, nombre: "Aula prueba H1" },
    });
    expect(c.avance).toEqual({ asignados: 1, requeridos: 3 });
    const [evento] = await auditoria("ASIGNAR_CLASE");
    expect(evento).toMatchObject({ entidadAfectada: "detalle_horario", entidadId: c.clases[0].id });
    expect(evento.valorAnterior).toBeNull();
    expect(evento.valorNuevo).toMatchObject({ dia: "LUNES", curso: "MAT", docenteId: castro, aulaId: aula1 });
  });

  it("rechaza una clase incompleta, un docente sin el curso y una clase en el recreo (US28)", async () => {
    await expect(asignar(seccionA, "MARTES", b[0], clase(mat, null, aula1))).rejects.toMatchObject({
      codigo: "CLASE_INCOMPLETA",
      message: "Debe completar curso, docente y aula antes de guardar",
    });
    await expect(asignar(seccionA, "MARTES", b[0], clase(mat, torres, aula1))).rejects.toMatchObject({
      codigo: "DOCENTE_SIN_CURSO",
      message: "Este docente no tiene asignado el curso seleccionado",
    });
    await expect(asignar(seccionA, "MARTES", recreo, clase(mat, castro, aula1))).rejects.toMatchObject({
      codigo: "BLOQUE_DE_RECREO",
    });
    expect((await obtenerCuadricula(seccionA)).clases).toHaveLength(1);
  });

  it("impide el cruce de docente con el borrador de otra sección e indica sección, día y bloque (US29)", async () => {
    await expect(asignar(seccionB, "LUNES", b[0], clase(mat, castro, aula2))).rejects.toMatchObject({
      codigo: "CRUCE_DOCENTE",
      message: "Error: Cruce de Docente · ya tiene clase en 1° HA (lunes 07:45 – 08:30)",
      detalles: { seccion: { id: seccionA, etiqueta: "1° HA" }, dia: "LUNES", estadoHorario: "BORRADOR" },
    });
    expect(await ocupacionDelBloque(seccionB, "LUNES", b[0])).toEqual({
      docentes: [{ docenteId: castro, seccion: "1° HA" }],
      aulas: [{ aulaId: aula1, seccion: "1° HA" }],
    });
  });

  it("impide ocupar un aula que otra sección usa en el mismo día y bloque (US30)", async () => {
    await expect(asignar(seccionB, "LUNES", b[0], clase(com, torres, aula1))).rejects.toMatchObject({
      codigo: "AULA_OCUPADA",
      message: "Error: Aula Ocupada · Aula prueba H1 está asignada a 1° HA (lunes 07:45 – 08:30)",
    });
  });

  it("permite al mismo docente y la misma aula en otra sección si el bloque es distinto (US29, US30)", async () => {
    const c = await asignar(seccionB, "LUNES", b[1], clase(mat, castro, aula1));
    expect(c.clases).toHaveLength(1);
  });

  it("con dos administradores a la vez, solo uno asigna al docente en ese día y bloque (US29)", async () => {
    const resultados = await Promise.allSettled([
      asignar(seccionA, "MARTES", b[0], clase(mat, castro, aula1)),
      asignar(seccionB, "MARTES", b[0], clase(mat, castro, aula2)),
    ]);
    const rechazadas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0].reason).toMatchObject({ codigo: "CRUCE_DOCENTE" });
    expect(rechazadas[0].reason.message).toMatch(/^Error: Cruce de Docente · ya tiene clase en 1° H[AB] \(martes/);
    expect(await prisma.detalleHorario.count({ where: { dia: "MARTES", bloqueId: b[0], docenteId: castro } })).toBe(1);
  });

  it("con dos administradores a la vez, solo uno ocupa el aula en ese día y bloque (US30)", async () => {
    const resultados = await Promise.allSettled([
      asignar(seccionA, "MIERCOLES", b[0], clase(mat, castro, aula1)),
      asignar(seccionB, "MIERCOLES", b[0], clase(com, torres, aula1)),
    ]);
    const rechazadas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0].reason).toMatchObject({ codigo: "AULA_OCUPADA" });
    expect(await prisma.detalleHorario.count({ where: { dia: "MIERCOLES", bloqueId: b[0], aulaId: aula1 } })).toBe(1);
  });

  it("la base rechaza el cruce aunque se salte la validación de la aplicación (US29, US30)", async () => {
    const borradorB = await prisma.horario.findFirstOrThrow({ where: { seccionId: seccionB } });
    const deCastroEnB = await prisma.asignacionDocente.findFirstOrThrow({
      where: { seccionId: seccionB, docenteId: castro },
    });
    const error = await prisma.detalleHorario
      .create({
        data: {
          horarioId: borradorB.id,
          seccionId: seccionB,
          dia: "LUNES",
          bloqueId: b[0],
          aulaId: aula2,
          asignacionDocenteId: deCastroEnB.id,
          docenteId: castro,
        },
      })
      .catch((e: unknown) => e);
    expect(esCruceEnBase(error)).toBe(true);
  });

  it("vacía un bloque del borrador y lo audita con los datos anteriores (US28)", async () => {
    // deja la sección B sin clases para que no estorbe a la A en lo que sigue
    for (const c of (await obtenerCuadricula(seccionB)).clases) {
      await quitarClase(admin, seccionB, { dia: c.dia, bloqueId: c.bloqueId }, meta);
    }
    expect((await obtenerCuadricula(seccionB)).clases).toHaveLength(0);
    const eventos = await auditoria("QUITAR_CLASE");
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos[0].valorAnterior).toMatchObject({ seccionId: seccionB, docenteId: expect.any(String) });
    await expect(quitarClase(admin, seccionB, { dia: "VIERNES", bloqueId: b[0] }, meta)).rejects.toMatchObject({
      codigo: "NO_ENCONTRADO",
    });
  });

  it("no publica si a algún curso le faltan bloques y lista lo pendiente (US31)", async () => {
    // la sección A tiene solo clases de Matemática: falta Comunicación (y quizá sobra Matemática)
    for (const c of (await obtenerCuadricula(seccionA)).clases.slice(1)) {
      await quitarClase(admin, seccionA, { dia: c.dia, bloqueId: c.bloqueId }, meta);
    }
    const error = await publicarHorario(admin, seccionA, meta).catch((e: unknown) => e);
    expect(error).toMatchObject({
      codigo: "HORARIO_INCOMPLETO",
      message: "No se puede publicar: existen bloques horarios sin asignar",
    });
    const detalles = (error as { detalles: { cursos: { nombre: string; faltan: number }[]; bloquesLibres: unknown[] } })
      .detalles;
    expect(detalles.cursos.map((c) => [c.nombre, c.faltan])).toEqual([
      ["Comunicación", 1],
      ["Matemática", 1],
    ]);
    expect(detalles.bloquesLibres).toHaveLength(35 - 1);
    expect((await obtenerCuadricula(seccionA)).horario?.estado).toBe("BORRADOR");
  });

  it("publica el horario completo, lo audita y avisa por correo a los docentes de la sección (US31)", async () => {
    await asignar(seccionA, "MARTES", b[0], clase(mat, castro, aula1));
    await asignar(seccionA, "LUNES", b[1], clase(com, torres, aula1));
    correo.mockClear();
    const publicado = await publicarHorario(admin, seccionA, meta);
    expect(publicado.horario).toMatchObject({ version: 1, estado: "PUBLICADO" });
    expect(publicado.horario?.publicadoEn).not.toBeNull();
    expect(publicado.hayBorrador).toBe(false);
    expect(publicado.aviso).toEqual({ docentes: 2, enviados: 2 });
    expect(correo).toHaveBeenCalledTimes(2);
    expect(correo.mock.calls[0][0].asunto).toBe("Kubo · Horario de 1° HA publicado");
    const [evento] = await auditoria("PUBLICAR_HORARIO");
    expect(evento.valorAnterior).toMatchObject({ version: 1, estado: "BORRADOR", publicada: null });
    expect(evento.valorNuevo).toMatchObject({ version: 1, estado: "PUBLICADO", clases: 3, archivada: null });
    await expect(publicarHorario(admin, seccionA, meta)).rejects.toMatchObject({ codigo: "SIN_CAMBIOS_POR_PUBLICAR" });
  });

  it("editar el horario publicado crea un borrador a partir de él, sin tocar lo publicado (US31)", async () => {
    const borrador = await crearBorrador(seccionA);
    expect(borrador.horario).toMatchObject({ version: 2, estado: "BORRADOR" });
    expect(borrador.clases).toHaveLength(3);
    // mueve Comunicación de lunes a jueves en el borrador
    await quitarClase(admin, seccionA, { dia: "LUNES", bloqueId: b[1] }, meta);
    await asignar(seccionA, "JUEVES", b[2], clase(com, torres, aula2));
    const publicado = await horarioPublicadoDeSeccion(seccionA);
    expect(publicado.horario).toMatchObject({ version: 1, estado: "PUBLICADO" });
    expect(publicado.clases.find((c) => c.curso.codigo === "COM")).toMatchObject({ dia: "LUNES", bloqueId: b[1] });
    // otra sección choca con la versión publicada y también con el borrador en edición
    await expect(asignar(seccionB, "LUNES", b[1], clase(com, torres, aula2))).rejects.toMatchObject({
      codigo: "CRUCE_DOCENTE",
      detalles: { estadoHorario: "PUBLICADO" },
    });
    await expect(asignar(seccionB, "JUEVES", b[2], clase(com, torres, aula1))).rejects.toMatchObject({
      codigo: "CRUCE_DOCENTE",
      detalles: { estadoHorario: "BORRADOR" },
    });
  });

  it("publicar la versión nueva archiva la anterior y no se revierte si falla el correo (US31)", async () => {
    correo.mockClear();
    correo.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("servidor de correo caído"));
    const publicado = await publicarHorario(admin, seccionA, meta);
    expect(publicado.horario).toMatchObject({ version: 2, estado: "PUBLICADO" });
    expect(publicado.aviso).toEqual({ docentes: 2, enviados: 0 });
    expect(publicado.versiones.map((v) => [v.version, v.estado])).toEqual([
      [2, "PUBLICADO"],
      [1, "ARCHIVADO"],
    ]);
    const eventos = await auditoria("PUBLICAR_HORARIO");
    expect(eventos.at(-1)?.valorNuevo).toMatchObject({ version: 2, archivada: { version: 1, estado: "ARCHIVADO" } });
    // la versión archivada se conserva en solo lectura y sus clases ya no ocupan docente ni aula
    const archivada = await obtenerCuadricula(seccionA, 1);
    expect(archivada.horario?.estado).toBe("ARCHIVADO");
    expect(archivada.clases).toHaveLength(3);
    const libre = await asignar(seccionB, "LUNES", b[1], clase(com, torres, aula2));
    expect(libre.clases).toHaveLength(1);
  });

  it("consulta el horario publicado por sección y por docente, sin los borradores (US31)", async () => {
    const deSeccion = await horarioPublicadoDeSeccion(seccionA);
    expect(deSeccion.horario?.version).toBe(2);
    expect(deSeccion.clases.map((c) => `${c.dia} ${c.curso.codigo}`).sort()).toEqual([
      "JUEVES COM",
      "LUNES MAT",
      "MARTES MAT",
    ]);
    const sinPublicar = await horarioPublicadoDeSeccion(seccionB);
    expect(sinPublicar).toMatchObject({ horario: null, clases: [] });
    const deTorres = await horarioPublicadoDeDocente(torres, anioId);
    // Torres tiene además una clase en el borrador de la sección B: no aparece
    expect(deTorres.clases).toHaveLength(1);
    expect(deTorres.clases[0]).toMatchObject({ dia: "JUEVES", seccion: { etiqueta: "1° HA" }, aula: { id: aula2 } });
    expect(deTorres.anio).toEqual({ id: anioId, anio: ANIO });
  });
});
