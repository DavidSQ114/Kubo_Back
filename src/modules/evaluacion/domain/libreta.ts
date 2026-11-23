// evaluacion/domain: reglas puras de la publicación de notas (US39, AD-15) y de la libreta del apoderado y del alumno
// (US46 AP-04, US51 AL-03, US66 PDF, US47 evidencias). La libreta recibe solo resultados y evidencias de registros
// PUBLICADOS (los filtra la consulta); aquí se arman los cursos de cada bimestre y se marcan los que aún no se publican.
import { erroresEvaluacion as E } from "./errores";
import type { EvidenciaVista } from "./evidencias";
import { LOGROS_NOTA, type EstadoRegistro, type LogroNota } from "./notas";

// ---------- Publicación (US39, criterio 4) ----------

/** Solo un registro CERRADO por el docente se publica; uno abierto o ya publicado se rechaza. */
export function verificarPublicable(estado: EstadoRegistro) {
  if (estado === "ABIERTO") throw E.registroNoCerrado();
  if (estado === "PUBLICADO") throw E.yaPublicado();
}

// ---------- Libreta (US46, US51) ----------

export interface CompetenciaDeLibreta {
  competenciaPlanId: string;
  codigo: string;
  nombre: string;
  /** null solo si la competencia se agregó al plan después del cierre. */
  logro: LogroNota | null;
  /** Evidencias del docente (US47); sin evidencias, la calificación no es clicable. */
  evidencias: EvidenciaVista[];
}

export interface CursoDeLibreta {
  cursoId: string;
  codigo: string;
  nombre: string;
  /** «Juan Pérez Salazar»; null si el curso aún no tiene docente. */
  docente: string | null;
  /** false: «Pendiente de publicación» (apoderado) o «Aún no publicado» (alumno), sin ninguna calificación. */
  publicado: boolean;
  publicadoEn: string | null;
  consolidado: LogroNota | null;
  competencias: CompetenciaDeLibreta[];
}

export interface CursoPublicadoEntrada {
  cursoId: string;
  codigo: string;
  nombre: string;
  docente: string | null;
  publicadoEn: Date;
  consolidado: LogroNota | null;
  competencias: { competenciaPlanId: string; codigo: string; nombre: string; orden: number }[];
  /** Logro de cada competencia, por id de competencia del plan. */
  notas: Record<string, LogroNota>;
  /** Evidencias de cada calificación, por id de competencia del plan (US47). */
  evidencias?: Record<string, EvidenciaVista[]>;
}

export interface CursoDelPlanEntrada {
  cursoId: string;
  codigo: string;
  nombre: string;
  docente: string | null;
}

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, "es");

/**
 * Cursos de un bimestre en la libreta: los publicados con sus logros y, del plan de la sección del alumno, los que aún
 * no se publican, sin notas (US46 criterio 2, US51 criterio 2). Cada curso aparece una sola vez.
 */
export function cursosDelBimestre(publicados: CursoPublicadoEntrada[], plan: CursoDelPlanEntrada[]): CursoDeLibreta[] {
  const conNotas: CursoDeLibreta[] = publicados.map((p) => ({
    cursoId: p.cursoId,
    codigo: p.codigo,
    nombre: p.nombre,
    docente: p.docente,
    publicado: true,
    publicadoEn: p.publicadoEn.toISOString(),
    consolidado: p.consolidado,
    competencias: [...p.competencias]
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({
        competenciaPlanId: c.competenciaPlanId,
        codigo: c.codigo,
        nombre: c.nombre,
        logro: p.notas[c.competenciaPlanId] ?? null,
        evidencias: p.notas[c.competenciaPlanId] ? (p.evidencias?.[c.competenciaPlanId] ?? []) : [],
      })),
  }));
  const yaPublicados = new Set(conNotas.map((c) => c.cursoId));
  const pendientes: CursoDeLibreta[] = plan
    .filter((c) => !yaPublicados.has(c.cursoId))
    .map((c) => ({ ...c, publicado: false, publicadoEn: null, consolidado: null, competencias: [] }));
  return [...conNotas, ...pendientes].sort(porNombre);
}

export const ESTADOS_BIMESTRE_LIBRETA = ["PUBLICADO", "PARCIAL", "PENDIENTE", "NO_INICIADO"] as const;
/** PUBLICADO: todos sus cursos; PARCIAL: algunos; PENDIENTE: ninguno; NO_INICIADO: aún no empieza y nada publicado. */
export type EstadoBimestreLibreta = (typeof ESTADOS_BIMESTRE_LIBRETA)[number];

export function estadoDelBimestre(
  bimestre: { fechaInicio: string },
  cursos: Pick<CursoDeLibreta, "publicado">[],
  hoy: string,
): EstadoBimestreLibreta {
  const publicados = cursos.filter((c) => c.publicado).length;
  if (publicados === 0) return bimestre.fechaInicio > hoy ? "NO_INICIADO" : "PENDIENTE";
  return publicados === cursos.length ? "PUBLICADO" : "PARCIAL";
}

export type ResumenDeLogros = Record<LogroNota, number>;

/** Cursos por logro consolidado en el bimestre («Resumen del bimestre» de AP-04): solo los publicados. */
export function resumenDeLogros(cursos: Pick<CursoDeLibreta, "publicado" | "consolidado">[]): ResumenDeLogros {
  const resumen = Object.fromEntries(LOGROS_NOTA.map((l) => [l, 0])) as ResumenDeLogros;
  for (const c of cursos) if (c.publicado && c.consolidado) resumen[c.consolidado] += 1;
  return resumen;
}

/**
 * Bimestre que se abre por defecto: el último con algún curso publicado; si aún no hay, el último que ya empezó; si
 * el año no empezó, el primero.
 */
export function bimestrePorDefecto<T extends { numero: number; fechaInicio: string; estado: EstadoBimestreLibreta }>(
  bimestres: T[],
  hoy: string,
): T | null {
  const orden = [...bimestres].sort((a, b) => a.numero - b.numero);
  const conPublicados = orden.filter((b) => b.estado === "PUBLICADO" || b.estado === "PARCIAL");
  if (conPublicados.length) return conPublicados.at(-1)!;
  return orden.filter((b) => b.fechaInicio <= hoy).at(-1) ?? orden[0] ?? null;
}

/** La libreta en PDF solo se genera con al menos un curso publicado en el bimestre (US66, criterio 1). */
export function verificarLibretaDescargable(cursos: Pick<CursoDeLibreta, "publicado">[]) {
  if (!cursos.some((c) => c.publicado)) throw E.sinNotasPublicadas();
}

const soloLetras = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "");

/** «Libreta_BimestreII_2026_ValeriaQuispe.pdf»: sin tildes ni espacios, para cualquier sistema de archivos. */
export function nombreArchivoLibreta(d: { bimestre: string; anio: number; nombres: string; apellidos: string }) {
  const nombre = `${d.nombres.trim().split(" ")[0]}${d.apellidos.trim().split(" ")[0]}`;
  return `Libreta_${soloLetras(d.bimestre)}_${d.anio}_${soloLetras(nombre)}.pdf`;
}

/** Nombre de cada logro de la escala para la leyenda y el PDF (CNEB). */
export const NOMBRE_LOGRO: Record<LogroNota, string> = {
  AD: "Logro destacado",
  A: "Logro esperado",
  B: "En proceso",
  C: "En inicio",
};
