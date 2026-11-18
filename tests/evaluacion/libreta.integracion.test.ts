// Prueba de integración (US39 criterio 4, US46, US51, US26, US66): publicación de notas del Administrador, libreta del
// apoderado, «Mis notas» del alumno, restricción por deuda y descargas en PDF. Seguridad de los endpoints (401 sin
// sesión, 403 con otro perfil, nadie ve las notas de un estudiante ajeno) y regla central: el apoderado y el alumno
// solo ven notas de registros PUBLICADOS, nunca de uno abierto o solo cerrado.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/evaluacion/libreta.integracion
// Crea sus propios datos ficticios en el año 2087 (DNI 900012xx) y los borra al terminar. Los registros de notas se
// preparan directamente en la base (el flujo del docente ya lo prueba notas.integracion); quien publica es el
// administrador del seed: la bitácora de auditoría es inmutable y quien la firma no se puede borrar.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { enviarCorreo } from "@/platform/correo";
import { prisma } from "@/platform/db/prisma";
import { GET as libretaAlumnoPdf } from "@/app/api/v1/evaluacion/alumno/libreta/pdf/route";
import { GET as libretaAlumno } from "@/app/api/v1/evaluacion/alumno/libreta/route";
import { GET as libretaHijoPdf } from "@/app/api/v1/evaluacion/apoderado/hijos/[id]/libreta/pdf/route";
import { GET as libretaHijo } from "@/app/api/v1/evaluacion/apoderado/hijos/[id]/libreta/route";
import { GET as detalleRuta } from "@/app/api/v1/evaluacion/publicaciones/[cierreId]/route";
import { GET as listarRuta, POST as publicarRuta } from "@/app/api/v1/evaluacion/publicaciones/route";
import { GET as horarioPdf } from "@/app/api/v1/horarios/apoderado/hijos/[id]/horario/pdf/route";
import {
  publicarNotas,
  registroDeCierre,
  registrosParaPublicar,
  type Libreta,
  type LibretaDelHijo,
  type LogroNota,
} from "@/modules/evaluacion";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { confirmarMatricula, MENSAJE_RESTRICCION_DEUDA } from "@/modules/matricula";

vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2087;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2087";
const meta = { requestId: `prueba-libreta-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function pedir(
  manejador: Manejador,
  ruta: string,
  opciones: { token?: string; params?: Record<string, string>; metodo?: "POST"; cuerpo?: unknown } = {},
) {
  const req = new NextRequest(`http://localhost/api/v1${ruta}`, {
    method: opciones.metodo ?? "GET",
    headers: opciones.token ? { authorization: `Bearer ${opciones.token}` } : undefined,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  const res = await manejador(req, { params: Promise.resolve(opciones.params ?? {}) });
  const tipo = res.headers.get("content-type") ?? "";
  if (tipo.includes("application/pdf")) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { estado: res.status, tipo, bytes, datos: undefined, error: undefined };
  }
  const json = await res.json();
  return {
    estado: res.status,
    tipo,
    bytes: undefined,
    datos: json.data,
    error: json.error as { code: string; message: string; details: Record<string, unknown> } | undefined,
  };
}

/** Código del ErrorApp con el que se rechaza la promesa. */
async function codigoDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return { codigo: (e as { codigo?: string }).codigo, mensaje: (e as Error).message };
  }
  throw new Error("Se esperaba un rechazo");
}

describe.skipIf(!ACTIVA)("publicación de notas, libreta y mis notas (US39, US46, US51, US26, US66)", () => {
  let anioId: string;
  let bimestreI: string;
  let bimestreII: string;
  let reglaId: string;
  let admin: Autenticado;
  const personas: string[] = [];
  const competencias: Record<"mat1" | "mat2" | "com1", string> = { mat1: "", mat2: "", com1: "" };
  const estudiantes: Record<"valeria" | "diego" | "carla", string> = { valeria: "", diego: "", carla: "" };
  const matriculas: Record<"valeria" | "diego" | "carla", string> = { valeria: "", diego: "", carla: "" };
  // registros: Matemática de la sección A en el bimestre I (CERRADO, se publica), Matemática de la B en el I
  // (CERRADO), Comunicación de la A en el I (ABIERTO, con notas) y Matemática de la A en el II (CERRADO, sin publicar)
  const cierre: Record<"matAI" | "matBI" | "comAI" | "matAII", string> = {
    matAI: "",
    matBI: "",
    comAI: "",
    matAII: "",
  };
  const token: Record<"apoderadoA" | "apoderadoB" | "valeria" | "docente", string> = {
    apoderadoA: "",
    apoderadoB: "",
    valeria: "",
    docente: "",
  };
  const emails = { apoderadoA: "90001201@prueba.kubo.test", apoderadoB: "90001202@prueba.kubo.test" };
  const correo = vi.mocked(enviarCorreo);

  async function ingresar(email: string) {
    const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
    if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
    return r.tokens.acceso;
  }

  /** Registro con notas y, si se cierra, sus consolidados (las notas se crean antes de cerrar: el trigger de US40). */
  async function registro(datos: {
    asignacionId: string;
    periodoId: string;
    notas: [matriculaId: string, competenciaPlanId: string, logro: LogroNota][];
    consolidados: [matriculaId: string, logro: LogroNota][];
    cerrar: boolean;
  }) {
    const c = await prisma.cierreCalificacion.create({
      data: {
        asignacionDocenteId: datos.asignacionId,
        periodoEvaluacionId: datos.periodoId,
        reglaConsolidacionId: reglaId,
        estado: "ABIERTO",
      },
    });
    await prisma.nota.createMany({
      data: datos.notas.map(([matriculaId, competenciaPlanId, logro]) => ({
        cierreId: c.id,
        matriculaId,
        competenciaPlanId,
        logro,
        registradoPorId: admin.usuarioId,
      })),
    });
    // un registro abierto no tiene consolidados; se crean igual para probar que la consulta los descarta
    await prisma.resultadoConsolidado.createMany({
      data: datos.consolidados.map(([matriculaId, logro]) => ({
        cierreId: c.id,
        matriculaId,
        logroConsolidado: logro,
        detalleCalculo: {},
      })),
    });
    if (datos.cerrar) {
      await prisma.cierreCalificacion.update({
        where: { id: c.id },
        data: { estado: "CERRADO", cerradoEn: new Date(), cerradoPorId: admin.usuarioId },
      });
    }
    return c.id;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    admin = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "ADMINISTRADOR",
      debeCambiarPassword: false,
    };
    const passwordHash = await hashPassword(CLAVE);
    const cuenta = (personaId: string, email: string) =>
      prisma.usuario.create({ data: { personaId, email, passwordHash, estado: "ACTIVO", debeCambiarPassword: false } });

    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 1 } });
    anioId = (
      await prisma.anioAcademico.create({
        data: {
          anio: ANIO,
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-12-15T00:00:00Z`),
          estado: "EN_CURSO",
        },
      })
    ).id;
    const bimestre = (numero: number, nombre: string, inicio: string, fin: string) =>
      prisma.periodoEvaluacion.create({
        data: {
          anioAcademicoId: anioId,
          numero,
          nombre,
          fechaInicio: new Date(`${ANIO}-${inicio}T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-${fin}T00:00:00Z`),
        },
      });
    bimestreI = (await bimestre(1, "Bimestre I", "03-01", "05-13")).id;
    bimestreII = (await bimestre(2, "Bimestre II", "05-16", "07-22")).id;
    reglaId = (
      await prisma.reglaConsolidacion.create({
        data: {
          anioAcademicoId: anioId,
          nombre: "Moda de los logros",
          metodo: "MODA",
          criterioDesempate: "MAYOR_JERARQUIA",
          configuracion: {},
          version: 1,
          estado: "VIGENTE",
        },
      })
    ).id;
    for (const [clave, valor] of [
      ["MONTO_MATRICULA", "300.00"],
      ["MONTO_PENSION", "400.00"],
    ] as const) {
      await prisma.parametroInstitucion.create({
        data: { anioAcademicoId: anioId, clave, valor, actualizadoPorId: u.id },
      });
    }
    const seccion = (nombre: string) =>
      prisma.seccion.create({ data: { anioAcademicoId: anioId, gradoId: grado.id, nombre, aforoMaximo: 5 } });
    const seccionA = (await seccion("LA")).id;
    const seccionB = (await seccion("LB")).id;

    // Matemática (2 competencias) y Comunicación (1) en el plan del grado
    const plan = async (codigo: string, cuantas: number) => {
      const curso = await prisma.curso.findFirstOrThrow({ where: { codigo } });
      const p = await prisma.planEstudio.create({
        data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: curso.id, horasSemanales: 4 },
      });
      const delArea = await prisma.competencia.findMany({
        where: { areaCurricularId: curso.areaCurricularId },
        orderBy: { codigo: "asc" },
        take: cuantas,
      });
      const ids: string[] = [];
      for (const [i, c] of delArea.entries()) {
        ids.push(
          (await prisma.competenciaPlan.create({ data: { planEstudioId: p.id, competenciaId: c.id, orden: i + 1 } }))
            .id,
        );
      }
      return { planId: p.id, ids };
    };
    const mat = await plan("MAT", 2);
    const com = await plan("COM", 1);
    [competencias.mat1, competencias.mat2] = mat.ids;
    [competencias.com1] = com.ids;

    const pDocente = await prisma.persona.create({
      data: {
        dni: "90001210",
        nombres: "Rosa",
        apellidos: "Libreta Prueba",
        email: "90001210@prueba.kubo.test",
        docente: { create: {} },
      },
      include: { docente: true },
    });
    personas.push(pDocente.id);
    await cuenta(pDocente.id, pDocente.email!);
    const asignar = (planEstudioId: string, seccionId: string) =>
      prisma.asignacionDocente.create({ data: { planEstudioId, seccionId, docenteId: pDocente.docente!.id } });
    const matA = (await asignar(mat.planId, seccionA)).id;
    const comA = (await asignar(com.planId, seccionA)).id;
    const matB = (await asignar(mat.planId, seccionB)).id;

    // apoderado A: Valeria y Diego (sección A); apoderado B: Carla (sección B). Valeria tiene cuenta de alumna.
    const apoderado = async (dni: string, email: string) => {
      const p = await prisma.persona.create({
        data: { dni, nombres: "Carmen", apellidos: `Apoderada ${dni}`, email, apoderado: { create: {} } },
        include: { apoderado: true },
      });
      personas.push(p.id);
      await cuenta(p.id, email);
      return p.apoderado!.id;
    };
    const apoderadoA = await apoderado("90001201", emails.apoderadoA);
    const apoderadoB = await apoderado("90001202", emails.apoderadoB);
    for (const [clave, dni, nombres, seccionId, apoderadoId] of [
      ["valeria", "90001221", "Valeria", seccionA, apoderadoA],
      ["diego", "90001222", "Diego", seccionA, apoderadoA],
      ["carla", "90001223", "Carla", seccionB, apoderadoB],
    ] as const) {
      const es = await prisma.persona.create({
        data: { dni, nombres, apellidos: "Quispe Prueba", estudiante: { create: { gradoIngresoId: grado.id } } },
        include: { estudiante: true },
      });
      personas.push(es.id);
      estudiantes[clave] = es.estudiante!.id;
      const v = await prisma.vinculoApoderado.create({
        data: { estudianteId: es.estudiante!.id, apoderadoId, parentesco: "Madre", esPrincipal: true },
      });
      const m = await confirmarMatricula(
        admin,
        {
          estudianteId: es.estudiante!.id,
          anioAcademicoId: anioId,
          seccionId,
          vinculoResponsableId: v.id,
          modalidadPago: "MENSUAL",
        },
        meta,
      );
      matriculas[clave] = m.matriculaId;
      if (clave === "valeria") await cuenta(es.id, "90001221@prueba.kubo.test");
    }

    const { valeria, diego, carla } = matriculas;
    cierre.matAI = await registro({
      asignacionId: matA,
      periodoId: bimestreI,
      notas: [
        [valeria, competencias.mat1, "AD"],
        [valeria, competencias.mat2, "A"],
        [diego, competencias.mat1, "B"],
        [diego, competencias.mat2, "B"],
      ],
      consolidados: [
        [valeria, "AD"],
        [diego, "B"],
      ],
      cerrar: true,
    });
    cierre.matBI = await registro({
      asignacionId: matB,
      periodoId: bimestreI,
      notas: [
        [carla, competencias.mat1, "C"],
        [carla, competencias.mat2, "C"],
      ],
      consolidados: [[carla, "C"]],
      cerrar: true,
    });
    cierre.comAI = await registro({
      asignacionId: comA,
      periodoId: bimestreI,
      notas: [[valeria, competencias.com1, "C"]],
      consolidados: [[valeria, "C"]],
      cerrar: false,
    });
    cierre.matAII = await registro({
      asignacionId: matA,
      periodoId: bimestreII,
      notas: [
        [valeria, competencias.mat1, "C"],
        [valeria, competencias.mat2, "C"],
      ],
      consolidados: [[valeria, "C"]],
      cerrar: true,
    });

    token.apoderadoA = await ingresar(emails.apoderadoA);
    token.apoderadoB = await ingresar(emails.apoderadoB);
    token.valeria = await ingresar("90001221@prueba.kubo.test");
    token.docente = await ingresar(pDocente.email!);
    correo.mockClear();
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    if (!anioId) return;
    // al borrar el cierre se van sus notas y sus resultados consolidados (el trigger solo bloquea crear o cambiar)
    await prisma.cierreCalificacion.deleteMany({ where: { periodoEvaluacion: { anioAcademicoId: anioId } } });
    await prisma.reglaConsolidacion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.asignacionDocente.deleteMany({ where: { seccion: { anioAcademicoId: anioId } } });
    await prisma.planEstudio.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    await prisma.usuario.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.docente.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  const libretaDe = async (estudiante: keyof typeof estudiantes, t = token.apoderadoA) =>
    (
      await pedir(libretaHijo, "/evaluacion/apoderado/hijos/…/libreta", {
        token: t,
        params: { id: estudiantes[estudiante] },
      })
    ).datos as LibretaDelHijo;
  const bimestreDe = (libreta: Libreta, id: string) => libreta.bimestres.find((b) => b.id === id)!;

  // ---------- Seguridad ----------

  it("401 sin sesión en todos los endpoints", async () => {
    const hijo = { id: estudiantes.valeria };
    for (const r of [
      await pedir(listarRuta, "/evaluacion/publicaciones"),
      await pedir(publicarRuta, "/evaluacion/publicaciones", { metodo: "POST", cuerpo: { cierreIds: [cierre.matAI] } }),
      await pedir(detalleRuta, "/evaluacion/publicaciones/…", { params: { cierreId: cierre.matAI } }),
      await pedir(libretaHijo, "/evaluacion/apoderado/hijos/…/libreta", { params: hijo }),
      await pedir(libretaHijoPdf, `/evaluacion/apoderado/hijos/…/libreta/pdf?periodoId=${bimestreI}`, { params: hijo }),
      await pedir(libretaAlumno, "/evaluacion/alumno/libreta"),
      await pedir(libretaAlumnoPdf, `/evaluacion/alumno/libreta/pdf?periodoId=${bimestreI}`),
      await pedir(horarioPdf, "/horarios/apoderado/hijos/…/horario/pdf", { params: hijo }),
    ]) {
      expect(r.estado).toBe(401);
    }
  });

  it("403 con otro perfil: ni el docente ni el apoderado publican; el alumno no usa las rutas del apoderado", async () => {
    const hijo = { id: estudiantes.valeria };
    for (const r of [
      await pedir(listarRuta, "/evaluacion/publicaciones", { token: token.docente }),
      await pedir(publicarRuta, "/evaluacion/publicaciones", {
        token: token.apoderadoA,
        metodo: "POST",
        cuerpo: { cierreIds: [cierre.matAI] },
      }),
      await pedir(detalleRuta, "/evaluacion/publicaciones/…", {
        token: token.valeria,
        params: { cierreId: cierre.matAI },
      }),
      await pedir(libretaHijo, "/evaluacion/apoderado/hijos/…/libreta", { token: token.valeria, params: hijo }),
      await pedir(libretaHijoPdf, `/evaluacion/apoderado/hijos/…/libreta/pdf?periodoId=${bimestreI}`, {
        token: token.docente,
        params: hijo,
      }),
      await pedir(libretaAlumno, "/evaluacion/alumno/libreta", { token: token.apoderadoA }),
      await pedir(libretaAlumnoPdf, `/evaluacion/alumno/libreta/pdf?periodoId=${bimestreI}`, { token: token.docente }),
      await pedir(horarioPdf, "/horarios/apoderado/hijos/…/horario/pdf", { token: token.valeria, params: hijo }),
    ]) {
      expect(r.estado).toBe(403);
      expect(r.error?.code).toBe("ACCESO_DENEGADO");
    }
    // la publicación no ocurrió
    expect((await prisma.cierreCalificacion.findUniqueOrThrow({ where: { id: cierre.matAI } })).estado).toBe("CERRADO");
  });

  it("un apoderado no ve la libreta, el PDF ni el horario de un estudiante que no es su hijo", async () => {
    const ajeno = { id: estudiantes.valeria };
    for (const r of [
      await pedir(libretaHijo, "/evaluacion/apoderado/hijos/…/libreta", { token: token.apoderadoB, params: ajeno }),
      await pedir(libretaHijoPdf, `/evaluacion/apoderado/hijos/…/libreta/pdf?periodoId=${bimestreI}`, {
        token: token.apoderadoB,
        params: ajeno,
      }),
      await pedir(horarioPdf, "/horarios/apoderado/hijos/…/horario/pdf", { token: token.apoderadoB, params: ajeno }),
    ]) {
      expect(r.estado).toBe(403);
      expect(r.error?.code).toBe("ESTUDIANTE_NO_VINCULADO");
    }
  });

  // ---------- Antes de publicar ----------

  it("sin publicar, la libreta no expone ninguna nota: ni del registro cerrado ni del abierto", async () => {
    const r = await libretaDe("valeria");
    if (r.restringido) throw new Error("Valeria no tiene deuda");
    for (const b of r.libreta.bimestres) {
      expect(b.cursos.every((c) => !c.publicado && c.consolidado === null && c.competencias.length === 0)).toBe(true);
    }
    expect(bimestreDe(r.libreta, bimestreI).cursos.map((c) => c.nombre)).toEqual(
      expect.arrayContaining(["Comunicación", "Matemática"]),
    );
    expect(JSON.stringify(r)).not.toMatch(/"logro":"/);
    const pdf = await pedir(libretaHijoPdf, `/evaluacion/apoderado/hijos/…/libreta/pdf?periodoId=${bimestreI}`, {
      token: token.apoderadoA,
      params: { id: estudiantes.valeria },
    });
    expect(pdf.estado).toBe(422);
    expect(pdf.error?.code).toBe("LIBRETA_SIN_PUBLICAR");
  });

  it("el administrador ve los registros cerrados por publicar y no los abiertos", async () => {
    const p = await registrosParaPublicar({ anioId });
    expect(p.porPublicar.map((r) => r.cierreId).sort()).toEqual([cierre.matAI, cierre.matBI, cierre.matAII].sort());
    expect(p.publicados).toEqual([]);
    expect(p.porPublicar.find((r) => r.cierreId === cierre.matAI)).toMatchObject({
      estado: "CERRADO",
      estudiantes: 2,
      seccion: { etiqueta: "1° LA" },
      bimestre: { numero: 1 },
    });
    const filtrado = await registrosParaPublicar({ anioId, periodoId: bimestreII });
    expect(filtrado.porPublicar.map((r) => r.cierreId)).toEqual([cierre.matAII]);
    // el detalle de un registro abierto no se muestra
    expect((await codigoDe(registroDeCierre(cierre.comAI))).codigo).toBe("NO_ENCONTRADO");
    expect((await registroDeCierre(cierre.matAI)).alumnos.map((a) => a.consolidado).sort()).toEqual(["AD", "B"]);
  });

  // ---------- Publicación (US39) ----------

  it("no publica un registro abierto y, si uno del lote falla, no publica ninguno", async () => {
    const r = await codigoDe(publicarNotas(admin, [cierre.matAI, cierre.comAI], meta));
    expect(r.codigo).toBe("REGISTRO_NO_CERRADO");
    const estados = await prisma.cierreCalificacion.findMany({
      where: { id: { in: [cierre.matAI, cierre.comAI] } },
      select: { estado: true },
    });
    expect(estados.map((e) => e.estado).sort()).toEqual(["ABIERTO", "CERRADO"]);
    expect(correo).not.toHaveBeenCalled();
  });

  it("publica el registro cerrado, lo audita y avisa en un solo correo al apoderado de los alumnos", async () => {
    const r = await publicarNotas(admin, [cierre.matAI], meta);
    expect(r.publicados).toHaveLength(1);
    expect(r.publicados[0]).toMatchObject({ cierreId: cierre.matAI, estado: "PUBLICADO" });
    const fila = await prisma.cierreCalificacion.findUniqueOrThrow({ where: { id: cierre.matAI } });
    expect(fila).toMatchObject({ estado: "PUBLICADO", publicadoPorId: admin.usuarioId });
    expect(fila.publicadoEn).not.toBeNull();

    const auditoria = await prisma.registroAuditoria.findFirstOrThrow({
      where: { accion: "PUBLICAR_NOTAS", requestId: meta.requestId, entidadId: cierre.matAI },
    });
    expect(auditoria.valorAnterior).toEqual({ estado: "CERRADO" });
    expect(auditoria.valorNuevo).toMatchObject({ estado: "PUBLICADO", anio: ANIO, bimestre: 1, estudiantes: 2 });

    // Valeria y Diego tienen la misma apoderada: un solo correo; la apoderada de Carla no recibe nada
    expect(r.aviso).toEqual({ apoderados: 1, enviados: 1 });
    expect(correo).toHaveBeenCalledTimes(1);
    const enviado = correo.mock.calls[0][0];
    expect(enviado.para).toBe(emails.apoderadoA);
    expect(enviado.texto).toContain("Valeria: Matemática · Bimestre I");
    expect(enviado.texto).toContain("Diego: Matemática · Bimestre I");

    // US55: en la misma transacción, notificación interna a la apoderada (una sola) y a Valeria, que tiene cuenta
    const notificaciones = await prisma.notificacion.findMany({
      where: { tipo: "NOTAS", usuario: { email: { in: [emails.apoderadoA, "90001221@prueba.kubo.test"] } } },
      select: { mensaje: true, enlace: true, usuario: { select: { email: true } } },
    });
    expect(notificaciones).toHaveLength(2);
    const deApoderada = notificaciones.find((n) => n.usuario.email === emails.apoderadoA)!;
    expect(deApoderada).toMatchObject({ enlace: "/apoderado/notas" });
    expect(deApoderada.mensaje).toContain("Valeria: Matemática · Bimestre I");
    expect(notificaciones.find((n) => n.usuario.email !== emails.apoderadoA)).toMatchObject({
      enlace: "/alumno/notas",
    });
    expect(await prisma.notificacion.count({ where: { usuario: { email: emails.apoderadoB } } })).toBe(0);
  });

  it("un registro publicado no se vuelve a publicar y sus notas siguen bloqueadas (US40)", async () => {
    expect((await codigoDe(publicarNotas(admin, [cierre.matAI], meta))).codigo).toBe("REGISTRO_YA_PUBLICADO");
    const nota = await prisma.nota.findFirstOrThrow({ where: { cierreId: cierre.matAI } });
    await expect(prisma.nota.update({ where: { id: nota.id }, data: { logro: "C" } })).rejects.toThrow(
      /REGISTRO_CERRADO/,
    );
    const p = await registrosParaPublicar({ anioId });
    expect(p.publicados.map((x) => x.cierreId)).toEqual([cierre.matAI]);
  });

  // ---------- Libreta del apoderado (US46) y Mis notas (US51) ----------

  it("el apoderado ve solo lo publicado: Matemática del bimestre I con sus logros; lo demás, pendiente", async () => {
    const r = await libretaDe("valeria");
    if (r.restringido) throw new Error("Valeria no tiene deuda");
    const i = bimestreDe(r.libreta, bimestreI);
    expect(i.estado).toBe("PARCIAL");
    const mat = i.cursos.find((c) => c.nombre === "Matemática")!;
    expect(mat).toMatchObject({ publicado: true, consolidado: "AD", docente: "Rosa Libreta Prueba" });
    expect(mat.competencias.map((c) => c.logro)).toEqual(["AD", "A"]);
    // Comunicación tiene notas en un registro abierto: no se exponen
    expect(i.cursos.find((c) => c.nombre === "Comunicación")).toMatchObject({
      publicado: false,
      consolidado: null,
      competencias: [],
    });
    // el bimestre II está cerrado pero no publicado: Matemática sigue pendiente
    const ii = bimestreDe(r.libreta, bimestreII);
    expect(ii.cursos.every((c) => !c.publicado && c.competencias.length === 0)).toBe(true);
    expect(i.resumen).toEqual({ AD: 1, A: 0, B: 0, C: 0 });
    expect(r.libreta.bimestrePorDefectoId).toBe(bimestreI);
  });

  it("el alumno ve en «Mis notas» lo mismo, solo de su propia matrícula", async () => {
    const r = await pedir(libretaAlumno, "/evaluacion/alumno/libreta", { token: token.valeria });
    expect(r.estado).toBe(200);
    const libreta = r.datos as Libreta;
    expect(libreta.estudiante.estudianteId).toBe(estudiantes.valeria);
    const mat = bimestreDe(libreta, bimestreI).cursos.find((c) => c.nombre === "Matemática")!;
    expect(mat).toMatchObject({ publicado: true, consolidado: "AD" });
    expect(bimestreDe(libreta, bimestreII).cursos.every((c) => !c.publicado)).toBe(true);
    // Carla (otra sección) no está publicada: el consolidado C de su registro no aparece en la libreta de Valeria
    expect(JSON.stringify(libreta)).not.toContain('"consolidado":"C"');
  });

  it("descarga la libreta en PDF de un bimestre publicado (apoderado y alumno)", async () => {
    const apoderado = await pedir(libretaHijoPdf, `/evaluacion/apoderado/hijos/…/libreta/pdf?periodoId=${bimestreI}`, {
      token: token.apoderadoA,
      params: { id: estudiantes.valeria },
    });
    expect(apoderado.estado).toBe(200);
    expect(apoderado.tipo).toContain("application/pdf");
    expect(new TextDecoder().decode(apoderado.bytes!.slice(0, 5))).toBe("%PDF-");
    const alumno = await pedir(libretaAlumnoPdf, `/evaluacion/alumno/libreta/pdf?periodoId=${bimestreI}`, {
      token: token.valeria,
    });
    expect(alumno.estado).toBe(200);
    const sinPublicar = await pedir(libretaAlumnoPdf, `/evaluacion/alumno/libreta/pdf?periodoId=${bimestreII}`, {
      token: token.valeria,
    });
    expect(sinPublicar.error?.code).toBe("LIBRETA_SIN_PUBLICAR");
  });

  it("el horario en PDF no se genera si la sección no tiene horario publicado", async () => {
    const r = await pedir(horarioPdf, "/horarios/apoderado/hijos/…/horario/pdf", {
      token: token.apoderadoA,
      params: { id: estudiantes.valeria },
    });
    expect(r.estado).toBe(422);
    expect(r.error?.code).toBe("HORARIO_NO_PUBLICADO");
  });

  // ---------- Restricción por deuda (US26) ----------

  it("con 2 pensiones vencidas el apoderado no ve la libreta ni la descarga; al pagar una, se restablece", async () => {
    const pensiones = await prisma.conceptoCobro.findMany({
      where: { matriculaId: matriculas.diego, tipo: "PENSION" },
      orderBy: { fechaVencimiento: "asc" },
      take: 2,
    });
    // vencidas respecto de hoy: la consulta usa la fecha real, no la del año de prueba
    for (const [i, p] of pensiones.entries()) {
      await prisma.conceptoCobro.update({
        where: { id: p.id },
        data: { fechaVencimiento: new Date(`2026-0${i + 1}-05T00:00:00Z`) },
      });
    }

    const r = await libretaDe("diego");
    expect(r.restringido).toBe(true);
    if (!r.restringido) return;
    expect(r.mensaje).toBe(MENSAJE_RESTRICCION_DEUDA);
    expect(r.deuda.pensiones).toHaveLength(2);
    expect(r.deuda.total).toBe("800.00");
    // sin ninguna calificación, aunque Matemática del bimestre I de Diego ya está publicada
    expect(JSON.stringify(r)).not.toMatch(/"logro|"consolidado|"cursos"/);
    const pdf = await pedir(libretaHijoPdf, `/evaluacion/apoderado/hijos/…/libreta/pdf?periodoId=${bimestreI}`, {
      token: token.apoderadoA,
      params: { id: estudiantes.diego },
    });
    expect(pdf.estado).toBe(403);
    expect(pdf.error).toMatchObject({ code: "LIBRETA_RESTRINGIDA", message: MENSAJE_RESTRICCION_DEUDA });

    // su hermana Valeria no tiene deuda: la misma apoderada sí ve su libreta
    expect((await libretaDe("valeria")).restringido).toBe(false);

    // con una sola pensión vencida ya no se restringe: se calcula en cada consulta
    await prisma.conceptoCobro.update({ where: { id: pensiones[0].id }, data: { estado: "PAGADO" } });
    const despues = await libretaDe("diego");
    expect(despues.restringido).toBe(false);
    if (despues.restringido) return;
    expect(bimestreDe(despues.libreta, bimestreI).cursos.find((c) => c.nombre === "Matemática")?.consolidado).toBe("B");
  });
});
