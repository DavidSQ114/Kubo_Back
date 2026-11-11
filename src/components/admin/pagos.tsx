// Piezas de AD-11 Pensiones y pagos: modal M-01 Registrar pago manual (US22, US23), modal M-02 Anular pago (US04),
// cronograma con el pago de cada cuota, operaciones de pago con su origen (Tesorería o Pasarela) y «Registrar
// devolución» de un pago en línea Observado (US70, US71), y log de auditoría de pagos.
"use client";

import { useState } from "react";
import { Alerta, Badge, Boton, Campo, Icono, Modal } from "@/components/ui";
import { api, descargar } from "@/lib/api";
import { fechaDia, fechaHora, hoyEnLima } from "@/lib/formato";
import { Avatar } from "./apoderados";
import { Selector, separarErrores } from "./grados";
import { soles } from "./matricula";
import { alertaError } from "./PortalAdmin";

// ---------- Tipos de la API (docs/api/matricula.md, «Pagos») ----------

export type EstadoPago = "OBSERVADO" | "CONFIRMADO" | "ANULADO";
export type MedioPago = "EFECTIVO" | "TRANSFERENCIA" | "DEPOSITO" | "TARJETA" | "PASARELA";
export type OrigenPago = "TESORERIA" | "PASARELA";

export interface CuotaCuenta {
  id: string;
  tipo: "MATRICULA" | "PENSION";
  mes: number | null;
  concepto: string;
  monto: string;
  fechaVencimiento: string;
  estado: "PENDIENTE" | "PAGADO" | "ANULADO";
  vencida: boolean;
  observada: boolean;
  pago: {
    operacionId: string;
    fechaPago: string;
    numeroOperacion: string;
    comprobante: string | null;
    cuotasDeLaOperacion: number;
  } | null;
}

export interface OperacionPago {
  operacionId: string;
  numeroOperacion: string;
  medioPago: MedioPago;
  nombreMedioPago: string;
  origen: OrigenPago;
  nombreOrigen: string;
  /** ID de la order en la pasarela (solo pagos en línea). */
  referenciaExterna: string | null;
  /** Por qué quedó Observado un pago en línea («Cuota pagada por otro medio»). */
  motivoObservacion: string | null;
  fechaPago: string;
  registradoEn: string;
  monto: string;
  estado: EstadoPago;
  nombreEstado: string;
  cuotas: { id: string; concepto: string; fechaVencimiento: string; monto: string }[];
  comprobante: { numero: string; url: string; enviadoEn: string | null } | null;
  registradoPor: string | null;
  confirmadoPor: string | null;
  anulacion: {
    motivo: string;
    nombreMotivo: string;
    detalle: string | null;
    anuladoPor: string | null;
    anuladoEn: string;
  } | null;
  mismoNumero: { operacionId: string; comprobante: string | null }[];
}

export interface EstadoCuenta {
  estudiante: { estudianteId: string; dni: string; nombreCompleto: string };
  matriculas: { matriculaId: string; anioId: string; anio: number; estado: string }[];
  matricula: {
    matriculaId: string;
    anio: { id: string; anio: number };
    estado: string;
    nombreEstado: string;
    fechaMatricula: string;
    modalidadPago: "MENSUAL" | "ANUAL";
    seccion: string | null;
    responsable: { nombreCompleto: string; email: string | null } | null;
  } | null;
  cuotas: CuotaCuenta[];
  totales: {
    pagado: string;
    cuotasPagadas: number;
    pendiente: string;
    cuotasPendientes: number;
    vencido: string;
    cuotasVencidas: number;
  } | null;
  operaciones: OperacionPago[];
  log: { id: string; fecha: string; accion: string; tipo: string; detalle: string; usuario: string }[];
}

/** Respuesta de registrar o confirmar un pago. */
export interface ResultadoPago {
  operacion: OperacionPago;
  aviso: string | null;
  correo: { enviado: boolean; motivo: string | null } | null;
}

export const MENSAJE_MONTO_NO_COINCIDE = "El monto ingresado no coincide con el total de las cuotas seleccionadas";
export const MENSAJE_SIN_NUMERO = "El número de operación es obligatorio";

/** Medios del registro manual (M-01); «Pago en línea» solo lo asigna la pasarela. */
export const MEDIOS_PAGO: { valor: MedioPago; texto: string }[] = [
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "DEPOSITO", texto: "Depósito" },
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TARJETA", texto: "Tarjeta" },
];

export const MOTIVOS_ANULACION_PAGO = [
  {
    valor: "ERROR_DIGITACION",
    texto: "Error de digitación",
    ayuda: "Monto, fecha o N.° de operación ingresados incorrectamente.",
  },
  {
    valor: "PAGO_DUPLICADO",
    texto: "Pago duplicado",
    ayuda: "La misma transferencia se registró en más de una pensión.",
  },
  { valor: "SOLICITUD_APODERADO", texto: "Solicitud del apoderado", ayuda: "El apoderado pidió revertir el registro." },
  { valor: "OTRO", texto: "Otro", ayuda: "Se detalla en la observación, que pasa a ser obligatoria." },
] as const;

/** «450.00» → céntimos enteros, sin float. */
export function centimos(monto: string) {
  const [enteros, decimales = "0"] = monto.trim().split(".");
  return Number(enteros) * 100 + Number(decimales.padEnd(2, "0").slice(0, 2));
}
const aMonto = (c: number) => `${Math.trunc(c / 100)}.${String(c % 100).padStart(2, "0")}`;

export function BadgeCuota({ cuota }: { cuota: CuotaCuenta }) {
  if (cuota.estado === "PAGADO")
    return (
      <Badge tono="verde" punto>
        Pagado
      </Badge>
    );
  if (cuota.estado === "ANULADO")
    return (
      <Badge tono="gris" punto>
        Anulado
      </Badge>
    );
  if (cuota.observada)
    return (
      <Badge tono="ambar" punto>
        Observado
      </Badge>
    );
  if (cuota.vencida)
    return (
      <Badge tono="rojo" punto>
        Vencido
      </Badge>
    );
  return (
    <Badge tono="celeste" punto>
      Pendiente
    </Badge>
  );
}

export function BadgeOperacion({ estado }: { estado: EstadoPago }) {
  if (estado === "CONFIRMADO")
    return (
      <Badge tono="verde" punto>
        Confirmado
      </Badge>
    );
  if (estado === "OBSERVADO")
    return (
      <Badge tono="ambar" punto>
        Observado
      </Badge>
    );
  return (
    <Badge tono="gris" punto>
      Anulado
    </Badge>
  );
}

/** Descarga el recibo (US25); los errores se muestran con `onError`. */
export function BotonRecibo({
  operacionId,
  comprobante,
  onError,
  texto,
}: {
  operacionId: string;
  comprobante: string;
  onError: (mensaje: string | null) => void;
  texto?: string;
}) {
  const [bajando, setBajando] = useState(false);
  async function bajar() {
    setBajando(true);
    onError(null);
    try {
      await descargar(`/matricula/pagos/${operacionId}/comprobante`, `recibo-${comprobante}.pdf`);
    } catch (e) {
      onError(alertaError(e));
    } finally {
      setBajando(false);
    }
  }
  if (texto) {
    return (
      <Boton variante="secundario" icono="icon-pdf" onClick={bajar} cargando={bajando}>
        {texto}
      </Boton>
    );
  }
  return (
    <button
      type="button"
      onClick={bajar}
      disabled={bajando}
      aria-label={`Descargar el recibo ${comprobante}`}
      className="rounded p-1 hover:bg-fondo disabled:opacity-50"
    >
      <Icono nombre="icon-pdf" size={18} />
    </button>
  );
}

// ---------- M-01 · Registrar pago manual (US22, US23) ----------

export function ModalRegistrarPago({
  cuenta,
  preseleccion,
  onCerrar,
  onRegistrado,
}: {
  cuenta: EstadoCuenta;
  preseleccion: string[];
  onCerrar: () => void;
  onRegistrado: (r: ResultadoPago) => void;
}) {
  const pendientes = cuenta.cuotas.filter((c) => c.estado === "PENDIENTE");
  const [elegidas, setElegidas] = useState<string[]>(preseleccion);
  const total = pendientes.filter((c) => elegidas.includes(c.id)).reduce((t, c) => t + centimos(c.monto), 0);
  const [monto, setMonto] = useState(preseleccion.length ? aMonto(total) : "");
  const [fecha, setFecha] = useState(hoyEnLima());
  const [numero, setNumero] = useState("");
  const [medio, setMedio] = useState<MedioPago | "">("TRANSFERENCIA");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function alternar(id: string, marcado: boolean) {
    const nuevas = marcado ? [...elegidas, id] : elegidas.filter((x) => x !== id);
    setElegidas(nuevas);
    // el monto sigue al total mientras el usuario no lo cambie a mano
    const nuevoTotal = pendientes.filter((c) => nuevas.includes(c.id)).reduce((t, c) => t + centimos(c.monto), 0);
    if (!monto || centimos(monto) === total) setMonto(nuevoTotal ? aMonto(nuevoTotal) : "");
  }

  async function registrar() {
    const e: Record<string, string> = {};
    if (!elegidas.length) e.conceptoIds = "Selecciona al menos una cuota pendiente.";
    if (!numero.trim()) e.numeroOperacion = MENSAJE_SIN_NUMERO;
    if (!medio) e.medioPago = "Elige el medio de pago";
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    setGeneral(null);
    try {
      const r = await api<ResultadoPago>("/matricula/pagos", {
        method: "POST",
        body: {
          conceptoIds: elegidas,
          monto: monto.trim(),
          medioPago: medio,
          numeroOperacion: numero,
          fechaPago: fecha,
        },
      });
      onRegistrado(r);
    } catch (err) {
      const r = separarErrores(err);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="nav-wallet"
      tonoIcono="azul"
      titulo="Registrar pago manual"
      subtitulo={`Operación de pago · ${cuenta.estudiante.nombreCompleto}${cuenta.matricula?.seccion ? ` (${cuenta.matricula.seccion})` : ""}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono="check-blanco" onClick={registrar} cargando={enviando}>
            Registrar pago
          </Boton>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-lg border border-borde bg-fondo p-3">
        <Avatar nombre={cuenta.estudiante.nombreCompleto} />
        <div className="flex flex-col text-[13px]">
          <span className="font-semibold text-texto">{cuenta.estudiante.nombreCompleto}</span>
          <span className="text-texto-3">
            {`${cuenta.matricula?.seccion ?? "Sin sección"} · Responsable del pago: ${cuenta.matricula?.responsable?.nombreCompleto ?? "—"}`}
          </span>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-borde">
        <p className="flex justify-between border-b border-borde bg-fondo px-3 py-2 text-[13px] font-semibold text-texto-2">
          <span>Cuotas pendientes del estudiante</span>
          <span className="font-normal text-texto-3">{`${pendientes.length} pendientes`}</span>
        </p>
        {pendientes.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 border-b border-borde px-3 py-2 last:border-0"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label={`Pagar ${c.concepto}`}
                checked={elegidas.includes(c.id)}
                onChange={(e) => alternar(c.id, e.target.checked)}
                className="size-[18px] accent-kubo-azul"
              />
              <div className="flex flex-col text-[13px]">
                <span className="font-semibold text-texto">{c.concepto}</span>
                <span className="text-texto-3">
                  {`${c.vencida ? "Venció" : "Vence"} el ${fechaDia(c.fechaVencimiento)}`}
                  {c.observada ? " · tiene un pago observado" : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BadgeCuota cuota={c} />
              <span className="text-[14px] font-semibold text-texto">{soles(c.monto)}</span>
            </div>
          </div>
        ))}
      </div>
      {errores.conceptoIds && <p className="text-[13px] text-rojo-oscuro">{errores.conceptoIds}</p>}
      <div className="flex items-center justify-between rounded-lg bg-fondo px-4 py-3">
        <div className="flex flex-col text-[13px]">
          <span className="font-semibold text-texto">Total de la operación</span>
          <span className="text-texto-3">{`${elegidas.length} cuota${elegidas.length === 1 ? "" : "s"} seleccionada${elegidas.length === 1 ? "" : "s"}`}</span>
        </div>
        <span className="text-[22px] font-semibold text-kubo-azul">{soles(aMonto(total))}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Monto de la operación (S/)"
          obligatorio
          inputMode="decimal"
          value={monto}
          error={errores.monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <Campo
          etiqueta="Fecha de pago"
          obligatorio
          type="date"
          max={hoyEnLima()}
          value={fecha}
          error={errores.fechaPago}
          onChange={(e) => setFecha(e.target.value)}
        />
        <Campo
          etiqueta="N.° de operación"
          obligatorio
          maxLength={40}
          placeholder="Por ejemplo, 00561207"
          value={numero}
          error={errores.numeroOperacion}
          onChange={(e) => setNumero(e.target.value)}
        />
        <Selector
          etiqueta="Medio de pago"
          obligatorio
          valor={medio}
          error={errores.medioPago}
          onCambiar={(v) => setMedio(v as MedioPago)}
        >
          <option value="">Elige el medio</option>
          {MEDIOS_PAGO.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.texto}
            </option>
          ))}
        </Selector>
      </div>
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}

// ---------- M-15 · Pago anual adelantado (US58) ----------

export const MENSAJE_MONTO_ANUAL = "El monto no coincide con el total pendiente";

export function ModalPagoAnual({
  cuenta,
  onCerrar,
  onRegistrado,
}: {
  cuenta: EstadoCuenta;
  onCerrar: () => void;
  onRegistrado: (r: ResultadoPago) => void;
}) {
  const vigentes = cuenta.cuotas.filter((c) => c.estado !== "ANULADO");
  const pagadas = vigentes.filter((c) => c.estado === "PAGADO");
  const pendientes = vigentes.filter((c) => c.estado === "PENDIENTE");
  const suma = (lista: CuotaCuenta[]) => lista.reduce((t, c) => t + centimos(c.monto), 0);
  const total = suma(pendientes);
  const [monto, setMonto] = useState(aMonto(total));
  const [fecha, setFecha] = useState(hoyEnLima());
  const [numero, setNumero] = useState("");
  const [medio, setMedio] = useState<MedioPago | "">("TRANSFERENCIA");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function registrar() {
    const e: Record<string, string> = {};
    if (!numero.trim()) e.numeroOperacion = MENSAJE_SIN_NUMERO;
    if (!medio) e.medioPago = "Elige el medio de pago";
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    setGeneral(null);
    try {
      const r = await api<ResultadoPago>(`/matricula/matriculas/${cuenta.matricula!.matriculaId}/pago-anual`, {
        method: "POST",
        body: { monto: monto.trim(), medioPago: medio, numeroOperacion: numero, fechaPago: fecha },
      });
      onRegistrado(r);
    } catch (err) {
      const r = separarErrores(err);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setEnviando(false);
    }
  }

  const fila = (texto: string, valor: string, clase = "text-texto") => (
    <div className="flex justify-between gap-3 border-b border-borde py-2 text-[14px] last:border-0">
      <span className="text-texto-2">{texto}</span>
      <span className={`font-semibold ${clase}`}>{valor}</span>
    </div>
  );

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="nav-wallet"
      tonoIcono="azul"
      titulo="Pago anual adelantado"
      subtitulo={`${cuenta.estudiante.nombreCompleto}${cuenta.matricula?.seccion ? ` · ${cuenta.matricula.seccion}` : ""} · año académico ${cuenta.matricula?.anio.anio ?? ""}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono="check-blanco" onClick={registrar} cargando={enviando} disabled={!pendientes.length}>
            Registrar pago anual
          </Boton>
        </>
      }
    >
      <Alerta tipo="info" titulo="Pago de todas las cuotas pendientes en una sola operación">
        El colegio no tiene definido ningún descuento por pago adelantado: el total es la suma de las cuotas pendientes.
      </Alerta>
      <div className="flex flex-col">
        {fila(`${vigentes.length} cuotas del año`, soles(aMonto(suma(vigentes))))}
        {fila(`Cuotas ya pagadas (${pagadas.length})`, `− ${soles(aMonto(suma(pagadas)))}`, "text-verde-oscuro")}
        {fila(`Total a pagar hoy (${pendientes.length} pendientes)`, soles(aMonto(total)))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Monto recibido (S/)"
          obligatorio
          inputMode="decimal"
          value={monto}
          error={errores.monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <Campo
          etiqueta="Fecha de pago"
          obligatorio
          type="date"
          max={hoyEnLima()}
          value={fecha}
          error={errores.fechaPago}
          onChange={(e) => setFecha(e.target.value)}
        />
        <Campo
          etiqueta="N.° de operación"
          obligatorio
          maxLength={40}
          value={numero}
          error={errores.numeroOperacion}
          onChange={(e) => setNumero(e.target.value)}
        />
        <Selector
          etiqueta="Medio de pago"
          obligatorio
          valor={medio}
          error={errores.medioPago}
          onCambiar={(v) => setMedio(v as MedioPago)}
        >
          <option value="">Elige el medio</option>
          {MEDIOS_PAGO.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.texto}
            </option>
          ))}
        </Selector>
      </div>
      <Alerta tipo="aviso" titulo="Al confirmar">
        Las cuotas pendientes pasan a «Pagado», la modalidad de pago de la matrícula cambia a «Anual», se emite un único
        comprobante por el total y el estudiante sale del panel de morosidad.
      </Alerta>
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}

// ---------- M-02 · Anular pago (US04) ----------

export function ModalAnularPago({
  operacion,
  estudiante,
  onCerrar,
  onAnulado,
}: {
  operacion: OperacionPago;
  estudiante: string;
  onCerrar: () => void;
  onAnulado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function anular() {
    const e: Record<string, string> = {};
    if (!motivo) e.motivo = "Selecciona el motivo de la anulación.";
    if (motivo === "OTRO" && !detalle.trim())
      e.detalle = "Con el motivo «Otro», describe la anulación en la observación.";
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    setGeneral(null);
    try {
      await api(`/matricula/pagos/${operacion.operacionId}/anular`, {
        method: "POST",
        body: { motivo, detalle: detalle.trim() || null },
      });
      onAnulado();
    } catch (err) {
      const r = separarErrores(err);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setEnviando(false);
    }
  }

  const cuotas = operacion.cuotas.length;
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="act-ban"
      titulo="Anular pago"
      subtitulo={`Operación ${operacion.numeroOperacion}${operacion.comprobante ? ` · Recibo ${operacion.comprobante.numero}` : ""} · ${cuotas} cuota${cuotas === 1 ? "" : "s"} · ${soles(operacion.monto)}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="peligro" icono="icon-ban-blanco" onClick={anular} cargando={enviando}>
            Anular pago
          </Boton>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 rounded-lg border border-borde bg-fondo p-3 text-[13px]">
        <div className="flex flex-col">
          <span className="font-semibold text-texto">{estudiante}</span>
          <span className="text-texto-3">
            {`Registrado el ${fechaHora(new Date(operacion.registradoEn))} · Op. ${operacion.numeroOperacion}`}
          </span>
        </div>
        <BadgeOperacion estado={operacion.estado} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex gap-1 text-[14px] font-medium text-texto-2">
          Motivo de anulación <span className="text-rojo">*</span>
        </legend>
        {MOTIVOS_ANULACION_PAGO.map((m) => (
          <label
            key={m.valor}
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${motivo === m.valor ? "border-kubo-azul ring-1 ring-kubo-azul" : "border-borde"}`}
          >
            <input
              type="radio"
              name="motivo-anulacion-pago"
              value={m.valor}
              checked={motivo === m.valor}
              onChange={() => setMotivo(m.valor)}
              className="mt-1 accent-kubo-azul"
            />
            <span className="flex flex-col text-[13px]">
              <span className="font-semibold text-texto">{m.texto}</span>
              <span className="text-texto-3">{m.ayuda}</span>
            </span>
          </label>
        ))}
        {errores.motivo && <p className="text-[13px] text-rojo-oscuro">{errores.motivo}</p>}
      </fieldset>
      <Campo
        etiqueta={motivo === "OTRO" ? "Observación" : "Observación (opcional)"}
        obligatorio={motivo === "OTRO"}
        maxLength={300}
        value={detalle}
        error={errores.detalle}
        onChange={(e) => setDetalle(e.target.value)}
      />
      <Alerta tipo="info" titulo="Qué ocurre al anular">
        {operacion.estado === "CONFIRMADO"
          ? "Las cuotas que cubría vuelven a «Pendiente» y admiten un nuevo pago. El registro no se borra: queda «Anulado» con el motivo, tu usuario y la fecha, y su recibo se descarga con la marca «ANULADO»."
          : "La operación queda «Anulado» con el motivo, tu usuario y la fecha. Sus cuotas no cambian."}
      </Alerta>
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}

// ---------- US71 · Registrar devolución de un pago en línea Observado ----------

export function ModalDevolucion({
  operacion,
  estudiante,
  onCerrar,
  onDevuelto,
}: {
  operacion: OperacionPago;
  estudiante: string;
  onCerrar: () => void;
  onDevuelto: () => void;
}) {
  const [detalle, setDetalle] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function registrar() {
    setEnviando(true);
    setGeneral(null);
    try {
      await api(`/matricula/pagos/${operacion.operacionId}/devolver`, {
        method: "POST",
        body: { detalle: detalle.trim() || null },
      });
      onDevuelto();
    } catch (err) {
      const r = separarErrores(err);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="act-refresh"
      tonoIcono="azul"
      titulo="Registrar devolución"
      subtitulo={`Pago en línea ${operacion.numeroOperacion} · ${soles(operacion.monto)}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton onClick={registrar} cargando={enviando}>
            Registrar devolución
          </Boton>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 rounded-lg border border-borde bg-fondo p-3 text-[13px]">
        <div className="flex flex-col">
          <span className="font-semibold text-texto">{estudiante}</span>
          <span className="text-texto-3">
            {`${operacion.cuotas.map((c) => c.concepto).join(", ")} · ${operacion.motivoObservacion ?? "Observado"}`}
          </span>
        </div>
        <BadgeOperacion estado={operacion.estado} />
      </div>
      <Campo
        etiqueta="Observación (opcional)"
        maxLength={300}
        placeholder="Por ejemplo, N.° de la devolución en Mercado Pago"
        value={detalle}
        error={errores.detalle}
        onChange={(e) => setDetalle(e.target.value)}
      />
      <Alerta tipo="info" titulo="Antes de registrar">
        Devuelve primero el dinero desde el panel de Mercado Pago. Aquí solo se deja constancia: la operación pasa a
        «Anulado» con el motivo «Devuelto», tu usuario y la fecha, y sus cuotas no cambian.
      </Alerta>
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}

// ---------- Tablas de AD-11 ----------

export function TablaCronogramaPagos({
  cuenta,
  onRegistrar,
  onError,
}: {
  cuenta: EstadoCuenta;
  onRegistrar: (cuotaId: string) => void;
  onError: (mensaje: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-borde">
      <table className="w-full min-w-[820px] text-left text-[13px]">
        <thead className="bg-fondo text-texto-2">
          <tr>
            {["Concepto", "Vencimiento", "Monto", "Estado", "Fecha de pago", "N.° de operación", "Comprobante", ""].map(
              (t) => (
                <th key={t} className="px-3 py-2 font-semibold">
                  {t}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {cuenta.cuotas.map((c) => (
            <tr key={c.id} className={`border-t border-borde ${c.vencida ? "bg-[rgba(214,69,69,0.06)]" : ""}`}>
              <td className="px-3 py-2">
                <span className="font-semibold text-texto">{c.concepto}</span>
                {c.pago && c.pago.cuotasDeLaOperacion > 1 && (
                  <span className="block text-[12px] text-kubo-azul">
                    {`Operación ${c.pago.numeroOperacion} · ${c.pago.cuotasDeLaOperacion} cuotas`}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-texto-2">{fechaDia(c.fechaVencimiento)}</td>
              <td className="px-3 py-2 text-texto">{soles(c.monto)}</td>
              <td className="px-3 py-2">
                <BadgeCuota cuota={c} />
              </td>
              <td className="px-3 py-2 text-texto-2">{c.pago ? fechaDia(c.pago.fechaPago) : "—"}</td>
              <td className="px-3 py-2 text-texto-2">{c.pago?.numeroOperacion ?? "—"}</td>
              <td className="px-3 py-2 text-texto-2">{c.pago?.comprobante ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                {c.pago?.comprobante && (
                  <BotonRecibo operacionId={c.pago.operacionId} comprobante={c.pago.comprobante} onError={onError} />
                )}
                {c.estado === "PENDIENTE" && (
                  <Boton variante="secundario" onClick={() => onRegistrar(c.id)}>
                    Registrar pago
                  </Boton>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TablaOperaciones({
  operaciones,
  ocupado,
  onAnular,
  onConfirmar,
  onDescartar,
  onDevolver,
  onError,
}: {
  operaciones: OperacionPago[];
  ocupado: string | null;
  onAnular: (o: OperacionPago) => void;
  onConfirmar: (o: OperacionPago) => void;
  onDescartar: (o: OperacionPago) => void;
  onDevolver: (o: OperacionPago) => void;
  onError: (mensaje: string | null) => void;
}) {
  const [origen, setOrigen] = useState<OrigenPago | "TODOS">("TODOS");
  if (!operaciones.length) {
    return <p className="text-[14px] text-texto-2">Todavía no hay operaciones de pago para esta matrícula.</p>;
  }
  const filas = origen === "TODOS" ? operaciones : operaciones.filter((o) => o.origen === origen);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 self-end text-[13px] text-texto-2">
        Origen
        <select
          value={origen}
          onChange={(e) => setOrigen(e.target.value as typeof origen)}
          className="rounded-lg border border-borde bg-white px-3 py-2 text-[14px] text-texto"
        >
          <option value="TODOS">Todos</option>
          <option value="TESORERIA">Tesorería</option>
          <option value="PASARELA">Pasarela</option>
        </select>
      </label>
      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead className="bg-fondo text-texto-2">
            <tr>
              {["N.° de operación", "Fecha", "Origen", "Cuotas que cubre", "Monto", "Comprobante", "Estado", ""].map(
                (t) => (
                  <th key={t} className="px-3 py-2 font-semibold">
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((o) => (
              <tr key={o.operacionId} className="border-t border-borde align-top">
                <td className="px-3 py-2 font-semibold break-all text-texto">{o.numeroOperacion}</td>
                <td className="px-3 py-2 text-texto-2">{fechaDia(o.fechaPago)}</td>
                <td className="px-3 py-2">
                  <Badge tono={o.origen === "PASARELA" ? "celeste" : "gris"}>{o.nombreOrigen}</Badge>
                </td>
                <td className="px-3 py-2 text-texto-2">
                  {o.cuotas.map((c) => c.concepto).join(", ")}
                  {o.anulacion && (
                    <span className="mt-1 block text-[12px] text-texto-3">
                      {`Anulado el ${fechaHora(new Date(o.anulacion.anuladoEn))} por ${o.anulacion.anuladoPor ?? "—"} · ${o.anulacion.nombreMotivo}${o.anulacion.detalle ? `: ${o.anulacion.detalle}` : ""}`}
                    </span>
                  )}
                  {o.estado === "OBSERVADO" && o.origen === "PASARELA" && (
                    <span className="mt-1 block text-[12px] text-ambar-oscuro">
                      {`${o.motivoObservacion ?? "Pago en línea en revisión"} · confirma si la cuota quedó libre o registra la devolución`}
                    </span>
                  )}
                  {o.estado === "OBSERVADO" && o.origen === "TESORERIA" && (
                    <span className="mt-1 block text-[12px] text-ambar-oscuro">
                      {`Número ya usado${o.mismoNumero.length ? ` en ${o.mismoNumero.map((x) => x.comprobante ?? "otra operación").join(", ")}` : ""}`}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-texto">{soles(o.monto)}</td>
                <td className="px-3 py-2 text-texto-2">{o.comprobante?.numero ?? "—"}</td>
                <td className="px-3 py-2">
                  <BadgeOperacion estado={o.estado} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {o.comprobante && (
                      <BotonRecibo operacionId={o.operacionId} comprobante={o.comprobante.numero} onError={onError} />
                    )}
                    {o.estado === "CONFIRMADO" && (
                      <button
                        type="button"
                        onClick={() => onAnular(o)}
                        aria-label={`Anular la operación ${o.numeroOperacion}`}
                        className="rounded p-1 hover:bg-fondo"
                      >
                        <Icono nombre="act-ban" size={18} />
                      </button>
                    )}
                    {o.estado === "OBSERVADO" && o.origen === "PASARELA" && (
                      <Boton variante="secundario" onClick={() => onDevolver(o)} disabled={ocupado === o.operacionId}>
                        Registrar devolución
                      </Boton>
                    )}
                    {o.estado === "OBSERVADO" && (
                      <>
                        {o.origen === "TESORERIA" && (
                          <Boton
                            variante="secundario"
                            onClick={() => onDescartar(o)}
                            disabled={ocupado === o.operacionId}
                          >
                            Descartar
                          </Boton>
                        )}
                        <Boton onClick={() => onConfirmar(o)} cargando={ocupado === o.operacionId}>
                          Confirmar
                        </Boton>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-texto-3">
                  No hay operaciones con ese origen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TONO_EVENTO: Record<string, "rojo" | "azul" | "ambar"> = {
  Anulación: "rojo",
  Confirmación: "azul",
  Devolución: "ambar",
};

export function LogPagos({ log }: { log: EstadoCuenta["log"] }) {
  if (!log.length) return <p className="text-[14px] text-texto-2">Sin registros de pagos todavía.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-borde">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="bg-fondo text-texto-2">
          <tr>
            {["Fecha y hora", "Acción", "Detalle", "Usuario"].map((t) => (
              <th key={t} className="px-3 py-2 font-semibold">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {log.map((e) => (
            <tr key={e.id} className="border-t border-borde align-top">
              <td className="px-3 py-2 whitespace-nowrap text-texto-2">{fechaHora(new Date(e.fecha))}</td>
              <td className="px-3 py-2">
                <Badge tono={TONO_EVENTO[e.tipo] ?? "verde"}>{e.tipo}</Badge>
              </td>
              <td className="px-3 py-2 text-texto-2">{e.detalle}</td>
              <td className="px-3 py-2 text-texto-2">{e.usuario}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
