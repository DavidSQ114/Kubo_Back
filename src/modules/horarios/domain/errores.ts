// horarios/domain: errores del módulo (US27 cuadrícula, US28 asignación, US29 cruce de docente, US30 cruce de aula,
// US31 publicación). Los mensajes entre comillas son los del Product Backlog v3.3.
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
