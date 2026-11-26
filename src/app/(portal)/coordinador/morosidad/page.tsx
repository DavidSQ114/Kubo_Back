// AD-12 · Panel de morosidad (US24): estudiantes con pensiones vencidas y no pagadas al día de hoy, con meses
// adeudados, deuda total y apoderado responsable; filtros por año, grado, sección y meses con «Filtrar». Selección de
// uno o varios estudiantes y «Enviar recordatorios» (US59, M-24) con la fecha del último recordatorio de cada uno.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/admin/apoderados";
import type { AnioAcademico } from "@/components/admin/anio";
import { Selector, type Grado, type Seccion } from "@/components/admin/grados";
import { soles } from "@/components/admin/matricula";
import { alertaError } from "@/components/admin/PortalAdmin";
import {
  ModalRecordatorios,
  ResultadoRecordatorios,
  type RecordatoriosEnviados,
} from "@/components/admin/recordatorios";
import { Alerta, Badge, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia, fechaHora } from "@/lib/formato";

interface FilaMorosidad {
  matriculaId: string;
  estudianteId: string;
  nombreCompleto: string;
  seccion: { id: string; nombre: string } | null;
  adeudado: string[];
  mesesAdeudados: number;
  cuotasVencidas: number;
  deuda: string;
  primerVencimiento: string;
  diasAtraso: number;
  responsable: { nombreCompleto: string; parentesco: string; telefono: string | null } | null;
  /** Instante del último recordatorio de pago (US59); null si nunca se envió. */
  ultimoRecordatorio: string | null;
}

interface PanelMorosidad {
  fecha: string;
  anio: { id: string; anio: number };
  resumen: { estudiantes: number; deudaTotal: string; cuotasVencidas: number };
  items: FilaMorosidad[];
}

interface Filtros {
  anioId: string;
  gradoId: string;
  seccionId: string;
  mesesMinimos: string;
  orden: "MONTO" | "MESES";
}

const FILTROS_VACIOS = { gradoId: "", seccionId: "", mesesMinimos: "", orden: "MONTO" as const };

/** Año por defecto: el «En curso» y, si no hay, el «En matrícula». */
const anioPorDefecto = (anios: AnioAcademico[]) =>
  anios.find((a) => a.estado === "EN_CURSO") ?? anios.find((a) => a.estado === "EN_MATRICULA") ?? anios[0];

/** CSV (separado por punto y coma, como lo abre Excel en español) del listado filtrado. */
function descargarCsv(panel: PanelMorosidad) {
  // los montos van sin comillas y con coma decimal («1000,00») para que Excel en español los lea como número; el
  // teléfono sigue entre comillas, como texto (bloque M5)
  const celda = (v: string | number) =>
    typeof v === "number" || /^\d+,\d+$/.test(v) ? String(v) : `"${String(v).replace(/"/g, '""')}"`;
  const filas = [
    [
      "Estudiante",
      "Sección",
      "Meses adeudados",
      "Cuotas vencidas",
      "Deuda total (S/)",
      "Días de atraso",
      "Apoderado",
      "Teléfono",
    ],
    ...panel.items.map((f) => [
      f.nombreCompleto,
      f.seccion?.nombre ?? "",
      f.adeudado.join(" "),
      f.cuotasVencidas,
      f.deuda.replace(".", ","),
      f.diasAtraso,
      f.responsable?.nombreCompleto ?? "",
      f.responsable?.telefono ?? "",
    ]),
  ];
  const texto = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `morosidad-${panel.anio.anio}-${panel.fecha}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function MorosidadPage() {
  const [anios, setAnios] = useState<AnioAcademico[] | null>(null);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [secciones, setSecciones] = useState<{ anioId: string; lista: Seccion[] } | null>(null);
  const [borrador, setBorrador] = useState<Filtros | null>(null);
  const [aplicados, setAplicados] = useState<Filtros | null>(null);
  const [panel, setPanel] = useState<PanelMorosidad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [paraEnviar, setParaEnviar] = useState<string[] | null>(null);
  const [resultado, setResultado] = useState<RecordatoriosEnviados | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const [a, g] = await Promise.all([api<AnioAcademico[]>("/academico/anios"), api<Grado[]>("/academico/grados")]);
        setAnios(a);
        setGrados(g);
        const anio = anioPorDefecto(a);
        if (anio) {
          const inicial = { anioId: anio.id, ...FILTROS_VACIOS };
          setBorrador(inicial);
          setAplicados(inicial);
        }
      } catch (e) {
        setError(alertaError(e));
      }
    }
    void cargar();
  }, []);

  // secciones del año elegido en los filtros
  const anioBorrador = borrador?.anioId;
  useEffect(() => {
    if (!anioBorrador) return;
    let vigente = true;
    api<Seccion[]>(`/academico/secciones?anioId=${anioBorrador}`)
      .then((lista) => vigente && setSecciones({ anioId: anioBorrador, lista }))
      .catch(() => vigente && setSecciones({ anioId: anioBorrador, lista: [] }));
    return () => {
      vigente = false;
    };
  }, [anioBorrador]);

  // cada «Filtrar» vuelve a consultar: sin caché, quien pagó ya no aparece
  useEffect(() => {
    if (!aplicados) return;
    let vigente = true;
    async function consultar() {
      setCargando(true);
      try {
        const q = new URLSearchParams({ anioId: aplicados!.anioId, orden: aplicados!.orden });
        if (aplicados!.gradoId) q.set("gradoId", aplicados!.gradoId);
        if (aplicados!.seccionId) q.set("seccionId", aplicados!.seccionId);
        if (aplicados!.mesesMinimos) q.set("mesesMinimos", aplicados!.mesesMinimos);
        const p = await api<PanelMorosidad>(`/matricula/morosidad?${q}`);
        if (vigente) {
          setPanel(p);
          setError(null);
        }
      } catch (e) {
        if (vigente) setError(alertaError(e));
      } finally {
        if (vigente) setCargando(false);
      }
    }
    void consultar();
    return () => {
      vigente = false;
    };
  }, [aplicados]);

  const seccionesDelGrado = (secciones && secciones.anioId === anioBorrador ? secciones.lista : []).filter(
    (s) => !borrador?.gradoId || s.grado.id === borrador.gradoId,
  );
  const cambiar = (c: Partial<Filtros>) => setBorrador((b) => b && { ...b, ...c });

  // la selección vale solo para las filas que siguen en el listado consultado
  const filas = panel?.items ?? [];
  const seleccionados = filas.filter((f) => seleccion.has(f.matriculaId)).map((f) => f.matriculaId);
  const todosMarcados = filas.length > 0 && seleccionados.length === filas.length;
  function marcar(matriculaId: string, marcado: boolean) {
    setSeleccion((s) => {
      const nueva = new Set(s);
      if (marcado) nueva.add(matriculaId);
      else nueva.delete(matriculaId);
      return nueva;
    });
  }

  function enviados(r: RecordatoriosEnviados) {
    setParaEnviar(null);
    setResultado(r);
    setSeleccion(new Set());
    // se vuelve a consultar: la columna «Último recordatorio» y quien ya pagó se actualizan
    setAplicados((a) => a && { ...a });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-texto-3">Tesorería / Morosidad</p>
          <h1 className="text-[28px] font-semibold text-texto">Panel de morosidad</h1>
          <p className="text-[15px] text-texto-2">
            {`Estudiantes con pensiones vencidas y no pagadas al ${panel ? fechaDia(panel.fecha) : "día de hoy"}. Quien regulariza su deuda sale del listado en la siguiente consulta.`}
          </p>
        </div>
        {panel && panel.items.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <Boton variante="secundario" onClick={() => descargarCsv(panel)}>
              Exportar CSV
            </Boton>
            <Boton
              icono="icon-send"
              disabled={!seleccionados.length}
              title={seleccionados.length ? undefined : "Selecciona uno o varios estudiantes de la tabla"}
              onClick={() => setParaEnviar(seleccionados)}
            >
              {seleccionados.length ? `Enviar recordatorios (${seleccionados.length})` : "Enviar recordatorios"}
            </Boton>
          </div>
        )}
      </div>

      {error && <Alerta tipo="error" titulo={error} />}
      {resultado && <ResultadoRecordatorios r={resultado} />}
      {paraEnviar && (
        <ModalRecordatorios matriculaIds={paraEnviar} onCerrar={() => setParaEnviar(null)} onEnviados={enviados} />
      )}

      {panel && (
        <Tarjeta className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-3">
          <div>
            <p className="text-[14px] text-texto-2">Estudiantes con deuda</p>
            <p className="text-[30px] font-semibold text-texto">{panel.resumen.estudiantes}</p>
          </div>
          <div>
            <p className="text-[14px] text-texto-2">Deuda vencida total</p>
            <p className="text-[30px] font-semibold text-rojo-oscuro">{soles(panel.resumen.deudaTotal)}</p>
          </div>
          <div>
            <p className="text-[14px] text-texto-2">Cuotas vencidas</p>
            <p className="text-[30px] font-semibold text-texto">{panel.resumen.cuotasVencidas}</p>
          </div>
        </Tarjeta>
      )}

      <Tarjeta className="flex flex-col gap-4 p-6">
        {!anios && !error && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando…
          </div>
        )}
        {anios && !anios.length && <Alerta tipo="info" titulo="Todavía no hay años académicos registrados." />}
        {borrador && anios && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <Selector etiqueta="Año" valor={borrador.anioId} onCambiar={(v) => cambiar({ anioId: v, seccionId: "" })}>
                {anios.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.anio}
                  </option>
                ))}
              </Selector>
            </div>
            <div className="w-52">
              <Selector
                etiqueta="Grado"
                valor={borrador.gradoId}
                onCambiar={(v) => cambiar({ gradoId: v, seccionId: "" })}
              >
                <option value="">Todos los grados</option>
                {grados.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </Selector>
            </div>
            <div className="w-40">
              <Selector etiqueta="Sección" valor={borrador.seccionId} onCambiar={(v) => cambiar({ seccionId: v })}>
                <option value="">Todas</option>
                {seccionesDelGrado.map((s) => (
                  <option key={s.id} value={s.id}>{`${s.grado.numero}° ${s.nombre}`}</option>
                ))}
              </Selector>
            </div>
            <div className="w-40">
              <Selector
                etiqueta="Meses adeudados"
                valor={borrador.mesesMinimos}
                onCambiar={(v) => cambiar({ mesesMinimos: v })}
              >
                <option value="">Todos</option>
                <option value="1">1 o más</option>
                <option value="2">2 o más</option>
                <option value="3">3 o más</option>
              </Selector>
            </div>
            <div className="w-44">
              <Selector
                etiqueta="Ordenar por"
                valor={borrador.orden}
                onCambiar={(v) => cambiar({ orden: v as Filtros["orden"] })}
              >
                <option value="MONTO">Deuda total</option>
                <option value="MESES">Meses adeudados</option>
              </Selector>
            </div>
            <Boton icono="icon-sliders" onClick={() => setAplicados({ ...borrador })} cargando={cargando}>
              Filtrar
            </Boton>
            <button
              type="button"
              className="px-2 py-3 text-[14px] font-semibold text-kubo-azul"
              onClick={() => {
                const limpio = { ...borrador, ...FILTROS_VACIOS };
                setBorrador(limpio);
                setAplicados(limpio);
              }}
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {panel && (
          <p className="text-[13px] text-texto-3">
            {`Resultado: ${panel.resumen.estudiantes} estudiante${panel.resumen.estudiantes === 1 ? "" : "s"} · ${soles(panel.resumen.deudaTotal)}`}
          </p>
        )}
        {panel && !panel.items.length && (
          <Alerta tipo="exito" titulo="No hay estudiantes con pensiones vencidas con estos filtros.">
            Las cuotas pendientes que aún no vencen no aparecen aquí.
          </Alerta>
        )}
        {panel && panel.items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-borde">
            <table className="w-full min-w-[940px] text-left text-[13px]">
              <thead className="bg-fondo text-texto-2">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      className="block size-[18px] cursor-pointer accent-kubo-azul"
                      aria-label="Seleccionar a todos los estudiantes del listado"
                      checked={todosMarcados}
                      onChange={(e) => setSeleccion(new Set(e.target.checked ? filas.map((f) => f.matriculaId) : []))}
                    />
                  </th>
                  {[
                    "Estudiante",
                    "Sección",
                    "Meses adeudados",
                    "N.°",
                    "Deuda total",
                    "Atraso",
                    "Apoderado responsable",
                    "Último recordatorio",
                    "",
                  ].map((t) => (
                    <th key={t} className="px-3 py-2 font-semibold">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {panel.items.map((f) => (
                  <tr
                    key={f.matriculaId}
                    className={`border-t border-borde ${f.cuotasVencidas >= 2 ? "bg-[rgba(214,69,69,0.05)]" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="block size-[18px] cursor-pointer accent-kubo-azul"
                        aria-label={`Seleccionar a ${f.nombreCompleto}`}
                        checked={seleccion.has(f.matriculaId)}
                        onChange={(e) => marcar(f.matriculaId, e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar nombre={f.nombreCompleto} />
                        <span className="font-semibold text-texto">{f.nombreCompleto}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-texto-2">{f.seccion?.nombre ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {f.adeudado.map((m, i) => (
                          <Badge key={`${m}-${i}`} tono="rojo">
                            {m}
                          </Badge>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-texto">{f.cuotasVencidas}</td>
                    <td className="px-3 py-2 font-semibold text-texto">{soles(f.deuda)}</td>
                    <td className="px-3 py-2 text-texto-2">{`${f.diasAtraso} día${f.diasAtraso === 1 ? "" : "s"}`}</td>
                    <td className="px-3 py-2 text-texto-2">
                      {f.responsable ? (
                        <span className="flex flex-col">
                          <span className="text-texto">{f.responsable.nombreCompleto}</span>
                          <span className="text-[12px] text-texto-3">
                            {`${f.responsable.parentesco}${f.responsable.telefono ? ` · ${f.responsable.telefono}` : ""}`}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-texto-2">
                      {f.ultimoRecordatorio ? (
                        <span title={fechaHora(new Date(f.ultimoRecordatorio))}>
                          {fechaHora(new Date(f.ultimoRecordatorio)).split(" ")[0]}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        <Link
                          href={`/coordinador/pagos?estudiante=${f.estudianteId}&anio=${panel.anio.id}`}
                          aria-label={`Ver pensiones y pagos de ${f.nombreCompleto}`}
                          className="inline-flex rounded p-1 hover:bg-fondo"
                        >
                          <Icono nombre="act-eye" size={18} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setParaEnviar([f.matriculaId])}
                          aria-label={`Enviar recordatorio de pago por ${f.nombreCompleto}`}
                          title="Enviar recordatorio"
                          className="inline-flex rounded p-1 hover:bg-fondo"
                        >
                          <Icono nombre="icon-send-azul" size={18} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[12px] text-texto-3">
          Una cuota está vencida si sigue «Pendiente» después de su fecha de vencimiento (hora de Lima). No se listan
          matrículas retiradas ni anuladas. Selecciona a los estudiantes y presiona «Enviar recordatorios»: el sistema
          no envía a quienes ya no tienen cuotas vencidas y guarda la fecha del último recordatorio de cada estudiante.
        </p>
      </Tarjeta>
    </div>
  );
}
