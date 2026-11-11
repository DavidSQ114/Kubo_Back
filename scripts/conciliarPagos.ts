// US71 · Conciliación de pagos en línea: revisa los intentos Pendiente con más de 10 minutos, consulta su order en la
// pasarela (GET /v1/orders/{id}) y actualiza su estado (registra el pago si fue aprobado). Uso: npm run conciliar-pagos
// En la EC2 lo ejecuta kubo-conciliar-pagos.timer cada 15 minutos (deploy/aws/systemd). Sin PASARELA no hace nada.
import "@/server/wiring";
import { prisma } from "@/platform/db/prisma";
import { logger } from "@/platform/logger";
import { conciliarIntentosPendientes } from "@/modules/matricula";

async function main() {
  try {
    const resumen = await conciliarIntentosPendientes();
    logger.info("Conciliación de pagos en línea terminada", { ...resumen });
    return resumen.resultados.ERROR ? 1 : 0;
  } catch (e) {
    logger.error("La conciliación de pagos en línea falló", { error: (e as Error)?.message ?? "Error desconocido" });
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((codigo) => process.exit(codigo));
