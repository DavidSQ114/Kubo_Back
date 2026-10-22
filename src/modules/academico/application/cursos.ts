// academico/application: catálogo de cursos y grados con horas de cada año (US10, pantalla AD-04).
// Los cambios del catálogo y del plan de estudio se registran en auditoría (RF03).
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import {
  compararPlanes,
  normalizarCodigoCurso,
  verificarArea,
  verificarCambioArea,
  verificarEliminacionCurso,
  verificarGradosPlan,
  type EstadoCurso,
  type GradoPlan,
  type UsoCurso,
} from "../domain/cursos";
import { erroresAcademico as E } from "../domain/errores";
import { verificarAnioEditable } from "../domain/secciones";
import {
  anios,
  areas,
  cursos,
  grados,
  planes,
  type CursoFila,
  type GradoFila,
  type PlanFila,
} from "../infrastructure/repositorio";
import { cierresProvider, horariosProvider } from "../puertos";
import { guardarCompetenciasTx } from "./competencias";

export interface PlanResumen {
  id: string;
  grado: GradoFila;
  horasSemanales: number;
  competencias: number;
  asignaciones: number;
}

export interface CursoVista extends CursoFila {
  /** Grados del curso en el año consultado (sin anioId, vacío). */
  planes: PlanResumen[];
  /** Competencias distintas configuradas en los planes del año. */
  competencias: number;
  uso: UsoCurso;
}

interface DatosCurso {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  areaCurricularId: string;
}

export const listarAreas = () => areas.conCompetencias();

const resumenPlan = (p: PlanFila): PlanResumen => ({
  id: p.id,
  grado: p.grado,
  horasSemanales: p.horasSemanales,
  competencias: p.competencias.length,
  asignaciones: p.asignaciones,
});

async function usoDeCursos(ids: string[]): Promise<Record<string, UsoCurso>> {
  const [docentes, horarios] = await Promise.all([
    cursos.docentesAsignados(ids),
    horariosProvider().seccionesConHorarioPublicado(ids),
  ]);
  return Object.fromEntries(
    ids.map((id) => [id, { docentes: docentes[id] ?? 0, seccionesConHorario: horarios[id] ?? 0 }]),
  );
}

async function vistas(filas: CursoFila[], anioId?: string): Promise<CursoVista[]> {
  const ids = filas.map((c) => c.id);
  const [delAnio, uso] = await Promise.all([
    anioId && ids.length ? planes.delAnio(anioId, ids) : Promise.resolve([] as PlanFila[]),
    usoDeCursos(ids),
  ]);
  return filas.map((c) => {
    const propios = delAnio.filter((p) => p.cursoId === c.id);
    const competencias = new Set(propios.flatMap((p) => p.competencias.map((cp) => cp.competencia.id)));
    return { ...c, planes: propios.map(resumenPlan), competencias: competencias.size, uso: uso[c.id] };
  });
}

/** Cursos con filtros por área y estado; con anioId trae sus grados, horas y competencias de ese año. */
export async function listarCursos(filtro: { areaId?: string; estado?: EstadoCurso; anioId?: string }) {
  if (filtro.anioId && !(await anios.porId(filtro.anioId))) throw errores.noEncontrado("El año académico");
  return vistas(await cursos.todos(filtro), filtro.anioId);
}

async function obtenerCurso(id: string, anioId?: string): Promise<CursoVista> {
  const c = await cursos.porId(id);
  if (!c) throw errores.noEncontrado("El curso");
  return (await vistas([c], anioId))[0];
}

/** Código repetido: índice único de curso. */
function traducirDuplicado(e: unknown): never {
  if (esDuplicado(e, "curso_codigo_key")) throw E.cursoDuplicado();
  throw e;
}

async function verificarAreaActiva(areaCurricularId: string, tx: Tx) {
  verificarArea(areaCurricularId);
  const a = await areas.porId(areaCurricularId, tx);
  if (!a || !a.activo) throw E.areaRequerida();
}

const resumen = (c: CursoFila) => ({
  codigo: c.codigo,
  nombre: c.nombre,
  descripcion: c.descripcion,
  area: c.areaCurricular.codigo,
  estado: c.estado,
});

/**
 * Registra un curso (US10). Con `plan`, en la misma transacción le asocia los grados del año con sus horas
 * y las competencias que evaluará en cada uno (formulario «Registrar nuevo curso» de AD-04).
 */
export async function crearCurso(
  admin: Autenticado,
  datos: DatosCurso & {
    plan?: { anioAcademicoId: string; grados: GradoPlan[]; competencias: string[] };
  },
  meta: MetaSolicitud,
): Promise<CursoVista> {
  const codigo = normalizarCodigoCurso(datos.codigo);
  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      await verificarAreaActiva(datos.areaCurricularId, tx);
      const c = await cursos.crear(
        {
          codigo,
          nombre: datos.nombre,
          descripcion: datos.descripcion ?? null,
          areaCurricularId: datos.areaCurricularId,
        },
        tx,
      );
      await registrarAuditoria(
        tx,
        { usuarioId: admin.usuarioId, entidad: "curso", entidadId: c.id, accion: "CREAR_CURSO", nuevo: resumen(c) },
        meta,
      );
      if (datos.plan) {
        const { anioAcademicoId, grados: pedidos, competencias } = datos.plan;
        const creados = await guardarPlanesTx(tx, admin, c, anioAcademicoId, pedidos, meta);
        const lista = competencias.map((competenciaId) => ({ competenciaId }));
        for (const planId of creados) await guardarCompetenciasTx(tx, admin, planId, lista, meta);
      }
      return c.id;
    });
  } catch (e) {
    traducirDuplicado(e);
  }
  return obtenerCurso(id, datos.plan?.anioAcademicoId);
}

export async function editarCurso(
  admin: Autenticado,
  id: string,
  datos: Partial<DatosCurso>,
  meta: MetaSolicitud,
): Promise<CursoVista> {
  const cambios = { ...datos, ...(datos.codigo !== undefined ? { codigo: normalizarCodigoCurso(datos.codigo) } : {}) };
  try {
    await prisma.$transaction(async (tx) => {
      await cursos.bloquearFila(tx, id);
      const actual = await cursos.porId(id, tx);
      if (!actual) throw errores.noEncontrado("El curso");
      if (cambios.areaCurricularId !== undefined) {
        await verificarAreaActiva(cambios.areaCurricularId, tx);
        const configuradas = await planes.competenciasDelCurso(id, tx);
        verificarCambioArea(actual.areaCurricular.id, cambios.areaCurricularId, configuradas);
      }
      const c = await cursos.actualizar(id, cambios, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "curso",
          entidadId: id,
          accion: "EDITAR_CURSO",
          anterior: resumen(actual),
          nuevo: resumen(c),
        },
        meta,
      );
    });
  } catch (e) {
    traducirDuplicado(e);
  }
  return obtenerCurso(id);
}

/** INACTIVO: el curso sigue en sus planes y notas, pero no se usa en nuevas asignaciones. */
export async function cambiarEstadoCurso(
  admin: Autenticado,
  id: string,
  estado: EstadoCurso,
  meta: MetaSolicitud,
): Promise<CursoVista> {
  await prisma.$transaction(async (tx) => {
    await cursos.bloquearFila(tx, id);
    const actual = await cursos.porId(id, tx);
    if (!actual) throw errores.noEncontrado("El curso");
    if (actual.estado === estado) return;
    await cursos.actualizar(id, { estado }, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "curso",
        entidadId: id,
        accion: estado === "ACTIVO" ? "ACTIVAR_CURSO" : "DESACTIVAR_CURSO",
        anterior: { estado: actual.estado },
        nuevo: { estado },
      },
      meta,
    );
  });
  return obtenerCurso(id);
}

/** Solo se elimina un curso sin docentes asignados ni horarios publicados; se borran también sus planes. */
export async function eliminarCurso(admin: Autenticado, id: string, meta: MetaSolicitud) {
  try {
    await prisma.$transaction(async (tx) => {
      await cursos.bloquearFila(tx, id);
      const actual = await cursos.porId(id, tx);
      if (!actual) throw errores.noEncontrado("El curso");
      verificarEliminacionCurso((await usoDeCursos([id]))[id]);
      await planes.eliminar(await planes.idsDelCurso(id, tx), tx);
      await cursos.eliminar(id, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "curso",
          entidadId: id,
          accion: "ELIMINAR_CURSO",
          anterior: resumen(actual),
        },
        meta,
      );
    });
  } catch (e) {
    // P2003: una asignación, nota u otro registro todavía apunta al curso o a sus planes.
    if ((e as { code?: string })?.code === "P2003") throw E.cursoAsignado({ docentes: 0, seccionesConHorario: 0 });
    throw e;
  }
  return { cursoId: id, eliminado: true };
}

// ---------- Grados del curso en un año (plan de estudio) ----------

/** Los cinco grados con el plan del curso en el año (o null si el curso no se dicta en ese grado). */
export async function planesDelCurso(cursoId: string, anioId: string) {
  const [curso, anio] = await Promise.all([cursos.porId(cursoId), anios.porId(anioId)]);
  if (!curso) throw errores.noEncontrado("El curso");
  if (!anio) throw errores.noEncontrado("El año académico");
  const [todos, delAnio] = await Promise.all([grados.activos(), planes.delAnio(anioId, [cursoId])]);
  return {
    cursoId,
    anioAcademicoId: anioId,
    grados: todos.map((g) => {
      const p = delAnio.find((x) => x.grado.id === g.id);
      return { grado: g, plan: p ? resumenPlan(p) : null };
    }),
  };
}

/**
 * Deja el curso en exactamente los grados pedidos para el año: crea, cambia horas o quita planes.
 * Un grado con docentes asignados o notas no se quita. Devuelve los ids de los planes creados.
 */
async function guardarPlanesTx(
  tx: Tx,
  admin: Autenticado,
  curso: CursoFila,
  anioId: string,
  pedidos: GradoPlan[],
  meta: MetaSolicitud,
): Promise<string[]> {
  verificarGradosPlan(pedidos);
  await anios.bloquearFila(tx, anioId);
  const anio = await anios.porId(anioId, tx);
  if (!anio) throw errores.noEncontrado("El año académico");
  verificarAnioEditable(anio.estado);
  for (const p of pedidos) {
    const g = await grados.porId(p.gradoId, tx);
    if (!g || !g.activo) throw errores.noEncontrado("El grado");
  }
  const actuales = await planes.delAnio(anioId, [curso.id], tx);
  const cambios = compararPlanes(
    actuales.map((a) => ({ planId: a.id, gradoId: a.grado.id, horasSemanales: a.horasSemanales })),
    pedidos,
  );
  await verificarPlanesQuitados(actuales.filter((a) => cambios.quitar.some((q) => q.planId === a.id)));
  await planes.eliminar(
    cambios.quitar.map((q) => q.planId),
    tx,
  );
  for (const a of cambios.actualizar) await planes.actualizarHoras(a.planId, a.horasSemanales, tx);
  const creados: string[] = [];
  for (const c of cambios.crear) {
    creados.push((await planes.crear({ anioAcademicoId: anioId, cursoId: curso.id, ...c }, tx)).id);
  }
  await registrarAuditoria(
    tx,
    {
      usuarioId: admin.usuarioId,
      entidad: "curso",
      entidadId: curso.id,
      accion: "GUARDAR_PLAN_ESTUDIO",
      anterior: { anio: anio.anio, grados: actuales.map((a) => ({ grado: a.grado.numero, horas: a.horasSemanales })) },
      nuevo: { anio: anio.anio, grados: pedidos },
    },
    meta,
  );
  return creados;
}

async function verificarPlanesQuitados(quitados: PlanFila[]) {
  const ids = quitados.flatMap((p) => p.competencias.map((c) => c.id));
  const notas = ids.length ? await cierresProvider().notasPorCompetenciaPlan(ids) : {};
  for (const p of quitados) {
    const conNotas = p.competencias.some((c) => (notas[c.id] ?? 0) > 0);
    if (p.asignaciones > 0 || conNotas) throw E.planEnUso(p.grado.nombre);
  }
}

export async function guardarPlanes(
  admin: Autenticado,
  cursoId: string,
  anioId: string,
  pedidos: GradoPlan[],
  meta: MetaSolicitud,
) {
  await prisma.$transaction(async (tx) => {
    await cursos.bloquearFila(tx, cursoId);
    const curso = await cursos.porId(cursoId, tx);
    if (!curso) throw errores.noEncontrado("El curso");
    await guardarPlanesTx(tx, admin, curso, anioId, pedidos, meta);
  });
  return planesDelCurso(cursoId, anioId);
}
