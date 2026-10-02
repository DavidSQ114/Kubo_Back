// Encabezado y carga de datos contra un endpoint REST (sin datos inventados).
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alerta, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { alertaError } from "@/lib/portal";

function esListado(data: unknown): data is { items: unknown[] } {
  return typeof data === "object" && data !== null && Array.isArray((data as { items?: unknown[] }).items);
}

function VistaGenerica({ data }: { data: unknown }) {
  if (esListado(data)) {
    if (data.items.length === 0) {
      return (
        <Alerta tipo="info" titulo="Sin registros">
          La consulta respondió correctamente, pero no hay elementos para mostrar.
        </Alerta>
      );
    }
    return (
      <Tarjeta className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-[14px] leading-[1.4]">
          <thead className="border-b border-borde bg-fondo text-texto-3">
            <tr>
              <th className="px-4 py-3 font-semibold">Registro</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={i} className="border-b border-borde last:border-0">
                <td className="px-4 py-3 font-mono text-[12px] text-texto-2">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta className="p-4">
      <pre className="overflow-x-auto text-[12px] leading-[1.5] text-texto-2">{JSON.stringify(data, null, 2)}</pre>
    </Tarjeta>
  );
}

export function EncabezadoPagina({
  migas,
  titulo,
  descripcion,
  acciones,
}: {
  migas: string;
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
        <p className="text-[14px] leading-[1.4] text-texto-3">{migas}</p>
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">{titulo}</h1>
        {descripcion && <p className="max-w-3xl text-[16px] leading-[1.5] text-texto-2">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

export function PaginaModulo({
  migas,
  titulo,
  descripcion,
  endpoint,
  query,
  acciones,
  children,
}: {
  migas: string;
  titulo: string;
  descripcion?: string;
  endpoint: string;
  query?: Record<string, string | number | undefined>;
  acciones?: ReactNode;
  children?: (data: unknown) => ReactNode;
}) {
  const ruta = useMemo(() => {
    const p = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== "") p.set(k, String(v));
      }
    }
    const qs = p.toString();
    return qs ? `${endpoint}?${qs}` : endpoint;
  }, [endpoint, query]);

  const [resultado, setResultado] = useState<{ ruta: string; data?: unknown; error?: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    api<unknown>(ruta)
      .then((d) => {
        if (vivo) setResultado({ ruta, data: d });
      })
      .catch((e) => {
        if (vivo) setResultado({ ruta, error: alertaError(e) });
      });
    return () => {
      vivo = false;
    };
  }, [ruta]);

  const cargando = resultado?.ruta !== ruta;
  const error = resultado?.ruta === ruta ? resultado.error : null;
  const data = resultado?.ruta === ruta ? resultado.data : null;

  return (
    <>
      <EncabezadoPagina migas={migas} titulo={titulo} descripcion={descripcion} acciones={acciones} />
      {cargando && (
        <div className="flex justify-center py-16">
          <Spinner claro={false} />
        </div>
      )}
      {!cargando && error && (
        <Alerta tipo="error" titulo="No pudimos cargar la información">
          {error}
        </Alerta>
      )}
      {!cargando && !error && (children ? children(data) : <VistaGenerica data={data} />)}
    </>
  );
}
