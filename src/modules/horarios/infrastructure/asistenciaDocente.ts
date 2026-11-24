// horarios/infrastructure: único lugar que consulta asistencia_docente (el módulo es su dueño; US32, AD-14). Las
// columnas DATE y TIME se convierten aquí a texto «AAAA-MM-DD» y «HH:MM:SS» (hora de Lima, como se registró).
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { EstadoAsistenciaDocente } from "../domain/asistenciaDocente";
import type { Dia } from "../domain/tipos";

type Db = Tx | typeof prisma;

const aFecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);
const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);
/** «07:31:05» → columna TIME (Prisma la lee y escribe como un instante del 1970-01-01 en UTC). */
const aHoraDb = (hora: string) => new Date(`1970-01-01T${hora}Z`);
const deHoraDb = (hora: Date | null) => (hora ? hora.toISOString().slice(11, 19) : null);

const selectRegistro = {
  id: true,
  docenteId: true,
  fecha: true,
  horaIngreso: true,
  horaSalida: true,
  estado: true,
  justificacion: true,
  registradoPorId: true,
  updatedAt: true,
} as const;

export interface RegistroDocenteFila {
  id: string;
  docenteId: string;
  fecha: string;
  horaIngreso: string | null;
  horaSalida: string | null;
  estado: EstadoAsistenciaDocente;
  justificacion: string | null;
  /** null: la registró la verificación automática de la hora límite. */
  registradoPorId: string | null;
  actualizadoEn: Date;
}

function fila(r: {
  id: string;
  docenteId: string;
  fecha: Date;
  horaIngreso: Date | null;
  horaSalida: Date | null;
  estado: EstadoAsistenciaDocente;
  justificacion: string | null;
  registradoPorId: string | null;
  updatedAt: Date;
}): RegistroDocenteFila {
  return {
    id: r.id,
    docenteId: r.docenteId,
    fecha: aTexto(r.fecha),
    horaIngreso: deHoraDb(r.horaIngreso),
    horaSalida: deHoraDb(r.horaSalida),
    estado: r.estado,
    justificacion: r.justificacion,
    registradoPorId: r.registradoPorId,
    actualizadoEn: r.updatedAt,
  };
}

export const asistenciaDocente = {
  async deFecha(fecha: string, db: Db = prisma): Promise<RegistroDocenteFila[]> {
    const filas = await db.asistenciaDocente.findMany({ where: { fecha: aFecha(fecha) }, select: selectRegistro });
    return filas.map(fila);
  },

  async porId(id: string, db: Db = prisma): Promise<RegistroDocenteFila | null> {
    const r = await db.asistenciaDocente.findUnique({ where: { id }, select: selectRegistro });
    return r && fila(r);
  },

  async delDia(docenteId: string, fecha: string, db: Db = prisma): Promise<RegistroDocenteFila | null> {
    const r = await db.asistenciaDocente.findUnique({
      where: { docenteId_fecha: { docenteId, fecha: aFecha(fecha) } },
      select: selectRegistro,
    });
    return r && fila(r);
  },

  /** Bloquea el registro del docente en esa fecha (si existe) para que dos marcaciones no se pisen. */
  async bloquear(tx: Tx, docenteId: string, fecha: string) {
    await tx.$queryRaw`SELECT id FROM asistencia_docente WHERE docente_id = ${docenteId}::uuid AND fecha = ${fecha}::date FOR UPDATE`;
  },

  async crear(
    datos: {
      docenteId: string;
      fecha: string;
      estado: EstadoAsistenciaDocente;
      horaIngreso: string;
      registradoPorId: string;
    },
    db: Db = prisma,
  ): Promise<RegistroDocenteFila> {
    const r = await db.asistenciaDocente.create({
      data: { ...datos, fecha: aFecha(datos.fecha), horaIngreso: aHoraDb(datos.horaIngreso) },
      select: selectRegistro,
    });
    return fila(r);
  },

  async actualizar(
    id: string,
    datos: {
      estado?: EstadoAsistenciaDocente;
      horaIngreso?: string;
      horaSalida?: string;
      justificacion?: string;
      registradoPorId?: string;
    },
    db: Db = prisma,
  ): Promise<RegistroDocenteFila> {
    const r = await db.asistenciaDocente.update({
      where: { id },
      data: {
        ...datos,
        horaIngreso: datos.horaIngreso ? aHoraDb(datos.horaIngreso) : undefined,
        horaSalida: datos.horaSalida ? aHoraDb(datos.horaSalida) : undefined,
      },
      select: selectRegistro,
    });
    return fila(r);
  },

  /**
   * Falta automática (registrado_por_id NULL) para los docentes indicados. La clave única (docente, fecha) hace que
   * una segunda ejecución, o un registro hecho a la vez, no dupliquen nada. Devuelve los registros creados.
   */
  async crearFaltas(docenteIds: string[], fecha: string, db: Db = prisma): Promise<RegistroDocenteFila[]> {
    if (!docenteIds.length) return [];
    const filas = await db.asistenciaDocente.createManyAndReturn({
      data: docenteIds.map((docenteId) => ({ docenteId, fecha: aFecha(fecha), estado: "FALTA" as const })),
      skipDuplicates: true,
      select: selectRegistro,
    });
    return filas.map(fila);
  },

  /**
   * Hora de la primera clase de cada docente en un día de la semana, según el horario PUBLICADO del año (columna
   * «Primera clase» de AD-14). Los docentes sin clases ese día no aparecen.
   */
  async primerasClases(anioAcademicoId: string, dia: Dia, db: Db = prisma): Promise<Record<string, string>> {
    const clases = await db.detalleHorario.findMany({
      where: { dia, bloque: { anioAcademicoId }, horario: { estadoPublicacion: "PUBLICADO" } },
      select: { docenteId: true, bloque: { select: { horaInicio: true } } },
    });
    const primeras: Record<string, string> = {};
    for (const c of clases) {
      const hora = deHoraDb(c.bloque.horaInicio)!.slice(0, 5);
      if (!primeras[c.docenteId] || hora < primeras[c.docenteId]) primeras[c.docenteId] = hora;
    }
    return primeras;
  },
};
