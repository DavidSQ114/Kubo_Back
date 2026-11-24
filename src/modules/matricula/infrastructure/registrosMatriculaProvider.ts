// matricula/infrastructure: implementa el puerto RegistrosMatriculaProvider de comunidad (US69). Antes de eliminar a
// una persona con perfil de estudiante, comunidad pregunta si tiene matrículas o pagos: si los tiene, no se elimina.
// Antes de crearle el acceso al portal del alumno (US49), pregunta si tiene una matrícula vigente. En el detalle de
// una persona (D-12) pide la matrícula más reciente de cada hijo, con su sección y el responsable del pago.
import { prisma } from "@/platform/db/prisma";
import { listarAnios, listarSecciones } from "@/modules/academico";
import type { MatriculaReciente, RegistrosMatriculaProvider } from "@/modules/comunidad";
import { matriculaVigente } from "../domain/portalAlumno";

export const registrosMatriculaProviderMatricula: RegistrosMatriculaProvider = {
  async registrosDeEstudiante(tx, estudianteId) {
    const matriculas = await tx.matricula.count({ where: { estudianteId } });
    if (!matriculas) return { matriculas: 0, pagos: 0 };
    const pagos = await tx.operacionPago.count({
      where: { pagos: { some: { conceptoCobro: { matricula: { estudianteId } } } } },
    });
    return { matriculas, pagos };
  },

  async tieneMatriculaVigente(tx, estudianteId) {
    const filas = await tx.matricula.findMany({
      where: { estudianteId, estado: "MATRICULADO" },
      select: { estado: true, anioAcademicoId: true },
    });
    if (filas.length === 0) return false;
    const anios = new Map((await listarAnios()).map((a) => [a.id, a]));
    const conAnio = filas.flatMap((m) => {
      const anio = anios.get(m.anioAcademicoId);
      return anio ? [{ estado: m.estado, anio: anio.anio, estadoAnio: anio.estado }] : [];
    });
    return matriculaVigente(conAnio) !== null;
  },

  async matriculasRecientes(estudianteIds) {
    if (!estudianteIds.length) return {};
    const filas = await prisma.matricula.findMany({
      where: { estudianteId: { in: [...new Set(estudianteIds)] } },
      select: { estudianteId: true, anioAcademicoId: true, seccionId: true, estado: true, vinculoResponsableId: true },
    });
    const anios = new Map((await listarAnios()).map((a) => [a.id, a.anio]));
    // la más reciente: la del último año; dentro del año, una anulada solo si no hay otra
    const peso = (m: (typeof filas)[number]) =>
      (anios.get(m.anioAcademicoId) ?? 0) * 2 + (m.estado === "ANULADO" ? 0 : 1);
    const recientes = new Map<string, (typeof filas)[number]>();
    for (const m of filas) {
      const actual = recientes.get(m.estudianteId);
      if (!actual || peso(m) > peso(actual)) recientes.set(m.estudianteId, m);
    }
    const etiquetas = new Map<string, string>();
    for (const anioId of new Set([...recientes.values()].filter((m) => m.seccionId).map((m) => m.anioAcademicoId))) {
      for (const s of await listarSecciones(anioId)) etiquetas.set(s.id, `${s.grado.numero}° ${s.nombre}`);
    }
    const resultado: Record<string, MatriculaReciente> = {};
    for (const [estudianteId, m] of recientes) {
      resultado[estudianteId] = {
        anio: anios.get(m.anioAcademicoId) ?? 0,
        estado: m.estado,
        seccion: m.seccionId ? (etiquetas.get(m.seccionId) ?? null) : null,
        vinculoResponsableId: m.vinculoResponsableId,
      };
    }
    return resultado;
  },
};
