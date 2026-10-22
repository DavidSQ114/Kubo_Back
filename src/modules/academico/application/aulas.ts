// academico/application: aulas físicas y su aforo (US09, pantalla AD-03). Las aulas se desactivan, no se borran.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import { erroresAcademico as E } from "../domain/errores";
import { listaSecciones, verificarAforo, verificarAforoAula } from "../domain/secciones";
import { aulas, secciones, type AulaFila } from "../infrastructure/repositorio";
import { matriculasProvider } from "../puertos";

export interface AulaVista extends AulaFila {
  /** Secciones del año consultado que usan el aula, con sus matriculados (columnas «Sección asignada» y «Ocupación»). */
  secciones: { id: string; grado: number; nombre: string; matriculados: number; aforoMaximo: number }[];
}

/** Todas las aulas (activas primero). Si se indica el año, cada una trae las secciones de ese año que la usan. */
export async function listarAulas(anioId?: string): Promise<AulaVista[]> {
  const lista = await aulas.todas();
  const delAnio = anioId ? await secciones.delAnio(anioId) : [];
  const conAula = delAnio.filter((s) => s.aula);
  const matriculados = conAula.length
    ? await matriculasProvider().matriculadosPorSeccion(conAula.map((s) => s.id))
    : {};
  return lista.map((a) => ({
    ...a,
    secciones: conAula
      .filter((s) => s.aula!.id === a.id)
      .map((s) => ({
        id: s.id,
        grado: s.grado.numero,
        nombre: s.nombre,
        matriculados: matriculados[s.id] ?? 0,
        aforoMaximo: s.aforoMaximo,
      })),
  }));
}

function traducirDuplicado(e: unknown): never {
  if (esDuplicado(e, "aula_nombre_key")) throw E.aulaDuplicada();
  throw e;
}

export async function crearAula(
  admin: Autenticado,
  datos: { nombre: string; ubicacion?: string | null; aforo: number },
  meta: MetaSolicitud,
): Promise<AulaFila> {
  verificarAforo(datos.aforo);
  try {
    return await prisma.$transaction(async (tx) => {
      const a = await aulas.crear({ nombre: datos.nombre, ubicacion: datos.ubicacion ?? null, aforo: datos.aforo }, tx);
      await registrarAuditoria(
        tx,
        { usuarioId: admin.usuarioId, entidad: "aula", entidadId: a.id, accion: "CREAR_AULA", nuevo: a },
        meta,
      );
      return a;
    });
  } catch (e) {
    return traducirDuplicado(e);
  }
}

/** El aforo no puede quedar por debajo del de las secciones vigentes que usan el aula. */
export async function editarAula(
  admin: Autenticado,
  id: string,
  datos: { nombre?: string; ubicacion?: string | null; aforo?: number },
  meta: MetaSolicitud,
): Promise<AulaFila> {
  try {
    return await prisma.$transaction(async (tx) => {
      await aulas.bloquearFila(tx, id);
      const actual = await aulas.porId(id, tx);
      if (!actual) throw errores.noEncontrado("El aula");
      if (datos.aforo !== undefined) {
        const vigentes = await secciones.vigentesDelAula(id, tx);
        verificarAforoAula(
          datos.aforo,
          vigentes.map((s) => s.aforoMaximo),
        );
      }
      const a = await aulas.actualizar(id, datos, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "aula",
          entidadId: id,
          accion: "EDITAR_AULA",
          anterior: actual,
          nuevo: a,
        },
        meta,
      );
      return a;
    });
  } catch (e) {
    return traducirDuplicado(e);
  }
}

/** Desactivar (no borrar). Un aula que usan secciones vigentes no se desactiva hasta quitarla de ellas. */
export async function cambiarEstadoAula(
  admin: Autenticado,
  id: string,
  activo: boolean,
  meta: MetaSolicitud,
): Promise<AulaFila> {
  return prisma.$transaction(async (tx) => {
    await aulas.bloquearFila(tx, id);
    const actual = await aulas.porId(id, tx);
    if (!actual) throw errores.noEncontrado("El aula");
    if (actual.activo === activo) return actual;
    if (!activo) {
      const vigentes = await secciones.vigentesDelAula(id, tx);
      if (vigentes.length) {
        throw E.aulaEnUso(listaSecciones(vigentes.map((s) => ({ grado: s.grado.numero, nombre: s.nombre }))));
      }
    }
    const a = await aulas.actualizar(id, { activo }, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "aula",
        entidadId: id,
        accion: activo ? "ACTIVAR_AULA" : "DESACTIVAR_AULA",
        anterior: { activo: actual.activo },
        nuevo: { activo },
      },
      meta,
    );
    return a;
  });
}
