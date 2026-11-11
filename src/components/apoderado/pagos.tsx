// Piezas del portal del apoderado para pagos (US43, US44): datos del cronograma del hijo, resumen pagado / pendiente
// / vencido (AP-02), tabla con «Descargar comprobante» y el aviso de pensiones vencidas de AP-01.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Alerta, Badge, Icono, Spinner } from "@/components/ui";
import { api, descargar } from "@/lib/api";
import { fechaDia, soles } from "@/lib/formato";
import { mensajeError } from "./PortalApoderado";

export type EstadoCuota = "PAGADO" | "PENDIENTE" | "VENCIDO" | "ANULADO";

export interface CuotaPortal {
  cuotaId: string;
  tipo: "MATRICULA" | "PENSION";
  mes: number | null;
  concepto: string;
  monto: string;
  fechaVencimiento: string;
  estado: EstadoCuota;
  nombreEstado: string;
  fechaPago: string | null;
  comprobanteDisponible: boolean;
  enRevision: boolean;
  /** US70: Pendiente o Vencido y sin un pago en revisión. */
  pagable: boolean;
}

export interface PagosDelHijo {
  estudiante: { estudianteId: string; nombres: string; nombreCompleto: string; codigoPago: string };
  matricula: {
    anioId: string;
    anio: number;
    estado: "MATRICULADO" | "RETIRADO";
    nombreEstado: string;
    fechaMatricula: string;
    grado: string | null;
    seccion: string | null;
  };
  anios: { anioId: string; anio: number }[];
  hoy: string;
  /** US70: hay una pasarela configurada (si no, «Pagar» no aparece). */
  pagoEnLinea: boolean;
  resumen: {
    pagado: string;
    cuotasPagadas: number;
    pendiente: string;
    cuotasPendientes: number;
    vencido: string;
    cuotasVencidas: number;
    alDia: boolean;
  };
  cuotas: CuotaPortal[];
  anuladas: CuotaPortal[];
}

type Carga = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; datos: PagosDelHijo };

/** Cronograma del hijo en un año (por defecto, el que está en curso). */
export function usePagosDelHijo(estudianteId: string, anioId: string | null) {
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    const consulta = anioId ? `?anioId=${encodeURIComponent(anioId)}` : "";
    api<PagosDelHijo>(`/matricula/apoderado/hijos/${estudianteId}/pagos${consulta}`)
      .then((datos) => vigente && setCarga({ fase: "listo", datos }))
      .catch((e) => vigente && setCarga({ fase: "error", mensaje: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, [estudianteId, anioId, intento]);

  return {
    carga,
    reintentar: () => {
      setCarga({ fase: "cargando" });
      setIntento((n) => n + 1);
    },
  };
}

const TONO_ESTADO: Record<EstadoCuota, "verde" | "celeste" | "rojo" | "gris"> = {
  PAGADO: "verde",
  PENDIENTE: "celeste",
  VENCIDO: "rojo",
  ANULADO: "gris",
};

export function BadgeCuota({ estado, nombre }: { estado: EstadoCuota; nombre: string }) {
  return (
    <Badge tono={TONO_ESTADO[estado]} punto>
      {nombre}
    </Badge>
  );
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** «Matrícula», «setiembre». */
const nombreCorto = (c: CuotaPortal) => (c.tipo === "MATRICULA" || c.mes == null ? "Matrícula" : MESES[c.mes - 1]);
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** «Setiembre», «Matrícula y octubre», «Octubre a diciembre» si son seguidas (en orden de vencimiento). */
const listaConceptos = (cuotas: CuotaPortal[]) => {
  const nombres = cuotas.map(nombreCorto);
  if (nombres.length <= 1) return mayuscula(nombres[0] ?? "");
  const seguidas = cuotas.every((c, i) => c.tipo === "PENSION" && (i === 0 || c.mes === (cuotas[i - 1].mes ?? 0) + 1));
  if (nombres.length > 2 && seguidas) return mayuscula(`${nombres[0]} a ${nombres.at(-1)}`);
  return mayuscula(`${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`);
};

/** «Matrícula + 6 de 10 pensiones» (tarjeta «Pagado» de AP-02). */
function detallePagado(datos: PagosDelHijo) {
  const pagadas = datos.cuotas.filter((c) => c.estado === "PAGADO");
  const pensiones = datos.cuotas.filter((c) => c.tipo === "PENSION").length;
  const pensionesPagadas = pagadas.filter((c) => c.tipo === "PENSION").length;
  const matricula = pagadas.some((c) => c.tipo === "MATRICULA");
  const texto = `${pensionesPagadas} de ${pensiones} ${pensiones === 1 ? "pensión" : "pensiones"}`;
  return matricula ? `Matrícula + ${texto}` : texto;
}

/** «Valeria Quispe Rojas» → «ValeriaQuispe», como lo nombra el servidor (US44). */
function nombreParaArchivo(e: { nombres: string; nombreCompleto: string }) {
  const apellidos = e.nombreCompleto.slice(e.nombres.length).trim();
  return [e.nombres, apellidos]
    .map((t) => (t.split(/\s+/)[0] ?? "").normalize("NFD").replace(/[^A-Za-z0-9]/g, ""))
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join("");
}

const cuotasTexto = (n: number) => (n === 1 ? "1 cuota" : `${n} cuotas`);

// ---------- AP-01 · Aviso de pensiones vencidas ----------

export function AvisoVencidas({ datos, accion }: { datos: PagosDelHijo; accion?: ReactNode }) {
  const vencidas = datos.cuotas.filter((c) => c.estado === "VENCIDO");
  if (vencidas.length === 0) return null;
  const titulo = vencidas.length === 1 ? "Tienes 1 pensión vencida" : `Tienes ${vencidas.length} pensiones vencidas`;
  const detalle =
    vencidas.length === 1
      ? `${vencidas[0].concepto} · ${soles(vencidas[0].monto)} · venció el ${fechaDia(vencidas[0].fechaVencimiento)}.`
      : `${listaConceptos(vencidas)} · ${soles(datos.resumen.vencido)} en total.`;
  return (
    <div className="flex items-center gap-4 rounded-lg border-l-4 border-rojo bg-rojo/8 px-5 py-4">
      <Icono nombre="alerta-err" size={20} />
      <div className="flex flex-1 flex-col gap-0.5 text-[14px] leading-[1.4]">
        <p className="font-semibold text-texto">{titulo}</p>
        <p className="text-texto-2">{detalle} Regulariza el pago en tesorería o por transferencia.</p>
      </div>
      {accion}
    </div>
  );
}

export function AvisoAlDia() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-borde bg-white px-6 py-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-verde/12">
        <Icono nombre="icon-check-verde" size={28} />
      </span>
      <p className="text-[18px] font-semibold text-texto">Estás al día con tus pagos</p>
      <p className="text-[14px] text-texto-2">No tienes pensiones pendientes ni vencidas.</p>
    </div>
  );
}

// ---------- AP-02 · Resumen ----------

function TarjetaResumen({
  titulo,
  monto,
  detalle,
  icono,
  tono,
}: {
  titulo: string;
  monto: string;
  detalle: string;
  icono: string;
  tono: "verde" | "rojo" | "azul";
}) {
  const fondo = { verde: "bg-verde/12", rojo: "bg-rojo/12", azul: "bg-kubo-azul/10" }[tono];
  return (
    <div className="flex flex-1 flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className={`flex size-10 items-center justify-center rounded-lg ${fondo}`}>
          <Icono nombre={icono} size={20} />
        </span>
        <span className="text-[14px] text-texto-2">{titulo}</span>
      </div>
      <span className="text-[28px] font-bold leading-none text-texto">{soles(monto)}</span>
      <span className="text-[13px] text-texto-3">{detalle}</span>
    </div>
  );
}

export function ResumenPagos({ datos }: { datos: PagosDelHijo }) {
  const r = datos.resumen;
  const de = (estado: EstadoCuota) => datos.cuotas.filter((c) => c.estado === estado);
  return (
    <section
      aria-label="Resumen de pagos"
      className="flex flex-col divide-y divide-borde rounded-lg border border-borde bg-white md:flex-row md:divide-x md:divide-y-0"
    >
      <TarjetaResumen
        titulo="Pagado"
        monto={r.pagado}
        detalle={r.cuotasPagadas ? detallePagado(datos) : "Sin pagos aún"}
        icono="icon-check-verde"
        tono="verde"
      />
      <TarjetaResumen
        titulo="Vencido"
        monto={r.vencido}
        detalle={
          r.cuotasVencidas
            ? `${listaConceptos(de("VENCIDO"))} · venció el ${fechaDia(de("VENCIDO")[0].fechaVencimiento)}`
            : "Nada vencido"
        }
        icono="alerta-err"
        tono="rojo"
      />
      <TarjetaResumen
        titulo="Pendiente"
        monto={r.pendiente}
        detalle={
          r.cuotasPendientes
            ? `${listaConceptos(de("PENDIENTE"))} · ${cuotasTexto(r.cuotasPendientes)}`
            : "Nada pendiente"
        }
        icono="icon-calendar"
        tono="azul"
      />
    </section>
  );
}

// ---------- AP-02 · Cronograma con comprobantes ----------

function BotonComprobante({ estudianteId, cuota }: { estudianteId: string; cuota: CuotaPortal }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disponible = cuota.estado === "PAGADO" && cuota.comprobanteDisponible;

  async function bajar() {
    setDescargando(true);
    setError(null);
    try {
      await descargar(`/matricula/apoderado/hijos/${estudianteId}/cuotas/${cuota.cuotaId}/comprobante`, "Recibo.pdf");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={bajar}
        disabled={!disponible || descargando}
        aria-label={`Descargar comprobante de ${cuota.concepto}`}
        title={disponible ? "Descargar comprobante" : "Disponible cuando la cuota esté pagada"}
        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[14px] font-semibold text-kubo-azul ring-1 ring-inset ring-borde hover:bg-fondo disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
      >
        {descargando ? <Spinner claro={false} /> : <Icono nombre="icon-pdf" size={18} />}
        PDF
      </button>
      {error && <span className="max-w-[200px] text-right text-[12px] text-rojo-oscuro">{error}</span>}
    </div>
  );
}

const FILTROS = [
  { valor: "TODOS", texto: "Todos los estados" },
  { valor: "PAGADO", texto: "Pagado" },
  { valor: "PENDIENTE", texto: "Pendiente" },
  { valor: "VENCIDO", texto: "Vencido" },
] as const;

export function TablaCronograma({ datos }: { datos: PagosDelHijo }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["valor"]>("TODOS");
  const [verAnuladas, setVerAnuladas] = useState(false);
  const filas = filtro === "TODOS" ? datos.cuotas : datos.cuotas.filter((c) => c.estado === filtro);
  const pensiones = datos.cuotas.filter((c) => c.tipo === "PENSION").length;
  const ejemplo = `Recibo_Marzo${datos.matricula.anio}_${nombreParaArchivo(datos.estudiante)}.pdf`;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-borde bg-white p-6" aria-label="Cronograma">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[20px] font-semibold text-texto">Cronograma de pensiones</h2>
          <p className="text-[14px] text-texto-2">
            Año académico {datos.matricula.anio}
            {datos.matricula.seccion ? ` · ${datos.matricula.seccion}` : ""} · matrícula y{" "}
            {pensiones === 1 ? "1 pensión" : `${pensiones} pensiones`}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-[13px] text-texto-2">
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as typeof filtro)}
            className="rounded-lg border border-borde bg-white px-4 py-2.5 text-[15px] text-texto"
          >
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.texto}
              </option>
            ))}
          </select>
        </label>
      </div>

      {datos.cuotas.length === 0 ? (
        <p className="rounded-lg bg-fondo px-4 py-6 text-center text-[14px] text-texto-2">
          Aún no hay cuotas generadas para esta matrícula. Se crean cuando el colegio confirma la matrícula.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="bg-fondo text-[13px] font-semibold whitespace-nowrap text-texto-2">
              <tr>
                <th className="px-4 py-3">Concepto</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fecha de pago</th>
                <th className="px-4 py-3 text-right">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {filas.map((c) => (
                <tr key={c.cuotaId} className={c.estado === "VENCIDO" ? "bg-rojo/6" : ""}>
                  <td
                    className={`px-4 py-3 text-texto ${c.estado === "VENCIDO" || c.tipo === "MATRICULA" ? "font-semibold" : ""}`}
                  >
                    {c.concepto}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-texto-2">{fechaDia(c.fechaVencimiento)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-texto-2">{soles(c.monto)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <BadgeCuota estado={c.estado} nombre={c.nombreEstado} />
                      {c.enRevision && <span className="text-[12px] text-ambar-oscuro">Pago en revisión</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-texto-2">
                    {c.fechaPago ? fechaDia(c.fechaPago) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <BotonComprobante estudianteId={datos.estudiante.estudianteId} cuota={c} />
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-texto-3">
                    No hay cuotas con ese estado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-2 text-[13px] leading-[1.4] text-texto-3">
        <p className="flex items-start gap-2">
          <Icono nombre="icon-pdf" size={16} />
          Los comprobantes se descargan con el mes y el nombre del estudiante (por ejemplo, «{ejemplo}»). El botón se
          habilita solo para cuotas pagadas.
        </p>
        <p className="flex items-start gap-2">
          <Icono nombre="icon-info" size={16} />
          El comprobante se emite por operación de pago: si una operación cubrió varias cuotas, todas descargan el mismo
          recibo.
        </p>
      </div>

      {datos.anuladas.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-borde pt-4">
          <button
            type="button"
            onClick={() => setVerAnuladas((v) => !v)}
            aria-expanded={verAnuladas}
            className="self-start text-[14px] font-semibold text-texto-2"
          >
            {verAnuladas ? "Ocultar" : "Ver"} cuotas anuladas ({datos.anuladas.length})
          </button>
          {verAnuladas && (
            <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde opacity-60">
              {datos.anuladas.map((c) => (
                <li key={c.cuotaId} className="flex items-center gap-4 px-4 py-2 text-[14px] text-texto-2">
                  <span className="flex-1 line-through">{c.concepto}</span>
                  <span>{fechaDia(c.fechaVencimiento)}</span>
                  <span>{soles(c.monto)}</span>
                  <BadgeCuota estado={c.estado} nombre={c.nombreEstado} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function ComoPagar({ codigo, enLinea = false }: { codigo: string; enLinea?: boolean }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-borde bg-white p-6" aria-label="¿Cómo pagar?">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-kubo-azul/10">
          <Icono nombre="icon-pdf" size={20} />
        </span>
        <h2 className="text-[18px] font-semibold text-texto">¿Cómo pagar?</h2>
      </div>
      {enLinea && (
        <div className="rounded-lg border-l-4 border-kubo-azul bg-kubo-azul/8 px-4 py-3">
          <p className="text-[14px] font-semibold text-texto">Pago en línea</p>
          <p className="text-[13px] leading-[1.5] text-texto-2">
            Usa «Pagar» para pagar con tarjeta en Mercado Pago. El pago se registra apenas Mercado Pago lo confirma.
          </p>
        </div>
      )}
      <p className="text-[14px] leading-[1.5] text-texto-2">
        Paga en tesorería del colegio o en agentes y banca por internet con el código del estudiante:
      </p>
      <p className="rounded-lg bg-fondo py-3 text-center text-[26px] font-bold tracking-[2px] text-kubo-azul">
        {codigo}
      </p>
      <p className="text-[13px] leading-[1.5] text-texto-3">
        El pago se refleja cuando tesorería lo registra. Recibirás el comprobante en tu correo.
      </p>
      <div className="rounded-lg border-l-4 border-verde-oscuro bg-verde/8 px-4 py-3">
        <p className="text-[14px] font-semibold text-texto">Pago adelantado del año</p>
        <p className="text-[13px] leading-[1.5] text-texto-2">
          Puedes cancelar en una sola operación todas las pensiones que tengas pendientes. Consúltalo en tesorería.
        </p>
      </div>
    </section>
  );
}

export function CargandoPagos() {
  return (
    <div className="flex justify-center py-16">
      <Spinner claro={false} />
    </div>
  );
}

export function ErrorPagos({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <Alerta tipo="error" titulo="No pudimos cargar los pagos">
      {mensaje}{" "}
      <button type="button" onClick={onReintentar} className="font-semibold text-kubo-azul underline">
        Reintentar
      </button>
    </Alerta>
  );
}
