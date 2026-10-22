// academico/puertos: lo que académico necesita de módulos superiores, sin importarlos.
// evaluacion (dueño de cierre_calificacion) implementa CierresProvider y src/server/wiring.ts lo conecta.

export interface ResumenCierres {
  total: number;
  publicados: number;
}

export interface CierresProvider {
  /** Cuántos cierres de calificación tienen los periodos del año y cuántos están PUBLICADOS (US06, cerrar año). */
  resumenCierres(anioAcademicoId: string): Promise<ResumenCierres>;
}

let cierres: CierresProvider | null = null;

export function configurarCierresProvider(p: CierresProvider) {
  cierres = p;
}

export function cierresProvider(): CierresProvider {
  if (!cierres) {
    throw new Error("CierresProvider no configurado: falta importar '@/server/wiring' en la ruta");
  }
  return cierres;
}

// ---------- Matrículas (dueño: matricula) ----------

export interface MatriculasProvider {
  /** Alumnos con matrícula MATRICULADO por sección (vacantes de US08). Las secciones sin alumnos no aparecen. */
  matriculadosPorSeccion(seccionIds: string[]): Promise<Record<string, number>>;
  /** Matrículas de la sección en cualquier estado (vigentes o históricas): si hay, no se elimina. */
  matriculasDeSeccion(seccionId: string): Promise<number>;
}

let matriculas: MatriculasProvider | null = null;

export function configurarMatriculasProvider(p: MatriculasProvider) {
  matriculas = p;
}

export function matriculasProvider(): MatriculasProvider {
  if (!matriculas) {
    throw new Error("MatriculasProvider no configurado: falta importar '@/server/wiring' en la ruta");
  }
  return matriculas;
}

// ---------- Docentes (dueño: comunidad) ----------

export interface DocenteResumen {
  id: string;
  nombreCompleto: string;
  /** «M. Torres»: para tablas angostas (AD-03). */
  nombreCorto: string;
  activo: boolean;
}

export interface DocentesProvider {
  /** Docentes por id, activos o no (para mostrar el tutor y validar que esté activo). */
  docentesPorId(ids: string[]): Promise<DocenteResumen[]>;
}

let docentes: DocentesProvider | null = null;

export function configurarDocentesProvider(p: DocentesProvider) {
  docentes = p;
}

export function docentesProvider(): DocentesProvider {
  if (!docentes) {
    throw new Error("DocentesProvider no configurado: falta importar '@/server/wiring' en la ruta");
  }
  return docentes;
}
