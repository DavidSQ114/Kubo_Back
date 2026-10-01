import type { Prisma } from "@/generated/prisma/client";

/** Cliente dentro de una transacción (prisma.$transaction(async (tx) => …)). */
export type Tx = Prisma.TransactionClient;

/** Error de Prisma por clave única duplicada (P2002). */
export function esDuplicado(e: unknown, campo?: string): boolean {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== "P2002") return false;
  if (!campo) return true;
  return JSON.stringify(err.meta?.target ?? "").includes(campo);
}
