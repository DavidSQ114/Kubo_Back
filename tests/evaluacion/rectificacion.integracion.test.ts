// Prueba de integración (US03, US41): bitácora de notas y solicitud de rectificación. Seguridad de los endpoints
// (401 sin sesión, 403 con otro perfil, un docente no pide rectificaciones de un curso ajeno, nadie resuelve su propia
// solicitud), bitácora escrita en la misma transacción que la nota e inmutable, el trigger de US40 que sigue
// rechazando la escritura directa y solo deja pasar la rectificación aprobada, dos aprobaciones a la vez (solo una
// aplica), recálculo con la regla usada al cerrar, libreta del apoderado con el valor corregido y rechazo con motivo.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/evaluacion/rectificacion.integracion
// Crea sus propios datos ficticios en el año 2086 y los borra al terminar (la bitácora de notas no se borra: es
// inmutable y no tiene claves foráneas). Quien cierra y publica es el administrador del seed (con un perfil Docente
// temporal): la auditoría es inmutable y quien la firma no se puede borrar. Por eso la sección B pasa después a la
// docente Ríos, que es quien pide la rectificación que aprueba el administrador.
import "@/server/wiring";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/platform/auth/tokens";
import { enviarCorreo } from "@/platform/correo";
import { prisma } from "@/platform/db/prisma";
import { GET as docentesBitacoraRuta } from "@/app/api/v1/evaluacion/bitacora/docentes/route";
import { GET as bitacoraRuta } from "@/app/api/v1/evaluacion/bitacora/route";
import { GET as misRuta } from "@/app/api/v1/evaluacion/docente/rectificaciones/route";
import { POST as aprobarRuta } from "@/app/api/v1/evaluacion/rectificaciones/[id]/aprobar/route";
import { POST as rechazarRuta } from "@/app/api/v1/evaluacion/rectificaciones/[id]/rechazar/route";
import { GET as bandejaRuta } from "@/app/api/v1/evaluacion/rectificaciones/route";
import { POST as solicitarRuta } from "@/app/api/v1/evaluacion/registros/[asignacionId]/bimestres/[periodoId]/rectificaciones/route";
import {
  aprobarRectificacion,
  bandejaRectificaciones,
  cerrarRegistro,
  docentesDeBitacora,
  guardarNotas,
  libretaDelHijo,
  listarBitacoraNotas,
  publicarNotas,
  rechazarRectificacion,
  solicitarRectificacion,
  type LogroNota,
} from "@/modules/evaluacion";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { confirmarMatricula } from "@/modules/matricula";

vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2086;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2086";
const meta = { requestId: `prueba-rectificacion-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;
// 12/04/2086 cae en el bimestre I (Lima es UTC−5)
const ABRIL = new Date("2086-04-12T15:00:00Z");

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
  const json = await res.json();
  return {
    estado: res.status,
    datos: json.data,
    error: json.error as { code: string; message: string; details: Record<string, unknown> } | undefined,
  };
}

async function codigoDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return { codigo: (e as { codigo?: string }).codigo, mensaje: (e as Error).message };
  }
  throw new Error("Se esperaba un rechazo");
}

/** «AAAA-MM-DD» de hoy en Lima: la bitácora guarda la hora real del cambio. */
const hoyEnLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

describe.skipIf(!ACTIVA)("bitácora de notas y rectificación de nota (US03, US41)", () => {
  let anioId: string;
  let bimestre: string;
  let reglaV1: string;
  let planId: string;
  let asignacionA: string;
  let asignacionB: string;
  let docenteAdminId: string;
  let docenteRiosId: string;
  let cierreA: string;
  let cierreB: string;
  const competencias: string[] = [];
  const personas: string[] = [];
  let docenteAdminCreado = false;
  let adminPersonaId: string;
  let admin: Autenticado;
  // el administrador del seed con perfil Docente: registra y cierra las secciones A y B
  let propio: Autenticado;
  // la docente Ríos: recibe la sección B y pide la rectificación que aprueba el administrador
  let rios: Autenticado;
  let apoderado: Autenticado;
  const alumnos: Record<"ana" | "bruno" | "carla", { matriculaId: string; estudianteId: string }> = {
    ana: { matriculaId: "", estudianteId: "" },
    bruno: { matriculaId: "", estudianteId: "" },
    carla: { matriculaId: "", estudianteId: "" },
  };
  const token: Record<"rios" | "apoderado", string> = { rios: "", apoderado: "" };
  const solicitud: Record<"carla" | "carlaRechazo" | "propia", string> = { carla: "", carlaRechazo: "", propia: "" };
  const correo = vi.mocked(enviarCorreo);

  const nota = (alumno: keyof typeof alumnos, competencia: number, logro: LogroNota) => ({
    matriculaId: alumnos[alumno].matriculaId,
    competenciaPlanId: competencias[competencia],
    logro,
  });
  const pedido = (alumno: keyof typeof alumnos, competencia: number, valorCorrecto: LogroNota, motivo: string) => ({
    matriculaId: alumnos[alumno].matriculaId,
    competenciaPlanId: competencias[competencia],
    valorCorrecto,
    motivo,
  });
  const notaEnBase = (alumno: keyof typeof alumnos, competencia: number) =>
    prisma.nota.findFirstOrThrow({
      where: { matriculaId: alumnos[alumno].matriculaId, competenciaPlanId: competencias[competencia] },
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
    admin = {
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
    bimestre = (
      await prisma.periodoEvaluacion.create({
        data: {
          anioAcademicoId: anioId,
          numero: 1,
          nombre: "Bimestre I",
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-05-13T00:00:00Z`),
          estado: "ACTIVO",
        },
      })
    ).id;
    // US12: la v1 (moda) es la que rige al cerrar; después se publica una v2 (ponderado) desde el mismo bimestre
    reglaV1 = (
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
    const seccionA = (await seccion("RA")).id;
    const seccionB = (await seccion("RB")).id;

    // Matemática con tres competencias: pesos 2, 1 y 1 (solo cuentan con el promedio ponderado)
    const mat = await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } });
    const delArea = await prisma.competencia.findMany({
      where: { areaCurricularId: mat.areaCurricularId },
      orderBy: { codigo: "asc" },
      take: 3,
    });
    expect(delArea).toHaveLength(3);
    planId = (
      await prisma.planEstudio.create({
        data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: mat.id, horasSemanales: 4 },
      })
    ).id;
    for (const [i, c] of delArea.entries()) {
      const cp = await prisma.competenciaPlan.create({
        data: { planEstudioId: planId, competenciaId: c.id, orden: i + 1, peso: i === 0 ? 2 : 1 },
      });
      competencias.push(cp.id);
    }

    const docenteAdmin = await prisma.docente.findUnique({ where: { personaId: u.personaId } });
    docenteAdminId = docenteAdmin?.id ?? (await prisma.docente.create({ data: { personaId: u.personaId } })).id;
    docenteAdminCreado = !docenteAdmin;
    propio = { ...admin, rol: "DOCENTE" };
    const pRios = await prisma.persona.create({
      data: {
        dni: "90001301",
        nombres: "Julia",
        apellidos: "Ríos Prueba",
        email: "90001301@prueba.kubo.test",
        docente: { create: {} },
      },
      include: { docente: true },
    });
    personas.push(pRios.id);
    docenteRiosId = pRios.docente!.id;
    rios = await cuenta(pRios.id, pRios.email!, "DOCENTE");
    asignacionA = (
      await prisma.asignacionDocente.create({
        data: { planEstudioId: planId, seccionId: seccionA, docenteId: docenteAdminId },
      })
    ).id;
    asignacionB = (
      await prisma.asignacionDocente.create({
        data: { planEstudioId: planId, seccionId: seccionB, docenteId: docenteAdminId },
      })
    ).id;

    // una familia con cuenta de apoderado: Ana y Bruno en la sección A y Carla en la B
    const pApoderado = await prisma.persona.create({
      data: {
        dni: "90001311",
        nombres: "Prueba",
        apellidos: "Apoderado Rectificación",
        email: "90001311@prueba.kubo.test",
        apoderado: { create: {} },
      },
      include: { apoderado: true },
    });
    personas.push(pApoderado.id);
    apoderado = await cuenta(pApoderado.id, pApoderado.email!, "APODERADO");
    for (const [clave, dni, nombres, apellidos, seccionId] of [
      ["ana", "90001321", "Ana", "Álvarez Prueba", seccionA],
      ["bruno", "90001322", "Bruno", "Castillo Prueba", seccionA],
      ["carla", "90001323", "Carla", "Mendoza Prueba", seccionB],
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
      alumnos[clave] = { matriculaId: m.matriculaId, estudianteId: es.estudiante!.id };
    }
    token.rios = await ingresar(rios.email);
    token.apoderado = await ingresar(apoderado.email);
    correo.mockClear();
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    if (!anioId) return;
    // las solicitudes primero: su nota y su solicitante no se pueden borrar mientras existan
    await prisma.solicitudRectificacion.deleteMany({
      where: { nota: { cierre: { periodoEvaluacion: { anioAcademicoId: anioId } } } },
    });
    // al borrar el cierre se van sus notas y sus resultados (el trigger de US40 solo bloquea crear o cambiar)
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
    const id = "11111111-1111-4111-8111-111111111111";
    const p = { asignacionId: asignacionA, periodoId: bimestre };
    const cuerpo = pedido("ana", 0, "A", "Error de digitación");
    const llamadas = (t?: string) => [
      pedir(solicitarRuta, "/evaluacion/registros/…/rectificaciones", { token: t, params: p, metodo: "POST", cuerpo }),
      pedir(misRuta, "/evaluacion/docente/rectificaciones", { token: t }),
      pedir(bandejaRuta, "/evaluacion/rectificaciones", { token: t }),
      pedir(aprobarRuta, "/evaluacion/rectificaciones/…/aprobar", { token: t, params: { id }, metodo: "POST" }),
      pedir(rechazarRuta, "/evaluacion/rectificaciones/…/rechazar", {
        token: t,
        params: { id },
        metodo: "POST",
        cuerpo: { motivo: "x" },
      }),
      pedir(bitacoraRuta, "/evaluacion/bitacora", { token: t }),
      pedir(docentesBitacoraRuta, "/evaluacion/bitacora/docentes", { token: t }),
    ];
    for (const r of await Promise.all(llamadas())) expect(r.estado).toBe(401);
    // el apoderado no entra a ninguno; la docente, solo a los suyos (pedir y ver sus solicitudes)
    const conApoderado = await Promise.all(llamadas(token.apoderado));
    const conDocente = (await Promise.all(llamadas(token.rios))).slice(2);
    for (const r of [...conApoderado, ...conDocente]) {
      expect(r.estado).toBe(403);
      expect(r.error?.code).toBe("ACCESO_DENEGADO");
    }
  });

  // ---------- US03 · Bitácora ----------

  it("cada nota nueva y cada cambio del docente queda en la bitácora con su valor anterior", async () => {
    await guardarNotas(
      propio,
      asignacionA,
      bimestre,
      {
        notas: [
          nota("ana", 0, "B"),
          nota("ana", 1, "B"),
          nota("ana", 2, "A"),
          nota("bruno", 0, "AD"),
          nota("bruno", 1, "AD"),
          nota("bruno", 2, "A"),
        ],
      },
      ABRIL,
    );
    // cambia una sola nota; las otras dos llegan con el mismo valor y no cuentan como cambio
    const r = await guardarNotas(
      propio,
      asignacionA,
      bimestre,
      { notas: [nota("ana", 0, "B"), nota("ana", 1, "B"), nota("ana", 2, "C")] },
      ABRIL,
    );
    expect(r.guardado).toMatchObject({ nuevas: 0, modificadas: 1, sinCambio: 2 });

    const cierre = await prisma.cierreCalificacion.findFirstOrThrow({ where: { asignacionDocenteId: asignacionA } });
    cierreA = cierre.id;
    const filas = await prisma.bitacoraNota.findMany({ where: { cierreId: cierreA }, orderBy: { createdAt: "asc" } });
    expect(filas).toHaveLength(7);
    expect(filas.every((f) => f.origen === "REGISTRO" && f.usuarioId === admin.usuarioId)).toBe(true);
    const anaC3 = filas.filter(
      (f) => f.competenciaPlanId === competencias[2] && f.matriculaId === alumnos.ana.matriculaId,
    );
    expect(anaC3.map((f) => [f.logroAnterior, f.logroNuevo])).toEqual([
      [null, "A"],
      ["A", "C"],
    ]);
    expect(anaC3[1]).toMatchObject({
      docenteId: docenteAdminId,
      anio: ANIO,
      cursoCodigo: "MAT",
      cursoNombre: "Matemática",
      seccion: "1° RA",
      bimestreNumero: 1,
      bimestreNombre: "Bimestre I",
      estudianteNombre: "Álvarez Prueba, Ana",
      competenciaColumna: 3,
      solicitudId: null,
    });
    expect(anaC3[1].notaId).toBe((await notaEnBase("ana", 2)).id);
  });

  it("la bitácora es inmutable: no se cambia, no se borra ni se vacía directo en la base", async () => {
    const fila = await prisma.bitacoraNota.findFirstOrThrow({ where: { cierreId: cierreA } });
    await expect(prisma.bitacoraNota.update({ where: { id: fila.id }, data: { logroNuevo: "AD" } })).rejects.toThrow(
      /BITACORA_NOTA_INMUTABLE/,
    );
    await expect(prisma.bitacoraNota.delete({ where: { id: fila.id } })).rejects.toThrow(/BITACORA_NOTA_INMUTABLE/);
    await expect(prisma.$executeRawUnsafe("TRUNCATE bitacora_nota")).rejects.toThrow(/BITACORA_NOTA_INMUTABLE/);
    expect((await prisma.bitacoraNota.findUniqueOrThrow({ where: { id: fila.id } })).logroNuevo).toBe(fila.logroNuevo);
  });

  // ---------- US41 · Solicitud ----------

  it("en un registro abierto no se pide rectificación: la nota se corrige directamente", async () => {
    const e = await codigoDe(
      solicitarRectificacion(propio, asignacionA, bimestre, pedido("ana", 0, "A", "Error"), meta, ABRIL),
    );
    expect(e.codigo).toBe("REGISTRO_ABIERTO");
  });

  it("cierra la sección A (moda) y la publica; cierra la sección B y pasa a la docente Ríos", async () => {
    // ana [B, B, C] → B · bruno [AD, AD, A] → AD
    const a = await cerrarRegistro(propio, asignacionA, bimestre, meta, ABRIL);
    expect(a.alumnos.map((x) => x.consolidado)).toEqual(["B", "AD"]);
    await publicarNotas(admin, [cierreA], meta);

    // carla [C, B, B] → B
    await guardarNotas(
      propio,
      asignacionB,
      bimestre,
      { notas: [nota("carla", 0, "C"), nota("carla", 1, "B"), nota("carla", 2, "B")] },
      ABRIL,
    );
    const b = await cerrarRegistro(propio, asignacionB, bimestre, meta, ABRIL);
    expect(b.alumnos.map((x) => x.consolidado)).toEqual(["B"]);
    cierreB = (await prisma.cierreCalificacion.findFirstOrThrow({ where: { asignacionDocenteId: asignacionB } })).id;
    await prisma.asignacionDocente.update({ where: { id: asignacionB }, data: { docenteId: docenteRiosId } });
    correo.mockClear();
  });

  it("un docente no pide rectificaciones de un curso ajeno (403)", async () => {
    const r = await pedir(solicitarRuta, "/evaluacion/registros/…/rectificaciones", {
      token: token.rios,
      params: { asignacionId: asignacionA, periodoId: bimestre },
      metodo: "POST",
      cuerpo: pedido("ana", 0, "A", "No es mi curso"),
    });
    expect(r.estado).toBe(403);
    expect(r.error?.code).toBe("ACCESO_DENEGADO");
    expect(await prisma.solicitudRectificacion.count({ where: { solicitadoPorId: rios.usuarioId } })).toBe(0);
  });

  it("valida la solicitud: motivo obligatorio, valor de la escala y distinto del registrado", async () => {
    const p = { asignacionId: asignacionB, periodoId: bimestre };
    const sinMotivo = await pedir(solicitarRuta, "/evaluacion/registros/…/rectificaciones", {
      token: token.rios,
      params: p,
      metodo: "POST",
      cuerpo: pedido("carla", 0, "A", " "),
    });
    expect(sinMotivo).toMatchObject({ estado: 400, error: { code: "DATOS_INVALIDOS" } });
    const fuera = await pedir(solicitarRuta, "/evaluacion/registros/…/rectificaciones", {
      token: token.rios,
      params: p,
      metodo: "POST",
      cuerpo: { ...pedido("carla", 0, "A", "x"), valorCorrecto: "15" },
    });
    expect(fuera.estado).toBe(400);
    const igual = await codigoDe(
      solicitarRectificacion(rios, asignacionB, bimestre, pedido("carla", 0, "C", "Igual"), meta, ABRIL),
    );
    expect(igual.codigo).toBe("VALOR_IGUAL_AL_ACTUAL");
  });

  it("la docente pide la rectificación: queda «Pendiente de aprobación» y se avisa a los coordinadores académicos", async () => {
    const r = await pedir(solicitarRuta, "/evaluacion/registros/…/rectificaciones", {
      token: token.rios,
      params: { asignacionId: asignacionB, periodoId: bimestre },
      metodo: "POST",
      cuerpo: pedido("carla", 0, "A", "Al digitar se registró C, pero la rúbrica indica logro esperado."),
    });
    expect(r.estado).toBe(201);
    expect(r.datos.solicitud).toMatchObject({
      estado: "PENDIENTE",
      nombreEstado: "Pendiente de aprobación",
      estudiante: "Mendoza Prueba, Carla",
      seccion: "1° RB",
      competencia: { columna: "C1" },
      valorAnterior: "C",
      valorSolicitado: "A",
      estadoRegistro: "CERRADO",
    });
    solicitud.carla = r.datos.solicitud.id;
    expect(r.datos.aviso.destinatarios).toBeGreaterThan(0);
    expect(
      correo.mock.calls.some(([c]) => c.para === "coordinacion@kubo.edu.pe" && /rectificación/.test(c.asunto)),
    ).toBe(true);

    // una sola pendiente por nota
    const otra = await codigoDe(
      solicitarRectificacion(rios, asignacionB, bimestre, pedido("carla", 0, "B", "Otra"), meta, ABRIL),
    );
    expect(otra.codigo).toBe("RECTIFICACION_PENDIENTE");

    // si el correo falla, la solicitud igual queda registrada
    correo.mockRejectedValueOnce(new Error("SMTP caído"));
    const sinCorreo = await solicitarRectificacion(
      rios,
      asignacionB,
      bimestre,
      pedido("carla", 1, "AD", "La evidencia corresponde a logro destacado."),
      meta,
      ABRIL,
    );
    solicitud.carlaRechazo = sinCorreo.solicitud.id;
    expect(await prisma.solicitudRectificacion.count({ where: { id: sinCorreo.solicitud.id } })).toBe(1);

    const mias = await pedir(misRuta, "/evaluacion/docente/rectificaciones", { token: token.rios });
    expect(mias.datos.map((s: { id: string }) => s.id).sort()).toEqual(
      [solicitud.carla, solicitud.carlaRechazo].sort(),
    );
    const bandeja = await bandejaRectificaciones(admin, { estado: "PENDIENTES", pagina: 1, tamano: 100 });
    expect(bandeja.items.filter((s) => s.id === solicitud.carla)).toHaveLength(1);
  });

  it("el trigger de US40 sigue rechazando la escritura directa, aun declarando una solicitud no aprobada", async () => {
    const n = await notaEnBase("carla", 0);
    await expect(prisma.nota.update({ where: { id: n.id }, data: { logro: "A" } })).rejects.toThrow(/REGISTRO_CERRADO/);
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('kubo.rectificacion_id', ${solicitud.carla}, true)`;
        await tx.nota.update({ where: { id: n.id }, data: { logro: "A" } });
      }),
    ).rejects.toThrow(/REGISTRO_CERRADO/);
    expect((await notaEnBase("carla", 0)).logro).toBe("C");
  });

  it("nadie aprueba ni rechaza su propia solicitud", async () => {
    const propia = await solicitarRectificacion(
      propio,
      asignacionA,
      bimestre,
      pedido("bruno", 2, "AD", "Error de digitación"),
      meta,
      ABRIL,
    );
    solicitud.propia = propia.solicitud.id;
    expect((await codigoDe(aprobarRectificacion(admin, solicitud.propia, meta))).codigo).toBe("SOLICITUD_PROPIA");
    expect((await codigoDe(rechazarRectificacion(admin, solicitud.propia, { motivo: "No" }, meta))).codigo).toBe(
      "SOLICITUD_PROPIA",
    );
    const bandeja = await bandejaRectificaciones(admin, { estado: "PENDIENTES", pagina: 1, tamano: 100 });
    expect(bandeja.items.find((s) => s.id === solicitud.propia)?.esPropia).toBe(true);
    expect((await notaEnBase("bruno", 2)).logro).toBe("A");
  });

  it("dos aprobaciones a la vez: solo una aplica; nota, consolidado con la regla del cierre, bitácora y auditoría", async () => {
    // después del cierre se publica una v2 (ponderado) que rige desde el mismo bimestre: no debe usarse
    await prisma.reglaConsolidacion.update({ where: { id: reglaV1 }, data: { estado: "ARCHIVADA" } });
    await prisma.reglaConsolidacion.create({
      data: {
        anioAcademicoId: anioId,
        rigeDesdeId: bimestre,
        nombre: "Promedio ponderado",
        metodo: "PONDERADO",
        criterioDesempate: "MAYOR_JERARQUIA",
        configuracion: {},
        version: 2,
        estado: "VIGENTE",
      },
    });
    correo.mockClear();
    const resultados = await Promise.allSettled([
      aprobarRectificacion(admin, solicitud.carla, meta),
      aprobarRectificacion(admin, solicitud.carla, meta),
    ]);
    const aplicadas = resultados.filter((r) => r.status === "fulfilled");
    const rechazadas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(aplicadas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0].reason).toMatchObject({ codigo: "SOLICITUD_YA_RESUELTA" });
    const aprobada = (aplicadas[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof aprobarRectificacion>>>).value;
    // carla [A, B, B] con moda → B, igual que antes; con el ponderado (v2) sería (3×2 + 2 + 2) / 4 = 2,5 → A
    expect(aprobada.consolidado).toEqual({ anterior: "B", nuevo: "B" });
    expect(aprobada.solicitud).toMatchObject({ estado: "APROBADA", nombreEstado: "Aprobada", valorActual: "A" });

    const n = await notaEnBase("carla", 0);
    expect(n).toMatchObject({ logro: "A", logroAnterior: "C", modificadoPorId: admin.usuarioId });
    const resultado = await prisma.resultadoConsolidado.findFirstOrThrow({
      where: { cierreId: cierreB, matriculaId: alumnos.carla.matriculaId },
    });
    expect(resultado.logroConsolidado).toBe("B");
    expect(resultado.detalleCalculo).toMatchObject({ regla: { version: 1, metodo: "MODA" } });

    const bitacora = await prisma.bitacoraNota.findMany({ where: { solicitudId: solicitud.carla } });
    expect(bitacora).toHaveLength(1);
    expect(bitacora[0]).toMatchObject({
      origen: "RECTIFICACION",
      notaId: n.id,
      logroAnterior: "C",
      logroNuevo: "A",
      usuarioId: admin.usuarioId,
      docenteId: docenteRiosId,
      docenteNombre: "Julia Ríos Prueba",
      estudianteNombre: "Mendoza Prueba, Carla",
    });
    const auditoria = await prisma.registroAuditoria.findMany({
      where: { requestId: meta.requestId, accion: "APROBAR_RECTIFICACION_NOTA", entidadId: n.id },
    });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].valorNuevo).toMatchObject({ logro: "A", solicitudId: solicitud.carla });

    // aviso al docente con el estado
    expect(correo.mock.calls.filter(([c]) => c.para === rios.email && /aprobada/.test(c.asunto))).toHaveLength(1);
  });

  it("después de aprobar, la escritura directa sigue rechazada aunque se declare la solicitud aprobada", async () => {
    const n = await notaEnBase("carla", 0);
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('kubo.rectificacion_id', ${solicitud.carla}, true)`;
        await tx.nota.update({ where: { id: n.id }, data: { logro: "AD" } });
      }),
    ).rejects.toThrow(/REGISTRO_CERRADO/);
    expect((await notaEnBase("carla", 0)).logro).toBe("A");
  });

  it("en un registro PUBLICADO el apoderado ve el valor corregido y el consolidado recalculado", async () => {
    // ana [B, B, C] → B; la rectificación de C1 a A deja [A, B, C]: empate y la moda elige el mayor → A
    await prisma.asignacionDocente.update({ where: { id: asignacionA }, data: { docenteId: docenteRiosId } });
    const pedida = await solicitarRectificacion(
      rios,
      asignacionA,
      bimestre,
      pedido("ana", 0, "A", "Error de digitación."),
      meta,
      ABRIL,
    );
    expect(pedida.solicitud.estadoRegistro).toBe("PUBLICADO");
    const r = await aprobarRectificacion(admin, pedida.solicitud.id, meta);
    expect(r.consolidado).toEqual({ anterior: "B", nuevo: "A" });

    const libreta = await libretaDelHijo(apoderado, alumnos.ana.estudianteId);
    if (libreta.restringido) throw new Error("La libreta no debía estar restringida");
    const mat = libreta.libreta.bimestres.find((b) => b.id === bimestre)!.cursos.find((c) => c.codigo === "MAT")!;
    expect(mat.consolidado).toBe("A");
    expect(mat.competencias.find((c) => c.competenciaPlanId === competencias[0])?.logro).toBe("A");
  });

  it("al rechazar con motivo, la nota no cambia y se avisa al docente «Rechazada» con el motivo", async () => {
    correo.mockClear();
    const conDocente = await pedir(rechazarRuta, "/evaluacion/rectificaciones/…/rechazar", {
      token: token.rios,
      params: { id: solicitud.carlaRechazo },
      metodo: "POST",
      cuerpo: {},
    });
    expect(conDocente.estado).toBe(403);
    const r = await rechazarRectificacion(
      admin,
      solicitud.carlaRechazo,
      { motivo: "La evidencia adjunta no sustenta el cambio de logro." },
      meta,
    );
    expect(r.solicitud).toMatchObject({
      estado: "RECHAZADA",
      nombreEstado: "Rechazada",
      motivoRechazo: "La evidencia adjunta no sustenta el cambio de logro.",
      valorActual: "B",
    });
    expect((await notaEnBase("carla", 1)).logro).toBe("B");
    expect(await prisma.bitacoraNota.count({ where: { solicitudId: solicitud.carlaRechazo } })).toBe(0);
    const aviso = correo.mock.calls.find(([c]) => c.para === rios.email)?.[0];
    expect(aviso?.texto).toContain("«Rechazada»");
    expect(aviso?.texto).toContain("La evidencia adjunta no sustenta el cambio de logro.");
    expect(
      await prisma.registroAuditoria.count({
        where: { requestId: meta.requestId, accion: "RECHAZAR_RECTIFICACION_NOTA", entidadId: solicitud.carlaRechazo },
      }),
    ).toBe(1);
    expect((await codigoDe(rechazarRectificacion(admin, solicitud.carlaRechazo, { motivo: "x" }, meta))).codigo).toBe(
      "SOLICITUD_YA_RESUELTA",
    );
  });

  it("la bitácora filtra por rango de fechas y docente a la vez, del más reciente al más antiguo y paginada", async () => {
    const hoy = hoyEnLima();
    const deRios = await listarBitacoraNotas({
      desde: hoy,
      hasta: hoy,
      docenteId: docenteRiosId,
      pagina: 1,
      tamano: 20,
    });
    expect(deRios.items.map((i) => i.origen)).toEqual(["RECTIFICACION", "RECTIFICACION"]);
    expect(deRios.items[0]).toMatchObject({
      nombreOrigen: "Rectificación aprobada",
      estudiante: "Álvarez Prueba, Ana",
    });
    expect(deRios.items[1]).toMatchObject({ estudiante: "Mendoza Prueba, Carla", competencia: { columna: "C1" } });

    // el mismo docente fuera del rango: nada
    const ayer = new Date(`${hoy}T12:00:00Z`);
    ayer.setUTCDate(ayer.getUTCDate() - 1);
    const fuera = ayer.toISOString().slice(0, 10);
    const vacio = await listarBitacoraNotas({
      desde: fuera,
      hasta: fuera,
      docenteId: docenteRiosId,
      pagina: 1,
      tamano: 20,
    });
    expect(vacio.paginacion.total).toBe(0);

    // otro docente en el mismo rango: solo sus registros, paginados y del más reciente al más antiguo
    const pagina = await listarBitacoraNotas({
      desde: hoy,
      hasta: hoy,
      docenteId: docenteAdminId,
      pagina: 1,
      tamano: 3,
    });
    expect(pagina.items).toHaveLength(3);
    expect(pagina.paginacion.total).toBeGreaterThanOrEqual(10);
    expect(pagina.items.every((i) => i.docente.id === docenteAdminId && i.origen === "REGISTRO")).toBe(true);
    const fechas = pagina.items.map((i) => i.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);

    expect((await codigoDe(listarBitacoraNotas({ desde: hoy, hasta: fuera, pagina: 1, tamano: 20 }))).codigo).toBe(
      "RANGO_FECHAS_INVALIDO",
    );
    expect((await docentesDeBitacora()).find((d) => d.id === docenteRiosId)?.nombre).toBe("Julia Ríos Prueba");
  });
});
