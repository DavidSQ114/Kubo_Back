"use client";

import { useEffect, useState } from "react";
import { Alerta, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { alertaError } from "@/lib/portal";

export function BloqueApi({ titulo, endpoint }: { titulo: string; endpoint: string }) {
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api<unknown>(endpoint)
      .then((d) => {
        if (vivo) {
          setData(d);
          setEstado("ok");
        }
      })
      .catch((e) => {
        if (vivo) {
          setEstado("error");
          setError(alertaError(e));
        }
      });
    return () => {
      vivo = false;
    };
  }, [endpoint]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">{titulo}</h2>
      {estado === "idle" && <Spinner claro={false} />}
      {estado === "error" && error && (
        <Alerta tipo="error" titulo={`No pudimos cargar ${titulo.toLowerCase()}`}>
          {error}
        </Alerta>
      )}
      {estado === "ok" && (
        <Tarjeta className="p-4">
          <pre className="overflow-x-auto text-[12px] text-texto-2">{JSON.stringify(data, null, 2)}</pre>
        </Tarjeta>
      )}
    </section>
  );
}
