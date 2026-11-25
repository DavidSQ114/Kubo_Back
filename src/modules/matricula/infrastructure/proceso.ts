// matricula/infrastructure: consultas del proceso de matrícula (bloque M4) sobre proceso_matricula y
// documento_requerido, tablas del módulo. Fechas DATE como «AAAA-MM-DD».
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";

type Db = Tx | typeof prisma;

const aFecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);
const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);

export interface DocumentoRequeridoFila {
  id: string;
  nombre: string;
  obligatorio: boolean;
  orden: number;
  activo: boolean;
}

export interface ProcesoFila {
  id: string;
  anioAcademicoId: string;
  fechaInicio: string;
  fechaFin: string;
  actualizadoPorId: string;
  updatedAt: Date;
  /** Todos los documentos (también los inactivos), en orden. */
  documentos: DocumentoRequeridoFila[];
}

const select = {
  id: true,
  anioAcademicoId: true,
  fechaInicio: true,
  fechaFin: true,
  actualizadoPorId: true,
  updatedAt: true,
  documentos: {
    orderBy: [{ activo: "desc" as const }, { orden: "asc" as const }],
    select: { id: true, nombre: true, obligatorio: true, orden: true, activo: true },
  },
} satisfies Prisma.ProcesoMatriculaSelect;

export const procesos = {
  async delAnio(anioAcademicoId: string, db: Db = prisma): Promise<ProcesoFila | null> {
    const p = await db.procesoMatricula.findUnique({ where: { anioAcademicoId }, select });
    return p && { ...p, fechaInicio: aTexto(p.fechaInicio), fechaFin: aTexto(p.fechaFin) };
  },

  /** Crea o actualiza las fechas del proceso del año y devuelve su id. */
  async guardarFechas(
    tx: Tx,
    datos: { anioAcademicoId: string; fechaInicio: string; fechaFin: string; actualizadoPorId: string },
  ) {
    const valores = {
      fechaInicio: aFecha(datos.fechaInicio),
      fechaFin: aFecha(datos.fechaFin),
      actualizadoPorId: datos.actualizadoPorId,
    };
    const p = await tx.procesoMatricula.upsert({
      where: { anioAcademicoId: datos.anioAcademicoId },
      create: { anioAcademicoId: datos.anioAcademicoId, ...valores },
      update: valores,
      select: { id: true },
    });
    return p.id;
  },

  /** Aplica los cambios de la lista: primero desactiva, luego actualiza y crea (índice de nombres activos). */
  async aplicarDocumentos(
    tx: Tx,
    procesoId: string,
    cambios: {
      actualizar: { id: string; nombre: string; obligatorio: boolean; orden: number }[];
      crear: { nombre: string; obligatorio: boolean; orden: number }[];
      desactivar: string[];
    },
  ) {
    if (cambios.desactivar.length) {
      await tx.documentoRequerido.updateMany({
        where: { procesoId, id: { in: cambios.desactivar } },
        data: { activo: false },
      });
    }
    for (const d of cambios.actualizar) {
      await tx.documentoRequerido.update({
        where: { id: d.id },
        data: { nombre: d.nombre, obligatorio: d.obligatorio, orden: d.orden, activo: true },
      });
    }
    if (cambios.crear.length) {
      await tx.documentoRequerido.createMany({
        data: cambios.crear.map((d) => ({ procesoId, nombre: d.nombre, obligatorio: d.obligatorio, orden: d.orden })),
      });
    }
  },
};
