// Bimestre que se muestra primero en la libreta completa de un alumno (bloque M5, «Notas por alumno» del coordinador y
// del tutor): el último con alguna nota o conducta, para no abrir en el Bimestre I cuando el año ya avanzó.

interface BimestreConCursos {
  id: string;
  cursos: { estado: string }[];
  conducta?: unknown;
}

/** Id del último bimestre con notas registradas o conducta; si ninguno tiene, el primero (o null sin bimestres). */
export function bimestrePorDefecto(bimestres: BimestreConCursos[]): string | null {
  const conDatos = bimestres.filter((b) => b.conducta != null || b.cursos.some((c) => c.estado !== "SIN_REGISTRO"));
  return conDatos[conDatos.length - 1]?.id ?? bimestres[0]?.id ?? null;
}
