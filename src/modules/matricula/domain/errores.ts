// matricula/domain: errores del módulo (US17 matrícula «En proceso», US18 matrícula en sección, US21 cronograma).
import { ErrorApp } from "@/platform/http/errores";

export const erroresMatricula = {
  sinAnioEnMatricula: () =>
    new ErrorApp(
      "SIN_ANIO_EN_MATRICULA",
      "No hay un año académico en matrícula ni en curso. Abre la matrícula en «Año y bimestres» para guardar el borrador.",
      422,
    ),
  matriculaExistente: (anio: number) =>
    new ErrorApp(
      "MATRICULA_EXISTENTE",
      `El estudiante ya tiene una matrícula en proceso o confirmada en ${anio}.`,
      409,
    ),

  // ---------- Matrícula en sección (US18) ----------
  incompleta: () =>
    new ErrorApp(
      "MATRICULA_INCOMPLETA",
      "Complete la sección y el apoderado responsable para confirmar la matrícula",
      422,
    ),
  sinVacantes: (matriculados: number, aforo: number) =>
    new ErrorApp("SECCION_SIN_VACANTES", "Sección sin vacantes disponibles", 409, { matriculados, aforo }),
  yaMatriculado: (detalles: { matriculaId: string; seccionId: string | null }) =>
    new ErrorApp("YA_MATRICULADO", "Este estudiante ya está matriculado en el periodo actual", 409, {
      ...detalles,
      sugerencia: "Usa «Traslado de sección» para cambiarlo de sección.",
    }),
  seccionInactiva: () =>
    new ErrorApp("SECCION_INACTIVA", "La sección está inactiva y no recibe nuevas matrículas.", 409),
  seccionNoEncontrada: () => new ErrorApp("SECCION_NO_ENCONTRADA", "La sección no existe.", 404),
  seccionOtroAnio: () =>
    new ErrorApp("SECCION_OTRO_ANIO", "La sección no pertenece al año académico de la matrícula.", 422),
  responsableNoVinculado: () =>
    new ErrorApp(
      "RESPONSABLE_NO_VINCULADO",
      "El apoderado responsable del pago debe ser uno de los apoderados vinculados al estudiante.",
      422,
    ),
  anioNoMatriculable: (anio: number, estado: string) =>
    new ErrorApp(
      "ANIO_NO_MATRICULABLE",
      `El año ${anio} está «${estado}»: solo se matricula en un año «En matrícula» o «En curso».`,
      422,
    ),
  sinMontos: (anio: number) =>
    new ErrorApp(
      "SIN_MONTOS",
      `El año ${anio} no tiene montos de matrícula y pensión. Configúralos en «Montos del año» antes de matricular.`,
      422,
    ),
  estudianteNoEncontrado: () =>
    new ErrorApp("ESTUDIANTE_NO_ENCONTRADO", "El estudiante no existe o ya no está activo.", 404),
  noEncontrada: () => new ErrorApp("MATRICULA_NO_ENCONTRADA", "La matrícula no existe.", 404),

  // ---------- Anulación (US18, M-19) y cronograma (US21) ----------
  noAnulable: (estado: string) =>
    new ErrorApp(
      "MATRICULA_NO_ANULABLE",
      `Solo se anula una matrícula «En proceso» o «Matriculado». Esta está «${estado}».`,
      409,
    ),
  conPagos: (pagos: number) =>
    new ErrorApp(
      "MATRICULA_CON_PAGOS",
      "No se puede anular esta matrícula: primero anula los pagos confirmados de esta matrícula.",
      409,
      { pagos },
    ),
};
