// academico/domain: reglas puras de cursos (US10) y de las competencias de cada plan de estudio (US11, RF09).
// Un plan de estudio es curso + grado + año, con sus horas semanales; sus competencias salen del área del curso.
import { erroresAcademico as E } from "./errores";

export const ESTADOS_CURSO = ["ACTIVO", "INACTIVO"] as const;
export type EstadoCurso = (typeof ESTADOS_CURSO)[number];

const CODIGO_CURSO = /^[A-Z0-9-]{2,12}$/;

/** " art-2 " → "ART-2". Letras, números o guiones. */
export function normalizarCodigoCurso(codigo: string): string {
  const limpio = codigo.trim().toUpperCase();
  if (!CODIGO_CURSO.test(limpio)) throw E.codigoCursoInvalido();
  return limpio;
}

/** El área curricular es obligatoria: de ella salen las competencias que se pueden evaluar. */
export function verificarArea(areaCurricularId: string | null | undefined) {
  if (!areaCurricularId) throw E.areaRequerida();
}

export interface UsoCurso {
  /** Docentes distintos con alguna asignación del curso (activa o no). */
  docentes: number;
  /** Secciones con el curso en un horario publicado. */
  seccionesConHorario: number;
}

/** Un curso asignado a docentes o en un horario publicado no se elimina: se desactiva. */
export function verificarEliminacionCurso(uso: UsoCurso) {
  if (uso.docentes > 0 || uso.seccionesConHorario > 0) throw E.cursoAsignado(uso);
}

/** El área no cambia mientras el curso tenga competencias del área actual (RF09). */
export function verificarCambioArea(areaActual: string, areaNueva: string, competenciasConfiguradas: number) {
  if (areaActual !== areaNueva && competenciasConfiguradas > 0) throw E.areaConCompetencias();
}

// ---------- Grados del curso (plan de estudio del año) ----------

export interface GradoPlan {
  gradoId: string;
  horasSemanales: number;
}

/** Grados asociados al curso en un año: cada grado una vez y con horas semanales enteras mayores a 0. */
export function verificarGradosPlan(planes: GradoPlan[]) {
  const vistos = new Set<string>();
  for (const p of planes) {
    if (!Number.isInteger(p.horasSemanales) || p.horasSemanales <= 0) throw E.horasInvalidas();
    if (vistos.has(p.gradoId)) throw E.gradoRepetido();
    vistos.add(p.gradoId);
  }
}

export interface CambiosPlanes {
  crear: GradoPlan[];
  actualizar: (GradoPlan & { planId: string })[];
  quitar: { planId: string; gradoId: string }[];
}

/** Compara los planes guardados con los pedidos: qué grados se agregan, cuáles cambian de horas y cuáles se quitan. */
export function compararPlanes(
  actuales: { planId: string; gradoId: string; horasSemanales: number }[],
  pedidos: GradoPlan[],
): CambiosPlanes {
  const porGrado = new Map(actuales.map((a) => [a.gradoId, a]));
  const pedidosIds = new Set(pedidos.map((p) => p.gradoId));
  return {
    crear: pedidos.filter((p) => !porGrado.has(p.gradoId)),
    actualizar: pedidos.flatMap((p) => {
      const a = porGrado.get(p.gradoId);
      return a && a.horasSemanales !== p.horasSemanales ? [{ ...p, planId: a.planId }] : [];
    }),
    quitar: actuales.filter((a) => !pedidosIds.has(a.gradoId)).map((a) => ({ planId: a.planId, gradoId: a.gradoId })),
  };
}

// ---------- Competencias del plan (US11) ----------

export interface CompetenciaPedida {
  competenciaId: string;
  orden?: number;
  peso?: number | null;
}

export interface CompetenciaCatalogo {
  id: string;
  areaCurricularId: string;
  activo: boolean;
}

export interface CompetenciaElegida {
  competenciaId: string;
  orden: number;
  peso: number | null;
}

/**
 * Valida las competencias pedidas para un plan y les asigna el orden (si falta, su posición en la lista).
 * Reglas: al menos una, sin repetir, todas del área del curso (RF09), peso opcional mayor a 0.
 * Una competencia desactivada en el catálogo solo puede quedarse si ya estaba en el plan.
 */
export function prepararCompetencias(
  pedidas: CompetenciaPedida[],
  areaDelCurso: string,
  catalogo: CompetenciaCatalogo[],
  yaEnElPlan: string[] = [],
): CompetenciaElegida[] {
  if (pedidas.length === 0) throw E.competenciasRequeridas();
  const porId = new Map(catalogo.map((c) => [c.id, c]));
  const vistas = new Set<string>();
  return pedidas.map((p, i) => {
    if (vistas.has(p.competenciaId)) throw E.competenciaDuplicada();
    vistas.add(p.competenciaId);
    const c = porId.get(p.competenciaId);
    if (!c || c.areaCurricularId !== areaDelCurso) throw E.competenciaFueraDelArea();
    if (!c.activo && !yaEnElPlan.includes(c.id)) throw E.competenciaInactiva();
    if (p.peso != null && !(p.peso > 0)) throw E.pesoInvalido();
    return { competenciaId: p.competenciaId, orden: p.orden ?? i + 1, peso: p.peso ?? null };
  });
}

/** Al quitar competencias del plan: ninguna puede tener notas registradas. */
export function verificarQuitarCompetencias(quitadas: { nombre: string; notas: number }[]) {
  const conNotas = quitadas.find((q) => q.notas > 0);
  if (conNotas) throw E.competenciaConNotas(conNotas.nombre, conNotas.notas);
}

/** Para registrar notas: el plan debe tener al menos una competencia configurada. */
export function verificarCompetenciasConfiguradas(competencias: unknown[]) {
  if (competencias.length === 0) throw E.cursoSinCompetencias();
}
