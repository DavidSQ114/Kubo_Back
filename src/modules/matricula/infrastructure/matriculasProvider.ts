// matricula/infrastructure: implementa el puerto MatriculasProvider que académico usa para vacantes y para
// eliminar secciones (US08). matricula es dueño de la tabla matricula; el resto del módulo llega en su fase.
import { prisma } from "@/platform/db/prisma";
import type { MatriculasProvider } from "@/modules/academico";

export const matriculasProviderMatricula: MatriculasProvider = {
  async matriculadosPorSeccion(seccionIds) {
    const filas = await prisma.matricula.groupBy({
      by: ["seccionId"],
      where: { seccionId: { in: seccionIds }, estado: "MATRICULADO" },
      _count: { _all: true },
    });
    return Object.fromEntries(filas.map((f) => [f.seccionId as string, f._count._all]));
  },
  matriculasDeSeccion: (seccionId) => prisma.matricula.count({ where: { seccionId } }),
};
