// Matrícula · Apoderado (bloque M4): proceso de matrícula del año y, por cada hijo vinculado, «Matricular» (si no
// tiene matrícula activa y la matrícula está abierta) o el estado de su solicitud con los documentos observados para
// reemplazar.
"use client";

import { useEffect, useState } from "react";
import { mensajeError } from "@/components/apoderado/PortalApoderado";
import { TarjetaHijo, TarjetaProceso, type MatriculaEnLinea } from "@/components/apoderado/matriculaEnLinea";
import { Alerta, Boton, Spinner } from "@/components/ui";
import { api } from "@/lib/api";

type Carga = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; datos: MatriculaEnLinea };

export default function MatriculaApoderadoPage() {
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api<MatriculaEnLinea>("/matricula/apoderado/matricula")
      .then((datos) => vigente && setCarga({ fase: "listo", datos }))
      .catch((e) => vigente && setCarga({ fase: "error", mensaje: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, [intento]);

  const recargar = (mensaje?: string) => {
    setExito(mensaje ?? null);
    setIntento((n) => n + 1);
  };

  return (
    <>
      <header className="flex flex-col gap-1 border-b border-borde pb-6">
        <h1 className="text-[32px] leading-[1.2] font-bold text-texto">Matrícula</h1>
        <p className="text-[16px] text-texto-2">
          Matricula a tus hijos en línea: confirma sus datos, elige el grado y sube los documentos que pide el colegio.
        </p>
      </header>
      {exito && <Alerta tipo="exito" titulo={exito} />}
      {carga.fase === "cargando" && (
        <div className="flex items-center gap-3 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando…
        </div>
      )}
      {carga.fase === "error" && (
        <Alerta tipo="error" titulo={carga.mensaje}>
          <Boton variante="secundario" onClick={() => recargar()}>
            Reintentar
          </Boton>
        </Alerta>
      )}
      {carga.fase === "listo" && (
        <>
          <TarjetaProceso proceso={carga.datos.proceso} />
          {carga.datos.hijos.length === 0 ? (
            <p className="rounded-lg bg-white px-4 py-6 text-center text-[14px] text-texto-2">
              No tienes hijos vinculados a tu cuenta. Comunícate con la secretaría del colegio para que los vinculen.
            </p>
          ) : (
            carga.datos.hijos.map((h) => (
              <TarjetaHijo key={h.estudianteId} hijo={h} datos={carga.datos} onCambio={recargar} />
            ))
          )}
        </>
      )}
    </>
  );
}
