// Datos de demostración de morosidad (US24, US26, US59). SOLO con datos ficticios (RNF14): cambia la fecha de
// matrícula del estudiante y agrega pensiones ya vencidas. Uso: npm run demo:morosidad -- --dni 12345678 [--desde 2026-09-01]
import "@/server/wiring";
import { parseArgs } from "node:util";
import { ZodError } from "zod";
import { prisma } from "@/platform/db/prisma";
import { ErrorApp } from "@/platform/http/errores";
import { logger } from "@/platform/logger";
import { esquemasMatricula, prepararDemoMorosidad, type ResultadoDemoMorosidad } from "@/modules/matricula";

const escribir = (texto = "") => process.stdout.write(`${texto}\n`);

function informe(r: ResultadoDemoMorosidad) {
  escribir(`Estudiante: ${r.estudiante} (DNI ${r.dniEnmascarado}) · año ${r.anio}`);
  if (r.huboCambios) {
    escribir(`Fecha de matrícula: ${r.fechaAnterior} → ${r.fechaNueva}`);
    escribir(`Pensiones agregadas: ${r.pensionesAgregadas.length}`);
  } else {
    escribir(`Sin cambios: la matrícula ya tenía la fecha ${r.fechaNueva} y todas sus pensiones.`);
  }
  escribir();
  escribir("Cronograma:");
  for (const c of r.cronograma) {
    escribir(`  ${c.fechaVencimiento}  ${c.concepto.padEnd(28)} S/ ${c.monto.padStart(8)}  ${c.estado}`);
  }
  escribir();
  escribir(`Pensiones vencidas hoy (${r.hoy}): ${r.pensionesVencidas}`);
}

function mensajeDeError(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join("\n");
  if (e instanceof ErrorApp) return e.message;
  return (e as Error)?.message ?? "Error desconocido";
}

async function main() {
  try {
    const { values } = parseArgs({ options: { dni: { type: "string" }, desde: { type: "string" } } });
    const datos = esquemasMatricula.DemoMorosidadSchema.parse(values);
    informe(await prepararDemoMorosidad(datos));
    return 0;
  } catch (e) {
    process.stderr.write(`No se prepararon los datos de demostración: ${mensajeDeError(e)}\n`);
    if (!(e instanceof ZodError || e instanceof ErrorApp)) {
      logger.error("Falló el script de datos de demostración de morosidad", { error: mensajeDeError(e) });
    }
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((codigo) => process.exit(codigo));
