// matricula/infrastructure: implementa el puerto RegistrosMatriculaProvider de comunidad (US69). Antes de eliminar a
// una persona con perfil de estudiante, comunidad pregunta si tiene matrículas o pagos: si los tiene, no se elimina.
// Antes de crearle el acceso al portal del alumno (US49), pregunta si tiene una matrícula vigente.
import { listarAnios } from "@/modules/academico";
import type { RegistrosMatriculaProvider } from "@/modules/comunidad";
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
};
