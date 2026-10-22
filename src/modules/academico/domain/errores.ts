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
  // ---------- Secciones y aulas (US08, US09) ----------
  aforoInvalido: () => new ErrorApp("AFORO_INVALIDO", "El aforo debe ser un número entero mayor a 0", 400),
  nombreSeccionInvalido: () =>
    new ErrorApp("NOMBRE_SECCION_INVALIDO", "El nombre de la sección debe ser una o más letras (A, B, C…)", 400),
  seccionDuplicada: () => new ErrorApp("SECCION_DUPLICADA", "Ya existe una sección con ese nombre en este grado", 409),
  seccionConMatriculados: (matriculas: number) =>
    new ErrorApp(
      "SECCION_CON_MATRICULADOS",
      "No se puede eliminar una sección con alumnos matriculados. Puedes inactivarla para que no reciba nuevas matrículas.",
      409,
      { matriculas },
    ),
  seccionConRegistros: () =>
    new ErrorApp(
      "SECCION_CON_REGISTROS",
      "No se puede eliminar la sección porque ya tiene cursos, horarios u otros registros. Puedes inactivarla.",
      409,
    ),
  seccionSinVacantes: (matriculados: number, aforo: number) =>
    new ErrorApp("SECCION_SIN_VACANTES", `Sección sin vacantes disponibles (${matriculados}/${aforo})`, 409, {
      matriculados,
      aforo,
    }),
  seccionInactiva: () =>
    new ErrorApp("SECCION_INACTIVA", "La sección está inactiva y no recibe nuevas matrículas.", 409),
  aulaDuplicada: () => new ErrorApp("AULA_DUPLICADA", "Ya existe un aula con ese nombre", 409),
  aulaInactiva: () => new ErrorApp("AULA_INACTIVA", "El aula está inactiva. Actívala o elige otra.", 422),
  aulaEnUso: (secciones: string) =>
    new ErrorApp(
      "AULA_EN_USO",
      `El aula está asignada a ${secciones}. Quítala de esas secciones antes de inactivarla.`,
      409,
    ),
  aforoMenorQueSecciones: (maximo: number) =>
    new ErrorApp(
      "AFORO_MENOR_QUE_SECCIONES",
      `El aforo del aula no puede ser menor que el de sus secciones (máximo ${maximo}).`,
      422,
    ),
  tutorNoDisponible: () => new ErrorApp("TUTOR_NO_DISPONIBLE", "El tutor debe ser un docente activo.", 422),
};
