import type { Prisma } from "@/generated/prisma/client";

/** Cliente dentro de una transacción (prisma.$transaction(async (tx) => …)). */
export type Tx = Prisma.TransactionClient;

interface ErrorPrisma {
  code?: string;
  meta?: { target?: unknown; driverAdapterError?: { cause?: { constraint?: unknown } } };
}

/**
 * Error de Prisma por clave única duplicada (P2002). Si se indica, comprueba también el campo o el índice.
 * Sin adaptador, Prisma informa los campos en meta.target; con @prisma/adapter-pg solo informa el índice
 * (meta.driverAdapterError.cause.constraint.index), por ejemplo "usuario_email_key" o "uq_anio_en_curso".
 */
export function esDuplicado(e: unknown, campoOIndice?: string): boolean {
  const err = e as ErrorPrisma;
  if (err?.code !== "P2002") return false;
  if (!campoOIndice) return true;
  const donde = JSON.stringify([err.meta?.target ?? null, err.meta?.driverAdapterError?.cause?.constraint ?? null]);
  return donde.includes(campoOIndice);
}
