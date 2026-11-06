// AD-16 · Auditoría y registros del sistema: «Log de errores» (US05), de solo lectura para el Administrador. Errores
// 500 con su stack trace completo y errores 400 de validación como eventos informativos; filtros por fecha, nivel y
// código HTTP. Los textos ya llegan redactados (sin DNI, correos ni tokens).
"use client";

import { useEffect, useState } from "react";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Campo, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaHora } from "@/lib/formato";

type Nivel = "INFO" | "WARN" | "ERROR" | "FATAL";

interface RegistroError {
  id: string;
  fecha: string;
  nivel: Nivel;
  codigoHttp: number;
  metodoHttp: string | null;
  endpoint: string;
  mensaje: string;
  requestId: string | null;
  usuario: string | null;
  tieneStack: boolean;
}

interface DetalleError extends Omit<RegistroError, "tieneStack"> {
  stackTrace: string | null;
  ipOrigen: string | null;
}

interface Pagina {
  items: RegistroError[];
  paginacion: { pagina: number; tamano: number; total: number; paginas: number };
}

interface Filtros {
  desde: string;
  hasta: string;
  nivel: string;
  codigoHttp: string;
  pagina: number;
}

const FILTROS_INICIALES: Filtros = { desde: "", hasta: "", nivel: "", codigoHttp: "", pagina: 1 };
const TAMANO_PAGINA = 20;

function BadgeNivel({ registro }: { registro: Pick<RegistroError, "nivel" | "codigoHttp"> }) {
  const texto = registro.nivel === "INFO" ? "INFO" : `${registro.nivel} ${registro.codigoHttp}`;
  if (registro.nivel === "INFO") return <Badge tono="azul">{texto}</Badge>;
  if (registro.nivel === "WARN") return <Badge tono="ambar">{texto}</Badge>;
  return <Badge tono="rojo">{texto}</Badge>;
}

export default function AuditoriaPage() {
  const [borrador, setBorrador] = useState<Filtros>(FILTROS_INICIALES);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_INICIALES);
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleError | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const q = new URLSearchParams({ pagina: String(aplicados.pagina), tamano: String(TAMANO_PAGINA) });
        if (aplicados.desde) q.set("desde", aplicados.desde);
        if (aplicados.hasta) q.set("hasta", aplicados.hasta);
        if (aplicados.nivel) q.set("nivel", aplicados.nivel);
        if (aplicados.codigoHttp) q.set("codigoHttp", aplicados.codigoHttp);
        const p = await api<Pagina>(`/identidad/errores?${q}`);
        if (vigente) {
          setPagina(p);
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
  }, [aplicados]);

  useEffect(() => {
    if (!elegido) return;
    let vigente = true;
    api<DetalleError>(`/identidad/errores/${elegido}`)
      .then((d) => {
        if (vigente) {
          setDetalle(d);
          setErrorDetalle(null);
        }
      })
      .catch((e) => vigente && setErrorDetalle(alertaError(e)));
    return () => {
      vigente = false;
    };
  }, [elegido]);

  const actual = detalle && detalle.id === elegido ? detalle : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-texto-3">Seguridad / Auditoría</p>
        <h1 className="text-[28px] font-semibold text-texto">Auditoría y registros del sistema</h1>
        <p className="text-[15px] text-texto-2">
          Bitácoras de solo lectura. Los registros son inmutables: nadie puede editarlos ni eliminarlos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Tarjeta className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-texto">Log de errores</h2>
              <p className="text-[13px] text-texto-3">
                Errores 500 con traza completa · errores 400 de validación como eventos informativos
              </p>
            </div>
            <Badge tono="gris">Solo lectura</Badge>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Campo
                etiqueta="Desde"
                type="date"
                value={borrador.desde}
                onChange={(e) => setBorrador((b) => ({ ...b, desde: e.target.value }))}
              />
            </div>
            <div className="w-40">
              <Campo
                etiqueta="Hasta"
                type="date"
                value={borrador.hasta}
                onChange={(e) => setBorrador((b) => ({ ...b, hasta: e.target.value }))}
              />
            </div>
            <div className="w-36">
              <Selector
                etiqueta="Nivel"
                valor={borrador.nivel}
                onCambiar={(v) => setBorrador((b) => ({ ...b, nivel: v }))}
              >
                <option value="">Todos</option>
                <option value="ERROR">ERROR</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="FATAL">FATAL</option>
              </Selector>
            </div>
            <div className="w-36">
              <Selector
                etiqueta="Código HTTP"
                valor={borrador.codigoHttp}
                onCambiar={(v) => setBorrador((b) => ({ ...b, codigoHttp: v }))}
              >
                <option value="">Todos</option>
                <option value="500">500</option>
                <option value="400">400</option>
              </Selector>
            </div>
            <Boton icono="icon-sliders" onClick={() => setAplicados({ ...borrador, pagina: 1 })}>
              Aplicar filtros
            </Boton>
          </div>
          {error && <Alerta tipo="error" titulo={error} />}
          {!pagina && !error && (
            <div className="flex items-center gap-3 text-[14px] text-texto-2">
              <Spinner claro={false} /> Cargando…
            </div>
          )}
          {pagina && !pagina.items.length && <Alerta tipo="info" titulo="No hay registros con estos filtros." />}
          {pagina && pagina.items.length > 0 && (
            <>
              <p className="text-[13px] text-texto-3">{`${pagina.paginacion.total} registros · del más reciente al más antiguo`}</p>
              <div className="overflow-x-auto rounded-lg border border-borde">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className="bg-fondo text-texto-2">
                    <tr>
                      {["Fecha y hora", "Nivel", "Endpoint", "Detalle", ""].map((t) => (
                        <th key={t} className="px-3 py-2 font-semibold">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagina.items.map((r) => (
                      <tr
                        key={r.id}
                        className={`border-t border-borde align-top ${elegido === r.id ? "bg-fondo" : ""}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-texto-2">{fechaHora(new Date(r.fecha))}</td>
                        <td className="px-3 py-2">
                          <BadgeNivel registro={r} />
                        </td>
                        <td className="px-3 py-2 text-texto">{`${r.metodoHttp ?? ""} ${r.endpoint}`}</td>
                        <td className="px-3 py-2 text-texto-2">
                          {r.mensaje}
                          {r.usuario ? <span className="block text-[12px] text-texto-3">{r.usuario}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Boton variante="secundario" onClick={() => setElegido(r.id)}>
                            Ver
                          </Boton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagina.paginacion.paginas > 1 && (
                <div className="flex items-center justify-end gap-3 text-[13px] text-texto-2">
                  <Boton
                    variante="secundario"
                    disabled={aplicados.pagina <= 1}
                    onClick={() => setAplicados((a) => ({ ...a, pagina: a.pagina - 1 }))}
                  >
                    Anterior
                  </Boton>
                  {`Página ${pagina.paginacion.pagina} de ${pagina.paginacion.paginas}`}
                  <Boton
                    variante="secundario"
                    disabled={aplicados.pagina >= pagina.paginacion.paginas}
                    onClick={() => setAplicados((a) => ({ ...a, pagina: a.pagina + 1 }))}
                  >
                    Siguiente
                  </Boton>
                </div>
              )}
            </>
          )}
          <p className="text-[12px] text-texto-3">
            Rotación automática al superar 50 MB; los archivos anteriores se conservan comprimidos (gzip). Niveles:
            INFO, WARN, ERROR y FATAL. Los errores de validación (400) se registran con nivel INFO y sin traza.
          </p>
        </Tarjeta>

        <Tarjeta className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[18px] font-semibold text-texto">Detalle del error</h2>
            {actual && <BadgeNivel registro={actual} />}
          </div>
          {!elegido && <p className="text-[14px] text-texto-2">Elige un registro para ver su detalle.</p>}
          {elegido && !actual && !errorDetalle && (
            <div className="flex items-center gap-3 text-[14px] text-texto-2">
              <Spinner claro={false} /> Cargando…
            </div>
          )}
          {errorDetalle && <Alerta tipo="error" titulo={errorDetalle} />}
          {actual && (
            <dl className="flex flex-col gap-3 text-[14px]">
              <div>
                <dt className="text-texto-3">Fecha y hora</dt>
                <dd className="text-texto">{fechaHora(new Date(actual.fecha))}</dd>
              </div>
              <div>
                <dt className="text-texto-3">Endpoint</dt>
                <dd className="text-texto">{`${actual.metodoHttp ?? ""} ${actual.endpoint}`}</dd>
              </div>
              <div>
                <dt className="text-texto-3">Usuario</dt>
                <dd className="text-texto">{actual.usuario ?? "Sin sesión"}</dd>
              </div>
              <div>
                <dt className="text-texto-3">Mensaje</dt>
                <dd className="break-words text-texto">{actual.mensaje}</dd>
              </div>
              <div>
                <dt className="text-texto-3">Stack trace</dt>
                <dd>
                  {actual.stackTrace ? (
                    <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-kubo-azul-oscuro p-3 text-[12px] whitespace-pre-wrap text-white">
                      {actual.stackTrace}
                    </pre>
                  ) : (
                    <span className="text-texto-2">Sin traza: evento informativo.</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-texto-3">Request ID</dt>
                <dd className="font-mono text-[12px] break-all text-texto-2">{actual.requestId ?? "—"}</dd>
              </div>
            </dl>
          )}
        </Tarjeta>
      </div>

      <Alerta tipo="info" titulo="Otras bitácoras">
        Los cambios de notas llegarán con el módulo de evaluación. El log de operaciones de pago está en «Pensiones y
        pagos», en la cuenta de cada estudiante.
      </Alerta>
    </div>
  );
}
