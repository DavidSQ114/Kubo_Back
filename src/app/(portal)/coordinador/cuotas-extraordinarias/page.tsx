// Cuotas extraordinarias (bloque M4): lotes del año con su concepto, destino, vencimiento, monto y avance de pago;
// «Nueva cuota extraordinaria» con vista previa (cantidad y total) antes de confirmar; detalle del lote con sus
// cuotas y anulación del lote o de una cuota sin pagar, con motivo. Solo Coordinador académico.
"use client";

import { useEffect, useState } from "react";
import type { AnioAcademico } from "@/components/admin/anio";
import { Selector, type Grado, type Seccion } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import {
  BadgeLote,
  ModalAnularExtraordinaria,
  ModalDetalleLote,
  ModalNuevoLote,
  type DetalleLote,
  type LoteListado,
} from "@/components/coordinador/cuotasExtraordinarias";
import { Alerta, Boton, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia, soles } from "@/lib/formato";

/** «1 cuota», «3 cuotas». */
const cantidad = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

/** Año por defecto: el «En curso» y, si no hay, el «En matrícula». */
const anioPorDefecto = (anios: AnioAcademico[]) =>
  anios.find((a) => a.estado === "EN_CURSO") ?? anios.find((a) => a.estado === "EN_MATRICULA") ?? anios[0];

type Anulando = { titulo: string; detalle: string; ruta: string; exito: string };

export default function CuotasExtraordinariasPage() {
  const [anios, setAnios] = useState<AnioAcademico[] | null>(null);
  const [anioId, setAnioId] = useState("");
  const [grados, setGrados] = useState<Grado[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [lotes, setLotes] = useState<LoteListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [creando, setCreando] = useState(false);
  const [detalle, setDetalle] = useState<DetalleLote | null>(null);
  const [anulando, setAnulando] = useState<Anulando | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const [a, g] = await Promise.all([api<AnioAcademico[]>("/academico/anios"), api<Grado[]>("/academico/grados")]);
        setAnios(a);
        setGrados(g);
        setAnioId(anioPorDefecto(a)?.id ?? "");
      } catch (e) {
        setError(alertaError(e));
      }
    }
    void cargar();
  }, []);

  useEffect(() => {
    if (!anioId) return;
    let vigente = true;
    Promise.all([
      api<{ items: LoteListado[] }>(`/matricula/extraordinarias?anioId=${anioId}`),
      api<Seccion[]>(`/academico/secciones?anioId=${anioId}`),
    ])
      .then(([l, s]) => {
        if (!vigente) return;
        setLotes(l.items);
        setSecciones(s.filter((x) => x.estado === "ACTIVA"));
        setError(null);
      })
      .catch((e) => vigente && setError(alertaError(e)));
    return () => {
      vigente = false;
    };
  }, [anioId, recarga]);

  const anio = anios?.find((a) => a.id === anioId);
  const admiteLotes = anio?.estado === "EN_MATRICULA" || anio?.estado === "EN_CURSO";

  async function abrir(loteId: string) {
    setAbriendo(loteId);
    try {
      setDetalle(await api<DetalleLote>(`/matricula/extraordinarias/${loteId}`));
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setAbriendo(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-texto-3">Matrícula y pagos / Cuotas extraordinarias</p>
          <h1 className="text-[28px] font-semibold text-texto">Cuotas extraordinarias</h1>
          <p className="text-[15px] text-texto-2">
            Cobros fuera del cronograma (paseos, materiales, actividades) para un alumno, una sección, un grado o todo
            el año. No entran en el orden de pago.
          </p>
        </div>
        {admiteLotes && (
          <Boton icono="icon-plus-blanco" onClick={() => setCreando(true)}>
            Nueva cuota extraordinaria
          </Boton>
        )}
      </div>

      {error && <Alerta tipo="error" titulo={error} />}
      {exito && <Alerta tipo="exito" titulo={exito} />}

      <Tarjeta className="flex flex-col gap-4 p-6">
        {!anios && !error && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando…
          </div>
        )}
        {anios && !anios.length && <Alerta tipo="info" titulo="Todavía no hay años académicos registrados." />}
        {anios && anios.length > 0 && (
          <div className="w-36">
            <Selector
              etiqueta="Año"
              valor={anioId}
              onCambiar={(v) => {
                setLotes(null);
                setAnioId(v);
              }}
            >
              {anios.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.anio}
                </option>
              ))}
            </Selector>
          </div>
        )}
        {anio && !admiteLotes && (
          <Alerta
            tipo="info"
            titulo={`El año ${anio.anio} no está en matrícula ni en curso: no se crean cuotas nuevas.`}
          />
        )}
        {anioId && !lotes && !error && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando lotes…
          </div>
        )}
        {lotes && !lotes.length && (
          <p className="rounded-lg bg-fondo px-4 py-6 text-center text-[14px] text-texto-2">
            Todavía no hay cuotas extraordinarias en este año. Crea una con «Nueva cuota extraordinaria».
          </p>
        )}
        {lotes && lotes.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-borde">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="bg-fondo text-texto-2">
                <tr>
                  {["Concepto", "Destino", "Vencimiento", "Monto", "Cuotas", "Total vigente", "Estado", ""].map((t) => (
                    <th key={t} className="px-3 py-2 font-semibold">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.loteId} className="border-t border-borde">
                    <td className="px-3 py-2">
                      <span className="font-semibold text-texto">{l.concepto}</span>
                      <span className="block text-[12px] text-texto-3">
                        {`Creado el ${fechaDia(l.creadoEn.slice(0, 10))}${l.creadoPor ? ` por ${l.creadoPor}` : ""}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-texto-2">
                      {l.destinoNombre}
                      <span className="block text-[12px] text-texto-3">{l.nombreDestino}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-texto-2">{fechaDia(l.fechaVencimiento)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-texto">{soles(l.monto)}</td>
                    <td className="px-3 py-2 text-texto-2">
                      {`${cantidad(l.resumen.pagadas, "pagada", "pagadas")} · ${cantidad(l.resumen.pendientes, "pendiente", "pendientes")}`}
                      {l.resumen.anuladas > 0 && (
                        <span className="block text-[12px] text-texto-3">
                          {cantidad(l.resumen.anuladas, "anulada", "anuladas")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap text-texto">{soles(l.resumen.total)}</td>
                    <td className="px-3 py-2">
                      <BadgeLote estado={l.estado} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex justify-end gap-2">
                        <Boton variante="secundario" onClick={() => abrir(l.loteId)} cargando={abriendo === l.loteId}>
                          Ver
                        </Boton>
                        {l.estado === "ACTIVO" && l.resumen.pendientes > 0 && (
                          <Boton
                            variante="secundario"
                            onClick={() =>
                              setAnulando({
                                titulo: "Anular lote",
                                detalle: `${l.concepto} · ${l.destinoNombre} · ${cantidad(l.resumen.pendientes, "cuota", "cuotas")} sin pagar`,
                                ruta: `/matricula/extraordinarias/${l.loteId}/anular`,
                                exito: `El lote «${l.concepto}» quedó anulado.`,
                              })
                            }
                          >
                            Anular
                          </Boton>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {creando && anioId && (
        <ModalNuevoLote
          anioId={anioId}
          grados={grados}
          secciones={secciones}
          onCerrar={() => setCreando(false)}
          onCreado={(l) => {
            setCreando(false);
            setExito(
              `${l.resumen.cuotas === 1 ? "Se generó 1 cuota" : `Se generaron ${l.resumen.cuotas} cuotas`} «${l.concepto}» por ${soles(l.resumen.total)}.`,
            );
            setRecarga((n) => n + 1);
          }}
        />
      )}
      {detalle && (
        <ModalDetalleLote
          lote={detalle}
          onCerrar={() => setDetalle(null)}
          onAnularCuota={(c) => {
            setDetalle(null);
            setAnulando({
              titulo: "Anular cuota",
              detalle: `${detalle.concepto} · ${c.nombreCompleto} · ${soles(c.monto)}`,
              ruta: `/matricula/cuotas/${c.cuotaId}/anular`,
              exito: `La cuota de ${c.nombreCompleto} quedó anulada.`,
            });
          }}
        />
      )}
      {anulando && (
        <ModalAnularExtraordinaria
          titulo={anulando.titulo}
          detalle={anulando.detalle}
          ruta={anulando.ruta}
          onCerrar={() => setAnulando(null)}
          onAnulado={() => {
            setExito(anulando.exito);
            setAnulando(null);
            setRecarga((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
