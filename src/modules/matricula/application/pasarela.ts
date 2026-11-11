// matricula/application: pago en línea desde el portal del apoderado (US70) y conciliación de los intentos pendientes
// (US71). El apoderado elige cuotas, el servidor calcula el monto y crea el intento y la order en la pasarela; el pago
// solo se registra cuando la pasarela lo confirma (aviso firmado o conciliación), nunca por la URL de retorno.
import { randomBytes } from "node:crypto";
import { logger } from "@/platform/logger";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { aCentimos, deCentimos } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import { erroresMatricula as E } from "../domain/errores";
import {
  decidirCobro,
  expiracionIntento,
  limiteConciliacion,
  MINUTOS_EXPIRACION_INTENTO,
  montoDelIntento,
  NOMBRE_ESTADO_INTENTO,
  puedeActualizarIntento,
  type CobroConsultado,
  type EstadoIntento,
  type PasarelaPagos,
} from "../domain/pasarela";
import { cuotasDePago } from "../infrastructure/pagos";
import { intentos, type IntentoFila } from "../infrastructure/intentos";
import { firmaAvisoValida, obtenerPasarela, simularPagoFalso, type SimulacionFalsa } from "../infrastructure/pasarela";
import { registrarPagoPasarela } from "./pagos";
import { hijoAutorizado } from "./portalApoderado";

/** Intentos que revisa como máximo una corrida de la conciliación (el timer corre cada 15 minutos). */
const MAXIMO_POR_CONCILIACION = 200;
const BYTES_REFERENCIA = 12;

/** «KUBO-3F9A…»: external_reference del intento (24 caracteres hexadecimales, dentro del máximo de 64). */
const nuevaReferencia = () => `KUBO-${randomBytes(BYTES_REFERENCIA).toString("hex").toUpperCase()}`;

/** ¿Hay una pasarela configurada? Si no, el portal no muestra «Pagar». */
export const pagoEnLineaDisponible = () => obtenerPasarela() !== null;

function pasarelaActiva(): PasarelaPagos {
  const pasarela = obtenerPasarela();
  if (!pasarela) throw E.pagoEnLineaNoDisponible();
  return pasarela;
}

// ---------- US70 · Crear el intento y la order ----------

/**
 * El apoderado elige cuotas Pendiente de un hijo vinculado; el servidor calcula el monto, crea el intento (Pendiente,
 * expira en 30 minutos) y la order en la pasarela, y devuelve la URL del checkout. Las cuotas no se reservan: se
 * vuelven a validar cuando llega la confirmación.
 */
export async function crearIntentoPago(
  auth: Autenticado,
  datos: { estudianteId: string; conceptoIds: string[]; urlBase: string },
) {
  const pasarela = pasarelaActiva();
  const hijo = await hijoAutorizado(auth, datos.estudianteId);
  const lista = await cuotasDePago.porIds(datos.conceptoIds);
  const montoCentimos = montoDelIntento(
    datos.conceptoIds,
    lista.map((c) => ({ ...c, montoCentimos: aCentimos(c.monto) })),
    datos.estudianteId,
  );
  const matriculaId = lista[0].matriculaId;
  if (!hijo.matriculas.some((m) => m.id === matriculaId)) throw E.cuotaNoEncontrada();

  const referencia = nuevaReferencia();
  const intentoId = await intentos.crear({
    matriculaId,
    creadoPorId: auth.usuarioId,
    conceptoIds: datos.conceptoIds,
    montoCentimos,
    referencia,
    pasarela: pasarela.nombre,
    expiraEn: expiracionIntento(new Date()),
  });
  const urlRetorno = `${datos.urlBase}/apoderado/pagos/retorno?intento=${intentoId}`;
  const porId = new Map(lista.map((c) => [c.id, c]));
  try {
    const cobro = await pasarela.crearCobro({
      idempotencia: intentoId,
      referencia,
      montoCentimos,
      items: datos.conceptoIds.map((id) => ({
        titulo: porId.get(id)!.concepto,
        montoCentimos: aCentimos(porId.get(id)!.monto),
      })),
      urlRetorno,
      expiraEnMinutos: MINUTOS_EXPIRACION_INTENTO,
    });
    await intentos.guardarOrden(intentoId, cobro);
    logger.info("Intento de pago en línea creado", { intentoId, pasarela: pasarela.nombre, cuotas: lista.length });
    return { intentoId, monto: deCentimos(montoCentimos), urlCheckout: cobro.urlCheckout };
  } catch (e) {
    // sin el token ni el cuerpo de la respuesta: solo el tipo de error
    logger.warn("La pasarela no creó la order del intento", { intentoId, error: (e as Error)?.name ?? "Error" });
    await intentos.actualizarEstado(intentoId, ["PENDIENTE"], { estado: "RECHAZADO", detalle: "PASARELA_NO_RESPONDE" });
    throw E.pasarelaNoResponde();
  }
}

// ---------- US70 · Aviso de la pasarela (webhook) ----------

/**
 * Valida el aviso: firma x-signature (401 si no coincide) y tipo. Devuelve el id de la order a consultar, o null si
 * el aviso no es de una order (se responde 200 y se ignora).
 */
export function validarAvisoPasarela(aviso: {
  firma: string | null;
  requestId: string | null;
  dataId: string | null;
  tipo: string | null;
}): string | null {
  const valida = firmaAvisoValida(aviso);
  if (valida === null) throw E.pagoEnLineaNoDisponible();
  if (!valida) throw E.firmaInvalida();
  if (aviso.tipo !== "order" || !aviso.dataId) return null;
  return aviso.dataId;
}

export type ResultadoAviso =
  "REGISTRADO" | "OBSERVADO" | "REPETIDO" | "ACTUALIZADO" | "SIN_CAMBIOS" | "ORDEN_DESCONOCIDA" | "ERROR";

/** Aplica al intento lo que respondió la pasarela: registra el pago, lo observa o actualiza su estado. */
async function aplicarCobro(
  intento: IntentoFila,
  cobro: CobroConsultado,
  meta: MetaSolicitud,
): Promise<ResultadoAviso> {
  const decision = decidirCobro(intento, cobro, new Date());
  if (decision.tipo === "REGISTRAR") {
    const r = await registrarPagoPasarela(intento, cobro, meta);
    if (r.repetido) return "REPETIDO";
    return r.operacion.estado === "CONFIRMADO" ? "REGISTRADO" : "OBSERVADO";
  }
  if (decision.tipo === "OBSERVAR") {
    // pagado en la pasarela pero no cuadra con el intento: no se registra; tesorería lo revisa
    logger.warn("Pago en línea que no coincide con su intento", { intentoId: intento.id, motivo: decision.motivo });
    const n = await intentos.actualizarEstado(intento.id, ["PENDIENTE", "RECHAZADO", "EXPIRADO"], {
      estado: "OBSERVADO",
      estadoExterno: cobro.estadoExterno,
      detalle: decision.motivo,
    });
    return n ? "OBSERVADO" : "SIN_CAMBIOS";
  }
  if (!puedeActualizarIntento(intento.estado, decision.estado)) {
    await intentos.actualizarEstado(intento.id, [intento.estado], { estadoExterno: cobro.estadoExterno });
    return "SIN_CAMBIOS";
  }
  const n = await intentos.actualizarEstado(intento.id, ["PENDIENTE"], {
    estado: decision.estado,
    estadoExterno: cobro.estadoExterno,
  });
  return n ? "ACTUALIZADO" : "SIN_CAMBIOS";
}

/**
 * Consulta la order en la pasarela (GET /v1/orders/{id}) y la aplica a su intento. Nunca lanza: se ejecuta después de
 * responder 200 al webhook; si falla, la conciliación (US71) lo vuelve a intentar.
 */
export async function procesarOrdenPasarela(ordenId: string, meta: MetaSolicitud): Promise<ResultadoAviso> {
  try {
    const pasarela = obtenerPasarela();
    if (!pasarela) return "ERROR";
    const intento = await intentos.porOrden(ordenId);
    if (!intento) {
      logger.warn("Aviso de una order sin intento en Kubo", { requestId: meta.requestId, ordenId });
      return "ORDEN_DESCONOCIDA";
    }
    const cobro = await pasarela.consultarPago(ordenId);
    if (!cobro) {
      logger.warn("La pasarela no encontró la order del aviso", { requestId: meta.requestId, ordenId });
      return "ORDEN_DESCONOCIDA";
    }
    const resultado = await aplicarCobro(intento, cobro, meta);
    logger.info("Order de la pasarela procesada", {
      requestId: meta.requestId,
      intentoId: intento.id,
      estadoExterno: cobro.estadoExterno,
      resultado,
    });
    return resultado;
  } catch (e) {
    logger.error("No se pudo procesar el aviso de la pasarela", {
      requestId: meta.requestId,
      ordenId,
      error: (e as Error)?.message ?? "Error desconocido",
    });
    return "ERROR";
  }
}

// ---------- US70 · Pantalla de retorno ----------

/** Intento del apoderado en sesión; uno ajeno responde 404, igual que uno que no existe. */
async function intentoPropio(auth: Autenticado, intentoId: string) {
  const intento = await intentos.porId(intentoId);
  if (!intento || intento.creadoPorId !== auth.usuarioId) throw E.intentoNoEncontrado();
  return intento;
}

async function vistaIntento(intento: IntentoFila) {
  const lista = await cuotasDePago.porIds(intento.conceptoIds);
  return {
    intentoId: intento.id,
    estudianteId: intento.estudianteId,
    estado: intento.estado,
    nombreEstado: NOMBRE_ESTADO_INTENTO[intento.estado],
    monto: deCentimos(intento.montoCentimos),
    cuotas: lista.map((c) => ({ cuotaId: c.id, concepto: c.concepto, monto: c.monto })),
    expiraEn: intento.expiraEn,
    comprobante: intento.operacion?.comprobante ?? null,
    pasarela: intento.pasarela,
  };
}

/**
 * Estado del intento registrado en Kubo (pantalla de retorno). Si sigue Pendiente, consulta antes la order en la
 * pasarela (servidor a servidor), así el resultado aparece aunque el aviso todavía no llegue. Lo que trae la URL de
 * retorno no se usa.
 */
export async function consultarIntento(auth: Autenticado, intentoId: string, meta: MetaSolicitud) {
  let intento = await intentoPropio(auth, intentoId);
  if (intento.estado === "PENDIENTE" && intento.ordenExternaId) {
    await procesarOrdenPasarela(intento.ordenExternaId, meta);
    intento = (await intentos.porId(intentoId))!;
  }
  return vistaIntento(intento);
}

/**
 * Solo con PASARELA=falsa (desarrollo y pruebas): simula lo que el apoderado hace en el checkout y procesa la order
 * como lo haría el aviso.
 */
export async function simularPagoEnLinea(
  auth: Autenticado,
  intentoId: string,
  resultado: SimulacionFalsa,
  meta: MetaSolicitud,
) {
  if (obtenerPasarela()?.nombre !== "falsa") throw E.simulacionNoDisponible();
  const intento = await intentoPropio(auth, intentoId);
  if (!intento.ordenExternaId || !simularPagoFalso(intento.ordenExternaId, resultado)) throw E.intentoNoEncontrado();
  await procesarOrdenPasarela(intento.ordenExternaId, meta);
  return vistaIntento((await intentos.porId(intentoId))!);
}

// ---------- US71 · Conciliación ----------

export interface ResumenConciliacion {
  revisados: number;
  resultados: Partial<Record<ResultadoAviso | "EXPIRADO_SIN_ORDEN", number>>;
}

/**
 * Revisa los intentos Pendiente creados hace más de diez minutos: consulta su order (GET /v1/orders/{id}) y actualiza
 * el estado (registra el pago si está aprobado). Un intento sin order (la pasarela no la creó) y ya vencido pasa a
 * Expirado. Lo ejecuta `npm run conciliar-pagos` (timer de systemd cada 15 minutos).
 */
export async function conciliarIntentosPendientes(ahora = new Date()): Promise<ResumenConciliacion> {
  const meta: MetaSolicitud = { requestId: `conciliacion-${ahora.toISOString()}`, ip: null, userAgent: null };
  const resumen: ResumenConciliacion = { revisados: 0, resultados: {} };
  if (!obtenerPasarela()) return resumen;
  const sumar = (clave: ResultadoAviso | "EXPIRADO_SIN_ORDEN") =>
    (resumen.resultados[clave] = (resumen.resultados[clave] ?? 0) + 1);

  for (const intento of await intentos.pendientesHasta(limiteConciliacion(ahora), MAXIMO_POR_CONCILIACION)) {
    resumen.revisados += 1;
    if (intento.ordenExternaId) {
      sumar(await procesarOrdenPasarela(intento.ordenExternaId, meta));
    } else if (ahora > intento.expiraEn) {
      const estado: EstadoIntento = "EXPIRADO";
      await intentos.actualizarEstado(intento.id, ["PENDIENTE"], { estado, detalle: "SIN_ORDEN" });
      sumar("EXPIRADO_SIN_ORDEN");
    }
  }
  return resumen;
}
