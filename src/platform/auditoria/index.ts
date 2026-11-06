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
  valorNuevo: unknown;
  motivo: string | null;
}

/**
 * Eventos de la bitácora de una entidad (por ejemplo, el log de pagos de AD-11, US04), del más reciente al más
 * antiguo. Solo lectura: la bitácora es inmutable.
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
      valorNuevo: true,
      motivo: true,
    },
  });
  return filas.map(({ createdAt, ...f }) => ({ ...f, fecha: createdAt }));
}
