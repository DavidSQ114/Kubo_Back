// academico/application: año académico (US06, pantalla AD-02). Crear, editar fechas, eliminar un año planificado,
// avanzar de estado y la situación del año para la barra superior.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import { erroresAcademico as E } from "../domain/errores";
import {
  anioPorDefecto,
  contiene,
  fechaEnLima,
  periodoQueContiene,
  puedeCerrarse,
  situacionDelAnio,
  verificarEliminacionAnio,
  verificarRangoAnio,
  verificarTransicion,
  type SituacionAnio,
} from "../domain/reglas";
import type { EstadoAnio } from "../domain/tipos";
import { anios, periodos, type AnioFila, type PeriodoFila } from "../infrastructure/repositorio";
import { cierresProvider, matriculasProvider } from "../puertos";

export interface PeriodoVista extends Omit<PeriodoFila, "anioAcademicoId"> {
  /** Año En curso y hoy (en Lima) cae en este bimestre: AD-02 lo marca «Vigente». No cambia el estado guardado. */
  vigente: boolean;
}

export interface AnioVista extends AnioFila {
  periodos: PeriodoVista[];
}

/** Bimestres del año para la pantalla, con la marca «vigente» calculada para hoy. */
function vistaPeriodos(anio: AnioFila, lista: PeriodoFila[], hoy: string): PeriodoVista[] {
  const vigente = anio.estado === "EN_CURSO" ? periodoQueContiene(lista, hoy) : null;
  return lista.map((p) => ({
    id: p.id,
    numero: p.numero,
    nombre: p.nombre,
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
    estado: p.estado,
    vigente: p.id === vigente?.id,
  }));
}

/** Todos los años, del más reciente al más antiguo, con sus bimestres. */
export async function listarAnios(): Promise<AnioVista[]> {
  const lista = await anios.listar();
  const todos = await periodos.deAnios(lista.map((a) => a.id));
  const hoy = fechaEnLima(new Date());
  return lista.map((a) => ({
    ...a,
    periodos: vistaPeriodos(
      a,
      todos.filter((p) => p.anioAcademicoId === a.id),
      hoy,
    ),
  }));
}

export async function obtenerAnio(id: string): Promise<AnioVista> {
  const a = await anios.porId(id);
  if (!a) throw errores.noEncontrado("El año académico");
  return { ...a, periodos: vistaPeriodos(a, await periodos.delAnio(id), fechaEnLima(new Date())) };
}

/**
 * Situación del año por defecto (el En curso, si no el En matrícula, si no el abierto más reciente) para la
 * insignia de la barra superior: «Año 2026 · Bimestre IV en curso». Sin años abiertos, null.
 */
export async function situacionActual(fecha: Date = new Date()): Promise<SituacionAnio | null> {
  const anio = anioPorDefecto(await anios.listar());
  if (!anio) return null;
  return situacionDelAnio(anio, await periodos.delAnio(anio.id), fechaEnLima(fecha));
}

/** Convierte las violaciones de unicidad de anio_academico en errores claros. */
function traducirDuplicado(e: unknown, anio?: number): never {
  if (esDuplicado(e, "uq_anio_en_curso")) throw E.otroAnioEnCurso(); // índice parcial: un solo año EN_CURSO
  if (anio !== undefined && esDuplicado(e, "anio_academico_anio_key")) throw E.anioDuplicado(anio);
  throw e;
}

export async function crearAnio(
  admin: Autenticado,
  datos: { anio: number; fechaInicio: string; fechaFin: string },
  meta: MetaSolicitud,
): Promise<AnioVista> {
  try {
    const creado = await prisma.$transaction(async (tx) => {
      await anios.bloquearCalendario(tx);
      verificarRangoAnio(datos, await anios.listar(tx));
      const a = await anios.crear(datos, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "anio_academico",
          entidadId: a.id,
          accion: "CREAR_ANIO_ACADEMICO",
          nuevo: a,
        },
        meta,
      );
      return a;
    });
    return { ...creado, periodos: [] };
  } catch (e) {
    return traducirDuplicado(e, datos.anio);
  }
}

/** Corrige el número o las fechas de un año que no esté cerrado. Sus bimestres deben seguir dentro del rango. */
export async function editarAnio(
  admin: Autenticado,
  id: string,
  datos: { anio?: number; fechaInicio?: string; fechaFin?: string },
  meta: MetaSolicitud,
): Promise<AnioVista> {
  try {
    await prisma.$transaction(async (tx) => {
      await anios.bloquearCalendario(tx);
      const actual = await anios.porId(id, tx);
      if (!actual) throw errores.noEncontrado("El año académico");
      if (actual.estado === "CERRADO") throw E.anioCerrado();

      const nuevo = { ...actual, ...datos };
      verificarRangoAnio(nuevo, await anios.listar(tx), id);
      const bimestres = await periodos.delAnio(id, tx);
      if (bimestres.some((p) => !contiene(nuevo, p))) throw E.periodosFueraDelNuevoRango();

      await anios.actualizar(id, datos, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "anio_academico",
          entidadId: id,
          accion: "EDITAR_ANIO_ACADEMICO",
          anterior: { anio: actual.anio, fechaInicio: actual.fechaInicio, fechaFin: actual.fechaFin },
          nuevo: { anio: nuevo.anio, fechaInicio: nuevo.fechaInicio, fechaFin: nuevo.fechaFin },
        },
        meta,
      );
    });
  } catch (e) {
    traducirDuplicado(e, datos.anio);
  }
  return obtenerAnio(id);
}

/**
 * Avanza el año al siguiente estado. EN_MATRICULA es «Abrir matrícula» (habilita el módulo de matrícula).
 * Para CERRADO, todos los cierres de calificación de sus periodos deben estar publicados.
 */
export async function cambiarEstadoAnio(
  admin: Autenticado,
  id: string,
  destino: EstadoAnio,
  meta: MetaSolicitud,
): Promise<AnioVista> {
  try {
    await prisma.$transaction(async (tx) => {
      await anios.bloquearFila(tx, id);
      const actual = await anios.porId(id, tx);
      if (!actual) throw errores.noEncontrado("El año académico");
      if (actual.estado === "CERRADO") throw E.anioCerrado();
      verificarTransicion(actual.estado, destino);

      if (destino === "EN_CURSO") {
        const otro = await anios.enCurso(tx);
        if (otro && otro.id !== id) throw E.otroAnioEnCurso();
      }
      if (destino === "CERRADO" && !puedeCerrarse(await cierresProvider().resumenCierres(id))) {
        throw E.notasSinPublicar();
      }

      await anios.actualizar(id, { estado: destino }, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "anio_academico",
          entidadId: id,
          accion: "CAMBIAR_ESTADO_ANIO_ACADEMICO",
          anterior: { estado: actual.estado },
          nuevo: { estado: destino },
        },
        meta,
      );
    });
  } catch (e) {
    traducirDuplicado(e);
  }
  return obtenerAnio(id);
}

/** Elimina un año PLANIFICADO sin secciones, planes de estudio ni matrículas (feedback del JP, AD-02). */
export async function eliminarAnio(admin: Autenticado, id: string, meta: MetaSolicitud) {
  await prisma.$transaction(async (tx) => {
    await anios.bloquearFila(tx, id);
    const actual = await anios.porId(id, tx);
    if (!actual) throw errores.noEncontrado("El año académico");
    const [uso, matriculas] = await Promise.all([anios.uso(id, tx), matriculasProvider().matriculasDelAnio(id)]);
    verificarEliminacionAnio(actual.estado, { ...uso, matriculas });
    const bimestres = await periodos.delAnio(id, tx);
    await anios.eliminar(id, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "anio_academico",
        entidadId: id,
        accion: "ELIMINAR_ANIO_ACADEMICO",
        anterior: {
          anio: actual.anio,
          fechaInicio: actual.fechaInicio,
          fechaFin: actual.fechaFin,
          bimestres: bimestres.map(({ numero, fechaInicio, fechaFin }) => ({ numero, fechaInicio, fechaFin })),
        },
      },
      meta,
    );
  });
  return { id, eliminado: true };
}
