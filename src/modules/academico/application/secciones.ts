// academico/application: grados y secciones del año (US08, pantalla AD-03). Vacantes para matrícula.
// El aforo de la sección frente al del aula lo valida el trigger tg_seccion_aforo_aula (AFORO_EXCEDE_AULA, 422).
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import { erroresAcademico as E } from "../domain/errores";
import {
  calcularVacantes,
  normalizarNombreSeccion,
  verificarAforo,
  verificarAnioEditable,
  verificarEliminacion,
  type EstadoSeccion,
  type Vacantes,
} from "../domain/secciones";
import { anios, aulas, grados, secciones, type GradoFila, type SeccionFila } from "../infrastructure/repositorio";
import { docentesProvider, matriculasProvider, type DocenteResumen } from "../puertos";

export interface SeccionVista {
  id: string;
  anioAcademicoId: string;
  nombre: string;
  aforoMaximo: number;
  estado: EstadoSeccion;
  grado: GradoFila;
  aula: { id: string; nombre: string; aforo: number; activo: boolean } | null;
  tutor: Omit<DocenteResumen, "activo"> | null;
  vacantes: Vacantes;
}

interface DatosSeccion {
  gradoId: string;
  nombre: string;
  aforoMaximo: number;
  aulaId?: string | null;
  tutorId?: string | null;
}

export const listarGrados = () => grados.activos();

async function vistas(filas: SeccionFila[]): Promise<SeccionVista[]> {
  const ids = filas.map((s) => s.id);
  const tutores = filas.flatMap((s) => (s.tutorId ? [s.tutorId] : []));
  const [matriculados, docentes] = await Promise.all([
    ids.length ? matriculasProvider().matriculadosPorSeccion(ids) : Promise.resolve({} as Record<string, number>),
    tutores.length ? docentesProvider().docentesPorId(tutores) : Promise.resolve([] as DocenteResumen[]),
  ]);
  return filas.map((s) => {
    const tutor = docentes.find((d) => d.id === s.tutorId);
    return {
      id: s.id,
      anioAcademicoId: s.anioAcademicoId,
      nombre: s.nombre,
      aforoMaximo: s.aforoMaximo,
      estado: s.estado,
      grado: s.grado,
      aula: s.aula && { id: s.aula.id, nombre: s.aula.nombre, aforo: s.aula.aforo, activo: s.aula.activo },
      tutor: tutor ? { id: tutor.id, nombreCompleto: tutor.nombreCompleto, nombreCorto: tutor.nombreCorto } : null,
      vacantes: calcularVacantes(matriculados[s.id] ?? 0, s.aforoMaximo),
    };
  });
}

/** Secciones del año, ordenadas por grado y nombre, con sus vacantes. */
export async function listarSecciones(anioId: string): Promise<SeccionVista[]> {
  if (!(await anios.porId(anioId))) throw errores.noEncontrado("El año académico");
  return vistas(await secciones.delAnio(anioId));
}

async function obtenerSeccion(id: string): Promise<SeccionVista> {
  const s = await secciones.porId(id);
  if (!s) throw errores.noEncontrado("La sección");
  return (await vistas([s]))[0];
}

/** Grado activo, aula activa y tutor docente activo (aula y tutor son opcionales). */
async function verificarReferencias(datos: Partial<DatosSeccion>, tx: Tx) {
  if (datos.gradoId) {
    const g = await grados.porId(datos.gradoId, tx);
    if (!g || !g.activo) throw errores.noEncontrado("El grado");
  }
  if (datos.aulaId) {
    const a = await aulas.porId(datos.aulaId, tx);
    if (!a) throw errores.noEncontrado("El aula");
    if (!a.activo) throw E.aulaInactiva();
  }
  if (datos.tutorId) {
    const [d] = await docentesProvider().docentesPorId([datos.tutorId]);
    if (!d || !d.activo) throw E.tutorNoDisponible();
  }
}

/** Nombre repetido en el mismo año y grado: índice único de seccion. */
function traducirDuplicado(e: unknown): never {
  if (esDuplicado(e, "seccion_anio_academico_id_grado_id_nombre_key")) throw E.seccionDuplicada();
  throw e;
}

const resumen = (s: SeccionFila) => ({
  grado: s.grado.numero,
  nombre: s.nombre,
  aforoMaximo: s.aforoMaximo,
  aulaId: s.aula?.id ?? null,
  tutorId: s.tutorId,
  estado: s.estado,
});

export async function crearSeccion(
  admin: Autenticado,
  datos: DatosSeccion & { anioAcademicoId: string },
  meta: MetaSolicitud,
): Promise<SeccionVista> {
  const nombre = normalizarNombreSeccion(datos.nombre);
  verificarAforo(datos.aforoMaximo);
  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      await anios.bloquearFila(tx, datos.anioAcademicoId);
      const anio = await anios.porId(datos.anioAcademicoId, tx);
      if (!anio) throw errores.noEncontrado("El año académico");
      verificarAnioEditable(anio.estado);
      await verificarReferencias(datos, tx);
      const s = await secciones.crear(
        {
          anioAcademicoId: anio.id,
          gradoId: datos.gradoId,
          nombre,
          aforoMaximo: datos.aforoMaximo,
          aulaId: datos.aulaId ?? null,
          tutorId: datos.tutorId ?? null,
        },
        tx,
      );
      await registrarAuditoria(
        tx,
        { usuarioId: admin.usuarioId, entidad: "seccion", entidadId: s.id, accion: "CREAR_SECCION", nuevo: resumen(s) },
        meta,
      );
      return s.id;
    });
  } catch (e) {
    traducirDuplicado(e);
  }
  return obtenerSeccion(id);
}

export async function editarSeccion(
  admin: Autenticado,
  id: string,
  datos: Partial<DatosSeccion>,
  meta: MetaSolicitud,
): Promise<SeccionVista> {
  const cambios = {
    ...datos,
    ...(datos.nombre !== undefined ? { nombre: normalizarNombreSeccion(datos.nombre) } : {}),
  };
  if (datos.aforoMaximo !== undefined) verificarAforo(datos.aforoMaximo);
  try {
    await prisma.$transaction(async (tx) => {
      await secciones.bloquearFila(tx, id);
      const actual = await secciones.porId(id, tx);
      if (!actual) throw errores.noEncontrado("La sección");
      const anio = await anios.porId(actual.anioAcademicoId, tx);
      verificarAnioEditable(anio!.estado);
      await verificarReferencias(cambios, tx);
      const s = await secciones.actualizar(id, cambios, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "seccion",
          entidadId: id,
          accion: "EDITAR_SECCION",
          anterior: resumen(actual),
          nuevo: resumen(s),
        },
        meta,
      );
    });
  } catch (e) {
    traducirDuplicado(e);
  }
  return obtenerSeccion(id);
}

/** INACTIVA: deja de recibir matrículas, pero conserva a sus alumnos. */
export async function cambiarEstadoSeccion(
  admin: Autenticado,
  id: string,
  estado: EstadoSeccion,
  meta: MetaSolicitud,
): Promise<SeccionVista> {
  await prisma.$transaction(async (tx) => {
    await secciones.bloquearFila(tx, id);
    const actual = await secciones.porId(id, tx);
    if (!actual) throw errores.noEncontrado("La sección");
    verificarAnioEditable((await anios.porId(actual.anioAcademicoId, tx))!.estado);
    if (actual.estado === estado) return;
    await secciones.actualizar(id, { estado }, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "seccion",
        entidadId: id,
        accion: estado === "ACTIVA" ? "ACTIVAR_SECCION" : "INACTIVAR_SECCION",
        anterior: { estado: actual.estado },
        nuevo: { estado },
      },
      meta,
    );
  });
  return obtenerSeccion(id);
}

/** Solo se elimina una sección sin matrículas ni otros registros (cursos, horarios…); si no, se inactiva. */
export async function eliminarSeccion(admin: Autenticado, id: string, meta: MetaSolicitud) {
  try {
    await prisma.$transaction(async (tx) => {
      await secciones.bloquearFila(tx, id);
      const actual = await secciones.porId(id, tx);
      if (!actual) throw errores.noEncontrado("La sección");
      verificarAnioEditable((await anios.porId(actual.anioAcademicoId, tx))!.estado);
      verificarEliminacion(await matriculasProvider().matriculasDeSeccion(id));
      await secciones.eliminar(id, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "seccion",
          entidadId: id,
          accion: "ELIMINAR_SECCION",
          anterior: resumen(actual),
        },
        meta,
      );
    });
  } catch (e) {
    // P2003: otra tabla (asignaciones, horarios…) todavía apunta a la sección.
    if ((e as { code?: string })?.code === "P2003") throw E.seccionConRegistros();
    throw e;
  }
  return { seccionId: id, eliminada: true };
}

/**
 * Vacantes de la sección para la matrícula. Ejemplo:
 *   const v = await vacantesSeccion(seccionId); if (v.completo) → «Sección sin vacantes disponibles (30/30)».
 * Para rechazar directamente, usar verificarVacantesSeccion.
 */
export async function vacantesSeccion(
  seccionId: string,
): Promise<Vacantes & { seccionId: string; estado: EstadoSeccion }> {
  const s = await secciones.porId(seccionId);
  if (!s) throw errores.noEncontrado("La sección");
  const matriculados = (await matriculasProvider().matriculadosPorSeccion([s.id]))[s.id] ?? 0;
  return { seccionId: s.id, estado: s.estado, ...calcularVacantes(matriculados, s.aforoMaximo) };
}
