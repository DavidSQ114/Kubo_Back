// matricula/infrastructure: implementa el puerto RegistrosMatriculaProvider de comunidad (US69). Antes de eliminar a
// una persona con perfil de estudiante, comunidad pregunta si tiene matrículas o pagos: si los tiene, no se elimina.
import type { RegistrosMatriculaProvider } from "@/modules/comunidad";

export const registrosMatriculaProviderMatricula: RegistrosMatriculaProvider = {
  async registrosDeEstudiante(tx, estudianteId) {
    const matriculas = await tx.matricula.count({ where: { estudianteId } });
    if (!matriculas) return { matriculas: 0, pagos: 0 };
    const pagos = await tx.operacionPago.count({
      where: { pagos: { some: { conceptoCobro: { matricula: { estudianteId } } } } },
    });
    return { matriculas, pagos };
  },
};
