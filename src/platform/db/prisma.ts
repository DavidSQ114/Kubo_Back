// platform/db: única instancia de PrismaClient para toda la aplicación.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function crearCliente() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? crearCliente();

// En desarrollo Next.js recarga módulos: se reutiliza la instancia para no abrir conexiones de más.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
