// aula-virtual/application: aula del alumno en «Mis cursos» (US67, AL-05). Un curso de su sección con matrícula
// vigente: los materiales PUBLICADOS de las unidades activas, agrupados por unidad, y los enlaces visibles con su estado.
// La URL de un enlace solo viaja mientras está Activo («Entrar a clase»). El alumno se resuelve en el servidor
// (persona → estudiante → matrícula vigente): nunca llega un id de sección desde el navegador.
import { asignacionParaNotas, planDeSeccion, seccionParaHorario } from "@/modules/academico";
import { docentesProviderComunidad } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { matriculaVigenteDelAlumno } from "@/modules/matricula";
import { erroresAulaVirtual as E } from "../domain/errores";
import { agruparPorUnidad, type EstadoEnlace, type TipoEnlace, type TipoFormato } from "../domain/reglas";
import { enlaces, materiales, unidades } from "../infrastructure/repositorio";
import { etiquetaDe } from "./contexto";
import { vistaDeEnlace } from "./vistas";

export interface MaterialDelAlumno {
  id: string;
  titulo: string;
  tipo: TipoFormato;
  publicadoEn: string | null;
  /** Archivo que se descarga por la API; null en un material tipo enlace. */
  archivo: { nombre: string; tamanoBytes: number } | null;
  /** URL de un material tipo enlace (se abre en otra pestaña). */
  url: string | null;
}

export interface EnlaceDelAlumno {
  id: string;
  tipo: TipoEnlace;
  titulo: string;
  inicio: string;
  fin: string;
  estado: EstadoEnlace;
  /** Solo con el enlace Activo: «Entrar a clase». */
  url: string | null;
}

export interface AulaDelCurso {
  curso: { id: string; codigo: string; nombre: string };
  /** «1° A». */
  seccionCorta: string;
  docente: { nombreCompleto: string } | null;
  unidades: { unidad: { id: string; numero: number; titulo: string }; materiales: MaterialDelAlumno[] }[];
  enlaces: EnlaceDelAlumno[];
}

/** Un curso de «Mis cursos» con sus materiales y enlaces visibles (US67). Un curso ajeno a su sección responde 404. */
export async function cursoDelAlumnoEnAula(
  auth: Autenticado,
  cursoId: string,
  ahora: Date = new Date(),
): Promise<AulaDelCurso> {
  const m = await matriculaVigenteDelAlumno(auth);
  const seccion = m.seccionId ? await seccionParaHorario(m.seccionId) : null;
  if (!seccion) throw E.cursoNoEncontrado();
  const delPlan = (await planDeSeccion(seccion)).find((p) => p.curso.id === cursoId);
  if (!delPlan) throw E.cursoNoEncontrado();
  const base = { curso: delPlan.curso, seccionCorta: etiquetaDe(seccion) };
  if (!delPlan.asignacion) return { ...base, docente: null, unidades: [], enlaces: [] };

  const asignacionId = delPlan.asignacion.id;
  const [docentes, listaUnidades, publicados, visibles] = await Promise.all([
    docentesProviderComunidad.docentesPorId([delPlan.asignacion.docenteId]),
    unidades.deAsignacion(asignacionId),
    materiales.publicadosDeAsignacion(asignacionId),
    enlaces.deAsignacion(asignacionId, true),
  ]);
  return {
    ...base,
    docente: docentes[0] ? { nombreCompleto: docentes[0].nombreCompleto } : null,
    unidades: agruparPorUnidad(listaUnidades, publicados).map((g) => ({
      unidad: g.unidad,
      materiales: g.materiales.map((x) => ({
        id: x.id,
        titulo: x.titulo,
        tipo: x.tipoFormato,
        publicadoEn: x.publicadoEn?.toISOString() ?? null,
        archivo:
          x.archivoClave && x.nombreArchivo ? { nombre: x.nombreArchivo, tamanoBytes: x.tamanoBytes ?? 0 } : null,
        url: x.tipoFormato === "ENLACE" ? x.urlArchivo : null,
      })),
    })),
    enlaces: visibles.flatMap((e): EnlaceDelAlumno[] => {
      const v = vistaDeEnlace(e, ahora);
      if (!v.inicio || !v.fin || !v.estado) return [];
      return [
        {
          id: v.id,
          tipo: v.tipo,
          titulo: v.titulo,
          inicio: v.inicio,
          fin: v.fin,
          estado: v.estado,
          url: v.estado === "ACTIVO" ? v.url : null,
        },
      ];
    }),
  };
}

/**
 * El material es del curso de la sección del alumno en sesión (matrícula vigente) y su asignación sigue activa. Sin
 * matrícula vigente responde 403 SIN_MATRICULA_VIGENTE, como el resto de su portal.
 */
export async function alumnoYCursoDelMaterial(auth: Autenticado, asignacionId: string): Promise<boolean> {
  const m = await matriculaVigenteDelAlumno(auth);
  const asignacion = await asignacionParaNotas(asignacionId);
  return !!asignacion && asignacion.activo && !!m.seccionId && asignacion.seccion.id === m.seccionId;
}
