// matricula/infrastructure: consultas de las solicitudes de matrícula del apoderado y sus documentos (bloque M4) sobre
// solicitud_matricula, documento_matricula y matricula, tablas del módulo. Los archivos están en platform/archivos.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { EstadoDocumento, EstadoSolicitud, OrigenSolicitud } from "../domain/solicitudes";

type Db = Tx | typeof prisma;

const selectSolicitud = {
  id: true,
  matriculaId: true,
  procesoId: true,
  gradoId: true,
  estado: true,
  origen: true,
  creadoPorId: true,
  enviadaEn: true,
  updatedAt: true,
  matricula: {
    select: {
      estudianteId: true,
      anioAcademicoId: true,
      estado: true,
      seccionId: true,
      vinculoResponsableId: true,
    },
  },
  documentos: {
    select: {
      id: true,
      documentoRequeridoId: true,
      nombreArchivo: true,
      mimeType: true,
      tamanoBytes: true,
      archivoClave: true,
      estado: true,
      observacion: true,
      revisadoPorId: true,
      revisadoEn: true,
      subidoEn: true,
    },
  },
} satisfies Prisma.SolicitudMatriculaSelect;

type SolicitudPrisma = Prisma.SolicitudMatriculaGetPayload<{ select: typeof selectSolicitud }>;

export interface DocumentoSubidoFila {
  id: string;
  documentoRequeridoId: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  archivoClave: string;
  estado: EstadoDocumento;
  observacion: string | null;
  revisadoPorId: string | null;
  revisadoEn: Date | null;
  subidoEn: Date;
}

export interface SolicitudFila {
  id: string;
  matriculaId: string;
  procesoId: string;
  gradoId: string;
  estado: EstadoSolicitud;
  origen: OrigenSolicitud;
  creadoPorId: string;
  enviadaEn: Date;
  updatedAt: Date;
  estudianteId: string;
  anioAcademicoId: string;
  estadoMatricula: string;
  seccionId: string | null;
  vinculoResponsableId: string | null;
  documentos: DocumentoSubidoFila[];
}

const fila = (s: SolicitudPrisma): SolicitudFila => {
  const { matricula, ...resto } = s;
  return {
    ...resto,
    estudianteId: matricula.estudianteId,
    anioAcademicoId: matricula.anioAcademicoId,
    estadoMatricula: matricula.estado,
    seccionId: matricula.seccionId,
    vinculoResponsableId: matricula.vinculoResponsableId,
  };
};

export interface ArchivoGuardado {
  archivoClave: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
}

export const solicitudes = {
  async crear(
    tx: Tx,
    datos: { matriculaId: string; procesoId: string; gradoId: string; creadoPorId: string },
    archivos: (ArchivoGuardado & { documentoRequeridoId: string })[],
  ) {
    const s = await tx.solicitudMatricula.create({ data: datos, select: { id: true } });
    await tx.documentoMatricula.createMany({ data: archivos.map((a) => ({ ...a, solicitudId: s.id })) });
    return s.id;
  },

  /**
   * Solicitud PRESENCIAL de la matrícula directa de un alumno nuevo: nace Matriculada, con los documentos recibidos en
   * secretaría ya aprobados por quien matricula.
   */
  async crearPresencial(
    tx: Tx,
    datos: { matriculaId: string; procesoId: string; gradoId: string; creadoPorId: string; revisadoEn: Date },
    archivos: (ArchivoGuardado & { documentoRequeridoId: string })[],
  ) {
    const { revisadoEn, ...solicitud } = datos;
    const s = await tx.solicitudMatricula.create({
      data: { ...solicitud, origen: "PRESENCIAL", estado: "MATRICULADA", enviadaEn: revisadoEn },
      select: { id: true },
    });
    await tx.documentoMatricula.createMany({
      data: archivos.map((a) => ({
        ...a,
        solicitudId: s.id,
        estado: "APROBADO" as const,
        revisadoPorId: datos.creadoPorId,
        revisadoEn,
        subidoEn: revisadoEn,
      })),
    });
    return s.id;
  },

  async bloquear(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM solicitud_matricula WHERE id = ${id}::uuid FOR UPDATE`;
  },

  async porId(id: string, db: Db = prisma): Promise<SolicitudFila | null> {
    const s = await db.solicitudMatricula.findUnique({ where: { id }, select: selectSolicitud });
    return s && fila(s);
  },

  async deMatricula(matriculaId: string, db: Db = prisma): Promise<SolicitudFila | null> {
    const s = await db.solicitudMatricula.findUnique({ where: { matriculaId }, select: selectSolicitud });
    return s && fila(s);
  },

  /**
   * Solicitudes en línea de las matrículas del año (bandeja del coordinador), las más antiguas primero. Las
   * presenciales no se revisan: se ven en el detalle de su matrícula.
   */
  async delAnio(anioAcademicoId: string, estado?: EstadoSolicitud, db: Db = prisma): Promise<SolicitudFila[]> {
    const filas = await db.solicitudMatricula.findMany({
      where: { matricula: { anioAcademicoId }, origen: "EN_LINEA", ...(estado ? { estado } : {}) },
      orderBy: { enviadaEn: "asc" },
      select: selectSolicitud,
    });
    return filas.map(fila);
  },

  cambiarEstado: (tx: Tx, id: string, estado: EstadoSolicitud) =>
    tx.solicitudMatricula.update({ where: { id }, data: { estado }, select: { id: true } }),
};

export const documentosSubidos = {
  /** Reemplaza el archivo (o lo agrega si el documento opcional faltaba): vuelve a En revisión. */
  async guardar(tx: Tx, solicitudId: string, documentoRequeridoId: string, archivo: ArchivoGuardado) {
    const datos = {
      ...archivo,
      estado: "EN_REVISION" as const,
      observacion: null,
      revisadoPorId: null,
      revisadoEn: null,
      subidoEn: new Date(),
    };
    await tx.documentoMatricula.upsert({
      where: { solicitudId_documentoRequeridoId: { solicitudId, documentoRequeridoId } },
      create: { solicitudId, documentoRequeridoId, ...datos },
      update: datos,
      select: { id: true },
    });
  },

  revisar: (
    tx: Tx,
    id: string,
    datos: { estado: EstadoDocumento; observacion: string | null; revisadoPorId: string; revisadoEn: Date },
  ) => tx.documentoMatricula.update({ where: { id }, data: datos, select: { id: true } }),
};

/** Matrícula En proceso que crea la solicitud del apoderado (sin sección: la asigna el coordinador). */
export const matriculaEnProceso = {
  crear: (
    tx: Tx,
    datos: { estudianteId: string; anioAcademicoId: string; vinculoResponsableId: string; registradoPorId: string },
  ) => tx.matricula.create({ data: { ...datos, estado: "EN_PROCESO" }, select: { id: true } }),

  /** Completa el borrador del registro (US17) con el responsable del pago que eligió el apoderado. */
  responsable: (tx: Tx, matriculaId: string, vinculoResponsableId: string) =>
    tx.matricula.update({ where: { id: matriculaId }, data: { vinculoResponsableId }, select: { id: true } }),
};
