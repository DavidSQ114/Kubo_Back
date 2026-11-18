// Prueba de integración (US37, US39, US40): registro de notas, cierre y consolidación del bimestre y bloqueo del
// registro cerrado. Seguridad de los endpoints (401 sin sesión, 403 con otro perfil, un docente no ve ni califica
// cursos ajenos), guardado parcial con el valor anterior, cierre incompleto, cierre concurrente del mismo registro,
// consolidación con la versión de la regla de cada bimestre y escritura rechazada después del cierre.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/evaluacion/notas.integracion
// Crea sus propios datos ficticios en el año 2088 (en curso, con dos bimestres) y los borra al terminar. El docente
// que cierra es el administrador del seed con un perfil Docente temporal: la bitácora de auditoría es inmutable y
// quien la firma no se puede borrar.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { enviarCorreo } from "@/platform/correo";
import { prisma } from "@/platform/db/prisma";
import { GET as verRegistro } from "@/app/api/v1/evaluacion/registros/[asignacionId]/bimestres/[periodoId]/route";
import { PUT as guardarRuta } from "@/app/api/v1/evaluacion/registros/[asignacionId]/bimestres/[periodoId]/notas/route";
import { POST as cerrarRuta } from "@/app/api/v1/evaluacion/registros/[asignacionId]/bimestres/[periodoId]/cerrar/route";
import { GET as misRegistrosRuta } from "@/app/api/v1/evaluacion/registros/route";
import { cerrarRegistro, guardarNotas, misRegistros, registroDeNotas, type LogroNota } from "@/modules/evaluacion";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { confirmarMatricula } from "@/modules/matricula";

vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2088;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2088";
const meta = { requestId: `prueba-notas-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;

// Fechas fijas (Lima es UTC−5): el 12/04/2088 cae en el bimestre I y el 10/06/2088, en el II
const ABRIL = new Date("2088-04-12T15:00:00Z");
const JUNIO = new Date("2088-06-10T15:00:00Z");

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function pedir(
  manejador: Manejador,
  ruta: string,
  opciones: { token?: string; params?: Record<string, string>; metodo?: "POST" | "PUT"; cuerpo?: unknown } = {},
) {
  const req = new NextRequest(`http://localhost/api/v1${ruta}`, {
    method: opciones.metodo ?? "GET",
    headers: opciones.token ? { authorization: `Bearer ${opciones.token}` } : undefined,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  const res = await manejador(req, { params: Promise.resolve(opciones.params ?? {}) });
  const json = await res.json();
  return {
    estado: res.status,
    datos: json.data,
    error: json.error as { code: string; message: string; details: Record<string, unknown> } | undefined,
  };
}

/** Código del ErrorApp con el que se rechaza la promesa. */
async function codigoDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return { codigo: (e as { codigo?: string }).codigo, mensaje: (e as Error).message, error: e };
  }
  throw new Error("Se esperaba un rechazo");
}

describe.skipIf(!ACTIVA)("registro de notas, cierre de bimestre y bloqueo (US37, US39, US40)", () => {
  let anioId: string;
  let bimestreI: string;
  let bimestreII: string;
  const reglaIds: Record<"v1" | "v2", string> = { v1: "", v2: "" };
  let seccionA: string;
  let seccionB: string;
  let asignacionA: string;
  let asignacionB: string;
  const competencias: string[] = [];
  const personas: string[] = [];
  let docenteAdminCreado = false;
  let adminPersonaId: string;
  // el administrador del seed con perfil Docente: dicta la sección A y es quien cierra
  let propio: Autenticado;
  // otro docente: dicta la sección B
  let ajeno: Autenticado;
  const alumnos: Record<"ana" | "bruno" | "carla", string> = { ana: "", bruno: "", carla: "" };
  const token: Record<"ajeno" | "apoderado", string> = { ajeno: "", apoderado: "" };
  const correo = vi.mocked(enviarCorreo);

  const params = (asignacionId: string, periodoId: string) => ({ asignacionId, periodoId });
  const nota = (alumno: keyof typeof alumnos, competencia: number, logro: LogroNota) => ({
    matriculaId: alumnos[alumno],
    competenciaPlanId: competencias[competencia],
    logro,
  });

  async function ingresar(email: string) {
    const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
    if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
    return r.tokens.acceso;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    adminPersonaId = u.personaId;
    const admin: Autenticado = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "ADMINISTRADOR",
      debeCambiarPassword: false,
    };
    const passwordHash = await hashPassword(CLAVE);
    const cuenta = async (personaId: string, email: string, rol: Autenticado["rol"]): Promise<Autenticado> => {
      const usuario = await prisma.usuario.create({
        data: { personaId, email, passwordHash, estado: "ACTIVO", debeCambiarPassword: false },
      });
      return { usuarioId: usuario.id, sesionId: "prueba", personaId, email, rol, debeCambiarPassword: false };
    };

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
          estado: numero === 1 ? "ACTIVO" : "INACTIVO",
        },
      });
    bimestreI = (await bimestre(1, "Bimestre I", "03-01", "05-13")).id;
    bimestreII = (await bimestre(2, "Bimestre II", "05-16", "07-22")).id;
    // US12: la v1 (moda) rige desde el inicio del año; la v2 (ponderado, vigente) desde el bimestre II
    reglaIds.v1 = (
      await prisma.reglaConsolidacion.create({
        data: {
          anioAcademicoId: anioId,
          nombre: "Moda de los logros",
          metodo: "MODA",
          criterioDesempate: "MAYOR_JERARQUIA",
          configuracion: {},
          version: 1,
          estado: "ARCHIVADA",
        },
      })
    ).id;
    reglaIds.v2 = (
      await prisma.reglaConsolidacion.create({
        data: {
          anioAcademicoId: anioId,
          rigeDesdeId: bimestreII,
          nombre: "Promedio ponderado",
          metodo: "PONDERADO",
          criterioDesempate: "MAYOR_JERARQUIA",
          configuracion: {},
          version: 2,
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
    seccionA = (await seccion("NA")).id;
    seccionB = (await seccion("NB")).id;

    // Matemática con tres competencias de su área: pesos 2, 1 y 1
    const mat = await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } });
    const delArea = await prisma.competencia.findMany({
      where: { areaCurricularId: mat.areaCurricularId },
      orderBy: { codigo: "asc" },
      take: 3,
    });
    expect(delArea).toHaveLength(3);
    const plan = await prisma.planEstudio.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: mat.id, horasSemanales: 4 },
    });
    for (const [i, c] of delArea.entries()) {
      const cp = await prisma.competenciaPlan.create({
        data: { planEstudioId: plan.id, competenciaId: c.id, orden: i + 1, peso: i === 0 ? 2 : 1 },
      });
      competencias.push(cp.id);
    }

    // docentes: el admin con perfil Docente (sección A) y Ríos (sección B)
    const docenteAdmin = await prisma.docente.findUnique({ where: { personaId: u.personaId } });
    const docenteAdminId = docenteAdmin?.id ?? (await prisma.docente.create({ data: { personaId: u.personaId } })).id;
    docenteAdminCreado = !docenteAdmin;
    propio = { ...admin, rol: "DOCENTE" };
    const pRios = await prisma.persona.create({
      data: {
        dni: "90001101",
        nombres: "Julia",
        apellidos: "Ríos Prueba",
        email: "90001101@prueba.kubo.test",
        docente: { create: {} },
      },
      include: { docente: true },
    });
    personas.push(pRios.id);
    ajeno = await cuenta(pRios.id, pRios.email!, "DOCENTE");
    asignacionA = (
      await prisma.asignacionDocente.create({
        data: { planEstudioId: plan.id, seccionId: seccionA, docenteId: docenteAdminId },
      })
    ).id;
    asignacionB = (
      await prisma.asignacionDocente.create({
        data: { planEstudioId: plan.id, seccionId: seccionB, docenteId: pRios.docente!.id },
      })
    ).id;

    // una familia con cuenta de apoderado: Ana y Bruno en la sección A y Carla en la B
    const pApoderado = await prisma.persona.create({
      data: {
        dni: "90001111",
        nombres: "Prueba",
        apellidos: "Apoderado Notas",
        email: "90001111@prueba.kubo.test",
        apoderado: { create: {} },
      },
      include: { apoderado: true },
    });
    personas.push(pApoderado.id);
    await cuenta(pApoderado.id, pApoderado.email!, "APODERADO");
    for (const [clave, dni, nombres, apellidos, seccionId] of [
      ["ana", "90001121", "Ana", "Álvarez Prueba", seccionA],
      ["bruno", "90001122", "Bruno", "Castillo Prueba", seccionA],
      ["carla", "90001123", "Carla", "Mendoza Prueba", seccionB],
    ] as const) {
      const es = await prisma.persona.create({
        data: { dni, nombres, apellidos, estudiante: { create: { gradoIngresoId: grado.id } } },
        include: { estudiante: true },
      });
      personas.push(es.id);
      const v = await prisma.vinculoApoderado.create({
        data: {
          estudianteId: es.estudiante!.id,
          apoderadoId: pApoderado.apoderado!.id,
          parentesco: "Madre",
          esPrincipal: true,
        },
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
      alumnos[clave] = m.matriculaId;
    }
    token.ajeno = await ingresar(ajeno.email);
    token.apoderado = await ingresar(pApoderado.email!);
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
    if (docenteAdminCreado) await prisma.docente.deleteMany({ where: { personaId: adminPersonaId } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  }, ESPERA_PREPARACION);

  // ---------- Seguridad ----------

  it("401 sin sesión y 403 con otro perfil en todos los endpoints", async () => {
    const p = params(asignacionA, bimestreI);
    const cuerpo = { notas: [nota("ana", 0, "A")] };
    expect((await pedir(misRegistrosRuta, "/evaluacion/registros")).estado).toBe(401);
    expect((await pedir(verRegistro, "/evaluacion/registros/…", { params: p })).estado).toBe(401);
    for (const r of [
      await pedir(misRegistrosRuta, "/evaluacion/registros", { token: token.apoderado }),
      await pedir(verRegistro, "/evaluacion/registros/…", { token: token.apoderado, params: p }),
      await pedir(guardarRuta, "/evaluacion/registros/…/notas", {
        token: token.apoderado,
        params: p,
        metodo: "PUT",
        cuerpo,
      }),
      await pedir(cerrarRuta, "/evaluacion/registros/…/cerrar", { token: token.apoderado, params: p, metodo: "POST" }),
    ]) {
      expect(r.estado).toBe(403);
      expect(r.error?.code).toBe("ACCESO_DENEGADO");
    }
  });

  it("un docente solo ve sus cursos y no ve, califica ni cierra los de otra sección", async () => {
    const mios = await misRegistros(ajeno, ABRIL);
    expect(mios.anio?.anio).toBe(ANIO);
    expect(mios.bimestreActivoId).toBe(bimestreI);
    expect(mios.cursos.map((c) => c.asignacionId)).toEqual([asignacionB]);

    const p = params(asignacionA, bimestreI);
    const ver = await pedir(verRegistro, "/evaluacion/registros/…", { token: token.ajeno, params: p });
    const guardar = await pedir(guardarRuta, "/evaluacion/registros/…/notas", {
      token: token.ajeno,
      params: p,
      metodo: "PUT",
      cuerpo: { notas: [nota("ana", 0, "C")] },
    });
    const cerrar = await pedir(cerrarRuta, "/evaluacion/registros/…/cerrar", {
      token: token.ajeno,
      params: p,
      metodo: "POST",
    });
    for (const r of [ver, guardar, cerrar]) expect(r.estado).toBe(403);
    expect(await prisma.nota.count({ where: { matriculaId: alumnos.ana } })).toBe(0);
  });

  // ---------- US37 · Registro de notas ----------

  it("muestra la grilla del bimestre activo: alumnos con matrícula vigente por competencias del curso", async () => {
    const r = await registroDeNotas(propio, asignacionA, bimestreI, ABRIL);
    expect(r).toMatchObject({
      estado: "ABIERTO",
      editable: true,
      motivoSoloLectura: null,
      seccion: { etiqueta: "1° NA" },
      regla: { version: 1, metodo: "MODA" },
      avance: { calificadas: 0, total: 6, porcentaje: 0, alumnosPendientes: 2 },
    });
    expect(r.alumnos.map((a) => a.nombre)).toEqual(["Álvarez Prueba, Ana", "Castillo Prueba, Bruno"]);
    expect(r.competencias.map((c) => c.competenciaPlanId)).toEqual(competencias);
  });

  it("un bimestre que no está activo se ve en solo lectura y rechaza notas", async () => {
    const r = await registroDeNotas(propio, asignacionA, bimestreII, ABRIL);
    expect(r).toMatchObject({ editable: false, motivoSoloLectura: "PERIODO_NO_ACTIVO" });
    expect(r.mensaje).toBe("Este periodo de evaluación no está activo.");
    const e = await codigoDe(guardarNotas(propio, asignacionA, bimestreII, { notas: [nota("ana", 0, "A")] }, ABRIL));
    expect(e.codigo).toBe("PERIODO_NO_ACTIVO");
  });

  it("la API rechaza un valor fuera de la escala con «Solo se permiten los valores AD, A, B o C»", async () => {
    const r = await pedir(guardarRuta, "/evaluacion/registros/…/notas", {
      token: token.ajeno,
      params: params(asignacionB, bimestreI),
      metodo: "PUT",
      cuerpo: { notas: [{ ...nota("carla", 1, "A"), logro: "15" }] },
    });
    expect(r.estado).toBe(400);
    expect(r.error).toMatchObject({ code: "VALOR_NO_PERMITIDO", message: "Solo se permiten los valores AD, A, B o C" });
    expect(await prisma.nota.count({ where: { matriculaId: alumnos.carla } })).toBe(0);
  });

  it("guarda una parte del registro y cada cambio conserva el valor anterior, quién y cuándo", async () => {
    const r1 = await guardarNotas(
      propio,
      asignacionA,
      bimestreI,
      { notas: [nota("ana", 0, "A"), nota("ana", 1, "AD"), nota("ana", 2, "AD")] },
      ABRIL,
    );
    expect(r1.guardado).toEqual({ nuevas: 3, modificadas: 0, sinCambio: 0 });
    expect(r1.avance).toMatchObject({ calificadas: 3, porcentaje: 50, alumnosPendientes: 1 });
    // Ana ya está completa: vista previa con la moda (AD)
    expect(r1.alumnos[0]).toMatchObject({ completo: true, consolidado: "AD" });

    const r2 = await guardarNotas(
      propio,
      asignacionA,
      bimestreI,
      { notas: [nota("ana", 0, "B"), nota("ana", 1, "AD")] },
      ABRIL,
    );
    expect(r2.guardado).toEqual({ nuevas: 0, modificadas: 1, sinCambio: 1 });
    const cambiada = await prisma.nota.findFirstOrThrow({
      where: { matriculaId: alumnos.ana, competenciaPlanId: competencias[0] },
    });
    expect(cambiada).toMatchObject({ logro: "B", logroAnterior: "A", modificadoPorId: propio.usuarioId });
    expect(cambiada.modificadoEn).toBeInstanceOf(Date);
    expect(r2.alumnos[0].notas[competencias[0]]).toMatchObject({ logro: "B", logroAnterior: "A" });
  });

  // ---------- US39 · Cierre ----------

  it("no cierra con notas incompletas e indica qué alumnos y competencias faltan", async () => {
    await guardarNotas(propio, asignacionA, bimestreI, { notas: [nota("bruno", 0, "C")] }, ABRIL);
    const e = await codigoDe(cerrarRegistro(propio, asignacionA, bimestreI, meta, ABRIL));
    expect(e.codigo).toBe("NOTAS_INCOMPLETAS");
    expect(e.mensaje).toBe("Existen registros de notas incompletos");
    const { pendientes } = (e.error as { detalles: { pendientes: { matriculaId: string; competencias: unknown[] }[] } })
      .detalles;
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0]).toMatchObject({ matriculaId: alumnos.bruno, nombre: "Castillo Prueba, Bruno" });
    expect(pendientes[0].competencias).toHaveLength(2);
    expect(
      (await prisma.cierreCalificacion.findFirstOrThrow({ where: { asignacionDocenteId: asignacionA } })).estado,
    ).toBe("ABIERTO");
  });

  it("dos cierres a la vez del mismo registro: uno consolida y el otro encuentra el registro cerrado", async () => {
    await guardarNotas(
      propio,
      asignacionA,
      bimestreI,
      { notas: [nota("bruno", 1, "B"), nota("bruno", 2, "B")] },
      ABRIL,
    );
    correo.mockClear();
    const [a, b] = await Promise.allSettled([
      cerrarRegistro(propio, asignacionA, bimestreI, meta, ABRIL),
      cerrarRegistro(propio, asignacionA, bimestreI, meta, ABRIL),
    ]);
    const exitos = [a, b].filter((x) => x.status === "fulfilled");
    const rechazos = [a, b].filter((x) => x.status === "rejected") as PromiseRejectedResult[];
    expect(exitos).toHaveLength(1);
    expect(rechazos).toHaveLength(1);
    expect((rechazos[0].reason as { codigo: string }).codigo).toBe("REGISTRO_CERRADO");

    const cierre = await prisma.cierreCalificacion.findFirstOrThrow({
      where: { asignacionDocenteId: asignacionA, periodoEvaluacionId: bimestreI },
      include: { resultadosConsolidados: true },
    });
    // la v1 (moda) rige en el bimestre I: Ana B, AD, AD → AD; Bruno C, B, B → B
    expect(cierre).toMatchObject({
      estado: "CERRADO",
      reglaConsolidacionId: reglaIds.v1,
      cerradoPorId: propio.usuarioId,
    });
    const logro = (m: string) => cierre.resultadosConsolidados.find((r) => r.matriculaId === m)?.logroConsolidado;
    expect(cierre.resultadosConsolidados).toHaveLength(2);
    expect(logro(alumnos.ana)).toBe("AD");
    expect(logro(alumnos.bruno)).toBe("B");
    expect(cierre.resultadosConsolidados[0].detalleCalculo).toMatchObject({ regla: { version: 1, metodo: "MODA" } });

    const vista = (exitos[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof cerrarRegistro>>>).value;
    expect(vista).toMatchObject({ estado: "CERRADO", editable: false, regla: { version: 1 } });
    expect(vista.alumnos.map((x) => x.consolidado)).toEqual(["AD", "B"]);
    expect(vista.aviso.enviados).toBeGreaterThanOrEqual(1);
    expect(correo.mock.calls.map(([c]) => c.para)).toContain("admin@kubo.edu.pe");

    const auditoria = await prisma.registroAuditoria.findMany({
      where: { requestId: meta.requestId, accion: "CERRAR_REGISTRO_NOTAS" },
    });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({ entidadAfectada: "cierre_calificacion", entidadId: cierre.id });
    expect(auditoria[0].valorNuevo).toMatchObject({
      estado: "CERRADO",
      estudiantes: 2,
      regla: { version: 1 },
      consolidados: { AD: 1, A: 0, B: 1, C: 0 },
    });
  });

  // ---------- US40 · Registro cerrado ----------

  it("después del cierre rechaza cualquier escritura: por el caso de uso de la API y directo en la base", async () => {
    const e = await codigoDe(guardarNotas(propio, asignacionA, bimestreI, { notas: [nota("ana", 0, "AD")] }, ABRIL));
    expect(e.codigo).toBe("REGISTRO_CERRADO");
    expect(e.mensaje).toBe("Este registro está cerrado y no puede modificarse directamente.");

    const guardada = await prisma.nota.findFirstOrThrow({
      where: { matriculaId: alumnos.ana, competenciaPlanId: competencias[0] },
    });
    await expect(prisma.nota.update({ where: { id: guardada.id }, data: { logro: "AD" } })).rejects.toThrow(
      /REGISTRO_CERRADO/,
    );
    expect((await prisma.nota.findUniqueOrThrow({ where: { id: guardada.id } })).logro).toBe("B");

    const r = await registroDeNotas(propio, asignacionA, bimestreI, ABRIL);
    expect(r).toMatchObject({ estado: "CERRADO", editable: false, motivoSoloLectura: "REGISTRO_CERRADO" });
    expect(r.correccion).toContain("envía una solicitud de rectificación a la administración");
    expect((await misRegistros(propio, ABRIL)).cursos[0].estados[bimestreI]).toBe("CERRADO");
  });

  it("en el bimestre II consolida con la versión que rige ahí (promedio ponderado con pesos 2, 1, 1)", async () => {
    const r = await registroDeNotas(propio, asignacionA, bimestreII, JUNIO);
    expect(r).toMatchObject({ editable: true, regla: { version: 2, metodo: "PONDERADO" } });
    await guardarNotas(
      propio,
      asignacionA,
      bimestreII,
      {
        notas: [
          // Ana: (1×2 + 4 + 4) / 4 = 2,5 → A · Bruno: (4×2 + 2 + 2) / 4 = 3 → A
          nota("ana", 0, "C"),
          nota("ana", 1, "AD"),
          nota("ana", 2, "AD"),
          nota("bruno", 0, "AD"),
          nota("bruno", 1, "B"),
          nota("bruno", 2, "B"),
        ],
      },
      JUNIO,
    );
    const cerrado = await cerrarRegistro(propio, asignacionA, bimestreII, meta, JUNIO);
    expect(cerrado.alumnos.map((a) => a.consolidado)).toEqual(["A", "A"]);
    const cierre = await prisma.cierreCalificacion.findFirstOrThrow({
      where: { asignacionDocenteId: asignacionA, periodoEvaluacionId: bimestreII },
      include: { resultadosConsolidados: true },
    });
    expect(cierre.reglaConsolidacionId).toBe(reglaIds.v2);
    expect(cierre.resultadosConsolidados[0].detalleCalculo).toMatchObject({
      regla: { version: 2, metodo: "PONDERADO" },
    });
  });
});
