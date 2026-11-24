// aula-virtual/domain: errores del aula virtual (US61 materiales, US62 enlaces de clase virtual, US67 acceso del
// alumno). Los mensajes entre comillas son los del encargo del sprint 4.
import { ErrorApp } from "@/platform/http/errores";

/** US62: una URL que no es http ni https (o no es una URL) no se guarda. */
export const MENSAJE_ENLACE_INVALIDO = "Ingresa un enlace válido";

/** US61: el formato no está entre los permitidos (el tipo real se decide por el contenido del archivo). */
export const MENSAJE_FORMATO_MATERIAL = "Formato no permitido. Sube un PDF, PPTX, DOCX, XLSX o una imagen JPG o PNG.";

/** US61: el archivo pesa más de 5 MB. */
export const MENSAJE_TAMANO_MATERIAL = "El archivo supera el tamaño máximo de 5 MB. Elige un archivo más liviano.";

export const erroresAulaVirtual = {
  enlaceInvalido: () => new ErrorApp("ENLACE_INVALIDO", MENSAJE_ENLACE_INVALIDO, 400),
  fechasEnlace: () =>
    new ErrorApp("FECHAS_ENLACE_INVALIDAS", "La fecha y hora de fin debe ser posterior a la de inicio.", 400),
  anioNoEnCurso: () =>
    new ErrorApp(
      "ANIO_NO_EN_CURSO",
      "Solo puedes gestionar el aula virtual de los cursos del año académico en curso.",
      422,
    ),
  unidadNoEncontrada: () => new ErrorApp("NO_ENCONTRADO", "La unidad didáctica no existe.", 404),
  unidadInactiva: () =>
    new ErrorApp("UNIDAD_INACTIVA", "La unidad está desactivada. Actívala o elige otra unidad.", 422),
  materialNoEncontrado: () => new ErrorApp("NO_ENCONTRADO", "El material no existe.", 404),
  materialYaPublicado: () => new ErrorApp("MATERIAL_YA_PUBLICADO", "El material ya está publicado.", 409),
  materialNoPublicado: () => new ErrorApp("MATERIAL_NO_PUBLICADO", "Solo se puede ocultar un material publicado.", 409),
  materialSinArchivo: () =>
    new ErrorApp("ARCHIVO_REQUERIDO", "Elige el archivo del material o cambia el tipo a «Enlace».", 400),
  enlaceNoEncontrado: () => new ErrorApp("NO_ENCONTRADO", "El enlace no existe.", 404),
  enlaceYaVisible: () => new ErrorApp("ENLACE_YA_VISIBLE", "El enlace ya está visible para los alumnos.", 409),
  enlaceYaOculto: () => new ErrorApp("ENLACE_YA_OCULTO", "El enlace ya está oculto para los alumnos.", 409),
  cursoNoEncontrado: () => new ErrorApp("NO_ENCONTRADO", "El curso no existe en tu sección.", 404),
};
