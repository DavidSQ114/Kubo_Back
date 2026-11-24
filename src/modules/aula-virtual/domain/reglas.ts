// aula-virtual/domain: reglas puras del aula virtual (DO-05, AL-05, M-16 y M-17). Formatos y visibilidad de los
// materiales de estudio (US61), URL y estado calculado de los enlaces de clase virtual (US62), orden de las unidades
// didácticas y lo que ve el alumno de su curso (US67). Sin Prisma ni Next.js.
import type { TipoArchivo } from "@/platform/archivos/reglas";
import { erroresAulaVirtual as E } from "./errores";

// ---------- Materiales de estudio (US61) ----------

export const TIPOS_FORMATO = ["PDF", "PPTX", "DOCX", "XLSX", "IMAGEN", "ENLACE"] as const;
export type TipoFormato = (typeof TIPOS_FORMATO)[number];

export const ESTADOS_VISIBILIDAD = ["BORRADOR", "PUBLICADO", "OCULTO"] as const;
export type EstadoVisibilidad = (typeof ESTADOS_VISIBILIDAD)[number];

/** Archivos que acepta el material (el tipo real se decide por los primeros bytes en platform/archivos). */
export const ARCHIVOS_MATERIAL = ["PDF", "PPTX", "DOCX", "XLSX", "JPG", "PNG"] as const satisfies TipoArchivo[];

/** Carpeta de los materiales en el almacén de archivos (clave materiales/<uuid>). */
export const AREA_MATERIALES = "materiales";

export const LARGO_MAXIMO_TITULO = 150;
/** Largo máximo de una URL que se guarda (la de una clase virtual o la de un material tipo enlace). */
export const LARGO_MAXIMO_URL = 2000;

/** Formato con el que se guarda el material según el tipo real del archivo: JPG y PNG son «IMAGEN». */
export function formatoDeArchivo(tipo: TipoArchivo): Exclude<TipoFormato, "ENLACE"> {
  return tipo === "JPG" || tipo === "PNG" ? "IMAGEN" : tipo;
}

/** Estado con el que se guarda un material nuevo: «Visible para los alumnos» lo publica; si no, queda en borrador. */
export const estadoInicial = (visible: boolean): EstadoVisibilidad => (visible ? "PUBLICADO" : "BORRADOR");

/** Publicar: un borrador o un material oculto pasa a PUBLICADO; uno ya publicado no cambia (409). */
export function verificarPublicable(estado: EstadoVisibilidad) {
  if (estado === "PUBLICADO") throw E.materialYaPublicado();
}

/** Ocultar: solo un material PUBLICADO pasa a OCULTO (un borrador nunca fue visible). */
export function verificarOcultable(estado: EstadoVisibilidad) {
  if (estado !== "PUBLICADO") throw E.materialNoPublicado();
}

/**
 * El alumno ve un material solo si está PUBLICADO y su unidad existe y está activa (US61 criterio 3 y US67): los
 * borradores, los ocultos y los de una unidad desactivada no aparecen ni se descargan.
 */
export function materialVisibleParaAlumno(m: { estado: EstadoVisibilidad; unidadActiva: boolean | null }): boolean {
  return m.estado === "PUBLICADO" && m.unidadActiva === true;
}

// ---------- URL (US61 material tipo enlace, US62) ----------

/**
 * URL absoluta http o https, sin espacios y con dominio. Devuelve la URL normalizada; si no lo es, 400 ENLACE_INVALIDO
 * con «Ingresa un enlace válido» (javascript:, ftp:, «meet.kubo.edu.pe» sin protocolo…).
 */
export function validarUrl(texto: string): string {
  const limpio = texto.trim();
  if (!limpio || limpio.length > LARGO_MAXIMO_URL || /\s/.test(limpio)) throw E.enlaceInvalido();
  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    throw E.enlaceInvalido();
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname.includes(".")) {
    throw E.enlaceInvalido();
  }
  return url.toString();
}

// ---------- Enlaces de clase virtual (US62) ----------

export const TIPOS_ENLACE = ["CLASE_VIRTUAL", "ASESORIA", "TALLER"] as const;
export type TipoEnlace = (typeof TIPOS_ENLACE)[number];

export const NOMBRE_TIPO_ENLACE: Record<TipoEnlace, string> = {
  CLASE_VIRTUAL: "Clase virtual",
  ASESORIA: "Asesoría",
  TALLER: "Taller",
};

export const ESTADOS_ENLACE = ["PROGRAMADO", "ACTIVO", "FINALIZADO"] as const;
export type EstadoEnlace = (typeof ESTADOS_ENLACE)[number];

/** Lima no tiene horario de verano: siempre UTC−5. */
const DESFASE_LIMA = "-05:00";

/** «2026-11-24T10:00» en la hora de Lima (lo que escribe el docente en M-17) → instante en UTC. */
export function instanteDeLima(fechaHora: string): Date {
  const instante = new Date(`${fechaHora}:00.000${DESFASE_LIMA}`);
  if (Number.isNaN(instante.getTime())) throw E.fechasEnlace();
  return instante;
}

/** El fin debe ser posterior al inicio (ck_enlace_virtual_fechas en la base). */
export function verificarFechasEnlace(inicio: Date, fin: Date) {
  if (fin.getTime() <= inicio.getTime()) throw E.fechasEnlace();
}

/**
 * Estado del enlace, calculado en el servidor con la hora actual (US62): «Programado» antes del inicio, «Activo» desde
 * el inicio exacto y hasta antes del fin, «Finalizado» desde el fin exacto. Comparar instantes da lo mismo en
 * cualquier zona; la hora de Lima solo importa al leer lo que escribe el docente (`instanteDeLima`).
 */
export function estadoEnlace(inicio: Date, fin: Date, ahora: Date): EstadoEnlace {
  if (ahora.getTime() < inicio.getTime()) return "PROGRAMADO";
  if (ahora.getTime() < fin.getTime()) return "ACTIVO";
  return "FINALIZADO";
}

/** Visibilidad del enlace: mostrarlo si está oculto, ocultarlo si está visible. */
export function verificarCambioVisibilidad(visibleActual: boolean, visibleNuevo: boolean) {
  if (visibleActual === visibleNuevo) throw visibleNuevo ? E.enlaceYaVisible() : E.enlaceYaOculto();
}

// ---------- Unidades didácticas ----------

export const DIRECCIONES = ["ARRIBA", "ABAJO"] as const;
export type Direccion = (typeof DIRECCIONES)[number];

/** Número de una unidad nueva: la siguiente a la mayor (las desactivadas también cuentan, nunca se reusan). */
export const siguienteNumero = (numeros: number[]) => (numeros.length ? Math.max(...numeros) : 0) + 1;

/**
 * Unidad con la que se intercambia el número al moverla hacia arriba o hacia abajo en el orden; null si ya está en
 * ese extremo (no hay nada que mover). Las unidades se ordenan por número.
 */
export function vecinaParaMover<T extends { id: string; numero: number }>(
  unidades: T[],
  id: string,
  direccion: Direccion,
): T | null {
  const orden = [...unidades].sort((a, b) => a.numero - b.numero);
  const i = orden.findIndex((u) => u.id === id);
  if (i < 0) throw E.unidadNoEncontrada();
  return orden[direccion === "ARRIBA" ? i - 1 : i + 1] ?? null;
}

// ---------- Lo que ve el alumno (US67, AL-05) ----------

export interface UnidadConMateriales<M> {
  unidad: { id: string; numero: number; titulo: string };
  materiales: M[];
}

/**
 * Materiales visibles agrupados por unidad activa, en el orden de las unidades y, dentro de cada una, del más reciente
 * al más antiguo. Las unidades sin materiales visibles no aparecen.
 */
export function agruparPorUnidad<
  M extends { unidadId: string | null; estado: EstadoVisibilidad; publicadoEn: Date | null },
>(unidades: { id: string; numero: number; titulo: string; activo: boolean }[], materiales: M[]) {
  const activas = new Map(unidades.filter((u) => u.activo).map((u) => [u.id, u]));
  const grupos: UnidadConMateriales<M>[] = [];
  for (const unidad of [...activas.values()].sort((a, b) => a.numero - b.numero)) {
    const delGrupo = materiales
      .filter((m) => m.unidadId === unidad.id && materialVisibleParaAlumno({ estado: m.estado, unidadActiva: true }))
      .sort((a, b) => (b.publicadoEn?.getTime() ?? 0) - (a.publicadoEn?.getTime() ?? 0));
    if (delGrupo.length) {
      grupos.push({ unidad: { id: unidad.id, numero: unidad.numero, titulo: unidad.titulo }, materiales: delGrupo });
    }
  }
  return grupos;
}
