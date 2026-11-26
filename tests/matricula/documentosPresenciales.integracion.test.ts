// Prueba de integración de los documentos de la matrícula presencial: la matrícula directa de un alumno nuevo en
// «Matrícula» exige los documentos obligatorios del proceso del año (leídos de proceso_matricula, aquí con nombres
// inventados), los registra como solicitud PRESENCIAL con sus documentos aprobados y la auditoría
// RECIBIR_DOCUMENTOS_MATRICULA, y borra los archivos si la transacción falla. Sin proceso, o con un alumno antiguo,
// sigue como siempre. Si la lista cambia después, la matrícula conserva los documentos que se registraron.
// Necesita una base TEMPORAL migrada y con el seed (nunca kubo_dev ni Neon). Se ejecuta solo si se pide:
//   KUBO_PRUEBA_INTEGRACION=1 DATABASE_URL=postgresql://…/kubo_tmp_… npx vitest run tests/matricula/documentosPresenciales
// Crea sus propios datos ficticios en los años 2072 y 2071 (DNI 900029xx) y los borra al terminar. Lo auditado lo
// firma el administrador del seed (la bitácora es inmutable y no deja borrar a su actor).
import "@/server/wiring";
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eliminarArchivo } from "@/platform/archivos";
import { prisma } from "@/platform/db/prisma";
import type { Autenticado } from "@/modules/identidad";
import {
  archivoDeDocumentoMatricula,
  bandejaSolicitudes,
  confirmarMatricula,
  detalleMatricula,
  guardarProceso,
  situacionEstudiante,
} from "@/modules/matricula";

const ACTIVA = process.env.KUBO_PRUEBA_INTEGRACION === "1";
const ANIO = 2072;
const ANIO_ANTERIOR = 2071;
const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const meta = { requestId: `prueba-documentos-presenciales-${Date.now()}`, ip: null, userAgent: null };
// almacén en disco de desarrollo (las pruebas de integración corren una tras otra: nadie más escribe a la vez)
const CARPETA_MATRICULA = path.join(
  process.env.ARCHIVOS_DIR?.trim() || path.join(process.cwd(), ".archivos"),
  "matricula",
);

const jpg = (nombre = "ficha.jpg") => ({
  nombre,
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]),
});
const pdf = (nombre = "vacunas.pdf") => ({ nombre, bytes: new TextEncoder().encode("%PDF-1.4\n%prueba\n") });
const texto = () => ({ nombre: "vacunas.pdf", bytes: new TextEncoder().encode("no soy un pdf") });

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

/** Archivos que hay en el área «matricula» del almacén. */
async function archivosEnAlmacen(): Promise<number> {
  try {
    const entradas = await fs.readdir(CARPETA_MATRICULA, { recursive: true, withFileTypes: true });
    return entradas.filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

describe.skipIf(!ACTIVA)("documentos de la matrícula presencial de un alumno nuevo", () => {
  let coordinador: Autenticado;
  let anioId: string;
  let anioAnteriorId: string;
  let seccionId: string;
  const estudiantes: Record<"nuevo" | "antiguo" | "sinProceso", { estudianteId: string; vinculoId: string }> = {
    nuevo: { estudianteId: "", vinculoId: "" },
    antiguo: { estudianteId: "", vinculoId: "" },
    sinProceso: { estudianteId: "", vinculoId: "" },
  };
  let documentos: { ficha: string; vacunas: string; foto: string };
  let matriculaNuevoId: string;
  const personas: string[] = [];

  const matricular = (
    quien: keyof typeof estudiantes,
    archivos?: Record<string, { nombre: string; bytes: Uint8Array }>,
  ) =>
    confirmarMatricula(
      coordinador,
      {
        estudianteId: estudiantes[quien].estudianteId,
        anioAcademicoId: anioId,
        seccionId,
        vinculoResponsableId: estudiantes[quien].vinculoId,
        modalidadPago: "MENSUAL",
        archivos,
      },
      meta,
    );

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
    const gradoId = (await prisma.grado.findFirstOrThrow({ where: { numero: 1 } })).id;
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
    anioAnteriorId = (await crearAnio(ANIO_ANTERIOR, "CERRADO")).id;
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
      await prisma.seccion.create({ data: { anioAcademicoId: anioId, gradoId, nombre: "P", aforoMaximo: 10 } })
    ).id;
    const seccionAnterior = await prisma.seccion.create({
      data: { anioAcademicoId: anioAnteriorId, gradoId, nombre: "P", aforoMaximo: 10 },
    });
    const apoderada = await prisma.persona.create({
      data: { dni: "90002904", nombres: "Rocío", apellidos: "Secretaría Prueba", apoderado: { create: {} } },
      include: { apoderado: true },
    });
    personas.push(apoderada.id);
    const dnis = { nuevo: "90002901", antiguo: "90002902", sinProceso: "90002903" } as const;
    for (const quien of Object.keys(dnis) as (keyof typeof dnis)[]) {
      const p = await prisma.persona.create({
        data: {
          dni: dnis[quien],
          nombres: "Alumno",
          apellidos: `Presencial ${quien}`,
          estudiante: { create: { gradoIngresoId: gradoId } },
        },
        include: { estudiante: true },
      });
      personas.push(p.id);
      const vinculo = await prisma.vinculoApoderado.create({
        data: {
          estudianteId: p.estudiante!.id,
          apoderadoId: apoderada.apoderado!.id,
          parentesco: "Madre",
          esPrincipal: true,
        },
      });
      estudiantes[quien] = { estudianteId: p.estudiante!.id, vinculoId: vinculo.id };
    }
    // el alumno antiguo ya estudió en el colegio el año anterior
    await prisma.matricula.create({
      data: {
        estudianteId: estudiantes.antiguo.estudianteId,
        anioAcademicoId: anioAnteriorId,
        seccionId: seccionAnterior.id,
        vinculoResponsableId: estudiantes.antiguo.vinculoId,
        estado: "FINALIZADO",
        registradoPorId: u.id,
      },
    });
  });

  afterAll(async () => {
    if (!anioId) return;
    const subidos = await prisma.documentoMatricula.findMany({
      where: { solicitud: { matricula: { anioAcademicoId: anioId } } },
      select: { archivoClave: true },
    });
    await Promise.all(subidos.map((d) => eliminarArchivo(d.archivoClave, meta.requestId)));
    const anios = [anioId, anioAnteriorId].filter(Boolean);
    await prisma.matricula.deleteMany({ where: { anioAcademicoId: { in: anios } } });
    await prisma.procesoMatricula.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.vinculoApoderado.deleteMany({ where: { estudiante: { personaId: { in: personas } } } });
    await prisma.apoderado.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.estudiante.deleteMany({ where: { personaId: { in: personas } } });
    await prisma.persona.deleteMany({ where: { id: { in: personas } } });
    await prisma.seccion.deleteMany({ where: { anioAcademicoId: { in: anios } } });
    await prisma.parametroInstitucion.deleteMany({ where: { anioAcademicoId: anioId } });
    await prisma.anioAcademico.deleteMany({ where: { id: { in: anios } } });
    await prisma.$disconnect();
  });

  it("sin proceso de matrícula en el año, el alumno nuevo se matricula como siempre y sin documentos", async () => {
    const s = await situacionEstudiante(estudiantes.sinProceso.estudianteId, anioId);
    expect(s.esAlumnoNuevo).toBe(true);
    expect(s.documentosRequeridos).toEqual([]);
    const m = await matricular("sinProceso");
    expect(m.estado).toBe("MATRICULADO");
    expect(m.documentos).toBeNull();
  });

  it("con proceso, al alumno nuevo se le piden los documentos activos en su orden, aunque el proceso esté cerrado", async () => {
    const p = await guardarProceso(
      coordinador,
      anioId,
      {
        fechaInicio: dias(-60),
        fechaFin: dias(-30),
        documentos: [
          { nombre: "Ficha de salud escolar", obligatorio: true },
          { nombre: "Constancia de vacunas", obligatorio: true },
          { nombre: "Foto tamaño carné", obligatorio: false },
        ],
      },
      meta,
    );
    const [ficha, vacunas, foto] = p.documentos.map((d) => d.documentoId);
    documentos = { ficha, vacunas, foto };
    const s = await situacionEstudiante(estudiantes.nuevo.estudianteId, anioId);
    expect(s.tieneSolicitudEnLinea).toBe(false);
    expect(s.documentosRequeridos).toEqual([
      { documentoRequeridoId: ficha, nombre: "Ficha de salud escolar", obligatorio: true },
      { documentoRequeridoId: vacunas, nombre: "Constancia de vacunas", obligatorio: true },
      { documentoRequeridoId: foto, nombre: "Foto tamaño carné", obligatorio: false },
    ]);
  });

  it("sin los obligatorios o con un archivo no permitido no matricula, y no deja archivos en el almacén", async () => {
    const antes = await archivosEnAlmacen();
    expect((await error(() => matricular("nuevo"))).codigo).toBe("DOCUMENTO_FALTANTE");
    // el opcional se guarda antes de la transacción y se borra cuando esta falla
    const soloOpcional = await error(() => matricular("nuevo", { [documentos.foto]: jpg("foto.jpg") }));
    expect(soloOpcional.codigo).toBe("DOCUMENTO_FALTANTE");
    expect(soloOpcional.message).toContain("«Ficha de salud escolar»");
    expect(
      (await error(() => matricular("nuevo", { [documentos.ficha]: jpg(), [documentos.vacunas]: texto() }))).codigo,
    ).toBe("ARCHIVO_NO_PERMITIDO");
    expect(await archivosEnAlmacen()).toBe(antes);
    expect(await prisma.matricula.count({ where: { estudianteId: estudiantes.nuevo.estudianteId } })).toBe(0);
  });

  it("con los obligatorios matricula y registra los documentos recibidos en secretaría, aprobados y auditados", async () => {
    const antes = await archivosEnAlmacen();
    const m = await matricular("nuevo", { [documentos.ficha]: jpg(), [documentos.vacunas]: pdf() });
    matriculaNuevoId = m.matriculaId;
    expect(m.estado).toBe("MATRICULADO");
    expect(m.cronograma.cuotas.find((c) => c.tipo === "INGRESO")?.monto).toBe("250.00");
    expect(await archivosEnAlmacen()).toBe(antes + 2);

    const s = await prisma.solicitudMatricula.findUniqueOrThrow({
      where: { matriculaId: m.matriculaId },
      include: { documentos: true },
    });
    expect(s).toMatchObject({ origen: "PRESENCIAL", estado: "MATRICULADA", creadoPorId: coordinador.usuarioId });
    expect(s.documentos).toHaveLength(2);
    for (const d of s.documentos) {
      expect(d).toMatchObject({ estado: "APROBADO", revisadoPorId: coordinador.usuarioId });
      expect(d.revisadoEn).not.toBeNull();
    }
    const auditoria = await prisma.registroAuditoria.findFirstOrThrow({
      where: { requestId: meta.requestId, accion: "RECIBIR_DOCUMENTOS_MATRICULA", entidadId: s.id },
    });
    expect(auditoria.valorNuevo).toMatchObject({ origen: "PRESENCIAL", noEntregados: ["Foto tamaño carné"] });

    expect(m.documentos).toMatchObject({ origen: "PRESENCIAL", nombreOrigen: "Recibido en secretaría" });
    expect(m.documentos!.items.map((d) => d.nombre)).toEqual(["Ficha de salud escolar", "Constancia de vacunas"]);
    const abierto = await archivoDeDocumentoMatricula(coordinador, s.id, s.documentos[0].id);
    expect(abierto.archivo.nombre).toBe(s.documentos[0].nombreArchivo);
    // no es una solicitud por revisar: no aparece en la bandeja
    expect((await bandejaSolicitudes({ anioId })).items.some((i) => i.solicitudId === s.id)).toBe(false);
  });

  it("al alumno antiguo no se le piden documentos y no acepta adjuntos", async () => {
    const s = await situacionEstudiante(estudiantes.antiguo.estudianteId, anioId);
    expect(s.esAlumnoNuevo).toBe(false);
    expect(s.documentosRequeridos).toEqual([]);
    const antes = await archivosEnAlmacen();
    expect((await error(() => matricular("antiguo", { [documentos.ficha]: jpg() }))).codigo).toBe(
      "DOCUMENTOS_NO_CORRESPONDEN",
    );
    expect(await archivosEnAlmacen()).toBe(antes);
    const m = await matricular("antiguo");
    expect(m.estado).toBe("MATRICULADO");
    expect(m.documentos).toBeNull();
  });

  it("si la coordinación cambia la lista después, la matrícula conserva los documentos que se registraron", async () => {
    await guardarProceso(
      coordinador,
      anioId,
      {
        fechaInicio: dias(-60),
        fechaFin: dias(-30),
        documentos: [
          { nombre: "Certificado de estudios", obligatorio: true },
          { nombre: "Ficha de salud escolar", obligatorio: true },
        ],
      },
      meta,
    );
    const d = await detalleMatricula(matriculaNuevoId);
    expect(d.documentos!.items.map((x) => x.nombre)).toEqual(["Ficha de salud escolar", "Constancia de vacunas"]);
    expect(d.documentos!.items.every((x) => x.documento?.estado === "APROBADO")).toBe(true);
  });
});
