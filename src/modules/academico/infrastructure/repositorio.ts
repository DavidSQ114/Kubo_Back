// academico/infrastructure: único lugar que consulta las tablas de académico: anio_academico, periodo_evaluacion,
// grado, seccion, aula, area_curricular, competencia, curso, plan_estudio, competencia_plan y asignacion_docente
// (el módulo es su dueño).
// Las columnas DATE se convierten aquí a texto "AAAA-MM-DD": el resto del módulo no ve objetos Date.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { AnioExistente, PeriodoGuardado } from "../domain/reglas";
import type { EstadoCurso } from "../domain/cursos";
import type { EstadoSeccion } from "../domain/secciones";
import type { EstadoAnio, EstadoPeriodo } from "../domain/tipos";

type Db = Tx | typeof prisma;

// Clave del candado que serializa las altas y cambios de fechas de años (evita dos años solapados a la vez).
const CANDADO_ANIOS = 2026_06;

const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);
const aFecha = (texto: string) => new Date(`${texto}T00:00:00.000Z`);

export interface AnioFila extends AnioExistente {
  anio: number;
}

export interface PeriodoFila extends PeriodoGuardado {
  id: string;
  anioAcademicoId: string;
  nombre: string;
}

const selectAnio = { id: true, anio: true, fechaInicio: true, fechaFin: true, estado: true } as const;
const selectPeriodo = {
  id: true,
  anioAcademicoId: true,
  numero: true,
  nombre: true,
  fechaInicio: true,
  fechaFin: true,
  estado: true,
} as const;

function filaAnio(a: { id: string; anio: number; fechaInicio: Date; fechaFin: Date; estado: string }): AnioFila {
  return {
    id: a.id,
    anio: a.anio,
    fechaInicio: aTexto(a.fechaInicio),
    fechaFin: aTexto(a.fechaFin),
    estado: a.estado as EstadoAnio,
  };
}

function filaPeriodo(p: {
  id: string;
  anioAcademicoId: string;
  numero: number;
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
}): PeriodoFila {
  return {
    ...p,
    fechaInicio: aTexto(p.fechaInicio),
    fechaFin: aTexto(p.fechaFin),
    estado: p.estado as EstadoPeriodo,
  };
}

export const anios = {
  async listar(db: Db = prisma): Promise<AnioFila[]> {
    const filas = await db.anioAcademico.findMany({ orderBy: { anio: "desc" }, select: selectAnio });
    return filas.map(filaAnio);
  },

  async porId(id: string, db: Db = prisma): Promise<AnioFila | null> {
    const a = await db.anioAcademico.findUnique({ where: { id }, select: selectAnio });
    return a ? filaAnio(a) : null;
  },

  async enCurso(db: Db = prisma): Promise<AnioFila | null> {
    const a = await db.anioAcademico.findFirst({ where: { estado: "EN_CURSO" }, select: selectAnio });
    return a ? filaAnio(a) : null;
  },

  async crear(datos: { anio: number; fechaInicio: string; fechaFin: string }, db: Db = prisma) {
    const a = await db.anioAcademico.create({
      data: { anio: datos.anio, fechaInicio: aFecha(datos.fechaInicio), fechaFin: aFecha(datos.fechaFin) },
      select: selectAnio,
    });
    return filaAnio(a);
  },

  async actualizar(
    id: string,
    datos: { anio?: number; fechaInicio?: string; fechaFin?: string; estado?: EstadoAnio },
    db: Db = prisma,
  ) {
    const a = await db.anioAcademico.update({
      where: { id },
      data: {
        anio: datos.anio,
        estado: datos.estado,
        fechaInicio: datos.fechaInicio ? aFecha(datos.fechaInicio) : undefined,
        fechaFin: datos.fechaFin ? aFecha(datos.fechaFin) : undefined,
      },
      select: selectAnio,
    });
    return filaAnio(a);
  },

  /** Bloquea la fila del año hasta el fin de la transacción (cambios de estado concurrentes). */
  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM anio_academico WHERE id = ${id}::uuid FOR UPDATE`;
  },

  /** Serializa las operaciones que validan solapamiento entre años (dos altas simultáneas). */
  async bloquearCalendario(tx: Tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CANDADO_ANIOS})`;
  },
};

export const periodos = {
  async delAnio(anioAcademicoId: string, db: Db = prisma): Promise<PeriodoFila[]> {
    const filas = await db.periodoEvaluacion.findMany({
      where: { anioAcademicoId },
      orderBy: { numero: "asc" },
      select: selectPeriodo,
    });
    return filas.map(filaPeriodo);
  },

  async deAnios(ids: string[], db: Db = prisma): Promise<PeriodoFila[]> {
    const filas = await db.periodoEvaluacion.findMany({
      where: { anioAcademicoId: { in: ids } },
      orderBy: [{ anioAcademicoId: "asc" }, { numero: "asc" }],
      select: selectPeriodo,
    });
    return filas.map(filaPeriodo);
  },

  /** Crea o actualiza el bimestre (único por año y número). Un bimestre nuevo nace INACTIVO. */
  async guardar(
    anioAcademicoId: string,
    p: { numero: number; nombre: string; fechaInicio: string; fechaFin: string },
    tx: Tx,
  ) {
    const fechas = { nombre: p.nombre, fechaInicio: aFecha(p.fechaInicio), fechaFin: aFecha(p.fechaFin) };
    await tx.periodoEvaluacion.upsert({
      where: { anioAcademicoId_numero: { anioAcademicoId, numero: p.numero } },
      create: { anioAcademicoId, numero: p.numero, ...fechas },
      update: fechas,
      select: { id: true },
    });
  },
};

// ---------- Grados, secciones y aulas (US08, US09) ----------

export interface GradoFila {
  id: string;
  numero: number;
  nombre: string;
}

export interface AulaFila {
  id: string;
  nombre: string;
  ubicacion: string | null;
  aforo: number;
  activo: boolean;
}

export interface SeccionFila {
  id: string;
  anioAcademicoId: string;
  nombre: string;
  aforoMaximo: number;
  estado: EstadoSeccion;
  tutorId: string | null;
  grado: GradoFila;
  aula: AulaFila | null;
}

const selectAula = { id: true, nombre: true, ubicacion: true, aforo: true, activo: true } as const;
const selectSeccion = {
  id: true,
  anioAcademicoId: true,
  nombre: true,
  aforoMaximo: true,
  estado: true,
  tutorId: true,
  grado: { select: { id: true, numero: true, nombre: true } },
  aula: { select: selectAula },
} as const;

export const grados = {
  activos: (db: Db = prisma): Promise<GradoFila[]> =>
    db.grado.findMany({
      where: { activo: true },
      orderBy: { numero: "asc" },
      select: { id: true, numero: true, nombre: true },
    }),

  porId: (id: string, db: Db = prisma) =>
    db.grado.findUnique({ where: { id }, select: { id: true, numero: true, nombre: true, activo: true } }),
};

export const secciones = {
  delAnio: (anioAcademicoId: string, db: Db = prisma) =>
    db.seccion.findMany({
      where: { anioAcademicoId },
      orderBy: [{ grado: { numero: "asc" } }, { nombre: "asc" }],
      select: selectSeccion,
    }) as Promise<SeccionFila[]>,

  porId: (id: string, db: Db = prisma) =>
    db.seccion.findUnique({ where: { id }, select: selectSeccion }) as Promise<SeccionFila | null>,

  /** Secciones activas de años no cerrados que usan el aula (para su aforo y para inactivarla). */
  vigentesDelAula: (aulaId: string, db: Db = prisma) =>
    db.seccion.findMany({
      where: { aulaId, estado: "ACTIVA", anioAcademico: { estado: { not: "CERRADO" } } },
      select: { id: true, nombre: true, aforoMaximo: true, grado: { select: { numero: true } } },
    }),

  crear: (
    data: {
      anioAcademicoId: string;
      gradoId: string;
      nombre: string;
      aforoMaximo: number;
      aulaId: string | null;
      tutorId: string | null;
    },
    db: Db = prisma,
  ) => db.seccion.create({ data, select: selectSeccion }) as Promise<SeccionFila>,

  actualizar: (
    id: string,
    data: {
      gradoId?: string;
      nombre?: string;
      aforoMaximo?: number;
      aulaId?: string | null;
      tutorId?: string | null;
      estado?: EstadoSeccion;
    },
    db: Db = prisma,
  ) => db.seccion.update({ where: { id }, data, select: selectSeccion }) as Promise<SeccionFila>,

  eliminar: (id: string, db: Db = prisma) => db.seccion.delete({ where: { id }, select: { id: true } }),

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM seccion WHERE id = ${id}::uuid FOR UPDATE`;
  },
};

export const aulas = {
  todas: (db: Db = prisma): Promise<AulaFila[]> =>
    db.aula.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], select: selectAula }),

  porId: (id: string, db: Db = prisma): Promise<AulaFila | null> =>
    db.aula.findUnique({ where: { id }, select: selectAula }),

  crear: (data: { nombre: string; ubicacion: string | null; aforo: number }, db: Db = prisma) =>
    db.aula.create({ data, select: selectAula }),

  actualizar: (
    id: string,
    data: { nombre?: string; ubicacion?: string | null; aforo?: number; activo?: boolean },
    db: Db = prisma,
  ) => db.aula.update({ where: { id }, data, select: selectAula }),

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM aula WHERE id = ${id}::uuid FOR UPDATE`;
  },
};

// ---------- Currículo: áreas, competencias, cursos y planes (US10, US11) ----------

const selectCompetencia = { id: true, areaCurricularId: true, codigo: true, nombre: true, activo: true } as const;

export interface CompetenciaFila {
  id: string;
  areaCurricularId: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export const areas = {
  /** Áreas activas con las competencias del catálogo (activas o no), por código. */
  conCompetencias: (db: Db = prisma) =>
    db.areaCurricular.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        competencias: { orderBy: { codigo: "asc" }, select: selectCompetencia },
      },
    }),

  porId: (id: string, db: Db = prisma) =>
    db.areaCurricular.findUnique({ where: { id }, select: { id: true, codigo: true, nombre: true, activo: true } }),
};

export const competencias = {
  delArea: (areaCurricularId: string, db: Db = prisma): Promise<CompetenciaFila[]> =>
    db.competencia.findMany({ where: { areaCurricularId }, orderBy: { codigo: "asc" }, select: selectCompetencia }),

  porIds: (ids: string[], db: Db = prisma): Promise<CompetenciaFila[]> =>
    db.competencia.findMany({ where: { id: { in: ids } }, select: selectCompetencia }),
};

const selectCurso = {
  id: true,
  codigo: true,
  nombre: true,
  descripcion: true,
  estado: true,
  areaCurricular: { select: { id: true, codigo: true, nombre: true } },
} as const;

export interface CursoFila {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  estado: EstadoCurso;
  areaCurricular: { id: string; codigo: string; nombre: string };
}

/** Cuenta pares únicos «curso|otro» por curso: docentes o secciones distintas de cada curso. */
function contarPorCurso(pares: Iterable<[string, string]>): Record<string, number> {
  const unicos = new Set([...pares].map(([cursoId, otro]) => `${cursoId}|${otro}`));
  const conteo: Record<string, number> = {};
  for (const par of unicos) {
    const cursoId = par.split("|")[0];
    conteo[cursoId] = (conteo[cursoId] ?? 0) + 1;
  }
  return conteo;
}

export const cursos = {
  todos: (filtro: { areaId?: string; estado?: EstadoCurso }, db: Db = prisma) =>
    db.curso.findMany({
      where: { areaCurricularId: filtro.areaId, estado: filtro.estado },
      orderBy: [{ estado: "asc" }, { nombre: "asc" }],
      select: selectCurso,
    }) as Promise<CursoFila[]>,

  porId: (id: string, db: Db = prisma) =>
    db.curso.findUnique({ where: { id }, select: selectCurso }) as Promise<CursoFila | null>,

  crear: (
    data: { codigo: string; nombre: string; descripcion: string | null; areaCurricularId: string },
    db: Db = prisma,
  ) => db.curso.create({ data, select: selectCurso }) as Promise<CursoFila>,

  actualizar: (
    id: string,
    data: {
      codigo?: string;
      nombre?: string;
      descripcion?: string | null;
      areaCurricularId?: string;
      estado?: EstadoCurso;
    },
    db: Db = prisma,
  ) => db.curso.update({ where: { id }, data, select: selectCurso }) as Promise<CursoFila>,

  eliminar: (id: string, db: Db = prisma) => db.curso.delete({ where: { id }, select: { id: true } }),

  /** Docentes distintos con alguna asignación del curso, por curso (de cualquier año, activa o no). */
  async docentesAsignados(cursoIds: string[], db: Db = prisma): Promise<Record<string, number>> {
    if (cursoIds.length === 0) return {};
    const filas = await db.asignacionDocente.findMany({
      where: { planEstudio: { cursoId: { in: cursoIds } } },
      distinct: ["planEstudioId", "docenteId"],
      select: { docenteId: true, planEstudio: { select: { cursoId: true } } },
    });
    return contarPorCurso(filas.map((f) => [f.planEstudio.cursoId, f.docenteId]));
  },

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM curso WHERE id = ${id}::uuid FOR UPDATE`;
  },
};

const selectPlan = {
  id: true,
  anioAcademicoId: true,
  cursoId: true,
  horasSemanales: true,
  grado: { select: { id: true, numero: true, nombre: true } },
  competenciasPlan: {
    orderBy: { orden: "asc" },
    select: { id: true, orden: true, peso: true, competencia: { select: { id: true, codigo: true, nombre: true } } },
  },
  _count: { select: { asignacionesDocente: true } },
} as const;

export interface CompetenciaPlanFila {
  id: string;
  orden: number;
  peso: number | null;
  competencia: { id: string; codigo: string; nombre: string };
}

export interface PlanFila {
  id: string;
  anioAcademicoId: string;
  cursoId: string;
  horasSemanales: number;
  grado: GradoFila;
  competencias: CompetenciaPlanFila[];
  /** Asignaciones docentes del plan: con alguna, el grado no se quita del curso. */
  asignaciones: number;
}

function filaPlan(p: {
  id: string;
  anioAcademicoId: string;
  cursoId: string;
  horasSemanales: number;
  grado: GradoFila;
  competenciasPlan: {
    id: string;
    orden: number;
    peso: { toNumber(): number } | null;
    competencia: CompetenciaPlanFila["competencia"];
  }[];
  _count: { asignacionesDocente: number };
}): PlanFila {
  const { competenciasPlan, _count, ...resto } = p;
  return {
    ...resto,
    competencias: competenciasPlan.map((c) => ({ ...c, peso: c.peso === null ? null : c.peso.toNumber() })),
    asignaciones: _count.asignacionesDocente,
  };
}

export const planes = {
  /** Planes del año de varios cursos, ordenados por grado. */
  async delAnio(anioAcademicoId: string, cursoIds: string[], db: Db = prisma): Promise<PlanFila[]> {
    const filas = await db.planEstudio.findMany({
      where: { anioAcademicoId, cursoId: { in: cursoIds } },
      orderBy: { grado: { numero: "asc" } },
      select: selectPlan,
    });
    return filas.map(filaPlan);
  },

  async porId(id: string, db: Db = prisma): Promise<PlanFila | null> {
    const p = await db.planEstudio.findUnique({ where: { id }, select: selectPlan });
    return p && filaPlan(p);
  },

  /** Competencias configuradas en los planes del curso, de cualquier año (para cambiar su área). */
  competenciasDelCurso: (cursoId: string, db: Db = prisma) =>
    db.competenciaPlan.count({ where: { planEstudio: { cursoId } } }),

  /** Plan del curso para un grado y año (US14: el curso debe dictarse en el grado de la sección). */
  delCursoEnGrado: (cursoId: string, gradoId: string, anioAcademicoId: string, db: Db = prisma) =>
    db.planEstudio.findUnique({
      where: { anioAcademicoId_gradoId_cursoId: { anioAcademicoId, gradoId, cursoId } },
      select: { id: true, gradoId: true, anioAcademicoId: true },
    }),

  /** Planes del curso de cualquier año (para eliminarlo). */
  idsDelCurso: async (cursoId: string, db: Db = prisma) =>
    (await db.planEstudio.findMany({ where: { cursoId }, select: { id: true } })).map((p) => p.id),

  crear: (
    data: { anioAcademicoId: string; cursoId: string; gradoId: string; horasSemanales: number },
    db: Db = prisma,
  ) => db.planEstudio.create({ data, select: { id: true } }),

  actualizarHoras: (id: string, horasSemanales: number, db: Db = prisma) =>
    db.planEstudio.update({ where: { id }, data: { horasSemanales }, select: { id: true } }),

  /** Borra planes con sus competencias (competencia_plan se borra en cascada). */
  eliminar: (ids: string[], db: Db = prisma) => db.planEstudio.deleteMany({ where: { id: { in: ids } } }),

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM plan_estudio WHERE id = ${id}::uuid FOR UPDATE`;
  },
};

export const competenciasPlan = {
  idsDePlanes: async (planIds: string[], db: Db = prisma) =>
    (await db.competenciaPlan.findMany({ where: { planEstudioId: { in: planIds } }, select: { id: true } })).map(
      (c) => c.id,
    ),

  crear: (
    data: { planEstudioId: string; competenciaId: string; orden: number; peso: number | null },
    db: Db = prisma,
  ) => db.competenciaPlan.create({ data, select: { id: true } }),

  actualizar: (id: string, data: { orden: number; peso: number | null }, db: Db = prisma) =>
    db.competenciaPlan.update({ where: { id }, data, select: { id: true } }),

  eliminar: (ids: string[], db: Db = prisma) => db.competenciaPlan.deleteMany({ where: { id: { in: ids } } }),
};

// ---------- Asignaciones de cursos a docentes (US14) ----------

const selectAsignacion = {
  id: true,
  docenteId: true,
  activo: true,
  planEstudio: {
    select: {
      id: true,
      horasSemanales: true,
      anioAcademico: { select: { id: true, anio: true, estado: true } },
      curso: { select: { id: true, codigo: true, nombre: true } },
    },
  },
  seccion: { select: { id: true, nombre: true, grado: { select: { id: true, numero: true, nombre: true } } } },
} as const;

export interface AsignacionFila {
  id: string;
  docenteId: string;
  activo: boolean;
  planEstudio: {
    id: string;
    horasSemanales: number;
    anioAcademico: { id: string; anio: number; estado: EstadoAnio };
    curso: { id: string; codigo: string; nombre: string };
  };
  seccion: { id: string; nombre: string; grado: GradoFila };
}

export const asignaciones = {
  /** Asignaciones activas de un docente (de un año, o de todos), por año, grado, sección y curso. */
  activasDelDocente: (docenteId: string, anioAcademicoId: string | undefined, db: Db = prisma) =>
    db.asignacionDocente.findMany({
      where: { docenteId, activo: true, ...(anioAcademicoId ? { planEstudio: { anioAcademicoId } } : {}) },
      orderBy: [
        { planEstudio: { anioAcademico: { anio: "desc" } } },
        { seccion: { grado: { numero: "asc" } } },
        { seccion: { nombre: "asc" } },
        { planEstudio: { curso: { nombre: "asc" } } },
      ],
      select: selectAsignacion,
    }) as Promise<AsignacionFila[]>,

  porId: (id: string, db: Db = prisma) =>
    db.asignacionDocente.findUnique({ where: { id }, select: selectAsignacion }) as Promise<AsignacionFila | null>,

  /** La asignación activa del curso del plan en la sección, si hay (uq_asignacion_activa). */
  activaDe: (planEstudioId: string, seccionId: string, db: Db = prisma) =>
    db.asignacionDocente.findFirst({
      where: { planEstudioId, seccionId, activo: true },
      select: { id: true, docenteId: true },
    }),

  /** Una asignación desactivada del mismo docente, curso y sección: se reactiva en vez de duplicarla. */
  inactivaDe: (planEstudioId: string, seccionId: string, docenteId: string, db: Db = prisma) =>
    db.asignacionDocente.findFirst({
      where: { planEstudioId, seccionId, docenteId, activo: false },
      select: { id: true },
    }),

  crear: (data: { planEstudioId: string; seccionId: string; docenteId: string }, db: Db = prisma) =>
    db.asignacionDocente.create({ data, select: { id: true } }),

  cambiarActivo: (id: string, activo: boolean, db: Db = prisma) =>
    db.asignacionDocente.update({ where: { id }, data: { activo }, select: { id: true } }),

  eliminar: (id: string, db: Db = prisma) => db.asignacionDocente.delete({ where: { id }, select: { id: true } }),

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM asignacion_docente WHERE id = ${id}::uuid FOR UPDATE`;
  },
};
