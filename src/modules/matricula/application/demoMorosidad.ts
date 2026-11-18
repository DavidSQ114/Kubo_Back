// matricula/application: datos de demostración de morosidad (US24, US26, US59) para scripts/demoMorosidad.ts.
// Adelanta la fecha de matrícula de un estudiante del año en curso y agrega las pensiones que el cronograma (US21)
// habría generado desde esa fecha, para que existan pensiones vencidas. Solo con datos ficticios (RNF14).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { obtenerParametro } from "@/platform/config/parametros";
import { aCentimos, deCentimos, fechaEnLima, listarAnios, montosDelAnio } from "@/modules/academico";
import { buscarPersonaPorDni, enmascararDni, estudianteDePersona } from "@/modules/comunidad";
import type { Tx } from "@/platform/db/tipos";
import { diaVencimientoValido } from "../domain/cronograma";
import {
  pensionesFaltantes,
  pensionesVencidas,
  referenciaPension,
  verificarAjusteDemo,
  type CuotaExistente,
} from "../domain/demoMorosidad";
import { erroresMatricula as E } from "../domain/errores";
import { contarPagos, cuotas, matriculas, type CuotaFila } from "../infrastructure/repositorio";

export interface ResultadoDemoMorosidad {
  matriculaId: string;
  estudiante: string;
  dniEnmascarado: string;
  anio: number;
  fechaAnterior: string;
  fechaNueva: string;
  /** false si ya estaba ajustada: la ejecución no cambió nada. */
  huboCambios: boolean;
  pensionesAgregadas: { concepto: string; fechaVencimiento: string; monto: string }[];
  cronograma: CuotaFila[];
  pensionesVencidas: number;
  hoy: string;
}

/** Día de vencimiento y monto: los de las pensiones de la matrícula o, si no tiene, los del año (como en US21). */
async function datosDePension(anioAcademicoId: string, anio: number, existentes: CuotaExistente[]) {
  const referencia = referenciaPension(existentes);
  if (referencia) return referencia;
  const [montos, dia] = await Promise.all([
    montosDelAnio(anioAcademicoId),
    obtenerParametro("DIA_VENCIMIENTO", anioAcademicoId),
  ]);
  if (!montos.montoPension) throw E.sinMontos(anio);
  return { dia: diaVencimientoValido(dia), montoCentimos: aCentimos(montos.montoPension) };
}

/** Matrícula En proceso o Matriculado del estudiante, bloqueada; si no la hay, el error que corresponde. */
async function matriculaAjustable(tx: Tx, estudianteId: string, anio: { id: string; anio: number }) {
  const m = await matriculas.vigenteBloqueada(tx, estudianteId, anio.id);
  if (m) return m;
  const ultima = await matriculas.ultimaDelAnio(estudianteId, anio.id, tx);
  if (ultima?.estado === "RETIRADO" || ultima?.estado === "ANULADO") throw E.demoMatriculaNoVigente(ultima.estado);
  throw E.demoSinMatricula(anio.anio);
}

/**
 * Prepara la demostración de morosidad para el estudiante del DNI: en una sola transacción cambia su fecha de
 * matrícula a `desde` y agrega las pensiones que faltan (mismo día de vencimiento y monto), y registra DATOS_DEMO
 * en la auditoría. La cuota de matrícula no cambia. Idempotente: si ya estaba ajustada, no hace nada.
 */
export async function prepararDemoMorosidad(
  datos: { dni: string; desde: string },
  hoy: string = fechaEnLima(new Date()),
): Promise<ResultadoDemoMorosidad> {
  const anio = (await listarAnios()).find((a) => a.estado === "EN_CURSO");
  if (!anio) throw E.demoSinAnioEnCurso();
  const persona = await buscarPersonaPorDni(datos.dni);
  if (!persona) throw E.demoPersonaNoEncontrada();
  const estudiante = await estudianteDePersona(persona.personaId);
  if (!estudiante) throw E.demoNoEsEstudiante();
  const dniEnmascarado = enmascararDni(datos.dni);

  const cambio = await prisma.$transaction(async (tx) => {
    const m = await matriculaAjustable(tx, estudiante.estudianteId, anio);
    verificarAjusteDemo({
      estado: m.estado,
      fechaMatricula: m.fechaMatricula,
      pagos: await contarPagos(m.id, tx),
      anio: anio.anio,
      desde: datos.desde,
    });
    const existentes: CuotaExistente[] = (await cuotas.deMatricula(m.id, tx)).map((c) => ({
      tipo: c.tipo,
      mes: c.mes,
      montoCentimos: aCentimos(c.monto),
      fechaVencimiento: c.fechaVencimiento,
    }));
    const pension = await datosDePension(anio.id, anio.anio, existentes);
    const faltantes = pensionesFaltantes({ anio: anio.anio, desde: datos.desde, ...pension, existentes });
    const agregadas = faltantes.map((c) => ({
      concepto: c.concepto,
      fechaVencimiento: c.fechaVencimiento,
      monto: deCentimos(c.montoCentimos),
    }));
    const resultado = { matriculaId: m.id, fechaAnterior: m.fechaMatricula, agregadas };
    if (m.fechaMatricula === datos.desde && !faltantes.length) return { ...resultado, huboCambios: false };

    await matriculas.cambiarFechaMatricula(m.id, datos.desde, tx);
    if (faltantes.length) await cuotas.crear(m.id, faltantes, tx);
    await registrarAuditoria(tx, {
      usuarioId: null,
      entidad: "matricula",
      entidadId: m.id,
      accion: "DATOS_DEMO",
      anterior: { fechaMatricula: m.fechaMatricula },
      nuevo: { dni: dniEnmascarado, fechaMatricula: datos.desde, pensionesAgregadas: agregadas },
      motivo: "Datos de demostración de morosidad (US24, US26, US59). Solo datos ficticios (RNF14).",
    });
    return { ...resultado, huboCambios: true };
  });

  const cronograma = await cuotas.deMatricula(cambio.matriculaId);
  return {
    matriculaId: cambio.matriculaId,
    estudiante: `${estudiante.nombres} ${estudiante.apellidos}`,
    dniEnmascarado,
    anio: anio.anio,
    fechaAnterior: cambio.fechaAnterior,
    fechaNueva: datos.desde,
    huboCambios: cambio.huboCambios,
    pensionesAgregadas: cambio.agregadas,
    cronograma,
    pensionesVencidas: pensionesVencidas(cronograma, hoy),
    hoy,
  };
}
