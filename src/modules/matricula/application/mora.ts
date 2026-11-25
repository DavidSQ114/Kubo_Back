// matricula/application: mora de las pensiones vencidas (bloque M4). generarMoras la corre la tarea programada cada
// 15 minutos (scripts/tareasProgramadas.ts) y es idempotente; condonarMora la usa el Coordinador académico desde el
// estado de cuenta. La generación la registra el Sistema en la auditoría (GENERAR_MORA, una por matrícula).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { aCentimosOCero, deCentimos, fechaEnLima, montosDelAnio } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import { erroresMatricula as E } from "../domain/errores";
import { morasPorGenerar, motivoValido, verificarMoraCondonable, type MoraNueva } from "../domain/mora";
import { cuotasAnulables, mora } from "../infrastructure/mora";

export interface ResumenMoras {
  /** Día de Lima con que se evaluó el vencimiento. */
  fecha: string;
  /** Moras creadas en esta corrida. */
  creadas: number;
  /** Matrículas a las que se agregó al menos una mora. */
  matriculas: number;
  /** Pensiones vencidas que no generaron mora porque su año no la cobra (monto 0). */
  sinMonto: number;
}

/**
 * Crea una cuota MORA por cada pensión Pendiente vencida que todavía no tiene la suya, con el monto de mora del año de
 * su matrícula y vencimiento hoy. Si el año no cobra mora (0), no hace nada con sus pensiones. Correrla dos veces no
 * duplica nada: una pensión con mora (aunque esté condonada) no vuelve a generarla.
 */
export async function generarMoras(ahora: Date = new Date()): Promise<ResumenMoras> {
  const hoy = fechaEnLima(ahora);
  return prisma.$transaction(async (tx) => {
    await mora.bloquearGeneracion(tx);
    const pensiones = await mora.pensionesVencidasSinMora(tx, hoy);
    const anios = [...new Set(pensiones.map((p) => p.anioAcademicoId))];
    const montoPorAnio = new Map<string, number>();
    for (const anioId of anios) {
      const m = await montosDelAnio(anioId, tx);
      montoPorAnio.set(anioId, aCentimosOCero(m.montoMora ?? "0"));
    }
    const nuevas: MoraNueva[] = anios.flatMap((anioId) =>
      morasPorGenerar(
        pensiones.filter((p) => p.anioAcademicoId === anioId),
        montoPorAnio.get(anioId) ?? 0,
        hoy,
      ),
    );
    const creadas = await mora.crear(tx, nuevas);
    const porMatricula = Map.groupBy(nuevas, (n) => n.matriculaId);
    for (const [matriculaId, lista] of porMatricula) {
      await registrarAuditoria(tx, {
        usuarioId: null,
        entidad: "matricula",
        entidadId: matriculaId,
        accion: "GENERAR_MORA",
        nuevo: {
          fecha: hoy,
          moras: lista.map((n) => ({ concepto: n.concepto, monto: deCentimos(n.montoCentimos) })),
        },
      });
    }
    return { fecha: hoy, creadas, matriculas: porMatricula.size, sinMonto: pensiones.length - nuevas.length };
  });
}

/**
 * Condona una mora Pendiente (pasa a Anulado) con motivo: sale de la deuda, del orden de pago y de la morosidad. Su
 * pensión ya no vuelve a generar mora. Registra CONDONAR_MORA.
 */
export async function condonarMora(
  coordinador: Autenticado,
  cuotaId: string,
  datos: { motivo: string },
  meta: MetaSolicitud,
) {
  const motivo = motivoValido(datos.motivo);
  return prisma.$transaction(async (tx) => {
    const cuota = await cuotasAnulables.bloqueada(tx, cuotaId);
    if (!cuota) throw E.cuotaNoEncontrada();
    verificarMoraCondonable(cuota);
    const anuladoEn = new Date();
    await cuotasAnulables.anular(tx, [cuota.id], {
      anuladoPorId: coordinador.usuarioId,
      anuladoEn,
      motivoAnulacion: motivo,
    });
    await registrarAuditoria(
      tx,
      {
        usuarioId: coordinador.usuarioId,
        entidad: "concepto_cobro",
        entidadId: cuota.id,
        accion: "CONDONAR_MORA",
        anterior: { estado: cuota.estado, concepto: cuota.concepto, monto: cuota.monto },
        nuevo: { estado: "ANULADO", matriculaId: cuota.matriculaId, pensionId: cuota.cuotaOrigenId },
        motivo,
      },
      meta,
    );
    return { cuotaId: cuota.id, estado: "ANULADO" as const, concepto: cuota.concepto, monto: cuota.monto, motivo };
  });
}
