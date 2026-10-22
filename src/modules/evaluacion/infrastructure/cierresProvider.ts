// evaluacion/infrastructure: implementa el puerto CierresProvider que académico necesita para cerrar el año (US06).
// evaluacion es dueño de cierre_calificacion; el resto del módulo (notas, cierres) llega en su propia fase.
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
};
