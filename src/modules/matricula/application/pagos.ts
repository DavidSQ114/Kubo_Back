// matricula/application: pensiones y pagos (AD-11). Registro de pago manual (US22, M-01), pagos con número de
// operación repetido que quedan Observado (US23), anulación con motivo (US04, M-02), recibo en PDF con correlativo
// (US25, M-03), estado de cuenta del estudiante, registro de un pago en línea aprobado por el Sistema (US70) y su
// devolución (US71). Cada escritura va en una transacción con las cuotas bloqueadas.
import { createHash } from "node:crypto";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { eventosDeAuditoria, registrarAuditoria } from "@/platform/auditoria";
import { enviarCorreo, smtpConfigurado } from "@/platform/correo";
import { logger } from "@/platform/logger";
import { obtenerParametro } from "@/platform/config/parametros";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { generarPdf, type DocumentoPdf } from "@/platform/pdf";
import { aCentimos, deCentimos, fechaEnLima, listarSecciones, obtenerAnio } from "@/modules/academico";
import { estudianteParaFicha, nombresDeUsuarios, type EstudianteFicha } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { seccionEnFecha } from "../domain/cambios";
import { erroresMatricula as E } from "../domain/errores";
import { NOMBRE_ESTADO_MATRICULA, type ModalidadPago } from "../domain/matriculas";
import {
  estadoInicialPago,
  NOMBRE_ESTADO_PAGO,
  NOMBRE_MEDIO_PAGO,
  NOMBRE_MOTIVO_ANULACION_PAGO,
  normalizarNumeroOperacion,
  prefijoComprobante,
  siguienteComprobante,
  verificarCuotasPagables,
  verificarFechaPago,
  verificarMontoAnual,
  verificarMontoExacto,
  verificarMotivoAnulacionPago,
  verificarPagoAnualPosible,
  verificarObservado,
  verificarPagoAnulable,
  verificarReciboDisponible,
  type MedioPago,
  type MotivoAnulacionElegible,
  type MotivoAnulacionPago,
} from "../domain/pagos";
import {
  estadoPagoPasarela,
  MOTIVO_DEVOLUCION,
  NOMBRE_ORIGEN_PAGO,
  verificarDescartable,
  verificarDevolucionPosible,
  type OrigenPago,
} from "../domain/pasarela";
import { cuotas as cuotasMatricula, historial, matriculas } from "../infrastructure/repositorio";
import {
  comprobantes,
  cuotasDePago,
  matriculasDeEstudiante,
  operaciones,
  type OperacionFila,
} from "../infrastructure/pagos";
import { intentos } from "../infrastructure/intentos";

export const AVISO_NUMERO_REPETIDO = "Este número de operación ya fue utilizado en otro pago";
const INSTITUCION_POR_DEFECTO = "Institución Educativa Kubo";
const ACCIONES_PAGO = ["REGISTRAR_PAGO", "CONFIRMAR_PAGO_OBSERVADO", "ANULAR_PAGO", "REGISTRAR_DEVOLUCION"];
/** Quién aparece como registrador de un pago en línea (US70): no hay usuario, lo registra el Sistema. */
const NOMBRE_SISTEMA = "Sistema (pago en línea)";
const ENTIDAD = "operacion_pago";

const rutaRecibo = (operacionId: string) => `/api/v1/matricula/pagos/${operacionId}/comprobante`;
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");
const centimosDe = (lista: { monto: string }[]) => lista.reduce((t, c) => t + aCentimos(c.monto), 0);

// ---------- Datos del recibo (US25) ----------

interface ContextoRecibo {
  institucion: string;
  estudiante: EstudianteFicha;
  anio: number;
  seccion: string | null;
  responsable: { nombreCompleto: string; email: string | null } | null;
  registradoPor: string;
}

/**
 * Datos guardados que necesita el recibo: estudiante, sección en la fecha de pago (por historial, para que un
 * traslado posterior no cambie el documento), apoderado responsable y quién registró el pago.
 */
async function contextoRecibo(op: Pick<OperacionFila, "matriculaId" | "fechaPago" | "registradoPorId">) {
  const registrador = op.registradoPorId;
  const m = await matriculas.porId(op.matriculaId);
  if (!m) throw E.noEncontrada();
  const [estudiante, anio, secciones, tramos, institucion, nombres] = await Promise.all([
    estudianteParaFicha(m.estudianteId),
    obtenerAnio(m.anioAcademicoId),
    listarSecciones(m.anioAcademicoId),
    historial.deMatricula(m.id),
    obtenerParametro<string>("NOMBRE_INSTITUCION"),
    nombresDeUsuarios(registrador ? [registrador] : []),
  ]);
  if (!estudiante) throw E.estudianteNoEncontrado();
  const seccionId = seccionEnFecha(tramos, op.fechaPago) ?? m.seccionId;
  const seccion = secciones.find((s) => s.id === seccionId);
  const responsable = estudiante.apoderados.find((a) => a.vinculoId === m.vinculoResponsableId) ?? null;
  return {
    institucion: typeof institucion === "string" && institucion.trim() ? institucion : INSTITUCION_POR_DEFECTO,
    estudiante,
    anio: anio.anio,
    seccion: seccion ? `${seccion.grado.numero}° ${seccion.nombre}` : null,
    responsable: responsable && { nombreCompleto: responsable.nombreCompleto, email: responsable.email },
    registradoPor: registrador ? (nombres[registrador]?.nombreCorto ?? "—") : NOMBRE_SISTEMA,
  } satisfies ContextoRecibo;
}

/**
 * Documento del recibo, armado solo con datos guardados y con la fecha de pago en los metadatos: el mismo pago
 * produce siempre el mismo PDF (y el mismo SHA-256). Sin «generado el» variable. Anulado: marca «ANULADO».
 */
function documentoRecibo(
  datos: {
    numero: string;
    numeroOperacion: string;
    medioPago: MedioPago;
    fechaPago: string;
    monto: string;
    cuotas: { concepto: string; fechaVencimiento: string; monto: string }[];
    anulado: boolean;
  },
  ctx: ContextoRecibo,
): DocumentoPdf {
  return {
    nombre: "recibo-pago",
    institucion: ctx.institucion,
    titulo: `Recibo de pago N.° ${datos.numero}`,
    subtitulo: `Año académico ${ctx.anio}`,
    fechaDocumento: new Date(`${datos.fechaPago}T05:00:00.000Z`),
    marcaAgua: datos.anulado ? "ANULADO" : undefined,
    bloques: [
      {
        tipo: "datos",
        titulo: "Datos del pago",
        filas: [
          ["Estudiante", `${ctx.estudiante.nombres} ${ctx.estudiante.apellidos}`],
          ["Sección", ctx.seccion ?? ""],
          ["Apoderado responsable", ctx.responsable?.nombreCompleto ?? ""],
          ["Fecha de pago", fechaCorta(datos.fechaPago)],
          ["N.° de operación", datos.numeroOperacion],
          ["Medio de pago", NOMBRE_MEDIO_PAGO[datos.medioPago]],
          ["Estado", datos.anulado ? "Anulado" : "Pagado"],
        ],
      },
      {
        tipo: "tabla",
        titulo: "Cuotas cubiertas",
        columnas: [
          { titulo: "Cuota", ancho: 0.5 },
          { titulo: "Vencimiento", ancho: 0.25 },
          { titulo: "Monto", ancho: 0.25, alinear: "derecha" },
        ],
        filas: [
          ...datos.cuotas.map((c) => [c.concepto, fechaCorta(c.fechaVencimiento), `S/ ${c.monto}`]),
          ["Total de la operación", "", `S/ ${datos.monto}`],
        ],
      },
      { tipo: "texto", texto: `Registrado por: ${ctx.registradoPor}` },
    ],
    pie: `Recibo N.° ${datos.numero}`,
  };
}

/** Emite el comprobante dentro de la transacción: correlativo sin huecos, PDF determinista y su SHA-256. */
async function emitirComprobante(tx: Tx, op: OperacionFila, ctx: ContextoRecibo, anio: number) {
  await comprobantes.bloquearCorrelativo(tx, anio);
  const numero = siguienteComprobante(anio, await comprobantes.ultimoDelAnio(tx, prefijoComprobante(anio)));
  const bytes = await generarPdf(
    documentoRecibo(
      {
        numero,
        numeroOperacion: op.numeroOperacion,
        medioPago: op.medioPago,
        fechaPago: op.fechaPago,
        monto: op.monto,
        cuotas: op.cuotas,
        anulado: false,
      },
      ctx,
    ),
  );
  const c = await comprobantes.crear(tx, {
    operacionPagoId: op.id,
    numeroComprobante: numero,
    nombreArchivo: `recibo-${numero}.pdf`,
    archivoUrl: rutaRecibo(op.id),
    tamanoBytes: bytes.byteLength,
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    montoCentimos: aCentimos(op.monto),
  });
  return { id: c.id, numero, bytes };
}

/**
 * Copia del recibo al apoderado responsable, después de confirmar la transacción: si falla, el pago se conserva.
 * Sin SMTP configurado (como hoy en AWS) no se envía, `enviadoEn` queda vacío y se deja un aviso sin datos personales.
 */
async function enviarCopia(
  comprobante: { id: string; numero: string; bytes: Uint8Array },
  ctx: ContextoRecibo,
  requestId: string,
) {
  if (!smtpConfigurado()) {
    logger.warn("SMTP no configurado: no se envió la copia del recibo", { requestId, comprobante: comprobante.numero });
    return { enviado: false, motivo: "SMTP_NO_CONFIGURADO" as const };
  }
  if (!ctx.responsable?.email) {
    logger.warn("El apoderado responsable no tiene correo: no se envió la copia del recibo", {
      requestId,
      comprobante: comprobante.numero,
    });
    return { enviado: false, motivo: "SIN_CORREO" as const };
  }
  const enviado = await enviarCorreo({
    para: ctx.responsable.email,
    asunto: `Recibo de pago ${comprobante.numero}`,
    texto:
      `Hola, ${ctx.responsable.nombreCompleto}:\n\n` +
      `Adjuntamos el recibo ${comprobante.numero} del pago registrado para ${ctx.estudiante.nombres} ` +
      `${ctx.estudiante.apellidos}.\n\n${ctx.institucion}`,
    adjuntos: [{ nombre: `recibo-${comprobante.numero}.pdf`, contenido: comprobante.bytes, tipo: "application/pdf" }],
  });
  if (!enviado) return { enviado: false, motivo: "ERROR_ENVIO" as const };
  await comprobantes.marcarEnviado(comprobante.id, new Date());
  return { enviado: true, motivo: null };
}

const resumenCuotas = (lista: { concepto: string }[]) => lista.map((c) => c.concepto);

// ---------- Registrar un pago manual (US22, US23) ----------

export interface DatosPago {
  conceptoIds: string[];
  /** «900.00». */
  monto: string;
  medioPago: MedioPago;
  numeroOperacion?: string | null;
  /** «AAAA-MM-DD». */
  fechaPago: string;
}

/** Pago anual: matrícula cuyas cuotas pendientes se pagan todas juntas (US58). */
interface PagoAnual {
  matriculaId: string;
}

/** Quién registra: un Administrador desde tesorería (US22) o el Sistema con un pago en línea (US70). */
interface Actor {
  usuarioId: string | null;
  origen: OrigenPago;
}

/** Pago en línea aprobado: la order de la pasarela y el intento que lo originó (US70). */
interface DatosPasarela {
  ordenId: string;
  intentoId: string;
  estadoExterno: string;
}

interface OpcionesRegistro {
  anual: PagoAnual | null;
  pasarela: DatosPasarela | null;
}

/** Cambia la modalidad a Anual y deja CAMBIAR_MODALIDAD_PAGO (US58), dentro de la transacción del pago. */
async function pasarAModalidadAnual(
  tx: Tx,
  usuarioId: string,
  datos: { matriculaId: string; operacionId: string; anterior: ModalidadPago },
  meta: MetaSolicitud,
) {
  await matriculas.cambiarModalidad(datos.matriculaId, "ANUAL", tx);
  await registrarAuditoria(
    tx,
    {
      usuarioId,
      entidad: "matricula",
      entidadId: datos.matriculaId,
      accion: "CAMBIAR_MODALIDAD_PAGO",
      anterior: { modalidadPago: datos.anterior },
      nuevo: { modalidadPago: "ANUAL", operacionId: datos.operacionId },
      motivo: "Pago anual adelantado",
    },
    meta,
  );
}

type CuotaBloqueada = Awaited<ReturnType<typeof cuotasDePago.bloqueadas>>[number] & { montoCentimos: number };

/**
 * Estado de la operación nueva. Tesorería (US22, US23): el monto debe ser exactamente la suma y un número de operación
 * ya usado la deja Observado. Pasarela (US70): las cuotas se validan recién ahora (no se reservaron); una ya pagada o
 * anulada, o un monto que no cuadra, la deja Observado con el motivo, sin rechazar el aviso.
 */
async function estadoDeLaOperacion(
  tx: Tx,
  datos: { conceptoIds: string[]; cuotas: CuotaBloqueada[]; montoCentimos: number; numero: string },
  opciones: OpcionesRegistro,
) {
  if (opciones.pasarela) return estadoPagoPasarela(datos.conceptoIds, datos.cuotas, datos.montoCentimos);
  const suma = verificarCuotasPagables(datos.conceptoIds, datos.cuotas);
  if (opciones.anual) verificarMontoAnual(datos.montoCentimos, suma);
  else verificarMontoExacto(datos.montoCentimos, suma);
  return { estado: estadoInicialPago(await operaciones.numeroUsado(tx, datos.numero)), motivo: null };
}

/**
 * Núcleo del registro de un pago (US22, US58 y US70). En una transacción bloquea el número de operación (o la order de
 * la pasarela) y las filas de las cuotas (en el pago anual, todas las Pendiente de la matrícula):
 * - una cuota ya pagada: «Esta pensión ya fue cancelada el [fecha]» (US23); en un pago en línea, Observado (US70);
 * - el monto debe ser exactamente la suma (sin pagos parciales ni descuentos);
 * - con un número de operación ya usado en otra operación no anulada queda Observado y no toca las cuotas;
 * - si no, Confirmado: las cuotas pasan a Pagado y se emite UN comprobante con su correlativo (US25); en el pago
 *   anual, además, la matrícula pasa a modalidad Anual (CAMBIAR_MODALIDAD_PAGO).
 * Una order de la pasarela ya registrada no se registra otra vez (idempotencia, índice único). Auditoría
 * REGISTRAR_PAGO (US04) con el actor (usuario o Sistema) y el origen. La copia del recibo se envía después de confirmar.
 */
async function registrarOperacion(actor: Actor, datos: DatosPago, meta: MetaSolicitud, opciones: OpcionesRegistro) {
  const { anual, pasarela } = opciones;
  const numero = normalizarNumeroOperacion(datos.numeroOperacion);
  const montoCentimos = aCentimos(datos.monto);
  const hoy = fechaEnLima(new Date());
  verificarFechaPago(datos.fechaPago, hoy);
  const matriculaId = anual?.matriculaId ?? (await cuotasDePago.porIds(datos.conceptoIds))[0]?.matriculaId;
  const ctx = matriculaId
    ? await contextoRecibo({ matriculaId, fechaPago: datos.fechaPago, registradoPorId: actor.usuarioId })
    : null;

  const resultado = await prisma.$transaction(async (tx) => {
    if (pasarela) {
      await operaciones.bloquearReferencia(tx, pasarela.ordenId);
      const yaRegistrada = await operaciones.idPorReferencia(tx, pasarela.ordenId);
      if (yaRegistrada) return { id: yaRegistrada, estado: null, motivo: null, comprobante: null, repetido: true };
    } else {
      await operaciones.bloquearNumero(tx, numero);
    }
    let conceptoIds = datos.conceptoIds;
    let modalidadAnterior: ModalidadPago | null = null;
    if (anual) {
      await matriculas.bloquearFila(tx, anual.matriculaId);
      const m = await matriculas.porId(anual.matriculaId, tx);
      if (!m) throw E.noEncontrada();
      conceptoIds = await cuotasDePago.pendientesBloqueadas(tx, anual.matriculaId);
      verificarPagoAnualPosible(m.estado, NOMBRE_ESTADO_MATRICULA[m.estado], conceptoIds.length);
      modalidadAnterior = m.modalidadPago;
    }
    const lista = (await cuotasDePago.bloqueadas(tx, conceptoIds)).map((c) => ({
      ...c,
      montoCentimos: aCentimos(c.monto),
    }));
    const { estado, motivo } = await estadoDeLaOperacion(
      tx,
      { conceptoIds, cuotas: lista, montoCentimos, numero },
      opciones,
    );
    const id = await operaciones.crear(tx, {
      numeroOperacion: numero,
      medioPago: datos.medioPago,
      fechaPago: datos.fechaPago,
      montoCentimos,
      estado,
      registradoPorId: actor.usuarioId,
      confirmadoPorId: estado === "CONFIRMADO" ? actor.usuarioId : null,
      origen: actor.origen,
      referenciaExterna: pasarela?.ordenId ?? null,
      motivoObservacion: motivo,
      cuotas: conceptoIds.map((cid) => ({ id: cid, montoCentimos: lista.find((c) => c.id === cid)!.montoCentimos })),
    });
    let comprobante: Awaited<ReturnType<typeof emitirComprobante>> | null = null;
    if (estado === "CONFIRMADO") {
      await cuotasDePago.marcar(tx, conceptoIds, "PENDIENTE", "PAGADO");
      comprobante = await emitirComprobante(tx, (await operaciones.porId(id, tx))!, ctx!, Number(hoy.slice(0, 4)));
      if (anual && modalidadAnterior && actor.usuarioId) {
        await pasarAModalidadAnual(
          tx,
          actor.usuarioId,
          { matriculaId: anual.matriculaId, operacionId: id, anterior: modalidadAnterior },
          meta,
        );
      }
    }
    await registrarAuditoria(
      tx,
      {
        usuarioId: actor.usuarioId,
        entidad: ENTIDAD,
        entidadId: id,
        accion: "REGISTRAR_PAGO",
        nuevo: {
          administradorId: actor.usuarioId,
          actor: actor.usuarioId ? "USUARIO" : "SISTEMA",
          origen: actor.origen,
          fechaHora: new Date().toISOString(),
          monto: deCentimos(montoCentimos),
          conceptos: resumenCuotas(lista),
          numeroOperacion: numero,
          medioPago: datos.medioPago,
          fechaPago: datos.fechaPago,
          estadoResultante: estado === "CONFIRMADO" ? "PAGADO" : "OBSERVADO",
          motivoObservacion: motivo,
          comprobante: comprobante?.numero ?? null,
          // si queda Observado, la confirmación lo lee para cambiar la modalidad a Anual (US58)
          tipoPago: anual ? "ANUAL" : "CUOTAS",
          matriculaId,
          ...(pasarela ? { referenciaExterna: pasarela.ordenId, intentoId: pasarela.intentoId } : {}),
        },
      },
      meta,
    );
    if (pasarela) {
      await intentos.marcarResultado(tx, pasarela.intentoId, {
        estado: estado === "CONFIRMADO" ? "APROBADO" : "OBSERVADO",
        operacionPagoId: id,
        detalle: motivo,
        estadoExterno: pasarela.estadoExterno,
      });
    }
    return { id, estado, motivo, comprobante, repetido: false };
  });

  const correo = resultado.comprobante ? await enviarCopia(resultado.comprobante, ctx!, meta.requestId) : null;
  const aviso = resultado.estado === "OBSERVADO" ? (resultado.motivo ?? AVISO_NUMERO_REPETIDO) : null;
  return { operacion: await detalleOperacion(resultado.id), aviso, correo, repetido: resultado.repetido };
}

const desdeTesoreria = (admin: Autenticado): Actor => ({ usuarioId: admin.usuarioId, origen: "TESORERIA" });

/** Registra un pago manual de las cuotas elegidas (US22, US23). */
export const registrarPago = (admin: Autenticado, datos: DatosPago, meta: MetaSolicitud) =>
  registrarOperacion(desdeTesoreria(admin), datos, meta, { anual: null, pasarela: null });

/**
 * Registra un pago en línea aprobado (US70), con el mismo núcleo que el pago manual: cuotas bloqueadas, monto exacto,
 * recibo (US25), correo y auditoría (US04), con actor Sistema y origen PASARELA. Idempotente por la order: un aviso
 * repetido devuelve la operación ya registrada con `repetido: true`.
 */
export const registrarPagoPasarela = (
  intento: { id: string; conceptoIds: string[]; montoCentimos: number },
  cobro: { ordenId: string; estadoExterno: string },
  meta: MetaSolicitud,
) =>
  registrarOperacion(
    { usuarioId: null, origen: "PASARELA" },
    {
      conceptoIds: intento.conceptoIds,
      monto: deCentimos(intento.montoCentimos),
      medioPago: "PASARELA",
      numeroOperacion: cobro.ordenId,
      fechaPago: fechaEnLima(new Date()),
    },
    meta,
    {
      anual: null,
      pasarela: { ordenId: cobro.ordenId, intentoId: intento.id, estadoExterno: cobro.estadoExterno },
    },
  );

export type DatosPagoAnual = Omit<DatosPago, "conceptoIds">;

/**
 * Pago anual adelantado (US58): una sola operación por el total de las cuotas Pendiente de la matrícula, sin
 * descuento. Monto distinto: «El monto no coincide con el total pendiente». Si se confirma, la matrícula pasa a
 * modalidad Anual y se emite un único comprobante por el total.
 */
export const registrarPagoAnual = (
  admin: Autenticado,
  matriculaId: string,
  datos: DatosPagoAnual,
  meta: MetaSolicitud,
) =>
  registrarOperacion(desdeTesoreria(admin), { ...datos, conceptoIds: [] }, meta, {
    anual: { matriculaId },
    pasarela: null,
  });

/** ¿La operación se registró como pago anual? (lo guarda REGISTRAR_PAGO en la bitácora). */
export async function esPagoAnual(operacionId: string) {
  const [registro] = await eventosDeAuditoria({
    entidad: ENTIDAD,
    entidadIds: [operacionId],
    acciones: ["REGISTRAR_PAGO"],
    limite: 1,
  });
  return (registro?.valorNuevo as { tipoPago?: string } | null)?.tipoPago === "ANUAL";
}

// ---------- Confirmar o descartar una operación Observado (US23) ----------

/**
 * El Administrador confirma una operación Observado: sus cuotas deben seguir Pendiente (si otra operación ya las
 * pagó, «Esta pensión ya fue cancelada el [fecha]»), pasan a Pagado y se emite el comprobante. Queda en
 * `confirmado_por` y en CONFIRMAR_PAGO_OBSERVADO.
 */
export async function confirmarPagoObservado(admin: Autenticado, operacionId: string, meta: MetaSolicitud) {
  const previa = await operaciones.porId(operacionId);
  if (!previa) throw E.pagoNoEncontrado();
  verificarObservado(previa.estado);
  const [ctx, anual] = await Promise.all([contextoRecibo(previa), esPagoAnual(operacionId)]);
  const hoy = fechaEnLima(new Date());

  const comprobante = await prisma.$transaction(async (tx) => {
    await operaciones.bloquear(tx, operacionId);
    const op = (await operaciones.porId(operacionId, tx))!;
    verificarObservado(op.estado);
    const ids = op.cuotas.map((c) => c.id);
    const lista = await cuotasDePago.bloqueadas(tx, ids);
    verificarCuotasPagables(
      ids,
      lista.map((c) => ({ ...c, montoCentimos: aCentimos(c.monto) })),
    );
    await operaciones.confirmar(tx, operacionId, admin.usuarioId);
    await cuotasDePago.marcar(tx, ids, "PENDIENTE", "PAGADO");
    const emitido = await emitirComprobante(tx, { ...op, estado: "CONFIRMADO" }, ctx, Number(hoy.slice(0, 4)));
    if (anual) {
      const m = await matriculas.porId(op.matriculaId, tx);
      if (m && m.modalidadPago !== "ANUAL") {
        await pasarAModalidadAnual(
          tx,
          admin.usuarioId,
          { matriculaId: m.id, operacionId, anterior: m.modalidadPago },
          meta,
        );
      }
    }
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: ENTIDAD,
        entidadId: operacionId,
        accion: "CONFIRMAR_PAGO_OBSERVADO",
        anterior: { estado: "OBSERVADO" },
        nuevo: {
          estado: "CONFIRMADO",
          estadoResultante: "PAGADO",
          monto: op.monto,
          conceptos: resumenCuotas(op.cuotas),
          numeroOperacion: op.numeroOperacion,
          comprobante: emitido.numero,
          confirmadoPorId: admin.usuarioId,
        },
      },
      meta,
    );
    return emitido;
  });

  const correo = await enviarCopia(comprobante, ctx, meta.requestId);
  return { operacion: await detalleOperacion(operacionId), aviso: null, correo };
}

/** Descarta una operación Observado: pasa a Anulado con el motivo «Pago duplicado»; sus cuotas no cambian. */
export async function descartarPagoObservado(
  admin: Autenticado,
  operacionId: string,
  datos: { detalle?: string | null },
  meta: MetaSolicitud,
) {
  await prisma.$transaction(async (tx) => {
    await operaciones.bloquear(tx, operacionId);
    const op = await operaciones.porId(operacionId, tx);
    if (!op) throw E.pagoNoEncontrado();
    verificarObservado(op.estado);
    verificarDescartable(op.origen);
    const observacion = datos.detalle?.trim() || null;
    await operaciones.anular(tx, operacionId, {
      anuladoPorId: admin.usuarioId,
      anuladoEn: new Date(),
      motivoAnulacion: "PAGO_DUPLICADO",
      observacion,
    });
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: ENTIDAD,
        entidadId: operacionId,
        accion: "ANULAR_PAGO",
        anterior: { estado: "OBSERVADO" },
        nuevo: {
          estado: "ANULADO",
          decision: "DESCARTAR_OBSERVADO",
          motivo: "PAGO_DUPLICADO",
          monto: op.monto,
          conceptos: resumenCuotas(op.cuotas),
          numeroOperacion: op.numeroOperacion,
          cuotasRevertidas: 0,
        },
        motivo: observacion ? `PAGO_DUPLICADO: ${observacion}` : "PAGO_DUPLICADO",
      },
      meta,
    );
  });
  return { operacion: await detalleOperacion(operacionId) };
}

// ---------- Anular un pago (US04, US23, M-02) ----------

/**
 * Anula una operación con un motivo de la lista (US04). Nada se borra: la operación queda Anulado con motivo,
 * responsable y fecha. Si estaba Confirmado, sus cuotas vuelven a Pendiente y admiten un pago nuevo, que no se
 * considera duplicado (US23). Su comprobante se sigue descargando con la marca «ANULADO».
 */
export async function anularPago(
  admin: Autenticado,
  operacionId: string,
  datos: { motivo?: MotivoAnulacionElegible | null; detalle?: string | null },
  meta: MetaSolicitud,
) {
  const motivo = verificarMotivoAnulacionPago(datos.motivo, datos.detalle);
  const observacion = datos.detalle?.trim() || null;
  await prisma.$transaction(async (tx) => {
    await operaciones.bloquear(tx, operacionId);
    const op = await operaciones.porId(operacionId, tx);
    if (!op) throw E.pagoNoEncontrado();
    verificarPagoAnulable(op.estado);
    let revertidas = 0;
    if (op.estado === "CONFIRMADO") {
      const ids = op.cuotas.map((c) => c.id);
      await cuotasDePago.bloqueadas(tx, ids);
      revertidas = await cuotasDePago.marcar(tx, ids, "PAGADO", "PENDIENTE");
    }
    await operaciones.anular(tx, operacionId, {
      anuladoPorId: admin.usuarioId,
      anuladoEn: new Date(),
      motivoAnulacion: motivo,
      observacion,
    });
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: ENTIDAD,
        entidadId: operacionId,
        accion: "ANULAR_PAGO",
        anterior: { estado: op.estado },
        nuevo: {
          estado: "ANULADO",
          motivo,
          monto: op.monto,
          conceptos: resumenCuotas(op.cuotas),
          numeroOperacion: op.numeroOperacion,
          comprobante: op.comprobante?.numero ?? null,
          cuotasRevertidas: revertidas,
        },
        motivo: observacion ? `${motivo}: ${observacion}` : motivo,
      },
      meta,
    );
  });
  return { operacion: await detalleOperacion(operacionId) };
}

// ---------- Registrar devolución de un pago en línea Observado (US71) ----------

/**
 * Tesorería ya devolvió el dinero de un pago en línea Observado (por ejemplo, la cuota estaba pagada por otro medio):
 * la operación pasa a Anulado con el motivo «Devuelto». Sus cuotas no cambian (nunca se marcaron como pagadas). La
 * devolución en sí se hace en el panel de la pasarela. Queda REGISTRAR_DEVOLUCION en la auditoría.
 */
export async function registrarDevolucion(
  admin: Autenticado,
  operacionId: string,
  datos: { detalle?: string | null },
  meta: MetaSolicitud,
) {
  await prisma.$transaction(async (tx) => {
    await operaciones.bloquear(tx, operacionId);
    const op = await operaciones.porId(operacionId, tx);
    if (!op) throw E.pagoNoEncontrado();
    verificarDevolucionPosible(op);
    const observacion = datos.detalle?.trim() || null;
    await operaciones.anular(tx, operacionId, {
      anuladoPorId: admin.usuarioId,
      anuladoEn: new Date(),
      motivoAnulacion: "DEVUELTO",
      observacion,
    });
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: ENTIDAD,
        entidadId: operacionId,
        accion: "REGISTRAR_DEVOLUCION",
        anterior: { estado: "OBSERVADO", motivoObservacion: op.motivoObservacion },
        nuevo: {
          estado: "ANULADO",
          motivo: "DEVUELTO",
          origen: op.origen,
          monto: op.monto,
          conceptos: resumenCuotas(op.cuotas),
          numeroOperacion: op.numeroOperacion,
          referenciaExterna: op.referenciaExterna,
          cuotasRevertidas: 0,
        },
        motivo: observacion ? `${MOTIVO_DEVOLUCION}: ${observacion}` : MOTIVO_DEVOLUCION,
      },
      meta,
    );
  });
  return { operacion: await detalleOperacion(operacionId) };
}

// ---------- Recibo en PDF (US25, M-03) ----------

/**
 * PDF del recibo, generado bajo demanda con los datos guardados (no hay almacenamiento de archivos todavía).
 * Observado, o sin comprobante: «No se puede generar un recibo de un pago no confirmado».
 */
export async function reciboDePago(operacionId: string) {
  const op = await operaciones.porId(operacionId);
  if (!op) throw E.pagoNoEncontrado();
  verificarReciboDisponible(op.estado, Boolean(op.comprobante));
  const ctx = await contextoRecibo(op);
  const bytes = await generarPdf(
    documentoRecibo(
      {
        numero: op.comprobante!.numero,
        numeroOperacion: op.numeroOperacion,
        medioPago: op.medioPago,
        fechaPago: op.fechaPago,
        monto: op.monto,
        cuotas: op.cuotas,
        anulado: op.estado === "ANULADO",
      },
      ctx,
    ),
  );
  return { bytes, nombreArchivo: op.comprobante!.nombreArchivo };
}

// ---------- Estado de cuenta (AD-11) ----------

async function vistaOperaciones(lista: OperacionFila[]) {
  const nombres = await nombresDeUsuarios(
    lista.flatMap((o) => [o.registradoPorId, o.confirmadoPorId, o.anuladoPorId].filter((x): x is string => !!x)),
  );
  const nombre = (id: string | null) => (id ? (nombres[id]?.nombreCorto ?? "—") : null);
  const registrador = (o: OperacionFila) => (o.registradoPorId ? nombre(o.registradoPorId) : NOMBRE_SISTEMA);
  return Promise.all(
    lista.map(async (o) => ({
      operacionId: o.id,
      numeroOperacion: o.numeroOperacion,
      medioPago: o.medioPago,
      nombreMedioPago: NOMBRE_MEDIO_PAGO[o.medioPago],
      origen: o.origen,
      nombreOrigen: NOMBRE_ORIGEN_PAGO[o.origen],
      referenciaExterna: o.referenciaExterna,
      motivoObservacion: o.motivoObservacion,
      fechaPago: o.fechaPago,
      registradoEn: o.registradoEn,
      monto: o.monto,
      estado: o.estado,
      nombreEstado: NOMBRE_ESTADO_PAGO[o.estado],
      cuotas: o.cuotas,
      comprobante: o.comprobante && {
        numero: o.comprobante.numero,
        url: rutaRecibo(o.id),
        enviadoEn: o.comprobante.enviadoEn,
      },
      registradoPor: registrador(o),
      confirmadoPor: nombre(o.confirmadoPorId),
      anulacion:
        o.estado === "ANULADO" && o.motivoAnulacion
          ? {
              motivo: o.motivoAnulacion,
              nombreMotivo: NOMBRE_MOTIVO_ANULACION_PAGO[o.motivoAnulacion],
              detalle: o.observacionAnulacion,
              anuladoPor: nombre(o.anuladoPorId),
              anuladoEn: o.anuladoEn,
            }
          : null,
      // US23: con qué otras operaciones comparte el número (solo para las Observado de tesorería)
      mismoNumero:
        o.estado === "OBSERVADO" && o.origen === "TESORERIA"
          ? await operaciones.conMismoNumero(o.numeroOperacion, o.id)
          : [],
    })),
  );
}

/** Detalle de una operación de pago. */
export async function detalleOperacion(operacionId: string) {
  const op = await operaciones.porId(operacionId);
  if (!op) throw E.pagoNoEncontrado();
  return (await vistaOperaciones([op]))[0];
}

const TIPO_EVENTO: Record<string, string> = {
  ANULAR_PAGO: "Anulación",
  CONFIRMAR_PAGO_OBSERVADO: "Confirmación",
  REGISTRAR_DEVOLUCION: "Devolución",
};

/** Texto corto de un evento del log de pagos de AD-11. */
function detalleEvento(accion: string, nuevo: Record<string, unknown>) {
  const conceptos = Array.isArray(nuevo.conceptos) ? (nuevo.conceptos as string[]).join(", ") : "";
  const enLinea = nuevo.origen === "PASARELA" ? " · en línea" : "";
  const comprobante = nuevo.comprobante ? ` · ${String(nuevo.comprobante)}` : "";
  const base = `Op. ${String(nuevo.numeroOperacion ?? "")}${comprobante}${enLinea}`;
  if (accion === "ANULAR_PAGO" || accion === "REGISTRAR_DEVOLUCION") {
    const motivo = NOMBRE_MOTIVO_ANULACION_PAGO[nuevo.motivo as MotivoAnulacionPago] ?? String(nuevo.motivo ?? "");
    return `${base} · ${conceptos} · motivo: ${motivo.toLowerCase()}`;
  }
  const estado =
    nuevo.estadoResultante === "OBSERVADO"
      ? `queda Observado${nuevo.motivoObservacion ? ` (${String(nuevo.motivoObservacion).toLowerCase()})` : ""}`
      : "Pagado";
  return `${base} · ${conceptos} · S/ ${String(nuevo.monto ?? "")} · ${estado}`;
}

/**
 * Estado de cuenta del estudiante en un año (por defecto, su matrícula más reciente): cronograma con el pago de
 * cada cuota, totales pagado, pendiente y vencido, operaciones de pago con su historial y el log de auditoría.
 */
export async function estadoDeCuenta(estudianteId: string, anioId?: string) {
  const estudiante = await estudianteParaFicha(estudianteId);
  if (!estudiante) throw E.estudianteNoEncontrado();
  const todas = (await matriculasDeEstudiante(estudianteId)).filter((m) => m.estado !== "ANULADO");
  const m = (anioId ? todas.find((x) => x.anioAcademicoId === anioId) : todas[0]) ?? null;
  const anios = await Promise.all(todas.map(async (x) => ({ x, anio: await obtenerAnio(x.anioAcademicoId) })));
  const base = {
    estudiante: {
      estudianteId,
      dni: estudiante.dni,
      nombreCompleto: `${estudiante.nombres} ${estudiante.apellidos}`,
    },
    matriculas: anios.map(({ x, anio }) => ({ matriculaId: x.id, anioId: anio.id, anio: anio.anio, estado: x.estado })),
  };
  if (!m) return { ...base, matricula: null, cuotas: [], totales: null, operaciones: [], log: [] };

  const hoy = fechaEnLima(new Date());
  const [anio, secciones, lista, todasOps] = await Promise.all([
    obtenerAnio(m.anioAcademicoId),
    listarSecciones(m.anioAcademicoId),
    cuotasMatricula.deMatricula(m.id),
    operaciones.deEstudiante(estudianteId),
  ]);
  const ops = todasOps.filter((o) => o.matriculaId === m.id);
  const vistas = await vistaOperaciones(ops);
  const confirmadaDe = new Map<string, (typeof vistas)[number]>();
  const observadaDe = new Set<string>();
  for (const v of vistas) {
    for (const c of v.cuotas) {
      if (v.estado === "CONFIRMADO") confirmadaDe.set(c.id, v);
      if (v.estado === "OBSERVADO") observadaDe.add(c.id);
    }
  }
  const cuotas = lista.map((c) => {
    const pago = c.id ? confirmadaDe.get(c.id) : undefined;
    return {
      ...c,
      vencida: c.estado === "PENDIENTE" && c.fechaVencimiento < hoy,
      observada: c.id ? observadaDe.has(c.id) : false,
      pago: pago
        ? {
            operacionId: pago.operacionId,
            fechaPago: pago.fechaPago,
            numeroOperacion: pago.numeroOperacion,
            comprobante: pago.comprobante?.numero ?? null,
            cuotasDeLaOperacion: pago.cuotas.length,
          }
        : null,
    };
  });
  const de = (estado: string, vencida?: boolean) =>
    cuotas.filter((c) => c.estado === estado && (vencida === undefined || c.vencida === vencida));
  const eventos = await eventosDeAuditoria({
    entidad: ENTIDAD,
    entidadIds: ops.map((o) => o.id),
    acciones: ACCIONES_PAGO,
  });
  const nombres = await nombresDeUsuarios(eventos.flatMap((e) => (e.usuarioId ? [e.usuarioId] : [])));
  const seccion = secciones.find((s) => s.id === m.seccionId);
  const estudianteFicha = estudiante.apoderados.find((a) => a.vinculoId === m.vinculoResponsableId);

  return {
    ...base,
    matricula: {
      matriculaId: m.id,
      anio: { id: anio.id, anio: anio.anio },
      estado: m.estado,
      nombreEstado: NOMBRE_ESTADO_MATRICULA[m.estado],
      fechaMatricula: m.fechaMatricula,
      modalidadPago: m.modalidadPago,
      seccion: seccion ? `${seccion.grado.numero}° ${seccion.nombre}` : null,
      responsable: estudianteFicha
        ? { nombreCompleto: estudianteFicha.nombreCompleto, email: estudianteFicha.email }
        : null,
    },
    cuotas,
    totales: {
      pagado: deCentimos(centimosDe(de("PAGADO"))),
      cuotasPagadas: de("PAGADO").length,
      pendiente: deCentimos(centimosDe(de("PENDIENTE", false))),
      cuotasPendientes: de("PENDIENTE", false).length,
      vencido: deCentimos(centimosDe(de("PENDIENTE", true))),
      cuotasVencidas: de("PENDIENTE", true).length,
    },
    operaciones: vistas,
    log: eventos.map((e) => ({
      id: e.id,
      fecha: e.fecha,
      accion: e.accion,
      tipo: TIPO_EVENTO[e.accion] ?? "Registro",
      detalle: detalleEvento(e.accion, (e.valorNuevo ?? {}) as Record<string, unknown>),
      usuario: e.usuarioId ? (nombres[e.usuarioId]?.nombreCorto ?? "—") : "Sistema",
    })),
  };
}
