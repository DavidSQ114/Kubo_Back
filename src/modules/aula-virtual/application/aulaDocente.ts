// aula-virtual/application: «Aula virtual» del docente (DO-05). Sus cursos y secciones del año en curso y, de uno de
// ellos, las unidades didácticas, los materiales de estudio (US61) y los enlaces de clase virtual (US62) en cualquier
// estado: el docente ve también sus borradores, los ocultos y las unidades desactivadas.
import { listarAnios, listarAsignaciones } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import { enlaces, materiales, unidades } from "../infrastructure/repositorio";
import { asignacionDelDocente, docenteEnSesion, etiquetaDe } from "./contexto";
import {
  vistaDeEnlace,
  vistaDeMaterial,
  vistaDeUnidad,
  type EnlaceVista,
  type MaterialVista,
  type UnidadVista,
} from "./vistas";

export interface CursoDelAula {
  asignacionId: string;
  curso: { id: string; codigo: string; nombre: string };
  seccion: { id: string; nombre: string };
  /** «3° B». */
  etiqueta: string;
}

export interface CursosDelAula {
  /** Año EN_CURSO; null si no hay uno. */
  anio: { id: string; anio: number } | null;
  cursos: CursoDelAula[];
}

/** Cursos y secciones del docente en sesión en el año en curso (sus asignaciones activas, US14). */
export async function cursosDelAula(auth: Autenticado): Promise<CursosDelAula> {
  const docente = await docenteEnSesion(auth);
  const anio = (await listarAnios()).find((a) => a.estado === "EN_CURSO");
  if (!anio) return { anio: null, cursos: [] };
  const cursos = (await listarAsignaciones(docente.id, anio.id))
    .map((a) => ({
      asignacionId: a.id,
      curso: a.curso,
      seccion: a.seccion,
      etiqueta: etiquetaDe({ nombre: a.seccion.nombre, grado: a.grado }),
    }))
    .sort((a, b) => a.curso.nombre.localeCompare(b.curso.nombre, "es") || a.etiqueta.localeCompare(b.etiqueta, "es"));
  return { anio: { id: anio.id, anio: anio.anio }, cursos };
}

export interface AulaDelDocente {
  asignacionId: string;
  curso: { id: string; codigo: string; nombre: string };
  seccion: { id: string; nombre: string; etiqueta: string };
  anio: { id: string; anio: number };
  /** Año EN_CURSO: se puede crear, publicar, ocultar y eliminar. */
  editable: boolean;
  unidades: UnidadVista[];
  materiales: MaterialVista[];
  enlaces: EnlaceVista[];
}

/** Aula de un curso y sección del docente en sesión: unidades, materiales y enlaces en cualquier estado. */
export async function aulaDelDocente(
  auth: Autenticado,
  asignacionId: string,
  ahora: Date = new Date(),
): Promise<AulaDelDocente> {
  const a = await asignacionDelDocente(auth, asignacionId, { escritura: false });
  const [listaUnidades, listaMateriales, listaEnlaces] = await Promise.all([
    unidades.deAsignacion(a.id),
    materiales.deAsignacion(a.id),
    enlaces.deAsignacion(a.id),
  ]);
  return {
    asignacionId: a.id,
    curso: a.curso,
    seccion: { id: a.seccion.id, nombre: a.seccion.nombre, etiqueta: etiquetaDe(a.seccion) },
    anio: { id: a.anio.id, anio: a.anio.anio },
    editable: a.anio.estado === "EN_CURSO",
    unidades: listaUnidades.map(vistaDeUnidad),
    materiales: listaMateriales.map(vistaDeMaterial),
    enlaces: listaEnlaces.map((e) => vistaDeEnlace(e, ahora)),
  };
}
