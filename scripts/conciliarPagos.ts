// Tareas de cada 15 minutos (kubo-conciliar-pagos.timer, deploy/aws/systemd). Uso: npm run conciliar-pagos
// 1. US71 · Conciliación de pagos en línea: revisa los intentos Pendiente con más de 10 minutos, consulta su order en
//    la pasarela (GET /v1/orders/{id}) y actualiza su estado (registra el pago si fue aprobado). Sin PASARELA no hace
//    nada.
// 2. US55 · Bandeja de salida de correos: reintenta los correos de las notificaciones que no se pudieron enviar
//    (máximo 5 intentos). Cada tarea corre aunque la otra falle.
import "@/server/wiring";
import { prisma } from "@/platform/db/prisma";
import { logger } from "@/platform/logger";
import { procesarBandeja } from "@/platform/notificaciones";
import { conciliarIntentosPendientes } from "@/modules/matricula";

async function conciliar() {
  try {
    const resumen = await conciliarIntentosPendientes();
    logger.info("Conciliación de pagos en línea terminada", { ...resumen });
    return resumen.resultados.ERROR ? 1 : 0;
  } catch (e) {
    logger.error("La conciliación de pagos en línea falló", { error: (e as Error)?.message ?? "Error desconocido" });
    return 1;
  }
}

async function reintentarCorreos() {
  try {
    const resumen = await procesarBandeja();
    logger.info("Bandeja de salida de correos procesada", { ...resumen });
    return 0;
  } catch (e) {
    logger.error("No se pudo procesar la bandeja de salida", { error: (e as Error)?.message ?? "Error desconocido" });
    return 1;
  }
}

async function main() {
  try {
    const codigos = [await conciliar(), await reintentarCorreos()];
    return Math.max(...codigos);
  } finally {
    await prisma.$disconnect();
  }
}

main().then((codigo) => process.exit(codigo));
