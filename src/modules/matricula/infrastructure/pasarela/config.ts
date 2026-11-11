// matricula/infrastructure: configuración de la pasarela de pagos (US70), validada con Zod. Sin PASARELA, o con
// variables incompletas, el pago en línea queda apagado (el botón «Pagar» no aparece) y el resto funciona igual.
import { z } from "zod";
import { logger } from "@/platform/logger";

/** Largos mínimos razonables: evitan arrancar con un valor de ejemplo o recortado. */
const LARGO_MINIMO_TOKEN = 20;
const LARGO_MINIMO_SECRETO = 16;

const secreto = z.string().trim().min(LARGO_MINIMO_SECRETO, "MP_WEBHOOK_SECRET demasiado corto");

const ConfigPasarelaSchema = z.discriminatedUnion("PASARELA", [
  z.object({
    PASARELA: z.literal("mercadopago"),
    MP_ACCESS_TOKEN: z.string().trim().min(LARGO_MINIMO_TOKEN, "MP_ACCESS_TOKEN demasiado corto"),
    MP_WEBHOOK_SECRET: secreto,
  }),
  z.object({
    PASARELA: z.literal("falsa"),
    MP_WEBHOOK_SECRET: secreto,
    // la pasarela falsa aprueba pagos con un clic: nunca en producción
    NODE_ENV: z
      .string()
      .optional()
      .refine((v) => v !== "production", "La pasarela falsa no se usa en producción"),
  }),
]);

export type ConfigPasarela = z.infer<typeof ConfigPasarelaSchema>;

let avisoDado = false;

/** Lee y valida las variables en cada llamada (así una prueba puede cambiarlas). null: pago en línea apagado. */
export function leerConfigPasarela(entorno: NodeJS.ProcessEnv = process.env): ConfigPasarela | null {
  const vacioANulo = (v: string | undefined) => (v?.trim() ? v : undefined);
  const datos = {
    PASARELA: vacioANulo(entorno.PASARELA),
    MP_ACCESS_TOKEN: vacioANulo(entorno.MP_ACCESS_TOKEN),
    MP_WEBHOOK_SECRET: vacioANulo(entorno.MP_WEBHOOK_SECRET),
    NODE_ENV: entorno.NODE_ENV,
  };
  if (!datos.PASARELA) return null;
  const r = ConfigPasarelaSchema.safeParse(datos);
  if (r.success) return r.data;
  if (!avisoDado) {
    avisoDado = true;
    // solo los nombres de las variables con problemas, nunca sus valores
    logger.warn("Pasarela de pagos mal configurada: el pago en línea queda desactivado", {
      variables: r.error.issues.map((i) => i.path.join(".") || "PASARELA"),
    });
  }
  return null;
}
