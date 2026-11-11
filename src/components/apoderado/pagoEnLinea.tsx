// Pago en línea desde el portal del apoderado (US70): botón «Pagar» de AP-02 con la selección de cuotas, pantalla de
// retorno con el estado registrado en Kubo (AP-02R) y la pasarela de prueba para desarrollo (AP-02P). Pantallas sin
// frame en el Figma: siguen el estilo de AP-02 y se describen en docs/frontend-pago-en-linea.md.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alerta, Badge, Boton, Casilla, Icono, Modal, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia, soles } from "@/lib/formato";
import type { CuotaPortal, PagosDelHijo } from "./pagos";
import { mensajeError } from "./PortalApoderado";

// ---------- Tipos de la API (docs/api/matricula.md, «Pago en línea») ----------

export type EstadoIntento = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "EXPIRADO" | "OBSERVADO";

export interface IntentoPago {
  intentoId: string;
  estudianteId: string;
  estado: EstadoIntento;
  nombreEstado: string;
  monto: string;
  cuotas: { cuotaId: string; concepto: string; monto: string }[];
  expiraEn: string;
  comprobante: string | null;
  pasarela: "mercadopago" | "falsa";
}

interface IntentoCreado {
  intentoId: string;
  monto: string;
  urlCheckout: string;
}

/** «450.00» → céntimos enteros, sin float. */
const centimos = (monto: string) => {
  const [entero, decimales = ""] = monto.split(".");
  return Number(entero) * 100 + Number(decimales.padEnd(2, "0").slice(0, 2));
};
const aMonto = (c: number) => `${Math.trunc(c / 100)}.${String(c % 100).padStart(2, "0")}`;

// ---------- AP-02 · Botón «Pagar» y selección de cuotas ----------

/** Al abrir, se marcan las vencidas (o la primera pendiente si no hay vencidas). */
function seleccionInicial(cuotas: CuotaPortal[]) {
  const vencidas = cuotas.filter((c) => c.estado === "VENCIDO").map((c) => c.cuotaId);
  return new Set(vencidas.length ? vencidas : cuotas.slice(0, 1).map((c) => c.cuotaId));
}

function ModalPagarEnLinea({ datos, onCerrar }: { datos: PagosDelHijo; onCerrar: () => void }) {
  const pagables = datos.cuotas.filter((c) => c.pagable);
  const [elegidas, setElegidas] = useState(() => seleccionInicial(pagables));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = pagables.filter((c) => elegidas.has(c.cuotaId)).reduce((t, c) => t + centimos(c.monto), 0);

  function alternar(cuotaId: string, marcada: boolean) {
    const nuevas = new Set(elegidas);
    if (marcada) nuevas.add(cuotaId);
    else nuevas.delete(cuotaId);
    setElegidas(nuevas);
  }

  async function irAPagar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await api<IntentoCreado>("/matricula/apoderado/pagos/intentos", {
        method: "POST",
        body: {
          estudianteId: datos.estudiante.estudianteId,
          conceptoIds: pagables.filter((c) => elegidas.has(c.cuotaId)).map((c) => c.cuotaId),
        },
      });
      window.location.assign(r.urlCheckout);
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="nav-wallet-azul"
      tonoIcono="azul"
      titulo="Pagar en línea"
      subtitulo={`${datos.estudiante.nombreCompleto} · Año ${datos.matricula.anio}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton onClick={irAPagar} cargando={enviando} disabled={total === 0}>
            {total === 0 ? "Ir a pagar" : `Ir a pagar ${soles(aMonto(total))}`}
          </Boton>
        </>
      }
    >
      <p className="text-[14px] text-texto-2">Elige las cuotas que quieres pagar ahora.</p>
      <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
        {pagables.map((c) => (
          <li key={c.cuotaId} className="flex items-center justify-between gap-3 px-4 py-3">
            <Casilla
              etiqueta={`${c.concepto} · vence el ${fechaDia(c.fechaVencimiento)}`}
              checked={elegidas.has(c.cuotaId)}
              onChange={(v) => alternar(c.cuotaId, v)}
            />
            <span className="flex items-center gap-2 text-[14px] whitespace-nowrap text-texto">
              {c.estado === "VENCIDO" && (
                <Badge tono="rojo" punto>
                  Vencido
                </Badge>
              )}
              {soles(c.monto)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between rounded-lg bg-fondo px-4 py-3">
        <span className="text-[14px] font-semibold text-texto-2">Total a pagar</span>
        <span className="text-[22px] font-bold text-kubo-azul">{soles(aMonto(total))}</span>
      </div>
      <Alerta tipo="info" titulo="Pagarás en Mercado Pago">
        Te llevaremos a la página segura de Mercado Pago. Kubo no recibe ni guarda los datos de tu tarjeta. El pago se
        registra cuando Mercado Pago lo confirma y recibirás el comprobante en tu correo.
      </Alerta>
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}

/** «Pagar» de AP-02: solo con una pasarela configurada y alguna cuota pendiente que no esté en revisión. */
export function BotonPagar({ datos }: { datos: PagosDelHijo }) {
  const [abierto, setAbierto] = useState(false);
  if (!datos.pagoEnLinea || !datos.cuotas.some((c) => c.pagable)) return null;
  return (
    <>
      <Boton icono="check-blanco" onClick={() => setAbierto(true)}>
        Pagar
      </Boton>
      {abierto && <ModalPagarEnLinea datos={datos} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

// ---------- AP-02R · Retorno del checkout ----------

type CargaIntento =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "listo"; intento: IntentoPago; consultas: number };

/** Consultas mientras el pago sigue «En proceso» (cada 4 s, hasta 1 minuto); luego se ofrece «Actualizar». */
const MAXIMO_CONSULTAS = 15;
const ESPERA_ENTRE_CONSULTAS_MS = 4000;

/** Estado del intento en Kubo. Mientras esté «En proceso», vuelve a consultar cada pocos segundos. */
export function useIntento(intentoId: string | null) {
  const [carga, setCarga] = useState<CargaIntento>({ fase: "cargando" });
  const [ronda, setRonda] = useState(0);

  useEffect(() => {
    if (!intentoId) return;
    let vigente = true;
    api<IntentoPago>(`/matricula/apoderado/pagos/intentos/${encodeURIComponent(intentoId)}`)
      .then((intento) => vigente && setCarga((c) => ({ fase: "listo", intento, consultas: consultasDe(c) + 1 })))
      .catch((e) => vigente && setCarga({ fase: "error", mensaje: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, [intentoId, ronda]);

  const pendiente = carga.fase === "listo" && carga.intento.estado === "PENDIENTE";
  const seguir = pendiente && carga.consultas < MAXIMO_CONSULTAS;
  useEffect(() => {
    if (!seguir) return;
    const t = setTimeout(() => setRonda((n) => n + 1), ESPERA_ENTRE_CONSULTAS_MS);
    return () => clearTimeout(t);
  }, [seguir, carga]);

  return {
    carga: intentoId ? carga : ({ fase: "error", mensaje: "Falta el pago a consultar." } as const),
    esperando: seguir,
    actualizar: () => {
      setCarga({ fase: "cargando" });
      setRonda((n) => n + 1);
    },
  };
}

const consultasDe = (c: CargaIntento) => (c.fase === "listo" ? c.consultas : 0);

const PRESENTACION: Record<
  EstadoIntento,
  { icono: string; fondo: string; titulo: string; texto: string; tono: "verde" | "rojo" | "ambar" | "gris" | "celeste" }
> = {
  APROBADO: {
    icono: "icon-check-verde",
    fondo: "bg-verde/12",
    titulo: "Pago aprobado",
    texto: "Registramos tu pago. Las cuotas ya figuran como pagadas y te enviamos el comprobante por correo.",
    tono: "verde",
  },
  RECHAZADO: {
    icono: "alerta-err",
    fondo: "bg-rojo/12",
    titulo: "Pago rechazado",
    texto: "Mercado Pago no aprobó el pago y no se hizo ningún cobro. Puedes intentarlo de nuevo con otro medio.",
    tono: "rojo",
  },
  PENDIENTE: {
    icono: "icon-clock-rojo",
    fondo: "bg-ambar/16",
    titulo: "Pago en proceso",
    texto:
      "Mercado Pago aún no confirma tu pago. Lo registraremos apenas llegue la confirmación; no vuelvas a pagar las mismas cuotas.",
    tono: "ambar",
  },
  EXPIRADO: {
    icono: "icon-calendar-gris",
    fondo: "bg-fondo",
    titulo: "El pago expiró",
    texto: "No se completó el pago dentro de los 30 minutos. No se hizo ningún cobro; puedes iniciar uno nuevo.",
    tono: "gris",
  },
  OBSERVADO: {
    icono: "alerta-warn",
    fondo: "bg-ambar/16",
    titulo: "Pago recibido en revisión",
    texto:
      "Recibimos tu pago, pero tesorería debe revisarlo (por ejemplo, una de las cuotas ya estaba pagada por otro medio). Si corresponde, te devolveremos el dinero.",
    tono: "ambar",
  },
};

export function ResultadoPagoEnLinea({ intentoId }: { intentoId: string | null }) {
  const { carga, esperando, actualizar } = useIntento(intentoId);

  if (carga.fase === "cargando") {
    return (
      <div className="flex justify-center py-16">
        <Spinner claro={false} />
      </div>
    );
  }
  if (carga.fase === "error") {
    return (
      <Alerta tipo="error" titulo="No pudimos consultar el pago">
        {carga.mensaje}{" "}
        <Link href="/apoderado/pagos" className="font-semibold text-kubo-azul underline">
          Volver a Pagos
        </Link>
      </Alerta>
    );
  }

  const { intento } = carga;
  const p = PRESENTACION[intento.estado];
  return (
    <section
      aria-live="polite"
      className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-5 rounded-lg border border-borde bg-white px-6 py-10 text-center"
    >
      <span className={`flex size-16 items-center justify-center rounded-full ${p.fondo}`}>
        {esperando ? <Spinner claro={false} /> : <Icono nombre={p.icono} size={30} />}
      </span>
      <div className="flex flex-col items-center gap-2">
        <Badge tono={p.tono} punto>
          {intento.nombreEstado}
        </Badge>
        <h2 className="text-[24px] font-bold text-texto">{p.titulo}</h2>
        <p className="max-w-[480px] text-[15px] leading-[1.5] text-texto-2">{p.texto}</p>
      </div>
      <dl className="grid w-full grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg bg-fondo px-5 py-4 text-left text-[14px]">
        <dt className="text-texto-3">Cuotas</dt>
        <dd className="text-texto">{intento.cuotas.map((c) => c.concepto).join(", ")}</dd>
        <dt className="text-texto-3">Monto</dt>
        <dd className="font-semibold text-texto">{soles(intento.monto)}</dd>
        {intento.comprobante && (
          <>
            <dt className="text-texto-3">Comprobante</dt>
            <dd className="text-texto">{intento.comprobante}</dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap justify-center gap-3">
        {intento.estado === "PENDIENTE" && !esperando && (
          <Boton variante="secundario" icono="act-refresh" onClick={actualizar}>
            Actualizar
          </Boton>
        )}
        <Link
          href="/apoderado/pagos"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-kubo-azul px-4 py-2.5 text-[16px] font-bold text-white hover:bg-kubo-azul-oscuro"
        >
          Volver a Pagos
        </Link>
      </div>
      <p className="text-[12px] text-texto-3">
        Este estado es el que registró Kubo con la confirmación de Mercado Pago, no el de la página de la que vienes.
      </p>
    </section>
  );
}

// ---------- AP-02P · Pasarela de prueba (solo PASARELA=falsa) ----------

export function PasarelaDePrueba({ intentoId }: { intentoId: string | null }) {
  const router = useRouter();
  const { carga } = useIntento(intentoId);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simular(resultado: "APROBADO" | "RECHAZADO" | "EN_PROCESO") {
    if (!intentoId) return;
    setEnviando(resultado);
    setError(null);
    try {
      await api(`/matricula/apoderado/pagos/intentos/${encodeURIComponent(intentoId)}/simular`, {
        method: "POST",
        body: { resultado },
      });
      router.push(`/apoderado/pagos/retorno?intento=${encodeURIComponent(intentoId)}`);
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(null);
    }
  }

  if (carga.fase === "cargando") {
    return (
      <div className="flex justify-center py-16">
        <Spinner claro={false} />
      </div>
    );
  }
  if (carga.fase === "error") return <Alerta tipo="error" titulo={carga.mensaje} />;
  const { intento } = carga;
  return (
    <section className="mx-auto flex w-full max-w-[560px] flex-col gap-5 rounded-lg border-2 border-dashed border-ambar bg-white p-6">
      <Alerta tipo="aviso" icono="alerta-warn" titulo="Pasarela de prueba">
        Esta pantalla reemplaza al checkout de Mercado Pago en desarrollo (PASARELA=falsa). No hay cobro real.
      </Alerta>
      <div className="flex items-center justify-between rounded-lg bg-fondo px-4 py-3">
        <span className="text-[14px] text-texto-2">{intento.cuotas.map((c) => c.concepto).join(", ")}</span>
        <span className="text-[22px] font-bold text-kubo-azul">{soles(intento.monto)}</span>
      </div>
      {intento.estado !== "PENDIENTE" ? (
        <Alerta tipo="info" titulo={`Este pago ya está «${intento.nombreEstado}».`} />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Boton onClick={() => simular("APROBADO")} cargando={enviando === "APROBADO"} disabled={!!enviando}>
            Aprobar pago
          </Boton>
          <Boton
            variante="peligro"
            onClick={() => simular("RECHAZADO")}
            cargando={enviando === "RECHAZADO"}
            disabled={!!enviando}
          >
            Rechazar
          </Boton>
          <Boton
            variante="secundario"
            onClick={() => simular("EN_PROCESO")}
            cargando={enviando === "EN_PROCESO"}
            disabled={!!enviando}
          >
            Dejar en proceso
          </Boton>
        </div>
      )}
      {error && <Alerta tipo="error" titulo={error} />}
    </section>
  );
}
