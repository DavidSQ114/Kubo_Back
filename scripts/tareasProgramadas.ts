// Tareas de cada 15 minutos (kubo-conciliar-pagos.timer, deploy/aws/systemd). Uso: npm run tareas-programadas (o
// npm run conciliar-pagos, el nombre que ejecuta el timer: así el servidor no necesita cambios en systemd).
// 1. US71 · Conciliación de pagos en línea: revisa los intentos Pendiente con más de 10 minutos, consulta su order en
//    la pasarela (GET /v1/orders/{id}) y actualiza su estado (registra el pago si fue aprobado). Sin PASARELA no hace
//    nada.
// 2. US55 · Bandeja de salida de correos: reintenta los correos de las notificaciones que no se pudieron enviar
//    (máximo 5 intentos).
// 3. US32 · Asistencia docente: desde la hora límite (HORA_LIMITE_ASISTENCIA_DOCENTE) marca «Inasistencia» a los
//    docentes activos que nadie marcó hoy. Solo días lectivos; es idempotente.
// Cada tarea corre aunque otra falle.
import "@/server/wiring";
import { prisma } from "@/platform/db/prisma";
import { logger } from "@/platform/logger";
import { procesarBandeja } from "@/platform/notificaciones";
import { marcarFaltasDocentes } from "@/modules/horarios";
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

async function faltasDocentes() {
  try {
    const resultado = await marcarFaltasDocentes();
    // «dia» y no «fecha»: el logger ya usa «fecha» para el instante del registro
    const { fecha: dia, ...resto } = resultado;
    logger.info("Verificación de la asistencia docente terminada", { dia, ...resto });
    return 0;
  } catch (e) {
    logger.error("La verificación de la asistencia docente falló", {
      error: (e as Error)?.message ?? "Error desconocido",
    });
    return 1;
  }
}

async function main() {
  try {
    const codigos = [await conciliar(), await reintentarCorreos(), await faltasDocentes()];
    return Math.max(...codigos);
  } finally {
    await prisma.$disconnect();
  }
}

main().then((codigo) => process.exit(codigo));
