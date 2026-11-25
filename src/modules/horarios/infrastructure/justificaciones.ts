// horarios/infrastructure: único lugar que consulta justificacion_asistencia (dueño: horarios; bloque M3). Una sola
// PENDIENTE por registro de asistencia (uq_justificacion_pendiente_por_registro).
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { EstadoAsistencia, Rango } from "../domain/asistencia";
import type { EstadoJustificacion } from "../domain/tutoria";

type Db = Tx | typeof prisma;

const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);
const aFecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);
const aHora = (hora: Date) => hora.toISOString().slice(11, 16);

const selectRegistro = {
  id: true,
  matriculaId: true,
  estado: true,
  sesionClase: {
    select: {
      fecha: true,
      detalleHorario: {
        select: { seccionId: true, asignacionDocenteId: true, bloque: { select: { horaInicio: true } } },
      },
    },
  },
} as const;

export interface RegistroJustificable {
  id: string;
  matriculaId: string;
  estado: EstadoAsistencia;
  fecha: string;
  horaInicio: string;
  seccionId: string;
  asignacionDocenteId: string;
}

type FilaRegistro = {
  id: string;
  matriculaId: string;
  estado: EstadoAsistencia;
  sesionClase: {
    fecha: Date;
    detalleHorario: { seccionId: string; asignacionDocenteId: string; bloque: { horaInicio: Date } };
  };
};

const registro = (r: FilaRegistro): RegistroJustificable => ({
  id: r.id,
  matriculaId: r.matriculaId,
  estado: r.estado,
  fecha: aTexto(r.sesionClase.fecha),
  horaInicio: aHora(r.sesionClase.detalleHorario.bloque.horaInicio),
  seccionId: r.sesionClase.detalleHorario.seccionId,
  asignacionDocenteId: r.sesionClase.detalleHorario.asignacionDocenteId,
});

const selectJustificacion = {
  id: true,
  asistenciaEstudianteId: true,
  presentadaPorId: true,
  motivo: true,
  archivoClave: true,
  nombreArchivo: true,
  mimeType: true,
  tamanoBytes: true,
  estado: true,
  revisadaPorId: true,
  revisadaEn: true,
  motivoRechazo: true,
  createdAt: true,
  asistenciaEstudiante: { select: selectRegistro },
} as const;

export interface JustificacionFila {
  id: string;
  presentadaPorId: string;
  motivo: string;
  archivoClave: string | null;
  nombreArchivo: string | null;
  mimeType: string | null;
  tamanoBytes: number | null;
  estado: EstadoJustificacion;
  revisadaPorId: string | null;
  revisadaEn: Date | null;
  motivoRechazo: string | null;
  createdAt: Date;
  registro: RegistroJustificable;
}

type FilaJustificacion = Omit<JustificacionFila, "registro" | "estado"> & {
  estado: string;
  asistenciaEstudianteId: string;
  asistenciaEstudiante: FilaRegistro;
};

const justificacion = (j: FilaJustificacion): JustificacionFila => ({
  id: j.id,
  presentadaPorId: j.presentadaPorId,
  motivo: j.motivo,
  archivoClave: j.archivoClave,
  nombreArchivo: j.nombreArchivo,
  mimeType: j.mimeType,
  tamanoBytes: j.tamanoBytes,
  estado: j.estado as EstadoJustificacion,
  revisadaPorId: j.revisadaPorId,
  revisadaEn: j.revisadaEn,
  motivoRechazo: j.motivoRechazo,
  createdAt: j.createdAt,
  registro: registro(j.asistenciaEstudiante),
});

export const registrosJustificables = {
  /** Faltas y tardanzas (justificadas o no) de una matrícula en un rango, con su clase. */
  async deMatricula(matriculaId: string, rango: Rango, db: Db = prisma): Promise<RegistroJustificable[]> {
    const filas = await db.asistenciaEstudiante.findMany({
      where: {
        matriculaId,
        estado: { in: ["FALTA", "TARDANZA", "FALTA_JUSTIFICADA", "TARDANZA_JUSTIFICADA"] },
        sesionClase: { fecha: { gte: aFecha(rango.fechaInicio), lte: aFecha(rango.fechaFin) } },
      },
      select: selectRegistro,
    });
    return filas.map(registro);
  },

  async porId(id: string, db: Db = prisma): Promise<RegistroJustificable | null> {
    const r = await db.asistenciaEstudiante.findUnique({ where: { id }, select: selectRegistro });
    return r && registro(r);
  },
};

export const justificaciones = {
  async porId(id: string, db: Db = prisma): Promise<JustificacionFila | null> {
    const j = await db.justificacionAsistencia.findUnique({ where: { id }, select: selectJustificacion });
    return j && justificacion(j);
  },

  /** Justificaciones de los registros de una matrícula, de la más reciente a la más antigua. */
  async deMatricula(matriculaId: string, db: Db = prisma): Promise<JustificacionFila[]> {
    const filas = await db.justificacionAsistencia.findMany({
      where: { asistenciaEstudiante: { matriculaId } },
      orderBy: { createdAt: "desc" },
      select: selectJustificacion,
    });
    return filas.map(justificacion);
  },

  /** Justificaciones de las clases de una sección: las pendientes y las revisadas desde `revisadasDesde`. */
  async deSeccion(seccionId: string, revisadasDesde: Date, db: Db = prisma): Promise<JustificacionFila[]> {
    const filas = await db.justificacionAsistencia.findMany({
      where: {
        asistenciaEstudiante: { sesionClase: { detalleHorario: { seccionId } } },
        OR: [{ estado: "PENDIENTE" }, { revisadaEn: { gte: revisadasDesde } }],
      },
      orderBy: { createdAt: "asc" },
      select: selectJustificacion,
    });
    return filas.map(justificacion);
  },

  /** Pendientes de una sección (inicio de la tutoría). */
  pendientesDeSeccion: (seccionId: string, db: Db = prisma) =>
    db.justificacionAsistencia.count({
      where: { estado: "PENDIENTE", asistenciaEstudiante: { sesionClase: { detalleHorario: { seccionId } } } },
    }),

  crear: (
    tx: Tx,
    datos: {
      asistenciaEstudianteId: string;
      presentadaPorId: string;
      motivo: string;
      archivoClave: string | null;
      nombreArchivo: string | null;
      mimeType: string | null;
      tamanoBytes: number | null;
    },
  ) => tx.justificacionAsistencia.create({ data: datos, select: { id: true } }),

  revisar: (
    tx: Tx,
    id: string,
    datos: { estado: "APROBADA" | "RECHAZADA"; revisadaPorId: string; revisadaEn: Date; motivoRechazo?: string },
  ) => tx.justificacionAsistencia.update({ where: { id }, data: datos, select: { id: true } }),

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM justificacion_asistencia WHERE id = ${id}::uuid FOR UPDATE`;
  },
};
