// aula-virtual/infrastructure: consultas de unidad_didactica, material_estudio y enlace_virtual (dueño: aula-virtual)
// para la gestión del docente (DO-05, US61, US62) y la vista del alumno (AL-05, US67). Las asignaciones, las secciones
// y las matrículas se piden por el index.ts de academico y de matricula.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { EstadoVisibilidad, TipoEnlace, TipoFormato } from "../domain/reglas";

type Db = typeof prisma | Tx;

// ---------- Unidades didácticas ----------

export interface UnidadFila {
  id: string;
  asignacionDocenteId: string;
  numero: number;
  titulo: string;
  activo: boolean;
}

const selectUnidad = { id: true, asignacionDocenteId: true, numero: true, titulo: true, activo: true } as const;

/** Número provisional al intercambiar dos unidades: uq (asignacion, numero) no es diferible. */
const NUMERO_PROVISIONAL = -1;

export const unidades = {
  deAsignacion: (asignacionId: string, db: Db = prisma): Promise<UnidadFila[]> =>
    db.unidadDidactica.findMany({
      where: { asignacionDocenteId: asignacionId },
      select: selectUnidad,
      orderBy: { numero: "asc" },
    }),

  porId: (id: string, db: Db = prisma): Promise<UnidadFila | null> =>
    db.unidadDidactica.findUnique({ where: { id }, select: selectUnidad }),

  crear: (tx: Tx, datos: { asignacionDocenteId: string; numero: number; titulo: string }): Promise<UnidadFila> =>
    tx.unidadDidactica.create({ data: datos, select: selectUnidad }),

  actualizar: (tx: Tx, id: string, datos: { titulo?: string; activo?: boolean }): Promise<UnidadFila> =>
    tx.unidadDidactica.update({ where: { id }, data: datos, select: selectUnidad }),

  /** Intercambia el número (el orden) de dos unidades de la misma asignación. */
  async intercambiarNumeros(tx: Tx, a: UnidadFila, b: UnidadFila) {
    await tx.unidadDidactica.update({ where: { id: a.id }, data: { numero: NUMERO_PROVISIONAL } });
    await tx.unidadDidactica.update({ where: { id: b.id }, data: { numero: a.numero } });
    await tx.unidadDidactica.update({ where: { id: a.id }, data: { numero: b.numero } });
  },

  /**
   * Serializa la creación y el reordenamiento de las unidades de una asignación (dos pestañas del mismo docente no
   * toman el mismo número). Es un candado de la transacción: no toca asignacion_docente, que es de academico.
   */
  async bloquearDeAsignacion(tx: Tx, asignacionId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${asignacionId}, 0))`;
  },
};

// ---------- Materiales de estudio ----------

export interface MaterialFila {
  id: string;
  asignacionDocenteId: string;
  unidadId: string | null;
  titulo: string;
  tipoFormato: TipoFormato;
  urlArchivo: string | null;
  archivoClave: string | null;
  nombreArchivo: string | null;
  tamanoBytes: number | null;
  mimeType: string | null;
  estado: EstadoVisibilidad;
  publicadoEn: Date | null;
  createdAt: Date;
}

const selectMaterial = {
  id: true,
  asignacionDocenteId: true,
  unidadId: true,
  titulo: true,
  tipoFormato: true,
  urlArchivo: true,
  archivoClave: true,
  nombreArchivo: true,
  tamanoBytes: true,
  mimeType: true,
  estadoVisibilidad: true,
  publicadoEn: true,
  createdAt: true,
} as const;

type MaterialPrisma = Prisma.MaterialEstudioGetPayload<{ select: typeof selectMaterial }>;

const aMaterial = ({ estadoVisibilidad, ...m }: MaterialPrisma): MaterialFila => ({ ...m, estado: estadoVisibilidad });

export interface MaterialConUnidad extends MaterialFila {
  /** null si el material no tiene unidad. */
  unidadActiva: boolean | null;
}

export const materiales = {
  deAsignacion: async (asignacionId: string, db: Db = prisma): Promise<MaterialFila[]> =>
    (
      await db.materialEstudio.findMany({
        where: { asignacionDocenteId: asignacionId },
        select: selectMaterial,
        orderBy: { createdAt: "desc" },
      })
    ).map(aMaterial),

  /** Solo lo que puede ver el alumno: PUBLICADO y en una unidad activa (US67). */
  publicadosDeAsignacion: async (asignacionId: string): Promise<MaterialFila[]> =>
    (
      await prisma.materialEstudio.findMany({
        where: { asignacionDocenteId: asignacionId, estadoVisibilidad: "PUBLICADO", unidad: { activo: true } },
        select: selectMaterial,
      })
    ).map(aMaterial),

  async porId(id: string, db: Db = prisma): Promise<MaterialConUnidad | null> {
    const fila = await db.materialEstudio.findUnique({
      where: { id },
      select: { ...selectMaterial, unidad: { select: { activo: true } } },
    });
    if (!fila) return null;
    const { unidad, ...resto } = fila;
    return { ...aMaterial(resto), unidadActiva: unidad ? unidad.activo : null };
  },

  crear: async (
    tx: Tx,
    datos: {
      asignacionDocenteId: string;
      unidadId: string;
      titulo: string;
      tipoFormato: TipoFormato;
      urlArchivo: string | null;
      archivoClave: string | null;
      nombreArchivo: string | null;
      tamanoBytes: number | null;
      mimeType: string | null;
      estado: EstadoVisibilidad;
      publicadoEn: Date | null;
      subidoPorId: string;
    },
  ): Promise<MaterialFila> => {
    const { estado, ...resto } = datos;
    return aMaterial(
      await tx.materialEstudio.create({ data: { ...resto, estadoVisibilidad: estado }, select: selectMaterial }),
    );
  },

  cambiarEstado: async (
    tx: Tx,
    id: string,
    datos: { estado: EstadoVisibilidad; publicadoEn?: Date },
  ): Promise<MaterialFila> =>
    aMaterial(
      await tx.materialEstudio.update({
        where: { id },
        data: { estadoVisibilidad: datos.estado, publicadoEn: datos.publicadoEn },
        select: selectMaterial,
      }),
    ),

  eliminar: async (tx: Tx, id: string) => {
    await tx.materialEstudio.delete({ where: { id } });
  },

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM material_estudio WHERE id = ${id}::uuid FOR UPDATE`;
  },
};

// ---------- Enlaces de clase virtual ----------

export interface EnlaceFila {
  id: string;
  asignacionDocenteId: string;
  tipoEnlace: TipoEnlace;
  titulo: string;
  urlMeet: string;
  fechaProgramada: Date | null;
  fechaFin: Date | null;
  visible: boolean;
  createdAt: Date;
}

const selectEnlace = {
  id: true,
  asignacionDocenteId: true,
  tipoEnlace: true,
  titulo: true,
  urlMeet: true,
  fechaProgramada: true,
  fechaFin: true,
  visible: true,
  createdAt: true,
} as const;

export interface DatosEnlaceFila {
  tipoEnlace: TipoEnlace;
  titulo: string;
  urlMeet: string;
  fechaProgramada: Date;
  fechaFin: Date;
  visible: boolean;
}

export const enlaces = {
  /** Con `soloVisibles`, lo que ve el alumno (US62, criterio 1). Por fecha de inicio. */
  deAsignacion: (asignacionId: string, soloVisibles = false, db: Db = prisma): Promise<EnlaceFila[]> =>
    db.enlaceVirtual.findMany({
      where: { asignacionDocenteId: asignacionId, ...(soloVisibles ? { visible: true } : {}) },
      select: selectEnlace,
      orderBy: [{ fechaProgramada: "asc" }, { createdAt: "asc" }],
    }),

  porId: (id: string, db: Db = prisma): Promise<EnlaceFila | null> =>
    db.enlaceVirtual.findUnique({ where: { id }, select: selectEnlace }),

  crear: (tx: Tx, datos: DatosEnlaceFila & { asignacionDocenteId: string }): Promise<EnlaceFila> =>
    tx.enlaceVirtual.create({ data: datos, select: selectEnlace }),

  actualizar: (tx: Tx, id: string, datos: Partial<DatosEnlaceFila>): Promise<EnlaceFila> =>
    tx.enlaceVirtual.update({ where: { id }, data: datos, select: selectEnlace }),

  eliminar: async (tx: Tx, id: string) => {
    await tx.enlaceVirtual.delete({ where: { id } });
  },

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM enlace_virtual WHERE id = ${id}::uuid FOR UPDATE`;
  },
};
