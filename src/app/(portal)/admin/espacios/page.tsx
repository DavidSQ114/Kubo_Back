// Espacios (bloque M1) · portal del Administrador: aulas físicas del colegio (US09) — listar, agregar, modificar y
// desactivar o activar — con la sección que usa cada una en el año elegido. Usa las rutas de aulas existentes; el
// Coordinador académico las ve al armar las secciones.
"use client";

import { useCallback, useEffect, useState } from "react";
import { anioPorDefecto, type AnioAcademico } from "@/components/admin/anio";
import { BloqueAulas } from "@/components/admin/espacios";
import { ID_CAMPO_AULA, Selector, type Aula } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

type Carga = { clave: string; aulas?: Aula[]; error?: string };

export default function EspaciosPage() {
  const [anios, setAnios] = useState<AnioAcademico[] | null>(null);
  const [anioElegido, setAnioElegido] = useState<string | null>(null);
  const [carga, setCarga] = useState<Carga | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState<Aula | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AnioAcademico[]>("/academico/anios")
      .then(setAnios)
      .catch(() => setAnios([])); // sin años igual se listan las aulas (sin la sección que las usa)
  }, []);

  const anio = anios ? (anios.find((a) => a.id === anioElegido) ?? anioPorDefecto(anios)) : undefined;
  const clave = anios ? `${anio?.id ?? "sin-anio"}|${recarga}` : null;

  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    const consulta = anio ? `?anioId=${anio.id}` : "";
    api<Aula[]>(`/academico/aulas${consulta}`)
      .then((aulas) => vigente && setCarga({ clave, aulas }))
      .catch((e) => vigente && setCarga({ clave, error: alertaError(e) }));
    return () => {
      vigente = false;
    };
  }, [clave, anio]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const recargar = useCallback((mensaje: string) => {
    setAviso(mensaje);
    setError(null);
    setRecarga((n) => n + 1);
  }, []);

  function nuevaAula() {
    setEditando(null);
    setTimeout(() => {
      const campo = document.getElementById(ID_CAMPO_AULA);
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus();
    }, 0);
  }

  async function cambiarEstado(a: Aula, activo: boolean) {
    setError(null);
    try {
      await api(`/academico/aulas/${a.id}/estado`, { method: "POST", body: { activo } });
      recargar(`${a.nombre} quedó ${activo ? "activa" : "desactivada"}.`);
    } catch (e) {
      setError(alertaError(e));
    }
  }

  const actual = carga && carga.clave === clave ? carga : null;

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] text-texto-3">Institución / Espacios</p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Espacios</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            Registra las aulas del colegio con su aforo. El coordinador académico las asigna a las secciones.
          </p>
        </div>
        {anios && anios.length > 0 && anio && (
          <div className="w-[170px]">
            <Selector etiqueta="Ocupación del año" valor={anio.id} onCambiar={setAnioElegido}>
              {anios.map((a) => (
                <option key={a.id} value={a.id}>
                  Año {a.anio}
                </option>
              ))}
            </Selector>
          </div>
        )}
        <Boton icono="icon-plus-blanco" onClick={nuevaAula}>
          Nueva aula
        </Boton>
      </div>

      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      {error && <Alerta tipo="error" titulo={error} />}

      {!actual ? (
        <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando…
        </Tarjeta>
      ) : actual.error ? (
        <Alerta tipo="error" titulo="No pudimos cargar las aulas">
          <p>{actual.error}</p>
          <Boton variante="secundario" onClick={() => setRecarga((n) => n + 1)}>
            Reintentar
          </Boton>
        </Alerta>
      ) : (
        <BloqueAulas
          aulas={actual.aulas ?? []}
          total={actual.aulas?.length ?? 0}
          resumen={false}
          editando={editando}
          onVerTodas={() => undefined}
          onEditar={setEditando}
          onCancelar={() => setEditando(null)}
          onCambiarEstado={cambiarEstado}
          onGuardado={(mensaje) => {
            setEditando(null);
            recargar(mensaje);
          }}
        />
      )}
    </>
  );
}
