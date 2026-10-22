// academico/application: periodos de evaluación del año (US07, pantalla AD-02). Los 4 bimestres se guardan juntos.
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import type { Autenticado } from "@/modules/identidad";
import { erroresAcademico as E } from "../domain/errores";
import {
  buscarPeriodoVigente,
  fechaEnLima,
  nombreBimestre,
  verificarCambiosPermitidos,
  verificarPeriodos,
  type PeriodoEntrada,
} from "../domain/reglas";
import { anios, periodos, type PeriodoFila } from "../infrastructure/repositorio";

export async function listarPeriodos(anioId: string): Promise<PeriodoFila[]> {
  if (!(await anios.porId(anioId))) throw errores.noEncontrado("El año académico");
  return periodos.delAnio(anioId);
}

/** Reemplaza los 4 bimestres del año: dentro del rango, sin solaparse y sin tocar los FINALIZADOS. */
export async function guardarPeriodos(
  admin: Autenticado,
  anioId: string,
  nuevos: PeriodoEntrada[],
  meta: MetaSolicitud,
): Promise<PeriodoFila[]> {
  await prisma.$transaction(async (tx) => {
    await anios.bloquearFila(tx, anioId);
    const anio = await anios.porId(anioId, tx);
    if (!anio) throw errores.noEncontrado("El año académico");
    if (anio.estado === "CERRADO") throw E.anioCerrado();

    verificarPeriodos(anio, nuevos);
    const anteriores = await periodos.delAnio(anioId, tx);
    verificarCambiosPermitidos(anteriores, nuevos);

    const ordenados = [...nuevos].sort((a, b) => a.numero - b.numero);
    for (const p of ordenados) {
      await periodos.guardar(anioId, { ...p, nombre: nombreBimestre(p.numero) }, tx);
    }
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "anio_academico",
        entidadId: anioId,
        accion: "GUARDAR_PERIODOS_EVALUACION",
        anterior: anteriores.map(({ numero, fechaInicio, fechaFin }) => ({ numero, fechaInicio, fechaFin })),
        nuevo: ordenados,
      },
      meta,
    );
  });
  return periodos.delAnio(anioId);
}

/**
 * Bimestre en el que cae la fecha (por defecto, hoy en Lima) si el año está EN_CURSO; si no, null.
 * Lo usa el registro de notas (US07, criterio 3): solo se califica dentro del bimestre vigente.
 * Ejemplo: const periodo = await periodoVigente(anioId); if (!periodo) throw …
 */
export async function periodoVigente(anioId: string, fecha: Date = new Date()): Promise<PeriodoFila | null> {
  const anio = await anios.porId(anioId);
  if (!anio || anio.estado !== "EN_CURSO") return null;
  return buscarPeriodoVigente(await periodos.delAnio(anioId), fechaEnLima(fecha));
}
