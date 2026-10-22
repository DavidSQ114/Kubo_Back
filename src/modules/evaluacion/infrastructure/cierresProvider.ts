// evaluacion/infrastructure: implementa el puerto CierresProvider de académico: cierres del año (US06) y
// notas por competencia del plan (US11). evaluacion es dueño de cierre_calificacion y nota; el resto llega en su fase.
import { prisma } from "@/platform/db/prisma";
import type { CierresProvider } from "@/modules/academico";

export const cierresProviderEvaluacion: CierresProvider = {
  async resumenCierres(anioAcademicoId) {
    const delAnio = { periodoEvaluacion: { anioAcademicoId } };
    const [total, publicados] = await prisma.$transaction([
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
};
