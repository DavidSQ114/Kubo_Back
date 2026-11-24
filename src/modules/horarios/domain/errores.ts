// horarios/domain: errores del módulo (US27 cuadrícula, US28 asignación, US29 cruce de docente, US30 cruce de aula,
// US31 publicación y, en erroresAsistencia, US35 toma de asistencia y US36 plazo de corrección). Los mensajes entre
// comillas son los del Product Backlog v3.3.
import { ErrorApp } from "@/platform/http/errores";
import { describirBloque, type Dia, type EstadoHorario } from "./tipos";

/** Dónde está la clase que choca: sección, día y bloque (US29 y US30, criterio 3). */
export interface DetalleCruce {
  seccion: { id: string; etiqueta: string };
  dia: Dia;
  bloque: { id: string; horaInicio: string; horaFin: string };
  /** La clase que choca está en el borrador en edición o en la versión publicada de esa sección. */
  estadoHorario: EstadoHorario;
}

export interface CursoPendiente {
  cursoId: string;
  nombre: string;
  horasSemanales: number;
  asignados: number;
  faltan: number;
}

export interface CursoExcedido {
  cursoId: string;
  nombre: string;
  horasSemanales: number;
  asignados: number;
  sobran: number;
}

export interface BloqueLibre {
  dia: Dia;
  bloqueId: string;
  horaInicio: string;
  horaFin: string;
}

export const erroresHorarios = {
  /** No hay horario publicado que descargar en PDF (US66, criterio 2). */
  horarioNoPublicado: () =>
    new ErrorApp("HORARIO_NO_PUBLICADO", "El horario aún no ha sido publicado por la institución.", 422),
  seccionFueraDelAnioActivo: () =>
    new ErrorApp("SECCION_FUERA_DE_ANIO_ACTIVO", "Esta sección no pertenece al periodo académico activo", 422),
  seccionInactiva: () =>
    new ErrorApp("SECCION_INACTIVA", "La sección está inactiva: su horario no se puede editar.", 422),
  jornadaNoConfigurada: () =>
    new ErrorApp(
      "JORNADA_NO_CONFIGURADA",
      "Aún no están configurados los bloques horarios de la jornada escolar. Comunícate con soporte.",
      422,
    ),
  claseIncompleta: () => new ErrorApp("CLASE_INCOMPLETA", "Debe completar curso, docente y aula antes de guardar", 400),
  bloqueDeRecreo: () => new ErrorApp("BLOQUE_DE_RECREO", "El recreo no admite clases.", 422),
  cursoFueraDelPlan: () =>
    new ErrorApp("CURSO_FUERA_DEL_PLAN", "El curso seleccionado no está en el plan de estudios de la sección.", 422),
  docenteSinCurso: () => new ErrorApp("DOCENTE_SIN_CURSO", "Este docente no tiene asignado el curso seleccionado", 422),
  aulaInactiva: () => new ErrorApp("AULA_INACTIVA", "El aula seleccionada está inactiva.", 422),
  cruceDocente: (cruce: DetalleCruce) =>
    new ErrorApp(
      "CRUCE_DOCENTE",
      `Error: Cruce de Docente · ya tiene clase en ${cruce.seccion.etiqueta} ` +
        `(${describirBloque(cruce.dia, cruce.bloque)})`,
      409,
      { ...cruce },
    ),
  aulaOcupada: (aula: string, cruce: DetalleCruce) =>
    new ErrorApp(
      "AULA_OCUPADA",
      `Error: Aula Ocupada · ${aula} está asignada a ${cruce.seccion.etiqueta} ` +
        `(${describirBloque(cruce.dia, cruce.bloque)})`,
      409,
      { ...cruce, aula },
    ),
  sinCambiosPorPublicar: () =>
    new ErrorApp("SIN_CAMBIOS_POR_PUBLICAR", "No hay un borrador con cambios por publicar en esta sección.", 409),
  planSinCursos: () =>
    new ErrorApp(
      "PLAN_SIN_CURSOS",
      "No se puede publicar: el grado de la sección no tiene cursos en su plan de estudios.",
      422,
    ),
  horarioIncompleto: (cursos: CursoPendiente[], bloquesLibres: BloqueLibre[]) =>
    new ErrorApp("HORARIO_INCOMPLETO", "No se puede publicar: existen bloques horarios sin asignar", 422, {
      cursos,
      bloquesLibres,
    }),
  horarioConExceso: (cursos: CursoExcedido[]) =>
    new ErrorApp(
      "HORARIO_CON_EXCESO",
      "No se puede publicar: hay cursos con más bloques que sus horas semanales",
      422,
      { cursos },
    ),
  clasesSinDocenteVigente: (clases: BloqueLibre[]) =>
    new ErrorApp(
      "CLASES_SIN_DOCENTE_VIGENTE",
      "No se puede publicar: hay clases cuyo docente ya no tiene asignado el curso. Vuelve a asignarlas.",
      422,
      { clases },
    ),
};

/** Alumno de la lista al que le falta el estado (US35, criterio 3). */
export interface AlumnoSinMarcar {
  matriculaId: string;
  nombre: string;
}

export const erroresAsistencia = {
  claseAjena: () =>
    new ErrorApp(
      "CLASE_AJENA",
      "Esta clase no está a tu cargo: solo puedes registrar la asistencia de tus propias clases.",
      403,
    ),
  fechaFutura: () => new ErrorApp("FECHA_FUTURA", "No se puede registrar la asistencia de una fecha futura.", 422),
  soloDiaActual: () => new ErrorApp("SOLO_DIA_ACTUAL", "Solo se puede registrar la asistencia del día actual.", 422),
  diaSinClases: (mensaje: string) => new ErrorApp("DIA_SIN_CLASES", mensaje, 422),
  claseFueraDeHorario: () =>
    new ErrorApp("CLASE_FUERA_DE_HORARIO", "Esta clase no está programada para hoy en el horario publicado.", 422),
  asistenciaIncompleta: (faltantes: AlumnoSinMarcar[]) =>
    new ErrorApp("ASISTENCIA_INCOMPLETA", "Existen alumnos sin estado de asistencia registrado", 422, { faltantes }),
  alumnoFueraDeLaClase: () =>
    new ErrorApp(
      "ALUMNO_FUERA_DE_LA_CLASE",
      "La lista incluye alumnos que no pertenecen a esta clase. Vuelve a cargar la página.",
      422,
    ),
  plazoVencido: (plazoHoras: number) =>
    new ErrorApp(
      "PLAZO_CORRECCION_VENCIDO",
      `El plazo para modificar esta asistencia ha expirado (${plazoHoras} horas)`,
      422,
      { plazoHoras },
    ),
  sinCambios: () =>
    new ErrorApp("ASISTENCIA_SIN_CAMBIOS", "El nuevo estado es igual al actual: no hay nada que corregir.", 409),
};

/** Asistencia del personal docente (US32, AD-14). */
export const erroresAsistenciaDocente = {
  /** US32, criterio 3: no se registra el ingreso ni la salida de otro día (validado con la fecha de Lima). */
  soloDiaActual: () => new ErrorApp("SOLO_DIA_ACTUAL", "Solo se puede registrar la asistencia del día actual", 422),
  diaNoLectivo: (mensaje: string) => new ErrorApp("DIA_NO_LECTIVO", mensaje, 422),
  docenteNoDisponible: () =>
    new ErrorApp("DOCENTE_NO_DISPONIBLE", "El docente no existe o está inactivo: no se registra su asistencia.", 422),
  ingresoYaRegistrado: (hora: string) =>
    new ErrorApp("INGRESO_YA_REGISTRADO", `El ingreso de este docente ya se registró a las ${hora}.`, 409, { hora }),
  faltaJustificada: () =>
    new ErrorApp(
      "FALTA_YA_JUSTIFICADA",
      "La inasistencia de este docente ya está justificada: no se registra su ingreso.",
      409,
    ),
  sinIngreso: () =>
    new ErrorApp("SIN_INGRESO", "Primero registra el ingreso del docente: la salida necesita un ingreso.", 422),
  salidaYaRegistrada: (hora: string) =>
    new ErrorApp("SALIDA_YA_REGISTRADA", `La salida de este docente ya se registró a las ${hora}.`, 409, { hora }),
  salidaAntesDelIngreso: () =>
    new ErrorApp("SALIDA_ANTES_DEL_INGRESO", "La hora de salida no puede ser anterior a la de ingreso.", 422),
  noEsFalta: () => new ErrorApp("NO_ES_INASISTENCIA", "Solo se justifica un registro con estado «Inasistencia».", 422),
};
