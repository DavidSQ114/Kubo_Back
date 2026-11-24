// Prueba de integración del aula virtual (US61, US62, US67): 401 y 403 en cada endpoint, vínculo del docente (solo
// sus cursos y secciones) y del alumno (solo su sección con matrícula vigente), unidades didácticas, materiales con su
// archivo en el almacén (disco temporal), rechazo por formato, tamaño y URL, estados Borrador, Publicado y Oculto,
// enlaces con su estado calculado, auditoría y aviso a los alumnos con cuenta de la sección.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/aula-virtual
// Crea sus propios datos ficticios en el año 2081 (EN_CURSO; las pruebas de integración corren una tras otra) y DNI
// 900018xx, y los borra al terminar. Lo que se audita lo hace el administrador del seed con perfil Docente (la
// bitácora es inmutable y quien la firma no se puede borrar): por la API se prueban los rechazos, las lecturas, las
// descargas y lo que no se audita (unidades y borradores).
import "@/server/wiring";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { reiniciarAlmacen, TAMANO_MAXIMO_ARCHIVO } from "@/platform/archivos";
import { hashPassword } from "@/platform/auth/tokens";
import { prisma } from "@/platform/db/prisma";
import { GET as cursoAlumnoRuta } from "@/app/api/v1/aula-virtual/alumno/cursos/[cursoId]/route";
import { GET as aulaRuta } from "@/app/api/v1/aula-virtual/asignaciones/[asignacionId]/route";
import { POST as crearEnlaceRuta } from "@/app/api/v1/aula-virtual/asignaciones/[asignacionId]/enlaces/route";
import { POST as subirRuta } from "@/app/api/v1/aula-virtual/asignaciones/[asignacionId]/materiales/route";
import { POST as crearUnidadRuta } from "@/app/api/v1/aula-virtual/asignaciones/[asignacionId]/unidades/route";
import { GET as cursosDocenteRuta } from "@/app/api/v1/aula-virtual/docente/cursos/route";
import { POST as ocultarEnlaceRuta } from "@/app/api/v1/aula-virtual/enlaces/[id]/ocultar/route";
import { POST as publicarEnlaceRuta } from "@/app/api/v1/aula-virtual/enlaces/[id]/publicar/route";
import { DELETE as eliminarEnlaceRuta, PUT as editarEnlaceRuta } from "@/app/api/v1/aula-virtual/enlaces/[id]/route";
import { GET as archivoRuta } from "@/app/api/v1/aula-virtual/materiales/[id]/archivo/route";
import { POST as ocultarMaterialRuta } from "@/app/api/v1/aula-virtual/materiales/[id]/ocultar/route";
import { POST as publicarMaterialRuta } from "@/app/api/v1/aula-virtual/materiales/[id]/publicar/route";
import { DELETE as eliminarMaterialRuta } from "@/app/api/v1/aula-virtual/materiales/[id]/route";
import { POST as moverUnidadRuta } from "@/app/api/v1/aula-virtual/unidades/[id]/mover/route";
import { PATCH as editarUnidadRuta } from "@/app/api/v1/aula-virtual/unidades/[id]/route";
import {
  aulaDelDocente,
  cambiarVisibilidadEnlace,
  crearEnlace,
  crearUnidad,
  editarUnidad,
  eliminarEnlace,
  eliminarMaterial,
  MENSAJE_ENLACE_INVALIDO,
  MENSAJE_FORMATO_MATERIAL,
  MENSAJE_TAMANO_MATERIAL,
  ocultarMaterial,
  publicarMaterial,
  subirMaterial,
  type AulaDelCurso,
  type UnidadVista,
} from "@/modules/aula-virtual";
import { iniciarSesion, type Autenticado } from "@/modules/identidad";
import { confirmarMatricula } from "@/modules/matricula";

vi.mock("@/platform/correo", () => ({
  enviarCorreo: vi.fn(async () => true),
  smtpConfigurado: () => false,
}));

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2081;
// contraseña ficticia de las cuentas que crea la prueba (cumple la política; no es de ninguna cuenta real)
const CLAVE = "Prueba-Kubo-2081";
const meta = { requestId: `prueba-aula-virtual-${Date.now()}`, ip: null, userAgent: null };
const ESPERA_PREPARACION = 120_000;
const ID_INEXISTENTE = "3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const MINUTO = 60_000;

const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const FALSO = new TextEncoder().encode("<html><body>no soy un PDF</body></html>");

/** «AAAA-MM-DDTHH:mm» en la hora de Lima (UTC−5) de un instante: lo que escribe el docente en M-17. */
const enLima = (instante: Date) => new Date(instante.getTime() - 5 * 60 * MINUTO).toISOString().slice(0, 16);

type Manejador = (req: NextRequest, contexto: { params: Promise<Record<string, string>> }) => Promise<Response>;

interface Respuesta {
  estado: number;
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
    metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    formulario?: FormData;
    json?: unknown;
  } = {},
): Promise<Respuesta> {
  const cabeceras: Record<string, string> = {};
  if (opciones.token) cabeceras.authorization = `Bearer ${opciones.token}`;
  if (opciones.json !== undefined) cabeceras["content-type"] = "application/json";
  const req = new NextRequest("http://localhost/api/v1/aula-virtual/…", {
    method: opciones.metodo ?? "GET",
    headers: cabeceras,
    body: opciones.formulario ?? (opciones.json !== undefined ? JSON.stringify(opciones.json) : undefined),
  });
  const res = await manejador(req, { params: Promise.resolve(opciones.params ?? {}) });
  const tipo = res.headers.get("content-type") ?? "";
  const disposicion = res.headers.get("content-disposition");
  if (!tipo.includes("application/json")) {
    return { estado: res.status, disposicion, bytes: new Uint8Array(await res.arrayBuffer()) };
  }
  const json = await res.json();
  return { estado: res.status, disposicion, datos: json.data, error: json.error };
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
  if (archivo) f.set("archivo", new File([new Uint8Array(archivo.bytes)], archivo.nombre, { type: archivo.tipo }));
  return f;
};

describe.skipIf(!ACTIVA)("aula virtual: materiales (US61), enlaces (US62) y acceso del alumno (US67)", () => {
  let carpeta: string;
  const entorno = { driver: process.env.ARCHIVOS_DRIVER, dir: process.env.ARCHIVOS_DIR };
  let anioId: string;
  let propio: Autenticado;
  let adminPersonaId: string;
  let docenteAdminCreado = false;
  const personas: string[] = [];
  const cursos = { mat: "", com: "" };
  const asignaciones = { matA: "", matB: "" };
  const usuarios = { valeria: "", carla: "" };
  const token = { rios: "", apoderado: "", valeria: "", carla: "", sinMatricula: "" };
  const unidad = { a1: "", a2: "", b1: "" };
  const material = { publicado: "", borrador: "", enlace: "", borradorB: "" };
  const enlace = { activo: "", programado: "", finalizado: "", oculto: "" };

  async function ingresar(email: string) {
    const r = await iniciarSesion({ email, password: CLAVE, recordar: false }, meta);
    if (r.tipo !== "SESION") throw new Error("La cuenta de prueba debe tener un solo perfil");
    return r.tokens.acceso;
  }

  const archivosGuardados = async () => (await fs.readdir(path.join(carpeta, "materiales")).catch(() => [])).length;
  const auditoria = (entidadId: string) =>
    prisma.registroAuditoria.findMany({
      where: { entidadId, requestId: meta.requestId },
      select: { accion: true, usuarioId: true },
      orderBy: { createdAt: "asc" },
    });
  const avisosDe = (usuarioId: string) =>
    prisma.notificacion.findMany({ where: { usuarioId, tipo: "MATERIAL" }, select: { titulo: true, enlace: true } });
  const aulaDe = async (t: string, cursoId = cursos.mat) =>
    (await pedir(cursoAlumnoRuta, { token: t, params: { cursoId } })).datos as AulaDelCurso;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "clave-de-firma-solo-para-pruebas-de-integracion";
    carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "kubo-aula-"));
    process.env.ARCHIVOS_DRIVER = "disco";
    process.env.ARCHIVOS_DIR = carpeta;
    reiniciarAlmacen();

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
    const seccionA = (await seccion("VA")).id;
    const seccionB = (await seccion("VB")).id;

    // Matemática con docente en ambas secciones; Comunicación en el plan, sin docente
    const mat = await prisma.curso.findFirstOrThrow({ where: { codigo: "MAT" } });
    const com = await prisma.curso.findFirstOrThrow({ where: { codigo: "COM" } });
    cursos.mat = mat.id;
    cursos.com = com.id;
    const plan = await prisma.planEstudio.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: mat.id, horasSemanales: 4 },
    });
    await prisma.planEstudio.create({
      data: { anioAcademicoId: anioId, gradoId: grado.id, cursoId: com.id, horasSemanales: 4 },
    });

    // docentes: el admin con perfil Docente (sección A) y Ríos (sección B)
    const docenteAdmin = await prisma.docente.findUnique({ where: { personaId: u.personaId } });
    const docenteAdminId = docenteAdmin?.id ?? (await prisma.docente.create({ data: { personaId: u.personaId } })).id;
    docenteAdminCreado = !docenteAdmin;
    propio = { ...admin, rol: "DOCENTE" };
    const pRios = await prisma.persona.create({
      data: {
        dni: "90001810",
        nombres: "Raúl",
        apellidos: "Ríos Aula",
        email: "90001810@prueba.kubo.test",
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

    // apoderado de todos; Valeria (A, con cuenta), Diego (A, sin cuenta), Carla (B, con cuenta) y Sofía (sin matrícula)
    const pApoderado = await prisma.persona.create({
      data: {
        dni: "90001801",
        nombres: "Carmen",
        apellidos: "Apoderada Aula",
        email: "90001801@prueba.kubo.test",
        apoderado: { create: {} },
      },
      include: { apoderado: true },
    });
    personas.push(pApoderado.id);
    await cuenta(pApoderado.id, pApoderado.email!);
    for (const [clave, dni, nombres, seccionId, conCuenta] of [
      ["valeria", "90001821", "Valeria", seccionA, true],
      ["diego", "90001822", "Diego", seccionA, false],
      ["carla", "90001823", "Carla", seccionB, true],
      ["sofia", "90001824", "Sofía", null, true],
    ] as const) {
      const es = await prisma.persona.create({
        data: { dni, nombres, apellidos: "Quispe Aula", estudiante: { create: { gradoIngresoId: grado.id } } },
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
      if (seccionId) {
        await confirmarMatricula(
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
      }
      if (conCuenta) {
        const c = await cuenta(es.id, `${dni}@prueba.kubo.test`);
        if (clave === "valeria" || clave === "carla") usuarios[clave] = c.id;
      }
    }

    token.rios = await ingresar("90001810@prueba.kubo.test");
    token.apoderado = await ingresar("90001801@prueba.kubo.test");
    token.valeria = await ingresar("90001821@prueba.kubo.test");
    token.carla = await ingresar("90001823@prueba.kubo.test");
    token.sinMatricula = await ingresar("90001824@prueba.kubo.test");
  }, ESPERA_PREPARACION);

  afterAll(async () => {
    process.env.ARCHIVOS_DRIVER = entorno.driver;
    process.env.ARCHIVOS_DIR = entorno.dir;
    reiniciarAlmacen();
    if (carpeta) await fs.rm(carpeta, { recursive: true, force: true });
    if (!anioId) return;
    // al borrar la asignación se van sus unidades, materiales y enlaces (cascada)
    await prisma.asignacionDocente.deleteMany({ where: { seccion: { anioAcademicoId: anioId } } });
    await prisma.planEstudio.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    // sus notificaciones se borran en cascada con la cuenta
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

  // ---------- Seguridad: 401 y 403 en cada endpoint ----------

  const enlaceValido = () => ({
    tipo: "CLASE_VIRTUAL",
    titulo: "Clase de Matemática",
    url: "https://meet.kubo.edu.pe/mat-va",
    inicio: enLima(new Date(Date.now() - 10 * MINUTO)),
    fin: enLima(new Date(Date.now() + 50 * MINUTO)),
    visible: true,
  });

  /** Cada endpoint con un pedido válido en forma; el id del recurso no importa para 401 y 403. */
  const endpoints = (): {
    nombre: string;
    manejador: Manejador;
    metodo: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    params: Record<string, string>;
    json?: unknown;
    formulario?: () => FormData;
    soloAlumno?: boolean;
  }[] => [
    { nombre: "cursos del docente", manejador: cursosDocenteRuta, metodo: "GET", params: {} },
    { nombre: "aula", manejador: aulaRuta, metodo: "GET", params: { asignacionId: asignaciones.matA } },
    {
      nombre: "crear unidad",
      manejador: crearUnidadRuta,
      metodo: "POST",
      params: { asignacionId: asignaciones.matA },
      json: { titulo: "Unidad" },
    },
    {
      nombre: "editar unidad",
      manejador: editarUnidadRuta,
      metodo: "PATCH",
      params: { id: ID_INEXISTENTE },
      json: { titulo: "Otra" },
    },
    {
      nombre: "mover unidad",
      manejador: moverUnidadRuta,
      metodo: "POST",
      params: { id: ID_INEXISTENTE },
      json: { direccion: "ARRIBA" },
    },
    {
      nombre: "subir material",
      manejador: subirRuta,
      metodo: "POST",
      params: { asignacionId: asignaciones.matA },
      formulario: () =>
        formulario(
          { unidadId: ID_INEXISTENTE, titulo: "Guía", tipo: "ARCHIVO", visible: "false" },
          { bytes: PDF, nombre: "guia.pdf", tipo: "application/pdf" },
        ),
    },
    { nombre: "publicar material", manejador: publicarMaterialRuta, metodo: "POST", params: { id: ID_INEXISTENTE } },
    { nombre: "ocultar material", manejador: ocultarMaterialRuta, metodo: "POST", params: { id: ID_INEXISTENTE } },
    { nombre: "eliminar material", manejador: eliminarMaterialRuta, metodo: "DELETE", params: { id: ID_INEXISTENTE } },
    {
      nombre: "crear enlace",
      manejador: crearEnlaceRuta,
      metodo: "POST",
      params: { asignacionId: asignaciones.matA },
      json: enlaceValido(),
    },
    {
      nombre: "editar enlace",
      manejador: editarEnlaceRuta,
      metodo: "PUT",
      params: { id: ID_INEXISTENTE },
      json: enlaceValido(),
    },
    { nombre: "publicar enlace", manejador: publicarEnlaceRuta, metodo: "POST", params: { id: ID_INEXISTENTE } },
    { nombre: "ocultar enlace", manejador: ocultarEnlaceRuta, metodo: "POST", params: { id: ID_INEXISTENTE } },
    { nombre: "eliminar enlace", manejador: eliminarEnlaceRuta, metodo: "DELETE", params: { id: ID_INEXISTENTE } },
    {
      nombre: "curso del alumno",
      manejador: cursoAlumnoRuta,
      metodo: "GET",
      params: { cursoId: ID_INEXISTENTE },
      soloAlumno: true,
    },
  ];

  it("cada endpoint responde 401 sin sesión", async () => {
    const lista = [
      ...endpoints(),
      { nombre: "archivo", manejador: archivoRuta, metodo: "GET" as const, params: { id: ID_INEXISTENTE } },
    ];
    for (const e of lista) {
      const r = await pedir(e.manejador, {
        metodo: e.metodo,
        params: e.params,
        json: e.json,
        formulario: e.formulario?.(),
      });
      expect(r.estado, e.nombre).toBe(401);
      expect(r.error?.code, e.nombre).toBe("NO_AUTENTICADO");
    }
  });

  it("cada endpoint responde 403 a un perfil que no le corresponde (apoderado; docente en el del alumno)", async () => {
    for (const e of endpoints()) {
      const r = await pedir(e.manejador, {
        token: e.soloAlumno ? token.rios : token.apoderado,
        metodo: e.metodo,
        params: e.params,
        json: e.json,
        formulario: e.formulario?.(),
      });
      expect(r.estado, e.nombre).toBe(403);
      expect(r.error?.code, e.nombre).toBe("ACCESO_DENEGADO");
    }
    const archivo = await pedir(archivoRuta, { token: token.apoderado, params: { id: ID_INEXISTENTE } });
    expect(archivo.estado).toBe(403);
  });

  // ---------- Unidades didácticas ----------

  it("el docente crea, renombra, ordena y desactiva las unidades de su curso", async () => {
    const crear = async (titulo: string) =>
      (
        await pedir(crearUnidadRuta, {
          token: token.rios,
          metodo: "POST",
          params: { asignacionId: asignaciones.matB },
          json: { titulo },
        })
      ).datos as UnidadVista;
    const u1 = await crear("Números enteros");
    const u2 = await crear("Álgebra");
    unidad.b1 = u1.id;
    expect([u1.numero, u2.numero]).toEqual([1, 2]);

    const renombrada = await pedir(editarUnidadRuta, {
      token: token.rios,
      metodo: "PATCH",
      params: { id: u2.id },
      json: { titulo: "  Ecuaciones  " },
    });
    expect((renombrada.datos as UnidadVista).titulo).toBe("Ecuaciones");

    const movidas = await pedir(moverUnidadRuta, {
      token: token.rios,
      metodo: "POST",
      params: { id: u2.id },
      json: { direccion: "ARRIBA" },
    });
    expect((movidas.datos as UnidadVista[]).map((u) => [u.titulo, u.numero])).toEqual([
      ["Ecuaciones", 1],
      ["Números enteros", 2],
    ]);
    // en el extremo no cambia nada
    const igual = await pedir(moverUnidadRuta, {
      token: token.rios,
      metodo: "POST",
      params: { id: u2.id },
      json: { direccion: "ARRIBA" },
    });
    expect((igual.datos as UnidadVista[]).map((u) => u.id)).toEqual([u2.id, u1.id]);

    const desactivada = await pedir(editarUnidadRuta, {
      token: token.rios,
      metodo: "PATCH",
      params: { id: u2.id },
      json: { activo: false },
    });
    expect((desactivada.datos as UnidadVista).activo).toBe(false);

    // unidades del curso del admin (sección A), con los casos de uso
    unidad.a1 = (await crearUnidad(propio, asignaciones.matA, "Fracciones")).id;
    unidad.a2 = (await crearUnidad(propio, asignaciones.matA, "Geometría")).id;
  });

  it("vínculo: otro docente recibe 403 en el aula ajena y 404 en sus unidades, materiales y enlaces", async () => {
    const aula = await pedir(aulaRuta, { token: token.rios, params: { asignacionId: asignaciones.matA } });
    expect(aula.estado).toBe(403);
    const crear = await pedir(crearUnidadRuta, {
      token: token.rios,
      metodo: "POST",
      params: { asignacionId: asignaciones.matA },
      json: { titulo: "Intrusa" },
    });
    expect(crear.estado).toBe(403);
    const subir = await pedir(subirRuta, {
      token: token.rios,
      metodo: "POST",
      params: { asignacionId: asignaciones.matA },
      formulario: formulario({
        unidadId: unidad.a1,
        titulo: "Guía",
        tipo: "ENLACE",
        url: "https://a.pe",
        visible: "false",
      }),
    });
    expect(subir.estado).toBe(403);
    const editar = await pedir(editarUnidadRuta, {
      token: token.rios,
      metodo: "PATCH",
      params: { id: unidad.a1 },
      json: { activo: false },
    });
    expect(editar.estado).toBe(404);
    // el docente de A tampoco puede subir a una unidad de B desde su curso
    expect((await codigoDe(crearUnidad(propio, asignaciones.matB, "Ajena"))).codigo).toBe("ACCESO_DENEGADO");
  });

  // ---------- US61 · Materiales ----------

  it("publica un PDF visible: queda en el almacén, en la auditoría y avisa solo a los alumnos con cuenta de la sección", async () => {
    const antes = await archivosGuardados();
    const m = await subirMaterial(
      propio,
      asignaciones.matA,
      {
        unidadId: unidad.a1,
        titulo: "Guía de fracciones",
        tipo: "ARCHIVO",
        url: null,
        visible: true,
        archivo: { nombre: "C:\\fakepath\\Guía 1.PDF", bytes: PDF },
      },
      meta,
    );
    material.publicado = m.id;
    expect(m).toMatchObject({
      tipo: "PDF",
      estado: "PUBLICADO",
      archivo: { nombre: "Guía 1.pdf", mime: "application/pdf", tamanoBytes: PDF.length },
    });
    expect(JSON.stringify(m)).not.toContain("materiales/");
    expect(await archivosGuardados()).toBe(antes + 1);
    expect(await auditoria(m.id)).toEqual([{ accion: "PUBLICAR_MATERIAL", usuarioId: propio.usuarioId }]);
    expect(await avisosDe(usuarios.valeria)).toEqual([
      { titulo: "Nuevo material en Matemática", enlace: `/alumno/cursos/${cursos.mat}` },
    ]);
    expect(await avisosDe(usuarios.carla)).toEqual([]);
  });

  it("guarda como borrador una imagen y un enlace sin publicar, sin auditoría ni aviso", async () => {
    const png = await subirMaterial(
      propio,
      asignaciones.matA,
      {
        unidadId: unidad.a1,
        titulo: "Mapa conceptual",
        tipo: "ARCHIVO",
        url: null,
        visible: false,
        archivo: { nombre: "mapa.png", bytes: PNG },
      },
      meta,
    );
    material.borrador = png.id;
    expect(png).toMatchObject({ tipo: "IMAGEN", estado: "BORRADOR", publicadoEn: null });
    const link = await subirMaterial(
      propio,
      asignaciones.matA,
      {
        unidadId: unidad.a2,
        titulo: "Video de ángulos",
        tipo: "ENLACE",
        url: "https://video.kubo.test/angulos",
        visible: true,
        archivo: null,
      },
      meta,
    );
    material.enlace = link.id;
    expect(link).toMatchObject({
      tipo: "ENLACE",
      estado: "PUBLICADO",
      archivo: null,
      url: "https://video.kubo.test/angulos",
    });
    expect(await auditoria(png.id)).toEqual([]);
    expect((await avisosDe(usuarios.valeria)).length).toBe(2);

    // por la API, un borrador de Ríos en su curso
    const r = await pedir(subirRuta, {
      token: token.rios,
      metodo: "POST",
      params: { asignacionId: asignaciones.matB },
      formulario: formulario(
        { unidadId: unidad.b1, titulo: "Práctica 1", tipo: "ARCHIVO", visible: "false" },
        { bytes: PDF, nombre: "practica.pdf", tipo: "application/pdf" },
      ),
    });
    expect(r.estado).toBe(201);
    material.borradorB = (r.datos as { id: string }).id;
  });

  it("rechaza el formato no permitido, más de 5 MB, una URL inválida y una unidad desactivada, indicando el motivo", async () => {
    const antes = await archivosGuardados();
    const subir = (campos: Record<string, string>, archivo?: { bytes: Uint8Array; nombre: string; tipo: string }) =>
      pedir(subirRuta, {
        token: token.rios,
        metodo: "POST",
        params: { asignacionId: asignaciones.matB },
        formulario: formulario({ unidadId: unidad.b1, titulo: "Material", visible: "true", ...campos }, archivo),
      });
    const formato = await subir({ tipo: "ARCHIVO" }, { bytes: FALSO, nombre: "trampa.pdf", tipo: "application/pdf" });
    expect([formato.estado, formato.error?.code, formato.error?.message]).toEqual([
      400,
      "ARCHIVO_NO_PERMITIDO",
      MENSAJE_FORMATO_MATERIAL,
    ]);
    const grande = new Uint8Array(TAMANO_MAXIMO_ARCHIVO + 1);
    grande.set(PDF);
    const pesado = await subir({ tipo: "ARCHIVO" }, { bytes: grande, nombre: "grande.pdf", tipo: "application/pdf" });
    expect([pesado.estado, pesado.error?.code, pesado.error?.message]).toEqual([
      413,
      "ARCHIVO_DEMASIADO_GRANDE",
      MENSAJE_TAMANO_MATERIAL,
    ]);
    const url = await subir({ tipo: "ENLACE", url: "javascript:alert(1)" });
    expect([url.estado, url.error?.message]).toEqual([400, MENSAJE_ENLACE_INVALIDO]);
    const unidades = await prisma.unidadDidactica.findMany({
      where: { asignacionDocenteId: asignaciones.matB, activo: false },
    });
    const inactiva = await pedir(subirRuta, {
      token: token.rios,
      metodo: "POST",
      params: { asignacionId: asignaciones.matB },
      formulario: formulario({
        unidadId: unidades[0].id,
        titulo: "M",
        tipo: "ENLACE",
        url: "https://a.pe",
        visible: "false",
      }),
    });
    expect([inactiva.estado, inactiva.error?.code]).toEqual([422, "UNIDAD_INACTIVA"]);
    expect(await archivosGuardados()).toBe(antes);
    expect(await prisma.materialEstudio.count({ where: { asignacionDocenteId: asignaciones.matB } })).toBe(1);
  });

  // ---------- US67 · Lo que ve el alumno ----------

  it("el alumno ve los materiales publicados de su sección agrupados por unidad y los descarga; borradores no", async () => {
    const aula = await aulaDe(token.valeria);
    expect(aula.seccionCorta).toBe("1° VA");
    expect(aula.unidades.map((g) => [g.unidad.titulo, g.materiales.map((m) => m.id)])).toEqual([
      ["Fracciones", [material.publicado]],
      ["Geometría", [material.enlace]],
    ]);
    const descarga = await pedir(archivoRuta, { token: token.valeria, params: { id: material.publicado } });
    expect(descarga.estado).toBe(200);
    expect(descarga.disposicion).toContain("inline");
    expect(Buffer.from(descarga.bytes!).equals(Buffer.from(PDF))).toBe(true);
    // el borrador: el alumno no lo ve ni lo descarga; el docente sí
    expect((await pedir(archivoRuta, { token: token.valeria, params: { id: material.borrador } })).estado).toBe(404);
    expect((await pedir(archivoRuta, { token: token.rios, params: { id: material.borrador } })).estado).toBe(404);
    expect((await pedir(archivoRuta, { token: token.rios, params: { id: material.borradorB } })).estado).toBe(200);
  });

  it("vínculo del alumno: otra sección, un curso ajeno o sin matrícula vigente no ven el material", async () => {
    // Carla (sección B) ve el aula de Matemática de su sección: sin los materiales de A
    const deCarla = await aulaDe(token.carla);
    expect(deCarla.unidades).toEqual([]);
    expect((await pedir(archivoRuta, { token: token.carla, params: { id: material.publicado } })).estado).toBe(404);
    // un curso que no está en el plan de su sección
    const otro = await pedir(cursoAlumnoRuta, { token: token.valeria, params: { cursoId: ID_INEXISTENTE } });
    expect([otro.estado, otro.error?.code]).toEqual([404, "NO_ENCONTRADO"]);
    // Comunicación está en su plan, pero sin docente: aula vacía
    const com = await aulaDe(token.valeria, cursos.com);
    expect([com.docente, com.unidades, com.enlaces]).toEqual([null, [], []]);
    const sin = await pedir(cursoAlumnoRuta, { token: token.sinMatricula, params: { cursoId: cursos.mat } });
    expect([sin.estado, sin.error?.code]).toEqual([403, "SIN_MATRICULA_VIGENTE"]);
  });

  it("ocultar, volver a publicar y desactivar la unidad cambian lo que ve el alumno (US61 criterio 3)", async () => {
    await ocultarMaterial(propio, material.publicado, meta);
    expect((await aulaDe(token.valeria)).unidades.flatMap((g) => g.materiales.map((m) => m.id))).toEqual([
      material.enlace,
    ]);
    expect((await pedir(archivoRuta, { token: token.valeria, params: { id: material.publicado } })).estado).toBe(404);
    expect((await codigoDe(ocultarMaterial(propio, material.publicado, meta))).codigo).toBe("MATERIAL_NO_PUBLICADO");

    await publicarMaterial(propio, material.publicado, meta);
    expect((await pedir(archivoRuta, { token: token.valeria, params: { id: material.publicado } })).estado).toBe(200);
    expect((await auditoria(material.publicado)).map((a) => a.accion)).toEqual([
      "PUBLICAR_MATERIAL",
      "OCULTAR_MATERIAL",
      "PUBLICAR_MATERIAL",
    ]);

    await editarUnidad(propio, unidad.a1, { activo: false });
    expect((await aulaDe(token.valeria)).unidades.map((g) => g.unidad.titulo)).toEqual(["Geometría"]);
    expect((await pedir(archivoRuta, { token: token.valeria, params: { id: material.publicado } })).estado).toBe(404);
    await editarUnidad(propio, unidad.a1, { activo: true });
  });

  it("el docente ve todo su aula y elimina un material con su archivo (auditado)", async () => {
    const aula = await aulaDelDocente(propio, asignaciones.matA);
    expect(aula.materiales.map((m) => [m.id, m.estado]).sort()).toEqual(
      [
        [material.publicado, "PUBLICADO"],
        [material.borrador, "BORRADOR"],
        [material.enlace, "PUBLICADO"],
      ].sort(),
    );
    const antes = await archivosGuardados();
    await eliminarMaterial(propio, material.borrador, meta);
    expect(await archivosGuardados()).toBe(antes - 1);
    expect((await auditoria(material.borrador)).map((a) => a.accion)).toEqual(["ELIMINAR_MATERIAL"]);
    expect((await pedir(archivoRuta, { token: token.rios, params: { id: material.borrador } })).estado).toBe(404);
  });

  // ---------- US62 · Enlaces de clase virtual ----------

  it("rechaza una URL inválida con «Ingresa un enlace válido» y un fin que no es posterior al inicio, sin guardar", async () => {
    const crear = (cambios: Record<string, unknown>) =>
      pedir(crearEnlaceRuta, {
        token: token.rios,
        metodo: "POST",
        params: { asignacionId: asignaciones.matB },
        json: { ...enlaceValido(), visible: false, ...cambios },
      });
    const url = await crear({ url: "meet.kubo.edu.pe/mat" });
    expect([url.estado, url.error?.code, url.error?.message]).toEqual([
      400,
      "ENLACE_INVALIDO",
      MENSAJE_ENLACE_INVALIDO,
    ]);
    const ahora = new Date();
    const fechas = await crear({ inicio: enLima(ahora), fin: enLima(ahora) });
    expect([fechas.estado, fechas.error?.code]).toEqual([400, "FECHAS_ENLACE_INVALIDAS"]);
    expect(await prisma.enlaceVirtual.count({ where: { asignacionDocenteId: asignaciones.matB } })).toBe(0);
    // un enlace oculto sí se guarda por la API (no se audita ni avisa)
    const oculto = await crear({});
    expect(oculto.estado).toBe(201);
  });

  it("muestra a los alumnos los enlaces visibles con su estado calculado y la URL solo del activo", async () => {
    const ahora = Date.now();
    const datos = (titulo: string, desdeMin: number, hastaMin: number, visible = true) => ({
      tipo: "CLASE_VIRTUAL" as const,
      titulo,
      url: `https://meet.kubo.test/${titulo.toLowerCase()}`,
      inicio: enLima(new Date(ahora + desdeMin * MINUTO)),
      fin: enLima(new Date(ahora + hastaMin * MINUTO)),
      visible,
    });
    enlace.activo = (await crearEnlace(propio, asignaciones.matA, datos("Activa", -10, 50), meta)).id;
    enlace.programado = (
      await crearEnlace(propio, asignaciones.matA, { ...datos("Mañana", 24 * 60, 25 * 60), tipo: "TALLER" }, meta)
    ).id;
    enlace.finalizado = (
      await crearEnlace(propio, asignaciones.matA, { ...datos("Ayer", -25 * 60, -24 * 60), tipo: "ASESORIA" }, meta)
    ).id;
    enlace.oculto = (await crearEnlace(propio, asignaciones.matA, datos("Oculta", -10, 50, false), meta)).id;

    const aula = await aulaDe(token.valeria);
    expect(aula.enlaces.map((e) => [e.titulo, e.estado, e.url])).toEqual([
      ["Ayer", "FINALIZADO", null],
      ["Activa", "ACTIVO", "https://meet.kubo.test/activa"],
      ["Mañana", "PROGRAMADO", null],
    ]);
    expect((await auditoria(enlace.activo)).map((a) => a.accion)).toEqual(["PUBLICAR_ENLACE"]);
    expect(await auditoria(enlace.oculto)).toEqual([]);
    expect((await avisosDe(usuarios.valeria)).filter((a) => a.titulo.startsWith("Clase virtual")).length).toBe(1);
    expect((await aulaDe(token.carla)).enlaces).toEqual([]);
  });

  it("ocultar, mostrar y eliminar un enlace quedan en la auditoría y cambian lo que ve el alumno", async () => {
    await cambiarVisibilidadEnlace(propio, enlace.activo, false, meta);
    expect((await aulaDe(token.valeria)).enlaces.map((e) => e.titulo)).toEqual(["Ayer", "Mañana"]);
    expect((await codigoDe(cambiarVisibilidadEnlace(propio, enlace.activo, false, meta))).codigo).toBe(
      "ENLACE_YA_OCULTO",
    );
    await cambiarVisibilidadEnlace(propio, enlace.oculto, true, meta);
    await eliminarEnlace(propio, enlace.finalizado, meta);
    expect((await aulaDe(token.valeria)).enlaces.map((e) => e.titulo)).toEqual(["Oculta", "Mañana"]);
    expect((await auditoria(enlace.activo)).map((a) => a.accion)).toEqual(["PUBLICAR_ENLACE", "OCULTAR_ENLACE"]);
    expect((await auditoria(enlace.oculto)).map((a) => a.accion)).toEqual(["PUBLICAR_ENLACE"]);
    expect((await auditoria(enlace.finalizado)).map((a) => a.accion)).toEqual(["PUBLICAR_ENLACE", "ELIMINAR_ENLACE"]);
    // otro docente: 404 en los enlaces ajenos
    for (const r of [
      await pedir(ocultarEnlaceRuta, { token: token.rios, metodo: "POST", params: { id: enlace.oculto } }),
      await pedir(eliminarEnlaceRuta, { token: token.rios, metodo: "DELETE", params: { id: enlace.oculto } }),
      await pedir(editarEnlaceRuta, {
        token: token.rios,
        metodo: "PUT",
        params: { id: enlace.oculto },
        json: enlaceValido(),
      }),
      await pedir(publicarMaterialRuta, { token: token.rios, metodo: "POST", params: { id: material.publicado } }),
      await pedir(eliminarMaterialRuta, { token: token.rios, metodo: "DELETE", params: { id: material.publicado } }),
    ]) {
      expect(r.estado).toBe(404);
    }
  });

  it("fuera del año en curso el aula queda en solo lectura (422 ANIO_NO_EN_CURSO)", async () => {
    await prisma.anioAcademico.update({ where: { id: anioId }, data: { estado: "EN_CIERRE" } });
    try {
      const r = await pedir(crearUnidadRuta, {
        token: token.rios,
        metodo: "POST",
        params: { asignacionId: asignaciones.matB },
        json: { titulo: "Tarde" },
      });
      expect([r.estado, r.error?.code]).toEqual([422, "ANIO_NO_EN_CURSO"]);
      const aula = await pedir(aulaRuta, { token: token.rios, params: { asignacionId: asignaciones.matB } });
      expect([aula.estado, (aula.datos as { editable: boolean }).editable]).toEqual([200, false]);
    } finally {
      await prisma.anioAcademico.update({ where: { id: anioId }, data: { estado: "EN_CURSO" } });
    }
  });
});
