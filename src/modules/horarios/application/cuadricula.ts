// horarios/application: cuadrícula semanal de una sección (US27, RF22, pantalla AD-13). 5 días por los bloques del
// año, con las clases de la versión en edición (o de la publicada), el avance frente al plan de estudios y lo que
// falta para publicar. Los nombres de cursos, docentes y aulas se piden a sus módulos dueños.
import type { Tx } from "@/platform/db/tipos";
import { obtenerParametro } from "@/platform/config/parametros";
import { errores } from "@/platform/http/errores";
import {
  asignacionesDeClases,
  aulasPorId,
  planDeSeccion,
  seccionParaHorario,
  type CursoDeSeccion,
  type SeccionParaHorario,
} from "@/modules/academico";
import { docentesProviderComunidad } from "@/modules/comunidad";
import {
  avancePorCurso,
  borradorDe,
  pendientesDePublicar,
  resumenAvance,
  versionVigente,
  type ClaseAsignada,
  type Pendientes,
} from "../domain/publicacion";
import { leerJornada, motivoSoloLectura } from "../domain/reglas";
import { DIAS, etiquetaSeccion, type Bloque, type Dia, type EstadoHorario } from "../domain/tipos";
import { bloques, clases, horarios, type ClaseFila, type HorarioFila } from "../infrastructure/repositorio";

/** Clave del parámetro de la institución con la jornada por defecto (seed). */
const PARAMETRO_JORNADA = "BLOQUES_HORARIO";

export interface DocenteDeClase {
  id: string;
  nombreCompleto: string;
  nombreCorto: string;
}

export interface ClaseVista {
  id: string;
  dia: Dia;
  bloqueId: string;
  curso: { id: string; codigo: string; nombre: string };
  docente: DocenteDeClase;
  aula: { id: string; nombre: string };
  seccion: { id: string; etiqueta: string };
  /** false si el docente dejó de tener asignado el curso después de armar el horario. */
  asignacionActiva: boolean;
}

export interface VersionVista {
  id: string;
  version: number;
  estado: EstadoHorario;
  publicadoEn: string | null;
}

export interface CursoDelHorario {
  cursoId: string;
  codigo: string;
  nombre: string;
  horasSemanales: number;
  asignados: number;
  faltan: number;
  sobran: number;
  /** Docente con el curso asignado en la sección (US14); null si aún no tiene. */
  docente: DocenteDeClase | null;
}

export interface SeccionVista {
  id: string;
  nombre: string;
  etiqueta: string;
  estado: string;
  grado: { id: string; numero: number; nombre: string };
  aula: { id: string; nombre: string } | null;
  anio: { id: string; anio: number; estado: string };
}

export interface CuadriculaVista {
  seccion: SeccionVista;
  /** false: la sección no es del periodo académico activo o está inactiva (US27, criterio 3). */
  editable: boolean;
  motivoSoloLectura: string | null;
  dias: readonly Dia[];
  bloques: Bloque[];
  /** Versión que se muestra: el borrador en edición, la publicada o la que se pidió; null si no hay horario. */
  horario: VersionVista | null;
  /** Hay un borrador en edición (con o sin una versión publicada). */
  hayBorrador: boolean;
  versiones: VersionVista[];
  clases: ClaseVista[];
  plan: CursoDelHorario[];
  avance: { asignados: number; requeridos: number };
  pendientes: Pendientes;
}

export async function cargarSeccion(seccionId: string, tx?: Tx): Promise<SeccionParaHorario> {
  const seccion = await seccionParaHorario(seccionId, tx);
  if (!seccion) throw errores.noEncontrado("La sección");
  return seccion;
}

export const vistaSeccion = (s: SeccionParaHorario): SeccionVista => ({
  id: s.id,
  nombre: s.nombre,
  etiqueta: etiquetaSeccion(s),
  estado: s.estado,
  grado: s.grado,
  aula: s.aula,
  anio: s.anio,
});

const sinAnio = ({ id, orden, horaInicio, horaFin, tipo, etiqueta }: Bloque): Bloque => ({
  id,
  orden,
  horaInicio,
  horaFin,
  tipo,
  etiqueta,
});

/**
 * Catálogo de bloques del año. La primera vez se crea con la jornada por defecto del parámetro BLOQUES_HORARIO
 * (editar el catálogo no es parte de este sprint).
 */
export async function bloquesDelAnio(anioAcademicoId: string, tx?: Tx): Promise<Bloque[]> {
  const existentes = await bloques.delAnio(anioAcademicoId, tx);
  if (existentes.length) return existentes.map(sinAnio);
  const jornada = leerJornada(await obtenerParametro(PARAMETRO_JORNADA, anioAcademicoId));
  await bloques.crearVarios(anioAcademicoId, jornada, tx);
  return (await bloques.delAnio(anioAcademicoId, tx)).map(sinAnio);
}

export const vistaVersion = (h: HorarioFila): VersionVista => ({
  id: h.id,
  version: h.version,
  estado: h.estado,
  publicadoEn: h.publicadoEn?.toISOString() ?? null,
});

async function docentesPorId(ids: string[]): Promise<Map<string, DocenteDeClase>> {
  const unicos = [...new Set(ids)];
  const lista = unicos.length ? await docentesProviderComunidad.docentesPorId(unicos) : [];
  return new Map(lista.map((d) => [d.id, { id: d.id, nombreCompleto: d.nombreCompleto, nombreCorto: d.nombreCorto }]));
}

/** Clases con los nombres de su curso, docente, aula y sección. */
export async function vistasDeClases(filas: ClaseFila[], tx?: Tx): Promise<ClaseVista[]> {
  if (filas.length === 0) return [];
  // una tras otra: dentro de una transacción las consultas comparten la conexión
  const asignaciones = await asignacionesDeClases(
    filas.map((f) => f.asignacionDocenteId),
    tx,
  );
  const aulas = await aulasPorId(
    filas.map((f) => f.aulaId),
    tx,
  );
  const docentes = await docentesPorId(filas.map((f) => f.docenteId));
  return filas.map((f) => {
    const asignacion = asignaciones.find((a) => a.id === f.asignacionDocenteId)!;
    const aula = aulas.find((a) => a.id === f.aulaId)!;
    return {
      id: f.id,
      dia: f.dia,
      bloqueId: f.bloqueId,
      curso: asignacion.curso,
      docente: docentes.get(f.docenteId) ?? { id: f.docenteId, nombreCompleto: "Docente", nombreCorto: "Docente" },
      aula: { id: aula.id, nombre: aula.nombre },
      seccion: { id: asignacion.seccion.id, etiqueta: etiquetaSeccion(asignacion.seccion) },
      asignacionActiva: asignacion.activo,
    };
  });
}

export const clasesAsignadas = (vistas: ClaseVista[]): ClaseAsignada[] =>
  vistas.map((c) => ({
    dia: c.dia,
    bloqueId: c.bloqueId,
    cursoId: c.curso.id,
    cursoNombre: c.curso.nombre,
    asignacionActiva: c.asignacionActiva,
  }));

export const cursosDelPlan = (plan: CursoDeSeccion[]) =>
  plan.map((p) => ({ cursoId: p.curso.id, nombre: p.curso.nombre, horasSemanales: p.horasSemanales }));

/**
 * Cuadrícula de la sección (US27). Sin `version` muestra el borrador en edición o, si no hay, la versión
 * publicada; con `version`, esa versión (las archivadas son de solo lectura).
 */
export async function obtenerCuadricula(seccionId: string, version?: number): Promise<CuadriculaVista> {
  const seccion = await cargarSeccion(seccionId);
  const [delAnio, versiones, plan] = await Promise.all([
    bloquesDelAnio(seccion.anio.id),
    horarios.deSeccion(seccionId),
    planDeSeccion(seccion),
  ]);
  const mostrada = version === undefined ? versionVigente(versiones) : versiones.find((v) => v.version === version);
  if (version !== undefined && !mostrada) throw errores.noEncontrado("La versión del horario");
  const vistas = mostrada ? await vistasDeClases(await clases.delHorario(mostrada.id)) : [];
  const asignadas = clasesAsignadas(vistas);
  const cursos = cursosDelPlan(plan);
  const avance = avancePorCurso(cursos, asignadas);
  const docentes = await docentesPorId(plan.flatMap((p) => (p.asignacion ? [p.asignacion.docenteId] : [])));
  const motivo = motivoSoloLectura({ estado: seccion.estado, anioEstado: seccion.anio.estado });

  return {
    seccion: vistaSeccion(seccion),
    editable: motivo === null,
    motivoSoloLectura: motivo?.message ?? null,
    dias: DIAS,
    bloques: delAnio,
    horario: mostrada ? vistaVersion(mostrada) : null,
    hayBorrador: borradorDe(versiones) !== null,
    versiones: versiones.map(vistaVersion).reverse(),
    clases: vistas,
    plan: avance.map((c) => {
      const delPlan = plan.find((p) => p.curso.id === c.cursoId);
      return {
        ...c,
        codigo: delPlan?.curso.codigo ?? vistas.find((v) => v.curso.id === c.cursoId)?.curso.codigo ?? "",
        docente: delPlan?.asignacion ? (docentes.get(delPlan.asignacion.docenteId) ?? null) : null,
      };
    }),
    avance: resumenAvance(avance),
    pendientes: pendientesDePublicar(cursos, asignadas, delAnio),
  };
}

export interface OcupacionVista {
  /** Docentes de la sección que ya tienen clase en otra sección en ese día y bloque, y en cuál. */
  docentes: { docenteId: string; seccion: string }[];
  /** Aulas que otra sección ocupa en ese día y bloque, y cuál. */
  aulas: { aulaId: string; seccion: string }[];
}

/**
 * Qué docentes y aulas están ocupados por OTRAS secciones en un día y bloque (M-06: «Ocupado · 4° A» y «Aula
 * disponible en este bloque»). Es una ayuda para elegir: la validación definitiva ocurre al guardar.
 */
export async function ocupacionDelBloque(seccionId: string, dia: Dia, bloqueId: string): Promise<OcupacionVista> {
  await cargarSeccion(seccionId);
  const otras = (await clases.ocupacionesDelBloque(dia, bloqueId)).filter((o) => o.seccionId !== seccionId);
  const etiquetas = new Map<string, string>();
  for (const id of new Set(otras.map((o) => o.seccionId))) {
    const s = await seccionParaHorario(id);
    if (s) etiquetas.set(id, etiquetaSeccion(s));
  }
  const unicos = <T extends { seccion: string }>(lista: T[], clave: (t: T) => string) =>
    lista.filter((x, i) => lista.findIndex((y) => clave(y) === clave(x)) === i);
  return {
    docentes: unicos(
      otras.map((o) => ({ docenteId: o.docenteId, seccion: etiquetas.get(o.seccionId) ?? "" })),
      (d) => d.docenteId,
    ),
    aulas: unicos(
      otras.map((o) => ({ aulaId: o.aulaId, seccion: etiquetas.get(o.seccionId) ?? "" })),
      (a) => a.aulaId,
    ),
  };
}
