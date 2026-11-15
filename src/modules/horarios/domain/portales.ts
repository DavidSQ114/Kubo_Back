// horarios/domain: reglas puras de «Mi horario» en los portales (US34 docente, US48 apoderado, US50 alumno).
// Los portales solo leen la versión PUBLICADA; aquí se resume lo que el docente dicta en la semana (DO-02).

export interface ClaseDeSeccion {
  seccion: { id: string; etiqueta: string };
}

export interface ResumenDelDocente {
  /** Bloques con clase en la semana, sumando todas sus secciones publicadas. */
  bloques: number;
  /** Secciones en las que dicta, sin repetir y en orden: «2° A», «2° B», «3° A». */
  secciones: string[];
}

/**
 * Resumen del horario del docente (DO-02: «Bloques por semana» y «Secciones a cargo»). Sin clases publicadas queda
 * en cero: la pantalla muestra «Aún no tienes cursos asignados para este periodo» (US34, criterio 2).
 */
export function resumenDelDocente(clases: ClaseDeSeccion[]): ResumenDelDocente {
  const etiquetas = new Map(clases.map((c) => [c.seccion.id, c.seccion.etiqueta]));
  return {
    bloques: clases.length,
    secciones: [...etiquetas.values()].sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
  };
}
