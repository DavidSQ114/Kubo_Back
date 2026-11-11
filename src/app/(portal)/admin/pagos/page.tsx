// AD-11 · Pensiones y pagos: estado de cuenta del estudiante, registro de pago manual (US22, M-01), pagos observados
// por número de operación repetido (US23), anulación con motivo (US04, M-02), recibos en PDF (US25), pago anual
// adelantado (US58, M-15) y log de pagos
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Avatar, Buscador, type EstudianteListado } from "@/components/admin/apoderados";
import { Selector } from "@/components/admin/grados";
import { soles } from "@/components/admin/matricula";
import {
  BotonRecibo,
  LogPagos,
  ModalAnularPago,
  ModalDevolucion,
  ModalPagoAnual,
  ModalRegistrarPago,
  TablaCronogramaPagos,
  TablaOperaciones,
  type EstadoCuenta,
  type OperacionPago,
  type ResultadoPago,
} from "@/components/admin/pagos";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia } from "@/lib/formato";

interface AvisoExito {
  titulo: string;
  detalle: string;
  recibo: { operacionId: string; numero: string } | null;
}

function textoCorreo(r: ResultadoPago, email: string | null | undefined) {
  if (!r.correo) return "";
  if (r.correo.enviado)
    return ` El recibo ${r.operacion.comprobante?.numero ?? ""} se envió a ${email ?? "el apoderado"}.`;
  if (r.correo.motivo === "SMTP_NO_CONFIGURADO")
    return " El correo no está configurado: entrega el recibo descargándolo.";
  if (r.correo.motivo === "SIN_CORREO") return " El apoderado responsable no tiene correo registrado.";
  return " No se pudo enviar la copia por correo; el pago quedó registrado.";
}

function PaginaPagos() {
  const router = useRouter();
  const parametros = useSearchParams();
  const estudianteId = parametros.get("estudiante");
  const anioId = parametros.get("anio");
  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [registrando, setRegistrando] = useState<string[] | null>(null);
  const [anulando, setAnulando] = useState<OperacionPago | null>(null);
  const [devolviendo, setDevolviendo] = useState<OperacionPago | null>(null);
  const [pagoAnual, setPagoAnual] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [exito, setExito] = useState<AvisoExito | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  useEffect(() => {
    if (!estudianteId) return;
    let vigente = true;
    async function cargar() {
      try {
        const c = await api<EstadoCuenta>(
          `/matricula/estudiantes/${estudianteId}/estado-cuenta${anioId ? `?anioId=${anioId}` : ""}`,
        );
        if (vigente) {
          setCuenta(c);
          setError(null);
        }
      } catch (e) {
        if (vigente) setError(alertaError(e));
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [estudianteId, anioId, recarga]);

  // la cuenta cargada solo vale para el estudiante de la URL
  const actual = cuenta && cuenta.estudiante.estudianteId === estudianteId ? cuenta : null;
  const observadas = actual?.operaciones.filter((o) => o.estado === "OBSERVADO") ?? [];

  function irA(estudiante: string | null, anio?: string | null) {
    const q = new URLSearchParams();
    if (estudiante) q.set("estudiante", estudiante);
    if (anio) q.set("anio", anio);
    setExito(null);
    setAviso(null);
    setErrorAccion(null);
    router.replace(`/admin/pagos${q.size ? `?${q}` : ""}`);
  }

  function alRegistrar(r: ResultadoPago) {
    setRegistrando(null);
    setRecarga((n) => n + 1);
    const cuotas = r.operacion.cuotas.map((c) => c.concepto.toLowerCase()).join(" y ");
    const base = `Operación ${r.operacion.numeroOperacion} · ${r.operacion.cuotas.length} cuota${r.operacion.cuotas.length === 1 ? "" : "s"} (${cuotas}) · ${soles(r.operacion.monto)}.`;
    if (r.aviso) {
      setExito(null);
      setAviso(
        `${r.aviso}. ${base} Queda en estado «Observado» y no descuenta la deuda hasta que la confirmes o la descartes.`,
      );
      return;
    }
    setAviso(null);
    setExito({
      titulo: "Operación registrada correctamente",
      detalle: base + textoCorreo(r, actual?.matricula?.responsable?.email),
      recibo: r.operacion.comprobante && {
        operacionId: r.operacion.operacionId,
        numero: r.operacion.comprobante.numero,
      },
    });
  }

  async function confirmar(o: OperacionPago) {
    setOcupado(o.operacionId);
    setErrorAccion(null);
    try {
      const r = await api<ResultadoPago>(`/matricula/pagos/${o.operacionId}/confirmar`, { method: "POST" });
      alRegistrar({ ...r, aviso: null });
    } catch (e) {
      setErrorAccion(alertaError(e));
    } finally {
      setOcupado(null);
    }
  }

  async function descartar(o: OperacionPago) {
    setOcupado(o.operacionId);
    setErrorAccion(null);
    try {
      await api(`/matricula/pagos/${o.operacionId}/descartar`, { method: "POST", body: {} });
      setAviso(null);
      setExito({
        titulo: "Operación descartada",
        detalle: `La operación ${o.numeroOperacion} quedó «Anulado» por pago duplicado. Las cuotas siguen pendientes.`,
        recibo: null,
      });
      setRecarga((n) => n + 1);
    } catch (e) {
      setErrorAccion(alertaError(e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-texto-3">Tesorería / Pensiones y pagos</p>
        <h1 className="text-[28px] font-semibold text-texto">Pensiones y pagos</h1>
        <p className="text-[15px] text-texto-2">
          Consulta el cronograma de pensiones de cada estudiante, registra pagos manuales y emite comprobantes.
        </p>
      </div>

      {exito && (
        <Alerta tipo="exito" titulo={exito.titulo}>
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>{exito.detalle}</span>
            {exito.recibo && (
              <BotonRecibo
                operacionId={exito.recibo.operacionId}
                comprobante={exito.recibo.numero}
                onError={setErrorAccion}
                texto="Ver recibo"
              />
            )}
          </span>
        </Alerta>
      )}
      {aviso && (
        <Alerta tipo="aviso" titulo="Operación observada">
          {aviso}
        </Alerta>
      )}
      {!aviso && observadas.length > 0 && (
        <Alerta
          tipo="aviso"
          titulo={`${observadas.length === 1 ? "1 operación observada" : `${observadas.length} operaciones observadas`} · ${observadas[0].cuotas.map((c) => c.concepto.toLowerCase()).join(", ")}`}
        >
          {`La operación ${observadas[0].numeroOperacion} usa un número ya registrado en otra operación. Queda en estado «Observado» y no descuenta la deuda hasta que la confirmes o la descartes en «Operaciones de pago».`}
        </Alerta>
      )}
      {errorAccion && <Alerta tipo="error" titulo={errorAccion} />}

      <Tarjeta className="flex flex-col gap-4 p-6">
        <Buscador<EstudianteListado>
          ruta="/comunidad/estudiantes"
          etiqueta="Estudiante"
          placeholder="Buscar estudiante por DNI o nombre"
          idDe={(e) => e.estudianteId}
          elegidos={estudianteId ? [estudianteId] : []}
          onElegir={(e) => irA(e.estudianteId)}
          vacio="No hay estudiantes con ese DNI o nombre."
          fila={(e) => (
            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-texto">{e.nombreCompleto}</span>
              <span className="text-[12px] text-texto-3">{`DNI ${e.dni}${e.gradoIngreso ? ` · ${e.gradoIngreso}` : ""}`}</span>
            </div>
          )}
        />
        {!estudianteId && (
          <p className="text-[14px] text-texto-2">
            Busca a un estudiante para ver su estado de cuenta y registrar pagos.
          </p>
        )}
        {estudianteId && !actual && !error && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando el estado de cuenta…
          </div>
        )}
        {error && <Alerta tipo="error" titulo={error} />}
        {actual && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-borde pt-4">
            <div className="flex items-center gap-3">
              <Avatar nombre={actual.estudiante.nombreCompleto} tono="verde" />
              <div className="flex flex-col text-[13px]">
                <span className="text-[16px] font-semibold text-texto">{actual.estudiante.nombreCompleto}</span>
                <span className="text-texto-3">
                  {actual.matricula
                    ? `${actual.matricula.seccion ?? "Sin sección"} · Matriculado el ${fechaDia(actual.matricula.fechaMatricula)} · Responsable: ${actual.matricula.responsable?.nombreCompleto ?? "—"}`
                    : `DNI ${actual.estudiante.dni}`}
                </span>
                {actual.matricula && (
                  <span className="mt-1 flex gap-2">
                    <Badge tono="azul">{`Modalidad: ${actual.matricula.modalidadPago === "ANUAL" ? "anual" : "mensual"}`}</Badge>
                    <Badge tono="gris">{actual.matricula.nombreEstado}</Badge>
                    {actual.matricula.estado === "MATRICULADO" &&
                      actual.cuotas.some((c) => c.estado === "PENDIENTE") && (
                        <button
                          type="button"
                          onClick={() => setPagoAnual(true)}
                          className="rounded-md border border-kubo-azul px-2 text-[12px] font-semibold text-kubo-azul hover:bg-fondo"
                        >
                          Pago anual
                        </button>
                      )}
                  </span>
                )}
              </div>
            </div>
            {actual.matriculas.length > 1 && (
              <div className="w-48">
                <Selector
                  etiqueta="Año"
                  oculto
                  valor={actual.matricula?.anio.id ?? ""}
                  onCambiar={(v) => irA(actual.estudiante.estudianteId, v)}
                >
                  {actual.matriculas.map((m) => (
                    <option key={m.matriculaId} value={m.anioId}>{`Año ${m.anio}`}</option>
                  ))}
                </Selector>
              </div>
            )}
            {actual.totales && (
              <dl className="flex gap-6 text-[13px]">
                <div>
                  <dt className="text-texto-3">Pagado</dt>
                  <dd className="text-[20px] font-semibold text-verde-oscuro">{soles(actual.totales.pagado)}</dd>
                  <dd className="text-[12px] text-texto-3">{`${actual.totales.cuotasPagadas} cuotas`}</dd>
                </div>
                <div>
                  <dt className="text-texto-3">Pendiente</dt>
                  <dd className="text-[20px] font-semibold text-kubo-azul">{soles(actual.totales.pendiente)}</dd>
                  <dd className="text-[12px] text-texto-3">{`${actual.totales.cuotasPendientes} cuotas`}</dd>
                </div>
                <div>
                  <dt className="text-texto-3">Vencido</dt>
                  <dd className="text-[20px] font-semibold text-rojo-oscuro">{soles(actual.totales.vencido)}</dd>
                  <dd className="text-[12px] text-texto-3">{`${actual.totales.cuotasVencidas} cuotas`}</dd>
                </div>
              </dl>
            )}
          </div>
        )}
      </Tarjeta>

      {actual && !actual.matricula && (
        <Alerta tipo="info" titulo="El estudiante no tiene una matrícula con cronograma">
          Matricúlalo en una sección para generar su cronograma de pensiones.{" "}
          <Link
            href={`/admin/matricula?estudiante=${actual.estudiante.estudianteId}`}
            className="font-semibold text-kubo-azul"
          >
            Ir a Matrícula
          </Link>
        </Alerta>
      )}

      {actual?.matricula && (
        <>
          <Tarjeta className="flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-texto">{`Cronograma de pensiones ${actual.matricula.anio.anio}`}</h2>
                <p className="text-[13px] text-texto-3">
                  Matrícula (pago único) y pensiones que vencen según el cronograma del año
                </p>
              </div>
              {actual.totales && actual.totales.cuotasVencidas > 0 && (
                <Badge
                  tono="rojo"
                  punto
                >{`${actual.totales.cuotasVencidas} vencida${actual.totales.cuotasVencidas === 1 ? "" : "s"}`}</Badge>
              )}
            </div>
            {actual.cuotas.length ? (
              <TablaCronogramaPagos
                cuenta={actual}
                onRegistrar={(id) => setRegistrando([id])}
                onError={setErrorAccion}
              />
            ) : (
              <p className="text-[14px] text-texto-2">
                La matrícula aún no tiene cronograma: se genera al confirmarla.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-texto-3">
                Una operación de pago puede cubrir varias cuotas completas del mismo estudiante; el N.° de operación y
                el comprobante se repiten en todas las cuotas que cubre.
              </p>
              {actual.cuotas.some((c) => c.estado === "PENDIENTE") && (
                <Boton icono="icon-plus-blanco" onClick={() => setRegistrando([])}>
                  Registrar pago
                </Boton>
              )}
            </div>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4 p-6">
            <div>
              <h2 className="text-[18px] font-semibold text-texto">Operaciones de pago</h2>
              <p className="text-[13px] text-texto-3">
                Cada operación cubre una o más cuotas completas del mismo estudiante.
              </p>
            </div>
            <TablaOperaciones
              operaciones={actual.operaciones}
              ocupado={ocupado}
              onAnular={setAnulando}
              onConfirmar={confirmar}
              onDescartar={descartar}
              onDevolver={setDevolviendo}
              onError={setErrorAccion}
            />
            <p className="text-[12px] text-texto-3">
              Estados de la operación: Observado, Confirmado y Anulado. Al anular una operación, las cuotas que cubría
              vuelven a «Pendiente». Origen: Tesorería (registro manual) o Pasarela (pago en línea del apoderado).
            </p>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-4 p-6">
            <div>
              <h2 className="text-[18px] font-semibold text-texto">Log de auditoría de pagos</h2>
              <p className="text-[13px] text-texto-3">Registro inmutable · no se eliminan registros</p>
            </div>
            <LogPagos log={actual.log} />
          </Tarjeta>
        </>
      )}

      {registrando && actual && (
        <ModalRegistrarPago
          cuenta={actual}
          preseleccion={registrando}
          onCerrar={() => setRegistrando(null)}
          onRegistrado={alRegistrar}
        />
      )}
      {pagoAnual && actual?.matricula && (
        <ModalPagoAnual
          cuenta={actual}
          onCerrar={() => setPagoAnual(false)}
          onRegistrado={(r) => {
            setPagoAnual(false);
            alRegistrar(r);
          }}
        />
      )}
      {anulando && actual && (
        <ModalAnularPago
          operacion={anulando}
          estudiante={`${actual.estudiante.nombreCompleto}${actual.matricula?.seccion ? ` · ${actual.matricula.seccion}` : ""}`}
          onCerrar={() => setAnulando(null)}
          onAnulado={() => {
            setExito({
              titulo: "Pago anulado",
              detalle: `La operación ${anulando.numeroOperacion} quedó «Anulado». Sus cuotas volvieron a «Pendiente».`,
              recibo: null,
            });
            setAviso(null);
            setAnulando(null);
            setRecarga((n) => n + 1);
          }}
        />
      )}
      {devolviendo && actual && (
        <ModalDevolucion
          operacion={devolviendo}
          estudiante={`${actual.estudiante.nombreCompleto}${actual.matricula?.seccion ? ` · ${actual.matricula.seccion}` : ""}`}
          onCerrar={() => setDevolviendo(null)}
          onDevuelto={() => {
            setExito({
              titulo: "Devolución registrada",
              detalle: `El pago en línea ${devolviendo.numeroOperacion} quedó «Anulado» con el motivo «Devuelto». Las cuotas no cambian.`,
              recibo: null,
            });
            setAviso(null);
            setDevolviendo(null);
            setRecarga((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

export default function PagosPage() {
  // useSearchParams (?estudiante= desde el detalle de una matrícula) necesita un límite de Suspense
  return (
    <Suspense
      fallback={
        <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando…
        </Tarjeta>
      }
    >
      <PaginaPagos />
    </Suspense>
  );
}
