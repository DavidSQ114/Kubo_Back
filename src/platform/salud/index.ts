// platform/salud: estado de la aplicación para el despliegue y el monitoreo (GET /api/v1/salud, despliegue en AWS).
// Solo informa si responde y si llega a la base de datos: nunca datos de la base, credenciales ni detalles del error.
import { prisma } from "@/platform/db/prisma";
import { logger } from "@/platform/logger";

export interface EstadoSalud {
  estado: "ok" | "error";
  /** Commit desplegado (sha corto). */
  version: string;
  baseDatos: "ok" | "error";
}

const LARGO_SHA_CORTO = 7;
// si la base no responde en este tiempo se informa "error" en vez de dejar colgado al que consulta
const MILISEGUNDOS_ESPERA_BASE = 3000;

/**
 * Commit desplegado: KUBO_VERSION (lo escribe deploy/aws/desplegar.sh en .env.production del release)
 * o VERCEL_GIT_COMMIT_SHA en Vercel. En local, "desarrollo".
 */
export function versionDesplegada(): string {
  const sha = process.env.KUBO_VERSION || process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, LARGO_SHA_CORTO) : "desarrollo";
}

async function baseDatosResponde(): Promise<boolean> {
  let espera: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    espera = setTimeout(() => rechazar(new Error("tiempo de espera agotado")), MILISEGUNDOS_ESPERA_BASE);
  });
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, limite]);
    return true;
  } catch (e) {
    logger.warn("salud: la base de datos no responde", { error: (e as Error).message });
    return false;
  } finally {
    clearTimeout(espera);
  }
}

export async function verificarSalud(): Promise<EstadoSalud> {
  const baseDatos = (await baseDatosResponde()) ? "ok" : "error";
  return { estado: baseDatos === "ok" ? "ok" : "error", version: versionDesplegada(), baseDatos };
}
