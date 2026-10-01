// platform/outbox: eventos que se procesan después de confirmar la transacción
// (correos masivos, notificaciones). El job /api/v1/jobs/procesar-outbox se agrega en una fase posterior.
// No guardar contraseñas ni tokens en el payload (RNF03).
import type { Tx } from "@/platform/db/tipos";

export async function encolarEvento(
  tx: Tx,
  evento: { tipo: string; agregadoTipo: string; agregadoId: string; payload: Record<string, unknown> },
) {
  await tx.outboxEvento.create({
    data: {
      tipoEvento: evento.tipo,
      agregadoTipo: evento.agregadoTipo,
      agregadoId: evento.agregadoId,
      payload: evento.payload as never,
    },
  });
}
