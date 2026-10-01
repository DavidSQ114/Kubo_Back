// platform/db: única instancia de PrismaClient para toda la aplicación.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function crearCliente() {
  // La sesión debe ir en UTC: @prisma/adapter-pg envía las fechas en UTC sin desplazamiento y, al leer,
  // asume que el servidor responde en UTC. Con la zona del servidor (America/Lima) quedaban 5 h adelantadas.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, options: "-c timezone=UTC" });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? crearCliente();

// En desarrollo Next.js recarga módulos: se reutiliza la instancia para no abrir conexiones de más.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
