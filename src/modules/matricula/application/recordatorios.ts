// matricula/application: recordatorios de pago a apoderados morosos (US59, AD-12, M-24). Desde el panel de morosidad
// el Administrador elige uno o varios estudiantes; al apoderado responsable del pago de cada uno le llega una
// notificación interna y un correo con el detalle de la deuda. En una transacción, con las matrículas bloqueadas, se
// vuelven a leer las cuotas vencidas: quien ya no tiene se omite. Se guarda la fecha del último recordatorio y queda
// ENVIAR_RECORDATORIOS en la auditoría por cada estudiante. Los correos salen después de confirmar (bandeja de salida).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { logger } from "@/platform/logger";
import { despacharCorreos, registrarAvisos } from "@/platform/notificaciones";
import { aCentimos, deCentimos, fechaEnLima } from "@/modules/academico";
import { resumenEstudiantes, responsablesDeVinculos, type ResponsableDePago } from "@/modules/comunidad";
import { usuariosDePersonas, type Autenticado } from "@/modules/identidad";
import { erroresMatricula as E } from "../domain/errores";
import { motivoDeOmision, textoRecordatorio, type MotivoOmision } from "../domain/recordatorios";
import { recordatorios, type CuotaVencidaFila, type MatriculaParaRecordatorio } from "../infrastructure/morosidad";

export interface ResultadoRecordatorio {
  matriculaId: string;
  estudiante: string;
  enviado: boolean;
  motivo: MotivoOmision | null;
  /** Fecha y hora del último recordatorio (la de este envío si se envió). */
  ultimoRecordatorio: string | null;
}

export interface RecordatoriosEnviados {
  enviados: number;
  omitidos: number;
  /** Correos que ya salieron; los que fallaron quedan en la bandeja de salida para reintentarse. */
  correos: { registrados: number; enviados: number };
  resultados: ResultadoRecordatorio[];
}

interface Destinatario {
  responsable: ResponsableDePago | null;
  usuarioId: string | null;
}

/** Apoderado responsable de cada matrícula, con su cuenta (notificación) y su correo. */
async function destinatarios(lista: MatriculaParaRecordatorio[]) {
  const vinculos = lista.flatMap((m) => (m.vinculoResponsableId ? [m.vinculoResponsableId] : []));
  const [responsables, estudiantes] = await Promise.all([
    responsablesDeVinculos(vinculos),
    resumenEstudiantes(lista.map((m) => m.estudianteId)),
  ]);
  const usuarios = await usuariosDePersonas(Object.values(responsables).map((r) => r.personaId));
  const porMatricula = new Map<string, Destinatario>();
  for (const m of lista) {
    const responsable = m.vinculoResponsableId ? (responsables[m.vinculoResponsableId] ?? null) : null;
    porMatricula.set(m.id, { responsable, usuarioId: responsable ? (usuarios[responsable.personaId] ?? null) : null });
  }
  return { porMatricula, estudiantes };
}

const agrupar = (cuotas: CuotaVencidaFila[]) => {
  const mapa = new Map<string, CuotaVencidaFila[]>();
  for (const c of cuotas) mapa.set(c.matriculaId, [...(mapa.get(c.matriculaId) ?? []), c]);
  return mapa;
};

/**
 * Envía el recordatorio de pago a los apoderados responsables de las matrículas elegidas (US59). Si alguna no existe
 * responde 404 y no se envía nada. Devuelve cuántos se enviaron y cuántos se omitieron, con el motivo de cada uno.
 */
export async function enviarRecordatoriosPago(
  admin: Autenticado,
  datos: { matriculaIds: string[] },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<RecordatoriosEnviados> {
  const ids = [...new Set(datos.matriculaIds)];
  const lista = await recordatorios.matriculas(ids);
  if (lista.length !== ids.length) throw E.noEncontrada();
  const hoy = fechaEnLima(ahora);
  const { porMatricula, estudiantes } = await destinatarios(lista);

  const { resultados, correoIds } = await prisma.$transaction(async (tx) => {
    await recordatorios.bloquear(tx, ids);
    // se vuelve a leer con las filas bloqueadas: quien pagó mientras tanto ya no recibe el recordatorio
    const cuotas = agrupar(await recordatorios.cuotasVencidas(ids, hoy, tx));
    const vigentes = new Map((await recordatorios.matriculas(ids, tx)).map((m) => [m.id, m]));
    const filas: ResultadoRecordatorio[] = [];
    const correos: string[] = [];
    for (const id of ids) {
      const m = vigentes.get(id)!;
      const estudiante = estudiantes[m.estudianteId]?.nombreCompleto ?? "Estudiante";
      const vencidas = cuotas.get(id) ?? [];
      const destino = porMatricula.get(id)!;
      const email = destino.responsable?.email ?? null;
      const motivo = motivoDeOmision({
        cuotasVencidas: vencidas.length,
        tieneCuenta: destino.usuarioId !== null,
        tieneCorreo: email !== null,
      });
      if (motivo) {
        filas.push({
          matriculaId: id,
          estudiante,
          enviado: false,
          motivo,
          ultimoRecordatorio: m.ultimoRecordatorioEn?.toISOString() ?? null,
        });
        continue;
      }
      const total = deCentimos(vencidas.reduce((t, c) => t + aCentimos(c.monto), 0));
      const texto = textoRecordatorio({
        apoderado: destino.responsable!.nombreCompleto.split(" ")[0],
        estudiante,
        cuotas: vencidas,
        total,
        hoy,
      });
      correos.push(
        ...(await registrarAvisos(tx, {
          notificaciones: destino.usuarioId
            ? [
                {
                  usuarioId: destino.usuarioId,
                  tipo: "RECORDATORIO",
                  titulo: texto.titulo,
                  mensaje: texto.mensaje,
                  enlace: "/apoderado/pagos",
                },
              ]
            : [],
          correos: email ? [{ para: email, asunto: texto.asunto, texto: texto.cuerpo }] : [],
          origen: { entidad: "matricula", id },
        })),
      );
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "matricula",
          entidadId: id,
          accion: "ENVIAR_RECORDATORIOS",
          anterior: { ultimoRecordatorioEn: m.ultimoRecordatorioEn?.toISOString() ?? null },
          nuevo: {
            ultimoRecordatorioEn: ahora.toISOString(),
            cuotasVencidas: vencidas.map((c) => ({ concepto: c.concepto, monto: c.monto, vence: c.fechaVencimiento })),
            deuda: total,
            diasAtraso: texto.diasAtraso,
            notificacion: destino.usuarioId !== null,
            correo: email !== null,
          },
        },
        meta,
      );
      filas.push({ matriculaId: id, estudiante, enviado: true, motivo: null, ultimoRecordatorio: ahora.toISOString() });
    }
    const enviadas = filas.filter((r) => r.enviado).map((r) => r.matriculaId);
    if (enviadas.length) await recordatorios.marcar(tx, enviadas, ahora);
    return { resultados: filas, correoIds: correos };
  });

  const enviados = resultados.filter((r) => r.enviado).length;
  const correosEnviados = await despacharCorreos(correoIds, meta.requestId);
  logger.info("Recordatorios de pago enviados", {
    requestId: meta.requestId,
    enviados,
    omitidos: resultados.length - enviados,
    correos: correoIds.length,
    correosEnviados,
  });
  return {
    enviados,
    omitidos: resultados.length - enviados,
    correos: { registrados: correoIds.length, enviados: correosEnviados },
    resultados,
  };
}
