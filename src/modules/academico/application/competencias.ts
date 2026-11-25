// academico/application: competencias que evalúa cada plan de estudio, curso + grado del año (US11, RF09, AD-04), y
// «Competencias de mi curso» del docente en DO-04 (bloque M2). Las notas son de evaluacion: se cuentan por el puerto
// CierresProvider.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import {
  prepararCompetencias,
  verificarEdicionDocente,
  verificarQuitarCompetencias,
  type CompetenciaPedida,
} from "../domain/cursos";
import { verificarAnioEditable } from "../domain/secciones";
import type { EstadoAnio } from "../domain/tipos";
import {
  anios,
  asignaciones,
  competencias,
  competenciasPlan,
  cursos,
  planes,
  secciones,
} from "../infrastructure/repositorio";
import { cierresProvider, docentesProvider } from "../puertos";

export interface CompetenciaDelPlan {
  /** Id de competencia_plan: es el que guardan las notas. */
  competenciaPlanId: string;
  competenciaId: string;
  codigo: string;
  nombre: string;
  orden: number;
  peso: number | null;
}

/** Plan con sus competencias (y sus notas) y las competencias del área del curso que se pueden elegir. */
export async function competenciasDePlan(planId: string) {
  const plan = await planes.porId(planId);
  if (!plan) throw errores.noEncontrado("El plan de estudio");
  const curso = (await cursos.porId(plan.cursoId))!;
  const [disponibles, notas] = await Promise.all([
    competencias.delArea(curso.areaCurricular.id),
    cierresProvider().notasPorCompetenciaPlan(plan.competencias.map((c) => c.id)),
  ]);
  return {
    plan: {
      id: plan.id,
      anioAcademicoId: plan.anioAcademicoId,
      grado: plan.grado,
      horasSemanales: plan.horasSemanales,
      curso: { id: curso.id, codigo: curso.codigo, nombre: curso.nombre, area: curso.areaCurricular },
    },
    competencias: plan.competencias.map((c) => ({ ...c, notas: notas[c.id] ?? 0 })),
    disponibles,
  };
}

/**
 * Reemplaza las competencias del plan por las pedidas (en ese orden). Usada también al registrar un curso y por el
 * docente en «Competencias de mi curso» (`docente`: su asignación queda en la auditoría y el plan no debe tener notas).
 */
export async function guardarCompetenciasTx(
  tx: Tx,
  admin: Autenticado,
  planId: string,
  pedidas: CompetenciaPedida[],
  meta: MetaSolicitud,
  docente?: { asignacionId: string },
) {
  await planes.bloquearFila(tx, planId);
  const plan = await planes.porId(planId, tx);
  if (!plan) throw errores.noEncontrado("El plan de estudio");
  verificarAnioEditable((await anios.porId(plan.anioAcademicoId, tx))!.estado);
  const curso = (await cursos.porId(plan.cursoId, tx))!;
  const catalogo = await competencias.porIds(
    pedidas.map((p) => p.competenciaId),
    tx,
  );
  if (docente) {
    // con el plan bloqueado: una nota registrada mientras tanto también lo impide
    const notasDelPlan = await cierresProvider().notasPorCompetenciaPlan(plan.competencias.map((c) => c.id));
    verificarEdicionDocente(Object.values(notasDelPlan).reduce((s, n) => s + n, 0));
  }
  const actuales = new Map(plan.competencias.map((c) => [c.competencia.id, c]));
  const elegidas = prepararCompetencias(pedidas, curso.areaCurricular.id, catalogo, [...actuales.keys()]);

  const quitadas = plan.competencias.filter((c) => !elegidas.some((e) => e.competenciaId === c.competencia.id));
  const ids = quitadas.map((q) => q.id);
  const [notas, items] = ids.length
    ? await Promise.all([
        cierresProvider().notasPorCompetenciaPlan(ids),
        cierresProvider().itemsPorCompetenciaPlan(ids),
      ])
    : [{}, {}];
  verificarQuitarCompetencias(
    quitadas.map((q) => ({ nombre: q.competencia.nombre, notas: notas[q.id] ?? 0, items: items[q.id] ?? 0 })),
  );

  await competenciasPlan.eliminar(
    quitadas.map((q) => q.id),
    tx,
  );
  for (const e of elegidas) {
    const actual = actuales.get(e.competenciaId);
    if (!actual) await competenciasPlan.crear({ planEstudioId: planId, ...e }, tx);
    else if (actual.orden !== e.orden || actual.peso !== e.peso) {
      await competenciasPlan.actualizar(actual.id, { orden: e.orden, peso: e.peso }, tx);
    }
  }
  const codigos = new Map(catalogo.map((c) => [c.id, c.codigo]));
  await registrarAuditoria(
    tx,
    {
      usuarioId: admin.usuarioId,
      entidad: "plan_estudio",
      entidadId: planId,
      accion: "GUARDAR_COMPETENCIAS_PLAN",
      anterior: { competencias: plan.competencias.map((c) => c.competencia.codigo) },
      nuevo: {
        curso: curso.codigo,
        grado: plan.grado.numero,
        competencias: elegidas.map((e) => ({ codigo: codigos.get(e.competenciaId), orden: e.orden, peso: e.peso })),
        ...(docente ? { por: "DOCENTE", asignacionId: docente.asignacionId } : {}),
      },
    },
    meta,
  );
}

export async function guardarCompetenciasPlan(
  admin: Autenticado,
  planId: string,
  pedidas: CompetenciaPedida[],
  meta: MetaSolicitud,
) {
  await prisma.$transaction((tx) => guardarCompetenciasTx(tx, admin, planId, pedidas, meta));
  return competenciasDePlan(planId);
}

// ---------- Competencias de mi curso (docente, bloque M2) ----------

export interface CompetenciasDeMiCurso extends Awaited<ReturnType<typeof competenciasDePlan>> {
  asignacionId: string;
  /** Secciones del grado en el año («3° A», «3° B»): el cambio aplica a todas, no solo a la del docente. */
  secciones: string[];
  /** El docente puede cambiar las competencias: el año no está cerrado y ninguna tiene notas. */
  editable: boolean;
  /** Por qué no se puede cambiar; null si es editable. */
  motivo: string | null;
}

/** Asignación activa del docente en sesión: un curso ajeno responde 403, aunque sea del mismo grado. */
async function asignacionDelDocente(auth: Autenticado, asignacionId: string) {
  const docente = await docentesProvider().docentePorPersona(auth.personaId);
  if (!docente) throw errores.accesoDenegado();
  const asignacion = await asignaciones.porId(asignacionId);
  if (!asignacion) throw errores.noEncontrado("El curso");
  if (asignacion.docenteId !== docente.id || !asignacion.activo) throw errores.accesoDenegado();
  return asignacion;
}

function motivoNoEditable(estadoAnio: EstadoAnio, notas: number): string | null {
  try {
    verificarAnioEditable(estadoAnio);
    verificarEdicionDocente(notas);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/**
 * Competencias del plan de un curso del docente (su curso + grado del año), las del área que puede agregar y las
 * secciones del grado a las que aplica el cambio (bloque M2, DO-04 «Competencias de mi curso»).
 */
export async function competenciasDeMiCurso(auth: Autenticado, asignacionId: string): Promise<CompetenciasDeMiCurso> {
  const asignacion = await asignacionDelDocente(auth, asignacionId);
  const detalle = await competenciasDePlan(asignacion.planEstudio.id);
  const delGrado = (await secciones.delAnio(asignacion.planEstudio.anioAcademico.id)).filter(
    (s) => s.grado.id === asignacion.seccion.grado.id && s.estado === "ACTIVA",
  );
  const notas = detalle.competencias.reduce((s, c) => s + c.notas, 0);
  const motivo = motivoNoEditable(asignacion.planEstudio.anioAcademico.estado, notas);
  return {
    ...detalle,
    asignacionId,
    secciones: delGrado.map((s) => `${s.grado.numero}° ${s.nombre}`),
    editable: motivo === null,
    motivo,
  };
}

/**
 * El docente agrega o quita competencias del catálogo oficial (activas y del área del curso) en el plan de su curso y
 * grado, con su peso. Solo mientras ninguna competencia del plan tenga notas en el año; aplica a todas las secciones
 * del grado y queda en la auditoría (GUARDAR_COMPETENCIAS_PLAN con `por: "DOCENTE"`).
 */
export async function guardarCompetenciasDeMiCurso(
  auth: Autenticado,
  asignacionId: string,
  pedidas: CompetenciaPedida[],
  meta: MetaSolicitud,
): Promise<CompetenciasDeMiCurso> {
  const asignacion = await asignacionDelDocente(auth, asignacionId);
  await prisma.$transaction((tx) =>
    guardarCompetenciasTx(tx, auth, asignacion.planEstudio.id, pedidas, meta, { asignacionId }),
  );
  return competenciasDeMiCurso(auth, asignacionId);
}

/**
 * Competencias que evalúa un plan (curso + grado del año), en orden. Para el registro de notas:
 *   const lista = await competenciasDelPlan(planEstudioId);
 *   verificarCompetenciasConfiguradas(lista); // de @/modules/academico // «Este curso no tiene competencias configuradas. Comunícate con la coordinación académica.»
 */
export async function competenciasDelPlan(planEstudioId: string): Promise<CompetenciaDelPlan[]> {
  const plan = await planes.porId(planEstudioId);
  if (!plan) throw errores.noEncontrado("El plan de estudio");
  return plan.competencias.map((c) => ({
    competenciaPlanId: c.id,
    competenciaId: c.competencia.id,
    codigo: c.competencia.codigo,
    nombre: c.competencia.nombre,
    orden: c.orden,
    peso: c.peso,
  }));
}
