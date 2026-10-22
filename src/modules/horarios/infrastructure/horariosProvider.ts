// horarios/infrastructure: implementa el puerto HorariosProvider que académico usa para no eliminar un curso
// que está en un horario publicado (US10) ni borrar una asignación docente con horario (US14). horarios es dueño de horario y detalle_horario; el resto llega en su fase.
import { prisma } from "@/platform/db/prisma";
import type { HorariosProvider } from "@/modules/academico";

export const horariosProviderHorarios: HorariosProvider = {
  async seccionesConHorarioPublicado(cursoIds) {
    if (cursoIds.length === 0) return {};
    const filas = await prisma.detalleHorario.findMany({
      where: {
        horario: { estadoPublicacion: "PUBLICADO" },
        asignacionDocente: { planEstudio: { cursoId: { in: cursoIds } } },
      },
      distinct: ["seccionId", "asignacionDocenteId"],
      select: { seccionId: true, asignacionDocente: { select: { planEstudio: { select: { cursoId: true } } } } },
    });
    // una sección cuenta una vez por curso, aunque el curso tenga varios bloques o docentes en ella
    const pares = new Set(filas.map((f) => `${f.asignacionDocente.planEstudio.cursoId}|${f.seccionId}`));
    const conteo: Record<string, number> = {};
    for (const par of pares) {
      const cursoId = par.split("|")[0];
      conteo[cursoId] = (conteo[cursoId] ?? 0) + 1;
    }
    return conteo;
  },

  async horariosPorAsignacion(asignacionIds) {
    if (asignacionIds.length === 0) return {};
    const filas = await prisma.detalleHorario.findMany({
      where: { asignacionDocenteId: { in: asignacionIds } },
      select: { asignacionDocenteId: true, horario: { select: { estadoPublicacion: true } } },
    });
    const resultado: Record<string, { bloques: number; publicado: boolean }> = {};
    for (const f of filas) {
      const r = (resultado[f.asignacionDocenteId] ??= { bloques: 0, publicado: false });
      r.bloques += 1;
      r.publicado ||= f.horario.estadoPublicacion === "PUBLICADO";
    }
    return resultado;
  },
};
