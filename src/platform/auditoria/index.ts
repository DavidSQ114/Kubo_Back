// platform/auditoria: bitácora inmutable de eventos críticos (RF03).
// Se llama dentro de la misma transacción que el cambio auditado.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { MetaSolicitud } from "@/platform/http/ruta";

export interface EventoAuditoria {
  usuarioId: string | null;
  entidad: string;
  entidadId: string;
  accion: string;
  anterior?: unknown;
  nuevo?: unknown;
  motivo?: string | null;
}

export async function registrarAuditoria(tx: Tx, evento: EventoAuditoria, meta?: MetaSolicitud) {
  await tx.registroAuditoria.create({
    data: {
      usuarioId: evento.usuarioId,
      entidadAfectada: evento.entidad,
      entidadId: evento.entidadId,
      accion: evento.accion,
      valorAnterior: (evento.anterior ?? undefined) as never,
      valorNuevo: (evento.nuevo ?? undefined) as never,
      motivo: evento.motivo ?? null,
      requestId: meta?.requestId ?? null,
      ipOrigen: meta?.ip ?? null,
    },
  });
}

export interface EventoRegistrado {
  id: string;
  accion: string;
  entidadId: string;
  usuarioId: string | null;
  fecha: Date;
  valorAnterior: unknown;
  valorNuevo: unknown;
  motivo: string | null;
}

export interface FiltroBitacora {
  desde?: Date;
  /** Exclusivo: el día siguiente al último incluido. */
  hasta?: Date;
  accion?: string;
  entidad?: string;
  pagina: number;
  tamano: number;
}

/**
 * Bitácora completa de operaciones críticas (RF03, AD-16 «Operaciones auditadas», bloque M1), de la más reciente a la
 * más antigua y paginada. Solo lectura: la bitácora es inmutable.
 */
export async function buscarEnBitacora(f: FiltroBitacora) {
  const where = {
    ...(f.desde || f.hasta ? { createdAt: { gte: f.desde, lt: f.hasta } } : {}),
    ...(f.accion ? { accion: f.accion } : {}),
    ...(f.entidad ? { entidadAfectada: f.entidad } : {}),
  };
  const [total, filas] = await prisma.$transaction([
    prisma.registroAuditoria.count({ where }),
    prisma.registroAuditoria.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.pagina - 1) * f.tamano,
      take: f.tamano,
      select: {
        id: true,
        accion: true,
        entidadAfectada: true,
        entidadId: true,
        usuarioId: true,
        createdAt: true,
        valorAnterior: true,
        valorNuevo: true,
        motivo: true,
        ipOrigen: true,
      },
    }),
  ]);
  return {
    total,
    items: filas.map(({ createdAt, entidadAfectada, ...r }) => ({ ...r, entidad: entidadAfectada, fecha: createdAt })),
  };
}

/** Acciones distintas registradas en la bitácora (para el filtro de AD-16). */
export async function accionesDeBitacora(): Promise<string[]> {
  const filas = await prisma.registroAuditoria.findMany({
    distinct: ["accion"],
    select: { accion: true },
    orderBy: { accion: "asc" },
  });
  return filas.map((f) => f.accion);
}

/**
 * Eventos de la bitácora de una entidad (por ejemplo, el log de pagos de AD-11, US04, o el historial de cambios de
 * una persona, US69), del más reciente al más antiguo. Solo lectura: la bitácora es inmutable.
 */
export async function eventosDeAuditoria(filtro: {
  entidad: string;
  entidadIds: string[];
  acciones?: string[];
  limite?: number;
}): Promise<EventoRegistrado[]> {
  if (!filtro.entidadIds.length) return [];
  const filas = await prisma.registroAuditoria.findMany({
    where: {
      entidadAfectada: filtro.entidad,
      entidadId: { in: filtro.entidadIds },
      ...(filtro.acciones ? { accion: { in: filtro.acciones } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: filtro.limite,
    select: {
      id: true,
      accion: true,
      entidadId: true,
      usuarioId: true,
      createdAt: true,
      valorAnterior: true,
      valorNuevo: true,
      motivo: true,
    },
  });
  return filas.map(({ createdAt, ...f }) => ({ ...f, fecha: createdAt }));
}
