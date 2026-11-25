// evaluacion/infrastructure: implementa el puerto CierresProvider de académico: cierres del año (US06) y
// notas por competencia del plan (US11), ítems de evaluación por competencia (bloque M2) y notas por asignación (US14). evaluacion es dueño de cierre_calificacion y nota; el resto llega en su fase.
import { prisma } from "@/platform/db/prisma";
import type { CierresProvider } from "@/modules/academico";

export const cierresProviderEvaluacion: CierresProvider = {
  async resumenCierres(anioAcademicoId) {
    const delAnio = { periodoEvaluacion: { anioAcademicoId } };
    // lectura sin transacción (bloque M5): en frío, una transacción de solo lectura pasó el límite de 5 s
    const [total, publicados] = await Promise.all([
      prisma.cierreCalificacion.count({ where: delAnio }),
      prisma.cierreCalificacion.count({ where: { ...delAnio, estado: "PUBLICADO" } }),
    ]);
    return { total, publicados };
  },

  async notasPorCompetenciaPlan(competenciaPlanIds) {
    if (competenciaPlanIds.length === 0) return {};
    const filas = await prisma.nota.groupBy({
      by: ["competenciaPlanId"],
      where: { competenciaPlanId: { in: competenciaPlanIds } },
      _count: { _all: true },
    });
    return Object.fromEntries(filas.map((f) => [f.competenciaPlanId, f._count._all]));
  },

  async itemsPorCompetenciaPlan(competenciaPlanIds) {
    if (competenciaPlanIds.length === 0) return {};
    const filas = await prisma.itemEvaluacion.groupBy({
      by: ["competenciaPlanId"],
      where: { competenciaPlanId: { in: competenciaPlanIds } },
      _count: { _all: true },
    });
    return Object.fromEntries(filas.map((f) => [f.competenciaPlanId, f._count._all]));
  },

  async notasPorAsignacion(asignacionIds) {
    if (asignacionIds.length === 0) return {};
    const cierres = await prisma.cierreCalificacion.findMany({
      where: { asignacionDocenteId: { in: asignacionIds } },
      select: { asignacionDocenteId: true, _count: { select: { notas: true } } },
    });
    const conteo: Record<string, number> = {};
    for (const c of cierres) conteo[c.asignacionDocenteId] = (conteo[c.asignacionDocenteId] ?? 0) + c._count.notas;
    return conteo;
  },

  async periodosConCierres(anioAcademicoId) {
    const filas = await prisma.cierreCalificacion.findMany({
      where: { periodoEvaluacion: { anioAcademicoId }, estado: { in: ["CERRADO", "PUBLICADO"] } },
      distinct: ["periodoEvaluacionId"],
      select: { periodoEvaluacionId: true },
    });
    return filas.map((f) => f.periodoEvaluacionId);
  },
};
