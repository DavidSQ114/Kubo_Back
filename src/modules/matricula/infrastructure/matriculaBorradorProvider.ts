// matricula/infrastructure: implementa el puerto MatriculaBorradorProvider de comunidad (US17 «Guardar como
// borrador»): matrícula «En proceso» sin sección, sin responsable de pago, sin validar vacantes y sin cronograma.
import { esDuplicado } from "@/platform/db/tipos";
import { listarAnios } from "@/modules/academico";
import type { MatriculaBorradorProvider } from "@/modules/comunidad";
import { erroresMatricula as E } from "../domain/errores";
import { anioParaBorrador } from "../domain/reglas";

export const matriculaBorradorProviderMatricula: MatriculaBorradorProvider = {
  async crearEnProceso(tx, { estudianteId, registradoPorId }) {
    const anio = anioParaBorrador(await listarAnios());
    // Un estudiante reactivado puede tener ya una matrícula activa en ese año (uq_matricula_activa_por_anio).
    const activa = await tx.matricula.findFirst({
      where: { estudianteId, anioAcademicoId: anio.id, estado: { in: ["EN_PROCESO", "MATRICULADO"] } },
      select: { id: true },
    });
    if (activa) throw E.matriculaExistente(anio.anio);
    try {
      const m = await tx.matricula.create({
        data: { estudianteId, anioAcademicoId: anio.id, registradoPorId, estado: "EN_PROCESO" },
        select: { id: true },
      });
      return { matriculaId: m.id, anioAcademicoId: anio.id, anio: anio.anio };
    } catch (e) {
      // Dos registros simultáneos del mismo estudiante: el índice único rechaza el segundo.
      if (esDuplicado(e, "uq_matricula_activa_por_anio")) throw E.matriculaExistente(anio.anio);
      throw e;
    }
  },
};
