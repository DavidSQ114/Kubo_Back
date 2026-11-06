// matricula/domain: errores del módulo (US17 matrícula «En proceso»).
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
};
