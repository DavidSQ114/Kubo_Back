/** Rutas previstas de la API v1 (sin prefijo `/api/v1`). El backend aún no expone la mayoría. */

export const API = {
  portal: {
    adminResumen: "/portal/admin/resumen",
    docenteResumen: "/portal/docente/resumen",
  },
  academico: {
    anios: "/academico/anios-academicos",
    periodos: "/academico/periodos-evaluacion",
    grados: "/academico/grados",
    secciones: "/academico/secciones",
    aulas: "/academico/aulas",
    cursos: "/academico/cursos",
    competencias: "/academico/competencias",
    catalogoOficial: "/academico/catalogo-oficial",
    reglasConsolidacion: "/academico/reglas-consolidacion",
  },
  matricula: {
    matriculas: "/matricula/matriculas",
  },
  tesoreria: {
    conceptos: "/matricula/conceptos-cobro",
    morosidad: "/matricula/morosidad",
  },
  horarios: {
    matriz: "/horarios/matriz",
    asistenciaDocente: "/horarios/asistencia-docente",
  },
  evaluacion: {
    notas: "/evaluacion/notas",
    rectificaciones: "/evaluacion/solicitudes-rectificacion",
  },
  auditoria: {
    registros: "/platform/auditoria/registros",
  },
  horariosDocente: {
    miHorario: "/horarios/docente/mi-horario",
    asistencia: "/horarios/docente/asistencia",
  },
  evaluacionDocente: {
    registroNotas: "/evaluacion/docente/registro-notas",
  },
  aulaVirtual: {
    misCursos: "/aula-virtual/docente/cursos",
    trabajos: "/aula-virtual/docente/trabajos",
    entregas: "/aula-virtual/docente/entregas",
  },
  comunidad: {
    docentes: "/comunidad/docentes",
    apoderados: "/comunidad/apoderados",
    estudiantes: "/comunidad/estudiantes",
  },
} as const;
