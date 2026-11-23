// Prueba de integración (US38, US47): evidencias pedagógicas del docente y su consulta por el apoderado y el alumno.
// Permisos del docente (solo su curso y sección), registro abierto, cerrado y publicado, archivo en el almacén (disco
// temporal), auditoría de cada subida y borrado, rechazo por tamaño y por tipo real, vínculo del apoderado y del alumno
// (404 para los ajenos) y restricción por deuda (US26).
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/evaluacion/evidencias.integracion
// Crea sus propios datos ficticios en el año 2082 (en matrícula, para no chocar con el año en curso) y DNI 900017xx, y
// los borra al terminar. Lo que se audita lo hace el administrador del seed con perfil Docente: la bitácora de
// auditoría es inmutable y quien la firma no se puede borrar. Por eso las subidas que funcionan se prueban con los
// casos de uso, y por la API los rechazos y las descargas.
import "@/server/wiring";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { reiniciarAlmacen, TAMANO_MAXIMO_ARCHIVO } from "@/platform/archivos";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { GET as archivoRuta } from "@/app/api/v1/evaluacion/evidencias/[id]/archivo/route";
import { GET as libretaAlumno } from "@/app/api/v1/evaluacion/alumno/libreta/route";
import { GET as libretaHijo } from "@/app/api/v1/evaluacion/apoderado/hijos/[id]/libreta/route";
import { POST as agregarRuta } from "@/app/api/v1/evaluacion/registros/[asignacionId]/bimestres/[periodoId]/evidencias/route";
import { DELETE as eliminarRuta } from "@/app/api/v1/evaluacion/registros/[asignacionId]/bimestres/[periodoId]/evidencias/[evidenciaId]/route";
import {
  agregarEvidencia,
  archivoDeEvidencia,
  eliminarEvidencia,
  MENSAJE_ARCHIVO_EVIDENCIA,
  registroDeNotas,
  type Libreta,
  type LibretaDelHijo,
} from "@/modules/evaluacion";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { confirmarMatricula, MENSAJE_RESTRICCION_DEUDA } from "@/modules/matricula";

vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2082;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2082";
const meta = { requestId: `prueba-evidencias-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;

const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const FALSO = new TextEncoder().encode("<html><body>no soy un PDF</body></html>");

/** Archivo de `tamano` bytes que empieza con la firma de `base`. */
function deTamano(base: Uint8Array, tamano: number) {
  const b = new Uint8Array(tamano);
  b.set(base);
  return b;
}

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

interface Respuesta {
  estado: number;
  tipo: string;
  disposicion: string | null;
  bytes?: Uint8Array;
  datos?: unknown;
  error?: { code: string; message: string; details: Record<string, unknown> };
}

async function pedir(
  manejador: Manejador,
  opciones: {
    token?: string;
    params?: Record<string, string>;
    metodo?: "GET" | "POST" | "DELETE";
    formulario?: FormData;
    cabeceras?: Record<string, string>;
  } = {},
): Promise<Respuesta> {
  const cabeceras: Record<string, string> = { ...opciones.cabeceras };
  if (opciones.token) cabeceras.authorization = `Bearer ${opciones.token}`;
  const req = new NextRequest("http://localhost/api/v1/evaluacion/…", {
    method: opciones.metodo ?? "GET",
    headers: cabeceras,
    body: opciones.formulario,
  });
  const res = await manejador(req, { params: Promise.resolve(opciones.params ?? {}) });
  const tipo = res.headers.get("content-type") ?? "";
  const disposicion = res.headers.get("content-disposition");
  if (!tipo.includes("application/json")) {
    return { estado: res.status, tipo, disposicion, bytes: new Uint8Array(await res.arrayBuffer()) };
  }
  const json = await res.json();
  return { estado: res.status, tipo, disposicion, datos: json.data, error: json.error };
}

async function codigoDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return { codigo: (e as { codigo?: string }).codigo, mensaje: (e as Error).message };
  }
  throw new Error("Se esperaba un rechazo");
}

const formulario = (campos: Record<string, string>, archivo?: { bytes: Uint8Array; nombre: string; tipo: string }) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  if (archivo) f.set("archivo", new File([archivo.bytes], archivo.nombre, { type: archivo.tipo }));
  return f;
};

describe.skipIf(!ACTIVA)("evidencias pedagógicas (US38) y su consulta en la libreta (US47)", () => {
  let carpeta: string;
  const entorno = { driver: process.env.ARCHIVOS_DRIVER, dir: process.env.ARCHIVOS_DIR };
  let anioId: string;
  let bimestreI: string;
  let admin: Autenticado;
  let propio: Autenticado;
  let adminPersonaId: string;
  let docenteAdminCreado = false;
  const personas: string[] = [];
  const competencias = { mat1: "", mat2: "" };
  const estudiantes = { valeria: "", diego: "", carla: "" };
  const matriculas = { valeria: "", diego: "", carla: "" };
  const asignaciones = { matA: "", matB: "" };
  let cierreA: string;
  const token = { otroDocente: "", apoderadoA: "", apoderadoB: "", valeria: "", carla: "" };
  const evidencia = { pdf: "", comentario: "", jpg5mb: "" };

  async function ingresar(email: string) {
    const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
    if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
    return r.tokens.acceso;
  }

  /** Archivos guardados en el almacén de prueba (carpeta evidencias/). */
  const archivosGuardados = async () => (await fs.readdir(path.join(carpeta, "evidencias")).catch(() => [])).length;
  const filasDeEvidencia = () => prisma.evidenciaPedagogica.count({ where: { nota: { cierreId: cierreA } } });

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "kubo-evidencias-"));
    process.env.ARCHIVOS_DRIVER = "disco";
    process.env.ARCHIVOS_DIR = carpeta;
    reiniciarAlmacen();

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
    const cuenta = (personaId: string, email: string) =>
      prisma.usuario.create({ data: { personaId, email, passwordHash, estado: "ACTIVO", debeCambiarPassword: false } });

    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 1 } });
    anioId = (
      await prisma.anioAcademico.create({
        data: {
          anio: ANIO,
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-12-15T00:00:00Z`),
          estado: "EN_MATRICULA",
        },
      })
    ).id;
    bimestreI = (
      await prisma.periodoEvaluacion.create({
        data: {
          anioAcademicoId: anioId,
          numero: 1,
          nombre: "Bimestre I",
          fechaInicio: new Date(`${ANIO}-03-01T00:00:00Z`),
          fechaFin: new Date(`${ANIO}-05-13T00:00:00Z`),
        },
      })
    ).id;
    const reglaId = (
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
    const seccionA = (await seccion("EA")).id;
    const seccionB = (await seccion("EB")).id;

    // Matemática con 2 competencias
    const curso = await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } });
    const plan = await prisma.planEstudio.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: curso.id, horasSemanales: 4 },
    });
    const delArea = await prisma.competencia.findMany({
      where: { areaCurricularId: curso.areaCurricularId },
      orderBy: { codigo: "asc" },
      take: 2,
    });
    const ids: string[] = [];
    for (const [i, c] of delArea.entries()) {
      ids.push(
        (await prisma.competenciaPlan.create({ data: { planEstudioId: plan.id, competenciaId: c.id, orden: i + 1 } }))
          .id,
      );
    }
    [competencias.mat1, competencias.mat2] = ids;

    // docentes: el admin con perfil Docente (sección A) y Ríos (sección B)
    const docenteAdmin = await prisma.docente.findUnique({ where: { personaId: u.personaId } });
    const docenteAdminId = docenteAdmin?.id ?? (await prisma.docente.create({ data: { personaId: u.personaId } })).id;
    docenteAdminCreado = !docenteAdmin;
    propio = { ...admin, rol: "DOCENTE" };
    const pRios = await prisma.persona.create({
      data: {
        dni: "90001710",
        nombres: "Raúl",
        apellidos: "Ríos Evidencia",
        email: "90001710@prueba.kubo.test",
        docente: { create: {} },
      },
      include: { docente: true },
    });
    personas.push(pRios.id);
    await cuenta(pRios.id, pRios.email!);
    asignaciones.matA = (
      await prisma.asignacionDocente.create({
        data: { planEstudioId: plan.id, seccionId: seccionA, docenteId: docenteAdminId },
      })
    ).id;
    asignaciones.matB = (
      await prisma.asignacionDocente.create({
        data: { planEstudioId: plan.id, seccionId: seccionB, docenteId: pRios.docente!.id },
      })
    ).id;

    // apoderado A: Valeria y Diego (sección A); apoderado B: Carla (sección B). Valeria y Carla tienen cuenta.
    const apoderado = async (dni: string) => {
      const email = `${dni}@prueba.kubo.test`;
      const p = await prisma.persona.create({
        data: { dni, nombres: "Carmen", apellidos: `Apoderada ${dni}`, email, apoderado: { create: {} } },
        include: { apoderado: true },
      });
      personas.push(p.id);
      await cuenta(p.id, email);
      return p.apoderado!.id;
    };
    const apoderadoA = await apoderado("90001701");
    const apoderadoB = await apoderado("90001702");
    for (const [clave, dni, nombres, seccionId, apoderadoId, conCuenta] of [
      ["valeria", "90001721", "Valeria", seccionA, apoderadoA, true],
      ["diego", "90001722", "Diego", seccionA, apoderadoA, false],
      ["carla", "90001723", "Carla", seccionB, apoderadoB, true],
    ] as const) {
      const es = await prisma.persona.create({
        data: { dni, nombres, apellidos: "Quispe Evidencia", estudiante: { create: { gradoIngresoId: grado.id } } },
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
      if (conCuenta) await cuenta(es.id, `${dni}@prueba.kubo.test`);
    }

    // registro ABIERTO de Matemática 1° EA: Valeria calificada en ambas competencias; Diego, sin calificar
    cierreA = (
      await prisma.cierreCalificacion.create({
        data: {
          asignacionDocenteId: asignaciones.matA,
          periodoEvaluacionId: bimestreI,
          reglaConsolidacionId: reglaId,
          estado: "ABIERTO",
        },
      })
    ).id;
    await prisma.nota.createMany({
      data: [
        { cierreId: cierreA, matriculaId: matriculas.valeria, competenciaPlanId: competencias.mat1, logro: "AD" },
        { cierreId: cierreA, matriculaId: matriculas.valeria, competenciaPlanId: competencias.mat2, logro: "A" },
      ].map((n) => ({ ...n, registradoPorId: admin.usuarioId })),
    });

    token.otroDocente = await ingresar("90001710@prueba.kubo.test");
    token.apoderadoA = await ingresar("90001701@prueba.kubo.test");
    token.apoderadoB = await ingresar("90001702@prueba.kubo.test");
    token.valeria = await ingresar("90001721@prueba.kubo.test");
    token.carla = await ingresar("90001723@prueba.kubo.test");
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    process.env.ARCHIVOS_DRIVER = entorno.driver;
    process.env.ARCHIVOS_DIR = entorno.dir;
    reiniciarAlmacen();
    if (carpeta) await fs.rm(carpeta, { recursive: true, force: true });
    if (!anioId) return;
    // al borrar el cierre se van sus notas y, con ellas, sus evidencias (los triggers miran el cierre, que ya no existe)
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

  const paramsA = () => ({ asignacionId: asignaciones.matA, periodoId: bimestreI });
  const datos = (
    clave: keyof typeof matriculas,
    competencia: keyof typeof competencias,
    comentario: string | null,
    archivo: { nombre: string; bytes: Uint8Array } | null,
  ) => ({ matriculaId: matriculas[clave], competenciaPlanId: competencias[competencia], comentario, archivo });
  const libretaDe = async (t: string, estudiante: keyof typeof estudiantes) =>
    (await pedir(libretaHijo, { token: t, params: { id: estudiantes[estudiante] } })).datos as LibretaDelHijo;
  const competenciaEnLibreta = (libreta: Libreta, competenciaPlanId: string) =>
    libreta.bimestres
      .find((b) => b.id === bimestreI)!
      .cursos.flatMap((c) => c.competencias)
      .find((c) => c.competenciaPlanId === competenciaPlanId);

  // ---------- Seguridad de los endpoints ----------

  it("401 sin sesión y 403 con un perfil que no es docente al adjuntar o eliminar", async () => {
    const params = { ...paramsA(), evidenciaId: "3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b" };
    const f = () =>
      formulario({ matriculaId: matriculas.valeria, competenciaPlanId: competencias.mat1, comentario: "x" });
    expect((await pedir(agregarRuta, { metodo: "POST", params, formulario: f() })).estado).toBe(401);
    expect((await pedir(eliminarRuta, { metodo: "DELETE", params })).estado).toBe(401);
    expect((await pedir(archivoRuta, { params: { id: params.evidenciaId } })).estado).toBe(401);
    for (const r of [
      await pedir(agregarRuta, { token: token.apoderadoA, metodo: "POST", params, formulario: f() }),
      await pedir(eliminarRuta, { token: token.valeria, metodo: "DELETE", params }),
    ]) {
      expect(r.estado).toBe(403);
      expect(r.error?.code).toBe("ACCESO_DENEGADO");
    }
  });

  // ---------- US38 · El docente adjunta evidencias ----------

  it("el docente adjunta un comentario y un PDF a una calificación guardada; queda en el almacén y en la auditoría", async () => {
    const r = await agregarEvidencia(
      propio,
      asignaciones.matA,
      bimestreI,
      datos("valeria", "mat1", "  Resolvió el problema con dos estrategias.  ", {
        nombre: "C:\\fakepath\\Ficha de trabajo.PDF",
        bytes: PDF,
      }),
      meta,
    );
    evidencia.pdf = r.evidencia.id;
    expect(r.evidencia).toMatchObject({
      comentario: "Resolvió el problema con dos estrategias.",
      archivo: { nombre: "Ficha de trabajo.pdf", tipo: "PDF", mime: "application/pdf", tamanoBytes: PDF.length },
    });
    // la clave del almacén nunca sale hacia la pantalla
    expect(JSON.stringify(r)).not.toContain("evidencias/");
    const valeria = r.registro.alumnos.find((a) => a.matriculaId === matriculas.valeria)!;
    expect(valeria.notas[competencias.mat1].evidencias.map((e) => e.id)).toEqual([evidencia.pdf]);
    expect(valeria.notas[competencias.mat2].evidencias).toEqual([]);

    const fila = await prisma.evidenciaPedagogica.findUniqueOrThrow({ where: { id: evidencia.pdf } });
    expect(fila.archivoClave).toMatch(/^evidencias\/[0-9a-f-]{36}$/);
    expect(fila.subidoPorId).toBe(propio.usuarioId);
    const enDisco = await fs.readFile(path.join(carpeta, ...fila.archivoClave!.split("/")));
    expect(new Uint8Array(enDisco)).toEqual(PDF);

    const auditoria = await prisma.registroAuditoria.findFirstOrThrow({
      where: { requestId: meta.requestId, entidadId: evidencia.pdf, accion: "AGREGAR_EVIDENCIA" },
    });
    expect(auditoria).toMatchObject({ entidadAfectada: "evidencia_pedagogica", usuarioId: propio.usuarioId });
    // sin el comentario ni el nombre del archivo
    expect(JSON.stringify(auditoria.valorNuevo)).not.toMatch(/estrategias|Ficha/);
  });

  it("acepta solo un comentario y un JPG de exactamente 5 MB", async () => {
    const soloComentario = await agregarEvidencia(
      propio,
      asignaciones.matA,
      bimestreI,
      datos("valeria", "mat2", "Explicó su razonamiento en voz alta.", null),
      meta,
    );
    evidencia.comentario = soloComentario.evidencia.id;
    expect(soloComentario.evidencia.archivo).toBeNull();

    const jpg = await agregarEvidencia(
      propio,
      asignaciones.matA,
      bimestreI,
      datos("valeria", "mat1", null, { nombre: "foto.jpeg", bytes: deTamano(JPG, TAMANO_MAXIMO_ARCHIVO) }),
      meta,
    );
    evidencia.jpg5mb = jpg.evidencia.id;
    expect(jpg.evidencia).toMatchObject({ comentario: null, archivo: { tipo: "JPG", tamanoBytes: 5_242_880 } });
    const valeria = jpg.registro.alumnos.find((a) => a.matriculaId === matriculas.valeria)!;
    expect(valeria.notas[competencias.mat1].evidencias).toHaveLength(2);
  });

  it("rechaza sin guardar nada: comentario vacío, archivo falsificado, PNG, 5 MB + 1 y calificación sin guardar", async () => {
    const [filas, archivos] = [await filasDeEvidencia(), await archivosGuardados()];
    const intentar = (d: ReturnType<typeof datos>) =>
      codigoDe(agregarEvidencia(propio, asignaciones.matA, bimestreI, d, meta));
    expect((await intentar(datos("valeria", "mat1", "   ", null))).codigo).toBe("EVIDENCIA_VACIA");
    expect(await intentar(datos("valeria", "mat1", null, { nombre: "tarea.pdf", bytes: FALSO }))).toEqual({
      codigo: "ARCHIVO_NO_PERMITIDO",
      mensaje: MENSAJE_ARCHIVO_EVIDENCIA,
    });
    expect((await intentar(datos("valeria", "mat1", null, { nombre: "a.png", bytes: PNG }))).codigo).toBe(
      "ARCHIVO_NO_PERMITIDO",
    );
    const grande = await intentar(
      datos("valeria", "mat1", null, { nombre: "a.pdf", bytes: deTamano(PDF, TAMANO_MAXIMO_ARCHIVO + 1) }),
    );
    expect(grande).toEqual({ codigo: "ARCHIVO_DEMASIADO_GRANDE", mensaje: MENSAJE_ARCHIVO_EVIDENCIA });
    // Diego no tiene calificación guardada en C1: la evidencia necesita una calificación
    expect((await intentar(datos("diego", "mat1", "Sin nota aún", { nombre: "a.pdf", bytes: PDF }))).codigo).toBe(
      "NOTA_SIN_CALIFICAR",
    );
    expect(await filasDeEvidencia()).toBe(filas);
    expect(await archivosGuardados()).toBe(archivos);
  });

  it("por la API: rechaza por Content-Length sin leer el cuerpo, el archivo falsificado y el curso de otro docente", async () => {
    const archivos = await archivosGuardados();
    const campos = { matriculaId: matriculas.valeria, competenciaPlanId: competencias.mat1 };
    const pdfValido = { bytes: PDF, nombre: "ficha.pdf", tipo: "application/pdf" };

    // Content-Length de 50 MB: se responde 413 antes de leer el cuerpo
    const grande = await pedir(agregarRuta, {
      token: token.otroDocente,
      metodo: "POST",
      params: paramsA(),
      formulario: formulario(campos, pdfValido),
      cabeceras: { "content-length": String(50 * 1024 * 1024) },
    });
    expect(grande.estado).toBe(413);
    expect(grande.error).toMatchObject({ code: "ARCHIVO_DEMASIADO_GRANDE", message: MENSAJE_ARCHIVO_EVIDENCIA });

    const falso = await pedir(agregarRuta, {
      token: token.otroDocente,
      metodo: "POST",
      params: paramsA(),
      formulario: formulario(campos, { bytes: FALSO, nombre: "tarea.pdf", tipo: "application/pdf" }),
    });
    expect(falso.estado).toBe(400);
    expect(falso.error).toMatchObject({ code: "ARCHIVO_NO_PERMITIDO", message: MENSAJE_ARCHIVO_EVIDENCIA });

    const largo = await pedir(agregarRuta, {
      token: token.otroDocente,
      metodo: "POST",
      params: paramsA(),
      formulario: formulario({ ...campos, comentario: "a".repeat(1001) }),
    });
    expect(largo.estado).toBe(400);
    expect(largo.error?.code).toBe("DATOS_INVALIDOS");

    // un archivo válido, pero el curso y la sección son de otro docente
    const ajeno = await pedir(agregarRuta, {
      token: token.otroDocente,
      metodo: "POST",
      params: paramsA(),
      formulario: formulario({ ...campos, comentario: "Intento ajeno" }, pdfValido),
    });
    expect(ajeno.estado).toBe(403);
    expect(ajeno.error?.code).toBe("ACCESO_DENEGADO");
    expect(await archivosGuardados()).toBe(archivos);
  });

  it("el docente de otra sección no descarga ni elimina evidencias ajenas", async () => {
    const descarga = await pedir(archivoRuta, { token: token.otroDocente, params: { id: evidencia.pdf } });
    expect(descarga.estado).toBe(404);
    expect(descarga.error?.code).toBe("NO_ENCONTRADO");
    const enOtroRegistro = await pedir(eliminarRuta, {
      token: token.otroDocente,
      metodo: "DELETE",
      params: { asignacionId: asignaciones.matB, periodoId: bimestreI, evidenciaId: evidencia.pdf },
    });
    expect(enOtroRegistro.estado).toBe(404);
    const enElAjeno = await pedir(eliminarRuta, {
      token: token.otroDocente,
      metodo: "DELETE",
      params: { ...paramsA(), evidenciaId: evidencia.pdf },
    });
    expect(enElAjeno.estado).toBe(403);
    expect(await prisma.evidenciaPedagogica.count({ where: { id: evidencia.pdf } })).toBe(1);
  });

  it("el docente del curso ve su archivo y elimina una evidencia: se borra del almacén y queda en la auditoría", async () => {
    const r = await archivoDeEvidencia(propio, evidencia.pdf);
    expect(r.archivo).toMatchObject({ mime: "application/pdf", nombre: "Ficha de trabajo.pdf" });
    expect(new Uint8Array(await new Response(r.flujo).arrayBuffer())).toEqual(PDF);

    const fila = await prisma.evidenciaPedagogica.findUniqueOrThrow({ where: { id: evidencia.jpg5mb } });
    const registro = await eliminarEvidencia(propio, asignaciones.matA, bimestreI, evidencia.jpg5mb, meta);
    const valeria = registro.alumnos.find((a) => a.matriculaId === matriculas.valeria)!;
    expect(valeria.notas[competencias.mat1].evidencias.map((e) => e.id)).toEqual([evidencia.pdf]);
    await expect(fs.access(path.join(carpeta, ...fila.archivoClave!.split("/")))).rejects.toThrow();
    expect(
      await prisma.registroAuditoria.count({
        where: { requestId: meta.requestId, entidadId: evidencia.jpg5mb, accion: "ELIMINAR_EVIDENCIA" },
      }),
    ).toBe(1);
  });

  // ---------- US38 criterio 3 y US47 · Registro abierto, cerrado y publicado ----------

  it("el apoderado y el alumno no ven evidencias de un registro abierto", async () => {
    expect((await pedir(archivoRuta, { token: token.apoderadoA, params: { id: evidencia.pdf } })).estado).toBe(404);
    expect((await pedir(archivoRuta, { token: token.valeria, params: { id: evidencia.pdf } })).estado).toBe(404);
    const libreta = await libretaDe(token.apoderadoA, "valeria");
    expect(JSON.stringify(libreta)).not.toContain(evidencia.pdf);
  });

  it("con el registro cerrado las evidencias quedan en solo lectura, también para la base de datos", async () => {
    await prisma.resultadoConsolidado.create({
      data: { cierreId: cierreA, matriculaId: matriculas.valeria, logroConsolidado: "AD", detalleCalculo: {} },
    });
    await prisma.cierreCalificacion.update({
      where: { id: cierreA },
      data: { estado: "CERRADO", cerradoEn: new Date(), cerradoPorId: admin.usuarioId },
    });
    const agregar = await codigoDe(
      agregarEvidencia(propio, asignaciones.matA, bimestreI, datos("valeria", "mat2", "Tarde", null), meta),
    );
    expect(agregar.codigo).toBe("REGISTRO_CERRADO");
    const eliminar = await codigoDe(eliminarEvidencia(propio, asignaciones.matA, bimestreI, evidencia.pdf, meta));
    expect(eliminar.codigo).toBe("REGISTRO_CERRADO");
    // aunque alguien escriba directo en la base, el trigger lo impide
    const nota = await prisma.nota.findFirstOrThrow({ where: { cierreId: cierreA, matriculaId: matriculas.valeria } });
    await expect(
      prisma.evidenciaPedagogica.create({
        data: { notaId: nota.id, comentario: "directo", subidoPorId: admin.usuarioId },
      }),
    ).rejects.toThrow(/REGISTRO_CERRADO/);
    await expect(prisma.evidenciaPedagogica.delete({ where: { id: evidencia.comentario } })).rejects.toThrow(
      /REGISTRO_CERRADO/,
    );
    // el docente las sigue viendo en el registro
    const r = await registroDeNotas(propio, asignaciones.matA, bimestreI);
    expect(r.alumnos[0].notas[competencias.mat1].evidencias).toHaveLength(1);
    // cerrado no es publicado: el apoderado aún no las ve
    expect((await pedir(archivoRuta, { token: token.apoderadoA, params: { id: evidencia.pdf } })).estado).toBe(404);
  });

  it("publicado: la libreta trae la evidencia y el apoderado y la alumna ven el PDF en el navegador", async () => {
    await prisma.cierreCalificacion.update({
      where: { id: cierreA },
      data: { estado: "PUBLICADO", publicadoEn: new Date(), publicadoPorId: admin.usuarioId },
    });
    const libreta = await libretaDe(token.apoderadoA, "valeria");
    if (libreta.restringido) throw new Error("Valeria no tiene deuda");
    expect(competenciaEnLibreta(libreta.libreta, competencias.mat1)?.evidencias).toEqual([
      expect.objectContaining({ id: evidencia.pdf, archivo: expect.objectContaining({ tipo: "PDF" }) }),
    ]);
    expect(competenciaEnLibreta(libreta.libreta, competencias.mat2)?.evidencias).toEqual([
      expect.objectContaining({ id: evidencia.comentario, archivo: null }),
    ]);
    const deAlumna = (await pedir(libretaAlumno, { token: token.valeria })).datos as Libreta;
    expect(competenciaEnLibreta(deAlumna, competencias.mat1)?.evidencias.map((e) => e.id)).toEqual([evidencia.pdf]);

    for (const t of [token.apoderadoA, token.valeria]) {
      const r = await pedir(archivoRuta, { token: t, params: { id: evidencia.pdf } });
      expect(r.estado).toBe(200);
      expect(r.tipo).toBe("application/pdf");
      expect(r.disposicion).toMatch(/^inline; filename="Ficha de trabajo\.pdf"/);
      expect(r.bytes).toEqual(PDF);
    }
  });

  it("un apoderado ajeno y otro alumno reciben 404; una evidencia sin archivo no tiene descarga", async () => {
    for (const t of [token.apoderadoB, token.carla]) {
      const r = await pedir(archivoRuta, { token: t, params: { id: evidencia.pdf } });
      expect(r.estado).toBe(404);
      expect(r.error?.code).toBe("NO_ENCONTRADO");
    }
    expect((await pedir(archivoRuta, { token: token.apoderadoA, params: { id: evidencia.comentario } })).estado).toBe(
      404,
    );
  });

  it("con deuda (US26) el apoderado recibe 403 y su libreta no trae evidencias; la alumna sí las ve", async () => {
    const pensiones = await prisma.conceptoCobro.findMany({
      where: { matriculaId: matriculas.valeria, tipo: "PENSION" },
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
    const r = await pedir(archivoRuta, { token: token.apoderadoA, params: { id: evidencia.pdf } });
    expect(r.estado).toBe(403);
    expect(r.error).toMatchObject({ code: "LIBRETA_RESTRINGIDA", message: MENSAJE_RESTRICCION_DEUDA });
    const libreta = await libretaDe(token.apoderadoA, "valeria");
    expect(libreta.restringido).toBe(true);
    expect(JSON.stringify(libreta)).not.toContain(evidencia.pdf);
    // la restricción por deuda es del apoderado (US26), como en «Mis notas» (US51)
    expect((await pedir(archivoRuta, { token: token.valeria, params: { id: evidencia.pdf } })).estado).toBe(200);
  });
});
