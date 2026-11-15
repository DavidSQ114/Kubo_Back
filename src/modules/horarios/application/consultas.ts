// horarios/application: consulta del horario PUBLICADO por sección y por docente (US31, RF24). Es la base de las
// pantallas «Mi horario» de los portales (DO-02, AL-02), que llegan en el siguiente bloque del sprint.
import { errores } from "@/platform/http/errores";
import { anioPorDefecto, listarAnios } from "@/modules/academico";
import { docentesProviderComunidad } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { DIAS, type Bloque, type Dia } from "../domain/tipos";
import { clases, horarios } from "../infrastructure/repositorio";
import {
  bloquesDelAnio,
  cargarSeccion,
  vistaSeccion,
  vistaVersion,
  vistasDeClases,
  type ClaseVista,
  type SeccionVista,
  type VersionVista,
} from "./cuadricula";

export interface HorarioDeSeccion {
  seccion: SeccionVista;
  dias: readonly Dia[];
  bloques: Bloque[];
  /** Versión publicada; null si la sección aún no tiene un horario publicado (las clases van vacías). */
  horario: VersionVista | null;
  clases: ClaseVista[];
}

/** Horario publicado de una sección: nunca muestra el borrador en edición. */
export async function horarioPublicadoDeSeccion(seccionId: string): Promise<HorarioDeSeccion> {
  const seccion = await cargarSeccion(seccionId);
  const [delAnio, [publicado]] = await Promise.all([bloquesDelAnio(seccion.anio.id), horarios.publicados([seccionId])]);
  return {
    seccion: vistaSeccion(seccion),
    dias: DIAS,
    bloques: delAnio,
    horario: publicado ? vistaVersion(publicado) : null,
    clases: publicado ? await vistasDeClases(await clases.delHorario(publicado.id)) : [],
  };
}

export interface HorarioDeDocente {
  docente: { id: string; nombreCompleto: string };
  /** Año consultado; null si no hay ningún año abierto (las clases van vacías). */
  anio: { id: string; anio: number } | null;
  dias: readonly Dia[];
  bloques: Bloque[];
  /** Clases del docente en los horarios publicados de las secciones del año, cada una con su sección y aula. */
  clases: ClaseVista[];
}

/**
 * Clases del docente en los horarios publicados de un año. Sin `anioAcademicoId` usa el año por defecto (el que
 * está en curso; si no, el que está en matrícula; si no, el abierto más reciente).
 */
export async function horarioPublicadoDeDocente(
  docenteId: string,
  anioAcademicoId?: string,
): Promise<HorarioDeDocente> {
  const [docente] = await docentesProviderComunidad.docentesPorId([docenteId]);
  if (!docente) throw errores.noEncontrado("El docente");
  const anios = await listarAnios();
  const anio = anioAcademicoId ? anios.find((a) => a.id === anioAcademicoId) : anioPorDefecto(anios);
  if (anioAcademicoId && !anio) throw errores.noEncontrado("El año académico");
  const base = { docente: { id: docente.id, nombreCompleto: docente.nombreCompleto }, dias: DIAS };
  if (!anio) return { ...base, anio: null, bloques: [], clases: [] };
  const [delAnio, filas] = await Promise.all([
    bloquesDelAnio(anio.id),
    clases.publicadasDelDocente(docenteId, anio.id),
  ]);
  return { ...base, anio: { id: anio.id, anio: anio.anio }, bloques: delAnio, clases: await vistasDeClases(filas) };
}

/** «Mi horario» del docente en sesión (DO-02). Un usuario sin perfil de docente no tiene horario que ver. */
export async function miHorarioDocente(sesion: Autenticado, anioAcademicoId?: string): Promise<HorarioDeDocente> {
  const docente = await docentesProviderComunidad.docentePorPersona(sesion.personaId);
  if (!docente) throw errores.accesoDenegado();
  return horarioPublicadoDeDocente(docente.id, anioAcademicoId);
}
