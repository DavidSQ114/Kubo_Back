// academico/application: catálogo oficial de competencias del CNEB (US56, AD-04 «Catálogo oficial»). El administrador
// registra una competencia nueva en su área, edita su nombre o descripción y la desactiva; solo elimina la que no
// está en ningún plan de estudios ni tiene calificaciones. Cada cambio queda en la bitácora con el valor anterior y el
// nuevo. Las notas son de evaluacion: se cuentan por el puerto CierresProvider.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import {
  cambiosDeCompetencia,
  normalizarCodigoCompetencia,
  verificarEliminacionCompetencia,
  type UsoCompetencia,
} from "../domain/cursos";
import { erroresAcademico as E } from "../domain/errores";
import { areas, competencias, type CompetenciaCatalogoFila } from "../infrastructure/repositorio";
import { cierresProvider } from "../puertos";

const ENTIDAD = "competencia";

export interface CompetenciaDelCatalogo {
  id: string;
  areaCurricularId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  uso: UsoCompetencia;
  /** Sin planes ni calificaciones: se puede eliminar. */
  eliminable: boolean;
}

export interface AreaDelCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  competencias: CompetenciaDelCatalogo[];
}

/** Planes y calificaciones de cada competencia (las que no se usan no aparecen). */
async function usoDeCompetencias(ids: string[]): Promise<Record<string, UsoCompetencia>> {
  const enPlanes = await competencias.enPlanes(ids);
  const notas = await cierresProvider().notasPorCompetenciaPlan(Object.values(enPlanes).flat());
  return Object.fromEntries(
    Object.entries(enPlanes).map(([id, planes]) => [
      id,
      { planes: planes.length, notas: planes.reduce((total, p) => total + (notas[p] ?? 0), 0) },
    ]),
  );
}

const SIN_USO: UsoCompetencia = { planes: 0, notas: 0 };

const vista = (c: CompetenciaCatalogoFila, uso: UsoCompetencia = SIN_USO): CompetenciaDelCatalogo => ({
  ...c,
  uso,
  eliminable: uso.planes === 0 && uso.notas === 0,
});

const resumen = (c: CompetenciaCatalogoFila) => ({
  codigo: c.codigo,
  nombre: c.nombre,
  descripcion: c.descripcion,
  activo: c.activo,
  areaCurricularId: c.areaCurricularId,
});

/** Áreas activas con todas sus competencias (activas o no), su descripción y su uso (pestaña «Catálogo oficial»). */
export async function catalogoDeCompetencias(): Promise<AreaDelCatalogo[]> {
  const [listaAreas, filas] = await Promise.all([areas.conCompetencias(), competencias.catalogo()]);
  const uso = await usoDeCompetencias(filas.map((c) => c.id));
  return listaAreas.map((a) => ({
    id: a.id,
    codigo: a.codigo,
    nombre: a.nombre,
    competencias: filas.filter((c) => c.areaCurricularId === a.id).map((c) => vista(c, uso[c.id])),
  }));
}

async function competenciaConUso(id: string): Promise<CompetenciaDelCatalogo> {
  const c = await competencias.porId(id);
  if (!c) throw errores.noEncontrado("La competencia");
  return vista(c, (await usoDeCompetencias([id]))[id]);
}

/**
 * US56, criterio 1: registra una competencia nueva del Ministerio en su área (código único, nombre y descripción).
 * Queda activa y disponible para asociarse a los cursos de esa área.
 */
export async function registrarCompetencia(
  admin: Autenticado,
  datos: { areaCurricularId: string; codigo: string; nombre: string; descripcion?: string | null },
  meta: MetaSolicitud,
): Promise<CompetenciaDelCatalogo> {
  const codigo = normalizarCodigoCompetencia(datos.codigo);
  const area = await areas.porId(datos.areaCurricularId);
  if (!area?.activo) throw E.areaNoDisponible();
  try {
    const creada = await prisma.$transaction(async (tx) => {
      const c = await competencias.crear(
        { areaCurricularId: area.id, codigo, nombre: datos.nombre, descripcion: datos.descripcion || null },
        tx,
      );
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: ENTIDAD,
          entidadId: c.id,
          accion: "REGISTRAR_COMPETENCIA",
          nuevo: { ...resumen(c), area: area.codigo },
        },
        meta,
      );
      return c;
    });
    return vista(creada);
  } catch (e) {
    if (esDuplicado(e)) throw E.codigoCompetenciaEnUso();
    throw e;
  }
}

/**
 * Edita el nombre o la descripción, o la activa o desactiva (US56, criterio 3: queda en la bitácora con el valor
 * anterior y el nuevo). Una competencia desactivada ya no se asocia a cursos nuevos; los planes la conservan.
 */
export async function editarCompetencia(
  admin: Autenticado,
  id: string,
  datos: { nombre?: string; descripcion?: string | null; activo?: boolean },
  meta: MetaSolicitud,
): Promise<CompetenciaDelCatalogo> {
  await prisma.$transaction(async (tx) => {
    await competencias.bloquearFila(tx, id);
    const actual = await competencias.porId(id, tx);
    if (!actual) throw errores.noEncontrado("La competencia");
    const pedida = { ...datos, descripcion: datos.descripcion === "" ? null : datos.descripcion };
    const { anterior, nuevo } = cambiosDeCompetencia(actual, pedida);
    await competencias.actualizar(id, nuevo, tx);
    const soloEstado = Object.keys(nuevo).length === 1 && nuevo.activo !== undefined;
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: ENTIDAD,
        entidadId: id,
        accion: soloEstado ? (nuevo.activo ? "ACTIVAR_COMPETENCIA" : "DESACTIVAR_COMPETENCIA") : "EDITAR_COMPETENCIA",
        anterior: { codigo: actual.codigo, ...anterior },
        nuevo: { codigo: actual.codigo, ...nuevo },
      },
      meta,
    );
  });
  return competenciaConUso(id);
}

/** US56, criterio 2: elimina solo una competencia sin planes de estudios ni calificaciones; si no, se desactiva. */
export async function eliminarCompetencia(admin: Autenticado, id: string, meta: MetaSolicitud) {
  try {
    await prisma.$transaction(async (tx) => {
      await competencias.bloquearFila(tx, id);
      const actual = await competencias.porId(id, tx);
      if (!actual) throw errores.noEncontrado("La competencia");
      verificarEliminacionCompetencia((await usoDeCompetencias([id]))[id] ?? SIN_USO);
      await competencias.eliminar(id, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: ENTIDAD,
          entidadId: id,
          accion: "ELIMINAR_COMPETENCIA",
          anterior: resumen(actual),
        },
        meta,
      );
    });
  } catch (e) {
    // P2003: un plan de estudios la asoció mientras tanto (competencia_plan la referencia con RESTRICT)
    if ((e as { code?: string })?.code === "P2003") throw E.competenciaEnPlan(1);
    throw e;
  }
  return { competenciaId: id, eliminada: true };
}
