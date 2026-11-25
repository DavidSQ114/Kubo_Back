// Prueba de integración del bloque M4 (fases 5 a 7): matrícula en línea del apoderado con documentos. Fuera de las
// fechas responde MATRICULA_AUN_NO_ABRE; sin un obligatorio, DOCUMENTO_FALTANTE; la solicitud crea la matrícula En
// proceso y avisa a los coordinadores; solo el coordinador y el apoderado del alumno abren los documentos; observar,
// reemplazar y aprobar cambian el estado; con todo aprobado se asigna la sección (Matriculado con cuota de ingreso).
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/solicitudes.integracion
// Crea sus propios datos ficticios en el año 2073 (DNI 900027xx) y los borra al terminar. Lo auditado lo firma el
// administrador del seed (la bitácora es inmutable y no deja borrar a su actor): para la parte del apoderado, su
// persona recibe por un rato un perfil de apoderado vinculado al alumno de prueba.
import "@/server/wiring";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eliminarArchivo } from "@/platform/archivos";
import { prisma } from "@/platform/db/prisma";
import type { Autenticado } from "@/modules/identidad";
import {
  archivoDeDocumentoMatricula,
  asignarSeccionSolicitud,
  enviarSolicitud,
  guardarProceso,
  matriculaEnLinea,
  reemplazarDocumento,
  revisarDocumentoSolicitud,
} from "@/modules/matricula";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2073;
const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const INICIO = new Date();
const meta = { requestId: `prueba-solicitudes-m4-${Date.now()}`, ip: null, userAgent: null };

// archivos mínimos con su firma real (el servidor detecta el tipo por el contenido, no por el nombre)
const jpg = () => ({
  nombre: "partida.jpg",
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]),
});
const pdf = () => ({ nombre: "dni.pdf", bytes: new TextEncoder().encode("%PDF-1.4\n%prueba\n") });
const texto = () => ({ nombre: "dni.pdf", bytes: new TextEncoder().encode("no soy un pdf") });

const dias = (n: number) => {
  const d = new Date(`${HOY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const error = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    return e as { codigo: string; message: string };
  }
  throw new Error("Se esperaba un error");
};

describe.skipIf(!ACTIVA)("matrícula en línea con documentos (bloque M4)", () => {
  let coordinador: Autenticado;
  let apoderado: Autenticado;
  let otroApoderado: Autenticado;
  let anioId: string;
  let seccionId: string;
  let gradoId: string;
  let estudianteId: string;
  let vinculoId: string;
  let apoderadoAdminId: string;
  let documentos: { partida: string; dni: string; noAdeudo: string };
  let solicitudId: string;
  const personas: string[] = [];

  const proceso = (fechaInicio: string, fechaFin: string) =>
    guardarProceso(
      coordinador,
      anioId,
      {
        fechaInicio,
        fechaFin,
        documentos: [
          { nombre: "Partida de nacimiento", obligatorio: true },
          { nombre: "DNI del alumno", obligatorio: true },
          { nombre: "Constancia de no adeudo", obligatorio: false },
        ],
      },
      meta,
    );
  const solicitud = (archivos: Record<string, { nombre: string; bytes: Uint8Array }>) =>
    enviarSolicitud(
      apoderado,
      estudianteId,
      { gradoId, vinculoResponsableId: vinculoId, confirmaDatos: true, archivos },
      meta,
    );
  const detalle = async () =>
    await prisma.solicitudMatricula.findUniqueOrThrow({ where: { id: solicitudId }, include: { documentos: true } });

  beforeAll(async () => {
    const u = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@kubo.edu.pe" } });
    coordinador = {
      usuarioId: u.id,
      sesionId: "prueba",
      personaId: u.personaId,
      email: u.email,
      rol: "COORDINADOR",
      debeCambiarPassword: false,
    };
    apoderado = { ...coordinador, rol: "APODERADO" };
    const grado = await prisma.grado.findFirstOrThrow({ where: { numero: 1 } });
    gradoId = grado.id;
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
    for (const [clave, valor] of [
      ["MONTO_MATRICULA", "300.00"],
      ["MONTO_PENSION", "400.00"],
      ["MONTO_INGRESO", "250.00"],
    ]) {
      await prisma.parametroInstitucion.create({
        data: { anioAcademicoId: anioId, clave, valor, actualizadoPorId: u.id },
      });
    }
    seccionId = (
      await prisma.seccion.create({ data: { anioAcademicoId: anioId, gradoId, nombre: "S", aforoMaximo: 5 } })
    ).id;
    // la persona del administrador del seed es por un rato apoderada del alumno de prueba
    apoderadoAdminId = (await prisma.apoderado.create({ data: { personaId: u.personaId } })).id;
    const e = await prisma.persona.create({
      data: {
        dni: "90002701",
        nombres: "Inés",
        apellidos: "Solicitud Prueba",
        estudiante: { create: { gradoIngresoId: gradoId } },
      },
      include: { estudiante: true },
    });
    const otro = await prisma.persona.create({
      data: { dni: "90002702", nombres: "Otro", apellidos: "Apoderado Prueba", apoderado: { create: {} } },
    });
    personas.push(e.id, otro.id);
    estudianteId = e.estudiante!.id;
    vinculoId = (
      await prisma.vinculoApoderado.create({
        data: { estudianteId, apoderadoId: apoderadoAdminId, parentesco: "Madre", esPrincipal: true },
      })
    ).id;
    otroApoderado = { ...apoderado, usuarioId: "00000000-0000-4000-8000-000000000000", personaId: otro.id };
  });

  afterAll(async () => {
    if (!anioId) return;
    const subidos = await prisma.documentoMatricula.findMany({
      where: { solicitud: { matricula: { anioAcademicoId: anioId } } },
      select: { archivoClave: true },
    });
    await Promise.all(subidos.map((d) => eliminarArchivo(d.archivoClave, meta.requestId)));
    await prisma.notificacion.deleteMany({
      where: { createdAt: { gte: INICIO }, enlace: { startsWith: "/coordinador/solicitudes-matricula" } },
    });
    await prisma.notificacion.deleteMany({ where: { createdAt: { gte: INICIO }, usuarioId: coordinador.usuarioId } });
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.procesoMatricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudianteId } });
    await prisma.apoderado.deleteMany({ where: { OR: [{ id: apoderadoAdminId }, { personaId: { in: personas } }] } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.delete({ where: { id: anioId } });
    await prisma.$disconnect();
  });

  it("antes del inicio de la matrícula responde MATRICULA_AUN_NO_ABRE", async () => {
    const p = await proceso(dias(3), dias(30));
    const [partida, dni, noAdeudo] = p.documentos.map((d) => d.documentoId);
    documentos = { partida, dni, noAdeudo };
    const e = await error(() => solicitud({ [partida]: jpg(), [dni]: pdf() }));
    expect(e.codigo).toBe("MATRICULA_AUN_NO_ABRE");
    const vista = await matriculaEnLinea(apoderado);
    expect(vista.hijos.find((h) => h.estudianteId === estudianteId)).toMatchObject({ puedeMatricular: false });
  });

  it("sin un documento obligatorio o con un archivo que no es PDF ni JPG, se rechaza", async () => {
    // sin los ids, la lista se vuelve a crear: los documentos anteriores quedan inactivos
    const p = await proceso(dias(-1), dias(30));
    const [partida, dni, noAdeudo] = p.documentos.map((d) => d.documentoId);
    expect(partida).not.toBe(documentos.partida);
    documentos = { partida, dni, noAdeudo };
    expect((await error(() => solicitud({ [documentos.partida]: jpg() }))).codigo).toBe("DOCUMENTO_FALTANTE");
    expect((await error(() => solicitud({ [documentos.partida]: jpg(), [documentos.dni]: texto() }))).codigo).toBe(
      "ARCHIVO_NO_PERMITIDO",
    );
    expect(await prisma.matricula.count({ where: { anioAcademicoId: anioId } })).toBe(0);
  });

  it("crea la matrícula En proceso con la solicitud en revisión y avisa a los coordinadores", async () => {
    const s = await solicitud({ [documentos.partida]: jpg(), [documentos.dni]: pdf() });
    solicitudId = s.solicitudId;
    expect(s.estado).toBe("EN_REVISION");
    const m = await prisma.matricula.findUniqueOrThrow({ where: { id: s.matriculaId } });
    expect(m).toMatchObject({ estado: "EN_PROCESO", vinculoResponsableId: vinculoId, seccionId: null });
    expect(
      await prisma.notificacion.count({
        where: { createdAt: { gte: INICIO }, enlace: { startsWith: "/coordinador/solicitudes-matricula" } },
      }),
    ).toBeGreaterThan(0);
    expect((await error(() => solicitud({ [documentos.partida]: jpg(), [documentos.dni]: pdf() }))).codigo).toBe(
      "SOLICITUD_EXISTENTE",
    );
  });

  it("solo el coordinador y el apoderado del alumno abren los documentos", async () => {
    const d = (await detalle()).documentos[0];
    expect((await archivoDeDocumentoMatricula(coordinador, solicitudId, d.id)).archivo.nombre).toBe(d.nombreArchivo);
    expect((await archivoDeDocumentoMatricula(apoderado, solicitudId, d.id)).archivo.mime).toBe(d.mimeType);
    expect((await error(() => archivoDeDocumentoMatricula(otroApoderado, solicitudId, d.id))).codigo).toBe(
      "ESTUDIANTE_NO_VINCULADO",
    );
  });

  it("observar, reemplazar y aprobar; recién con todo aprobado se asigna la sección con la cuota de ingreso", async () => {
    const porRequerido = async (id: string) => (await detalle()).documentos.find((x) => x.documentoRequeridoId === id)!;
    const partida = await porRequerido(documentos.partida);
    const observada = await revisarDocumentoSolicitud(
      coordinador,
      solicitudId,
      partida.id,
      { decision: "OBSERVAR", observacion: "No se lee" },
      meta,
    );
    expect(observada.estado).toBe("OBSERVADA");
    expect(
      (
        await error(() =>
          asignarSeccionSolicitud(coordinador, solicitudId, { seccionId, modalidadPago: "MENSUAL" }, meta),
        )
      ).codigo,
    ).toBe("DOCUMENTOS_PENDIENTES");
    expect((await error(() => reemplazarDocumento(apoderado, estudianteId, documentos.dni, pdf(), meta))).codigo).toBe(
      "DOCUMENTO_NO_REEMPLAZABLE",
    );
    const reemplazada = await reemplazarDocumento(apoderado, estudianteId, documentos.partida, jpg(), meta);
    expect(reemplazada.estado).toBe("EN_REVISION");
    for (const id of [documentos.partida, documentos.dni]) {
      await revisarDocumentoSolicitud(
        coordinador,
        solicitudId,
        (await porRequerido(id)).id,
        { decision: "APROBAR" },
        meta,
      );
    }
    expect((await detalle()).estado).toBe("APROBADA");
    const m = await asignarSeccionSolicitud(coordinador, solicitudId, { seccionId, modalidadPago: "MENSUAL" }, meta);
    expect(m.estado).toBe("MATRICULADO");
    expect(m.cronograma.cuotas.find((c) => c.tipo === "INGRESO")?.monto).toBe("250.00");
    expect((await detalle()).estado).toBe("MATRICULADA");
  });
});
