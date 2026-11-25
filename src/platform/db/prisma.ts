// platform/db: única instancia de PrismaClient para toda la aplicación.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Límites de las transacciones interactivas (bloque M5). Los de Prisma (2 s de espera por una conexión y 5 s de
 * duración) se pasaban en el primer ingreso en frío (conexión nueva a la base, compilación) y la operación respondía
 * 500. Con estos, una transacción lenta sigue cortándose, pero no la primera de un servidor recién levantado.
 */
const ESPERA_MAXIMA_CONEXION_MS = 10_000;
const DURACION_MAXIMA_TRANSACCION_MS = 20_000;

function crearCliente() {
  // La sesión debe ir en UTC: @prisma/adapter-pg envía las fechas en UTC sin desplazamiento y, al leer,
  // asume que el servidor responde en UTC. Con la zona del servidor (America/Lima) quedaban 5 h adelantadas.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, options: "-c timezone=UTC" });
  return new PrismaClient({
    adapter,
    transactionOptions: { maxWait: ESPERA_MAXIMA_CONEXION_MS, timeout: DURACION_MAXIMA_TRANSACCION_MS },
  });
}

export const prisma = globalForPrisma.prisma ?? crearCliente();

// En desarrollo Next.js recarga módulos: se reutiliza la instancia para no abrir conexiones de más.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
