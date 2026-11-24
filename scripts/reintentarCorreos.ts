// US55 · Reintenta ahora los correos pendientes de la bandeja de salida (outbox_evento, tipo CORREO). Uso a mano:
// npm run reintentar-correos. En la EC2 lo hace cada 15 minutos kubo-conciliar-pagos.timer (scripts/tareasProgramadas.ts).
import "@/server/wiring";
import { prisma } from "@/platform/db/prisma";
import { logger } from "@/platform/logger";
import { procesarBandeja } from "@/platform/notificaciones";

async function main() {
  try {
    const resumen = await procesarBandeja();
    logger.info("Bandeja de salida de correos procesada", { ...resumen });
    return 0;
  } catch (e) {
    logger.error("No se pudo procesar la bandeja de salida", { error: (e as Error)?.message ?? "Error desconocido" });
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((codigo) => process.exit(codigo));
