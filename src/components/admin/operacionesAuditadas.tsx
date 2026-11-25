// AD-16 · Auditoría · pestaña «Operaciones auditadas» (RF03, bloque M1): bitácora inmutable de operaciones críticas
// (registrar usuarios, suspender, desbloquear, cambiar parámetros, matrículas, pagos, notas…) de solo lectura para el
// Administrador, con filtros por fecha y acción, de la más reciente a la más antigua y paginada. Cada fila muestra
// quién, cuándo, qué, sobre qué entidad y, al abrirla, el valor anterior y el nuevo.
"use client";

import { Fragment, useEffect, useState } from "react";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Campo, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaHora } from "@/lib/formato";

interface Operacion {
  id: string;
  fecha: string;
  accion: string;
  entidad: string;
  entidadId: string;
  usuario: string | null;
  valorAnterior: unknown;
  valorNuevo: unknown;
  motivo: string | null;
}

interface Pagina {
  items: Operacion[];
  acciones: string[];
  paginacion: { pagina: number; total: number; paginas: number };
}

interface Filtros {
  desde: string;
  hasta: string;
  accion: string;
  pagina: number;
}

const INICIALES: Filtros = { desde: "", hasta: "", accion: "", pagina: 1 };
const TAMANO_PAGINA = 20;

/** «SUSPENDER_USUARIO» → «Suspender usuario». */
const legible = (accion: string) => {
  const t = accion.toLowerCase().replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const json = (valor: unknown) => (valor == null ? "—" : JSON.stringify(valor, null, 2));

export function OperacionesAuditadas() {
  const [borrador, setBorrador] = useState<Filtros>(INICIALES);
  const [aplicados, setAplicados] = useState<Filtros>(INICIALES);
  const [carga, setCarga] = useState<{ filtros: Filtros; pagina?: Pagina; error?: string } | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    const q = new URLSearchParams({ pagina: String(aplicados.pagina), tamano: String(TAMANO_PAGINA) });
    if (aplicados.desde) q.set("desde", aplicados.desde);
    if (aplicados.hasta) q.set("hasta", aplicados.hasta);
    if (aplicados.accion) q.set("accion", aplicados.accion);
    api<Pagina>(`/identidad/auditoria?${q}`)
      .then((pagina) => vigente && setCarga({ filtros: aplicados, pagina }))
      .catch((e) => vigente && setCarga({ filtros: aplicados, error: alertaError(e) }));
    return () => {
      vigente = false;
    };
  }, [aplicados]);

  const actual = carga?.filtros === aplicados ? carga : null;
  const acciones = carga?.pagina?.acciones ?? [];

  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-texto">Operaciones auditadas</h2>
          <p className="text-[13px] text-texto-3">Quién hizo cada operación crítica, cuándo y qué cambió</p>
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
        <div className="w-64">
          <Selector
            etiqueta="Acción"
            valor={borrador.accion}
            onCambiar={(v) => setBorrador((b) => ({ ...b, accion: v }))}
          >
            <option value="">Todas</option>
            {acciones.map((a) => (
              <option key={a} value={a}>
                {legible(a)}
              </option>
            ))}
          </Selector>
        </div>
        <Boton onClick={() => setAplicados({ ...borrador, pagina: 1 })}>Filtrar</Boton>
        <Boton
          variante="secundario"
          onClick={() => {
            setBorrador(INICIALES);
            setAplicados(INICIALES);
          }}
        >
          Limpiar
        </Boton>
      </div>

      {!actual ? (
        <div className="flex items-center justify-center gap-3 p-10 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando…
        </div>
      ) : actual.error ? (
        <Alerta tipo="error" titulo="No pudimos cargar la bitácora">
          <p>{actual.error}</p>
          <Boton variante="secundario" onClick={() => setAplicados({ ...aplicados })}>
            Reintentar
          </Boton>
        </Alerta>
      ) : !actual.pagina?.items.length ? (
        <p className="p-6 text-center text-[14px] text-texto-2">
          No hay operaciones registradas con esos filtros. Prueba con otro rango de fechas o con otra acción.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-borde text-[12px] uppercase tracking-[0.5px] text-texto-3">
                <th className="py-2.5 pr-4 font-semibold">Fecha</th>
                <th className="py-2.5 pr-4 font-semibold">Usuario</th>
                <th className="py-2.5 pr-4 font-semibold">Acción</th>
                <th className="py-2.5 pr-4 font-semibold">Entidad</th>
                <th className="py-2.5 pr-4 font-semibold">Motivo</th>
                <th className="py-2.5 font-semibold">
                  <span className="sr-only">Cambios</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {actual.pagina.items.map((o) => (
                <Fragment key={o.id}>
                  <tr className="border-b border-borde align-top">
                    <td className="py-3 pr-4 whitespace-nowrap text-texto-2">{fechaHora(new Date(o.fecha))}</td>
                    <td className="py-3 pr-4 text-texto">{o.usuario ?? "—"}</td>
                    <td className="py-3 pr-4 font-semibold text-texto">{legible(o.accion)}</td>
                    <td className="py-3 pr-4 text-texto-2">{o.entidad}</td>
                    <td className="py-3 pr-4 text-texto-2">{o.motivo ?? "—"}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        aria-expanded={abierta === o.id}
                        onClick={() => setAbierta((a) => (a === o.id ? null : o.id))}
                        className="font-semibold whitespace-nowrap text-kubo-azul hover:underline"
                      >
                        {abierta === o.id ? "Ocultar" : "Ver cambios"}
                      </button>
                    </td>
                  </tr>
                  {abierta === o.id && (
                    <tr className="border-b border-borde bg-fondo">
                      <td colSpan={6} className="p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <p className="pb-1 text-[12px] font-semibold text-texto-3">Valor anterior</p>
                            <pre className="overflow-x-auto rounded-md bg-white p-3 text-[12px] text-texto">
                              {json(o.valorAnterior)}
                            </pre>
                          </div>
                          <div>
                            <p className="pb-1 text-[12px] font-semibold text-texto-3">Valor nuevo</p>
                            <pre className="overflow-x-auto rounded-md bg-white p-3 text-[12px] text-texto">
                              {json(o.valorNuevo)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actual?.pagina && actual.pagina.paginacion.paginas > 1 && (
        <div className="flex items-center justify-end gap-3 text-[14px] text-texto-2">
          <span>
            Página {aplicados.pagina} de {actual.pagina.paginacion.paginas} · {actual.pagina.paginacion.total} en total
          </span>
          <Boton
            variante="secundario"
            disabled={aplicados.pagina <= 1}
            onClick={() => setAplicados((f) => ({ ...f, pagina: f.pagina - 1 }))}
          >
            Anterior
          </Boton>
          <Boton
            variante="secundario"
            disabled={aplicados.pagina >= actual.pagina.paginacion.paginas}
            onClick={() => setAplicados((f) => ({ ...f, pagina: f.pagina + 1 }))}
          >
            Siguiente
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}
