// platform/correo: envío de correos por SMTP (Amazon SES, Gmail, Mailtrap…).
// Sin SMTP_HOST configurado (desarrollo), el correo se muestra en la consola y NO en el archivo de log,
// porque puede contener enlaces de un solo uso.
import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/platform/logger";

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
}

let transporte: Transporter | null | undefined;
function obtenerTransporte(): Transporter | null {
  if (transporte !== undefined) return transporte;
  if (!process.env.SMTP_HOST) return (transporte = null);
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporte;
}

/** Envía un correo. Devuelve false si falló (el error se registra, nunca se propaga). */
export async function enviarCorreo(correo: Correo): Promise<boolean> {
  const t = obtenerTransporte();
  if (!t) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n──── Correo (modo desarrollo) ────\nPara: ${correo.para}\nAsunto: ${correo.asunto}\n\n${correo.texto}\n──────────────────────────────────\n`);
      return true;
    }
    logger.error("SMTP no configurado: no se pudo enviar un correo", { asunto: correo.asunto });
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? "Kubo <no-responder@kubo.edu.pe>",
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    });
    return true;
  } catch (e) {
    logger.error("Fallo al enviar correo", { asunto: correo.asunto, error: (e as Error).message });
    return false;
  }
}
