// academico/domain: errores del módulo (US06 año académico, US07 periodos de evaluación).
import { ErrorApp } from "@/platform/http/errores";
import { fechaCorta, NOMBRE_ESTADO_ANIO, type EstadoAnio, type RangoFechas } from "./tipos";

export const erroresAcademico = {
  fechasInvalidas: () =>
    new ErrorApp("FECHAS_INVALIDAS", "La fecha de fin debe ser posterior a la fecha de inicio", 400),
  anioSolapado: () => new ErrorApp("ANIO_SOLAPADO", "Ya existe un año académico activo en ese rango de fechas", 409),
  anioNoCoincide: () => new ErrorApp("ANIO_NO_COINCIDE", "El año debe coincidir con la fecha de inicio", 400),
  anioDuplicado: (anio: number) => new ErrorApp("ANIO_DUPLICADO", `Ya existe el año académico ${anio}.`, 409),
  otroAnioEnCurso: () =>
    new ErrorApp(
      "ANIO_EN_CURSO_EXISTENTE",
      "Ya hay otro año académico en curso. Pásalo a cierre antes de iniciar las clases de este año.",
      409,
    ),
  transicionNoPermitida: (actual: EstadoAnio, destino: EstadoAnio) =>
    new ErrorApp(
      "TRANSICION_NO_PERMITIDA",
      `No se puede pasar de «${NOMBRE_ESTADO_ANIO[actual]}» a «${NOMBRE_ESTADO_ANIO[destino]}». ` +
        "Los estados solo avanzan, de uno en uno.",
      422,
      { actual, destino },
    ),
  notasSinPublicar: () =>
    new ErrorApp("NOTAS_SIN_PUBLICAR", "No se puede cerrar el año: existen notas sin publicar", 422),
  anioCerrado: () => new ErrorApp("ANIO_CERRADO", "El año académico está cerrado y ya no se puede modificar.", 422),
  periodosIncompletos: () =>
    new ErrorApp("PERIODOS_INCOMPLETOS", "Registra los 4 bimestres, del I al IV, sin repetir ninguno.", 400),
  periodoFechasInvalidas: (nombre: string) =>
    new ErrorApp("FECHAS_INVALIDAS", `${nombre}: la fecha de fin debe ser posterior a la fecha de inicio`, 400),
  periodoFueraDelAnio: (nombre: string, anio: RangoFechas) =>
    new ErrorApp(
      "PERIODO_FUERA_DEL_ANIO",
      `El ${nombre} debe estar dentro del año académico (del ${fechaCorta(anio.fechaInicio)} al ${fechaCorta(anio.fechaFin)}).`,
      422,
    ),
  periodosSolapados: () => new ErrorApp("PERIODOS_SOLAPADOS", "Los periodos de evaluación no pueden solaparse", 422),
  periodosDesordenados: () => new ErrorApp("PERIODOS_DESORDENADOS", "Los bimestres deben registrarse en orden", 422),
  periodoFinalizado: (nombre: string) =>
    new ErrorApp("PERIODO_FINALIZADO", `No se puede editar el ${nombre} porque ya está finalizado.`, 422),
  periodosFueraDelNuevoRango: () =>
    new ErrorApp(
      "PERIODOS_FUERA_DEL_ANIO",
      "Los bimestres registrados quedarían fuera de las nuevas fechas del año. Ajusta primero los bimestres.",
      422,
    ),
};
