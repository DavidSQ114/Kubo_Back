// platform/auditoria: bitácora inmutable de eventos críticos (RF03).
// Se llama dentro de la misma transacción que el cambio auditado.
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
