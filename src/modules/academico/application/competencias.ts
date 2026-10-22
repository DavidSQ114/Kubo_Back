// academico/application: competencias que evalúa cada plan de estudio, curso + grado del año (US11, RF09, AD-04).
// Las notas son de evaluacion: se cuentan por el puerto CierresProvider.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import { prepararCompetencias, verificarQuitarCompetencias, type CompetenciaPedida } from "../domain/cursos";
import { verificarAnioEditable } from "../domain/secciones";
import { anios, competencias, competenciasPlan, cursos, planes } from "../infrastructure/repositorio";
import { cierresProvider } from "../puertos";

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

/** Reemplaza las competencias del plan por las pedidas (en ese orden). Usada también al registrar un curso. */
export async function guardarCompetenciasTx(
  tx: Tx,
  admin: Autenticado,
  planId: string,
  pedidas: CompetenciaPedida[],
  meta: MetaSolicitud,
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
  const actuales = new Map(plan.competencias.map((c) => [c.competencia.id, c]));
  const elegidas = prepararCompetencias(pedidas, curso.areaCurricular.id, catalogo, [...actuales.keys()]);

  const quitadas = plan.competencias.filter((c) => !elegidas.some((e) => e.competenciaId === c.competencia.id));
  const notas = quitadas.length ? await cierresProvider().notasPorCompetenciaPlan(quitadas.map((q) => q.id)) : {};
  verificarQuitarCompetencias(quitadas.map((q) => ({ nombre: q.competencia.nombre, notas: notas[q.id] ?? 0 })));

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

/**
 * Competencias que evalúa un plan (curso + grado del año), en orden. Para el registro de notas:
 *   const lista = await competenciasDelPlan(planEstudioId);
 *   verificarCompetenciasConfiguradas(lista); // de @/modules/academico // «Este curso no tiene competencias configuradas. Contacte al administrador.»
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
