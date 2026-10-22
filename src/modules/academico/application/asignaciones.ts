// academico/application: asignación de cursos a docentes (US14, RF11, pantalla AD-07) y «Mis cursos» del docente.
// El docente se valida con DocentesProvider (comunidad); las notas y los horarios se cuentan por sus puertos.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import { modoQuitar, verificarAsignable, verificarConflicto, type ModoQuitar } from "../domain/asignaciones";
import { erroresAcademico as E } from "../domain/errores";
import { anios, asignaciones, cursos, planes, secciones, type AsignacionFila } from "../infrastructure/repositorio";
import { cierresProvider, docentesProvider, horariosProvider } from "../puertos";

export interface AsignacionVista {
  id: string;
  docenteId: string;
  anio: { id: string; anio: number };
  curso: { id: string; codigo: string; nombre: string };
  grado: { id: string; numero: number; nombre: string };
  seccion: { id: string; nombre: string };
  horasSemanales: number;
  /** Algún bloque de la asignación está en un horario PUBLICADO (columna «Horario» de AD-07). */
  horarioPublicado: boolean;
}

async function vistas(filas: AsignacionFila[]): Promise<AsignacionVista[]> {
  const horarios = filas.length ? await horariosProvider().horariosPorAsignacion(filas.map((a) => a.id)) : {};
  return filas.map((a) => ({
    id: a.id,
    docenteId: a.docenteId,
    anio: { id: a.planEstudio.anioAcademico.id, anio: a.planEstudio.anioAcademico.anio },
    curso: a.planEstudio.curso,
    grado: a.seccion.grado,
    seccion: { id: a.seccion.id, nombre: a.seccion.nombre },
    horasSemanales: a.planEstudio.horasSemanales,
    horarioPublicado: horarios[a.id]?.publicado ?? false,
  }));
}

/** Carga académica activa de un docente en un año (o en todos). */
export async function listarAsignaciones(docenteId: string, anioId?: string): Promise<AsignacionVista[]> {
  return vistas(await asignaciones.activasDelDocente(docenteId, anioId));
}

/** «Mis cursos» del docente en sesión (US14, criterio 1): sus asignaciones activas, de todos los años. */
export async function misCursos(sesion: Autenticado): Promise<AsignacionVista[]> {
  const docente = await docentesProvider().docentePorPersona(sesion.personaId);
  if (!docente) return [];
  return vistas(await asignaciones.activasDelDocente(docente.id, undefined));
}

const resumen = (a: AsignacionFila) => ({
  docenteId: a.docenteId,
  anio: a.planEstudio.anioAcademico.anio,
  curso: a.planEstudio.curso.codigo,
  grado: a.seccion.grado.numero,
  seccion: a.seccion.nombre,
});

/**
 * Asigna al docente un curso del plan de estudios del grado de la sección (US14). Si el mismo docente tenía esa
 * asignación desactivada, la reactiva. Un curso tiene un solo docente activo por sección (uq_asignacion_activa).
 */
export async function asignarCurso(
  admin: Autenticado,
  datos: { docenteId: string; seccionId: string; cursoId: string },
  meta: MetaSolicitud,
): Promise<AsignacionVista> {
  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const seccion = await secciones.porId(datos.seccionId, tx);
      if (!seccion) throw errores.noEncontrado("La sección");
      const [anio, curso, [docente]] = await Promise.all([
        anios.porId(seccion.anioAcademicoId, tx),
        cursos.porId(datos.cursoId, tx),
        docentesProvider().docentesPorId([datos.docenteId]),
      ]);
      if (!curso) throw errores.noEncontrado("El curso");
      if (!docente) throw errores.noEncontrado("El docente");
      const plan = await planes.delCursoEnGrado(curso.id, seccion.grado.id, seccion.anioAcademicoId, tx);
      verificarAsignable({
        anioEstado: anio!.estado,
        docenteActivo: docente.activo,
        seccion: { estado: seccion.estado, gradoId: seccion.grado.id, anioAcademicoId: seccion.anioAcademicoId },
        cursoEstado: curso.estado,
        plan,
      });
      verificarConflicto(await asignaciones.activaDe(plan!.id, seccion.id, tx), docente.id);

      const inactiva = await asignaciones.inactivaDe(plan!.id, seccion.id, docente.id, tx);
      const nueva = inactiva
        ? await asignaciones.cambiarActivo(inactiva.id, true, tx)
        : await asignaciones.crear({ planEstudioId: plan!.id, seccionId: seccion.id, docenteId: docente.id }, tx);
      const fila = (await asignaciones.porId(nueva.id, tx))!;
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "asignacion_docente",
          entidadId: nueva.id,
          accion: "ASIGNAR_CURSO_DOCENTE",
          nuevo: { ...resumen(fila), reactivada: Boolean(inactiva) },
        },
        meta,
      );
      return nueva.id;
    });
  } catch (e) {
    // dos administradores asignando a la vez el mismo curso y sección: el índice deja pasar solo uno
    if (esDuplicado(e, "uq_asignacion_activa")) throw E.cursoConDocente();
    throw e;
  }
  return (await vistas([(await asignaciones.porId(id))!]))[0];
}

async function cerrarAsignacion(admin: Autenticado, id: string, modo: ModoQuitar, meta: MetaSolicitud) {
  await prisma.$transaction(async (tx) => {
    await asignaciones.bloquearFila(tx, id);
    const actual = await asignaciones.porId(id, tx);
    if (!actual) throw errores.noEncontrado("La asignación");
    if (actual.planEstudio.anioAcademico.estado === "CERRADO") throw E.anioCerrado();
    if (modo === "ELIMINAR") await asignaciones.eliminar(id, tx);
    else await asignaciones.cambiarActivo(id, false, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "asignacion_docente",
        entidadId: id,
        accion: "QUITAR_ASIGNACION_DOCENTE",
        anterior: resumen(actual),
        nuevo: { resultado: modo === "ELIMINAR" ? "ELIMINADA" : "DESACTIVADA" },
      },
      meta,
    );
  });
}

/** Quita una asignación: con notas u horarios se desactiva (activo = false); si no, se elimina. */
export async function quitarAsignacion(admin: Autenticado, id: string, meta: MetaSolicitud) {
  const [notas, horarios] = await Promise.all([
    cierresProvider().notasPorAsignacion([id]),
    horariosProvider().horariosPorAsignacion([id]),
  ]);
  let modo = modoQuitar({ notas: notas[id] ?? 0, bloquesHorario: horarios[id]?.bloques ?? 0 });
  try {
    await cerrarAsignacion(admin, id, modo, meta);
  } catch (e) {
    // P2003: otro registro (cierres, material, trabajos…) todavía apunta a la asignación: se desactiva.
    if ((e as { code?: string })?.code !== "P2003") throw e;
    modo = "DESACTIVAR";
    await cerrarAsignacion(admin, id, modo, meta);
  }
  return { asignacionId: id, resultado: modo === "ELIMINAR" ? "ELIMINADA" : "DESACTIVADA" };
}
