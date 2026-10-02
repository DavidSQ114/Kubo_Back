// AD-17 · Importar horario (CSV)
"use client";

import Link from "next/link";
import { useState } from "react";
import { EncabezadoPagina } from "@/components/portal/PaginaModulo";
import { Alerta, Boton, Campo, Tarjeta } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { alertaError } from "@/lib/portal";

export default function ImportarHorarioPage() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function importar() {
    if (!archivo) {
      setError("Selecciona un archivo CSV.");
      return;
    }
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      const res = await fetch("/api/v1/horarios/importar", { method: "POST", body: form, credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(
          json?.error?.code ?? "ERROR",
          json?.error?.message ?? "No pudimos importar el horario.",
          res.status,
          json?.error?.details ?? {},
        );
      }
      setMensaje("Importación completada.");
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <EncabezadoPagina
        migas="Académico / Horarios / Importar"
        titulo="Importar horario (CSV)"
        descripcion="Carga masiva de detalle de horario. El backend validará cruces y vacantes."
        acciones={
          <Link href="/admin/horarios">
            <Boton variante="secundario">Volver a horarios</Boton>
          </Link>
        }
      />
      {mensaje && (
        <Alerta tipo="exito" titulo={mensaje}>
          Revisa la matriz en la pantalla de horarios.
        </Alerta>
      )}
      {error && (
        <Alerta tipo="error" titulo="Importación no disponible">
          {error}
        </Alerta>
      )}
      <Tarjeta className="flex max-w-xl flex-col gap-4 p-6">
        <Campo
          etiqueta="Archivo CSV"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
        <Boton onClick={importar} disabled={enviando || !archivo}>
          {enviando ? "Importando…" : "Importar"}
        </Boton>
      </Tarjeta>
    </>
  );
}
