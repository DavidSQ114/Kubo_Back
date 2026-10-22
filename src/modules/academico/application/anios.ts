// academico/application: año académico (US06, pantalla AD-02). Crear, editar fechas y avanzar de estado.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import { erroresAcademico as E } from "../domain/errores";
import { contiene, puedeCerrarse, verificarRangoAnio, verificarTransicion } from "../domain/reglas";
import type { EstadoAnio } from "../domain/tipos";
import { anios, periodos, type AnioFila, type PeriodoFila } from "../infrastructure/repositorio";
import { cierresProvider } from "../puertos";

export type PeriodoVista = Omit<PeriodoFila, "anioAcademicoId">;

export interface AnioVista extends AnioFila {
  periodos: PeriodoVista[];
}

const vistaPeriodo = (p: PeriodoFila): PeriodoVista => ({
  id: p.id,
  numero: p.numero,
  nombre: p.nombre,
  fechaInicio: p.fechaInicio,
  fechaFin: p.fechaFin,
  estado: p.estado,
});

/** Todos los años, del más reciente al más antiguo, con sus bimestres. */
export async function listarAnios(): Promise<AnioVista[]> {
  const lista = await anios.listar();
  const todos = await periodos.deAnios(lista.map((a) => a.id));
  return lista.map((a) => ({
    ...a,
    periodos: todos.filter((p) => p.anioAcademicoId === a.id).map(vistaPeriodo),
  }));
}

export async function obtenerAnio(id: string): Promise<AnioVista> {
  const a = await anios.porId(id);
  if (!a) throw errores.noEncontrado("El año académico");
  return { ...a, periodos: (await periodos.delAnio(id)).map(vistaPeriodo) };
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
