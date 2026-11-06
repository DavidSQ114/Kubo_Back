// AD-05 · Reglas de evaluación (US12, RF10)
"use client";

import { useCallback, useEffect, useState } from "react";
import { anioPorDefecto, type AnioAcademico } from "@/components/admin/anio";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import {
  datosIniciales,
  FormularioRegla,
  HistorialVersiones,
  ModalConfirmarRegla,
  VistaPrevia,
  type DatosRegla,
  type ReglasDelAnio,
} from "@/components/admin/reglas";
import { Alerta, Badge, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

type Carga<T> = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "lista"; datos: T };

export default function ReglasEvaluacionPage() {
  const [anios, setAnios] = useState<Carga<AnioAcademico[]>>({ fase: "cargando" });
  const [anioElegido, setAnioElegido] = useState<string | null>(null);
  const [reglas, setReglas] = useState<{ anioId: string; carga: Carga<ReglasDelAnio> } | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const lista = await api<AnioAcademico[]>("/academico/anios");
        if (vigente) setAnios({ fase: "lista", datos: lista });
      } catch (e) {
        if (vigente) setAnios({ fase: "error", mensaje: alertaError(e) });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, []);

  const lista = anios.fase === "lista" ? anios.datos : [];
  const anio = lista.find((a) => a.id === anioElegido) ?? anioPorDefecto(lista);
  const anioId = anio?.id;

  useEffect(() => {
    if (!anioId) return;
    let vigente = true;
    async function cargar() {
      try {
        const datos = await api<ReglasDelAnio>(`/academico/anios/${anioId}/reglas`);
        if (vigente) setReglas({ anioId: anioId!, carga: { fase: "lista", datos } });
      } catch (e) {
        if (vigente) setReglas({ anioId: anioId!, carga: { fase: "error", mensaje: alertaError(e) } });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [anioId, recarga]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const recargar = useCallback((mensaje?: string) => {
    if (mensaje) setAviso(mensaje);
    setRecarga((n) => n + 1);
  }, []);

  const carga: Carga<ReglasDelAnio> = reglas?.anioId === anioId && reglas ? reglas.carga : { fase: "cargando" };
  const datos = carga.fase === "lista" ? carga.datos : null;

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] whitespace-pre text-texto-3">Configuración / Reglas de evaluación</p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Reglas de evaluación</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            Define cómo se calcula el logro final de cada competencia al cerrar el bimestre. La regla vigente se aplica
            a todos los estudiantes sin excepción.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          {lista.length > 0 && (
            <div className="w-[220px]">
              <Selector etiqueta="Año académico" valor={anio?.id ?? ""} onCambiar={setAnioElegido}>
                {lista.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.anio}
                  </option>
                ))}
              </Selector>
            </div>
          )}
          {datos && (
            <Badge tono={datos.vigente ? "celeste" : "gris"} punto>
              {datos.vigente ? `Regla vigente: versión ${datos.vigente.version}` : "Sin regla vigente"}
            </Badge>
          )}
        </div>
      </div>

      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}

      {anios.fase === "error" && (
        <Alerta tipo="error" titulo="No pudimos cargar los años académicos">
          {anios.mensaje}
        </Alerta>
      )}
      {anios.fase === "lista" && lista.length === 0 && (
        <Tarjeta className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Icono nombre="icon-calendar" size={28} />
          <p className="text-[16px] font-semibold text-texto">Aún no hay años académicos</p>
          <p className="max-w-[400px] text-[14px] leading-[1.4] text-texto-2">
            Registra el año en «Año y bimestres»: la regla de consolidación se define para cada año.
          </p>
        </Tarjeta>
      )}
      {(anios.fase === "cargando" || (anioId && carga.fase === "cargando")) && (
        <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando las reglas…
        </Tarjeta>
      )}
      {carga.fase === "error" && (
        <Alerta tipo="error" titulo="No pudimos cargar las reglas del año">
          {carga.mensaje}{" "}
          <button type="button" onClick={() => recargar()} className="font-semibold text-kubo-azul hover:underline">
            Reintentar
          </button>
        </Alerta>
      )}
      {datos && (
        <EditorRegla
          key={`${datos.anio.id}-${datos.historial[0]?.version ?? 0}-${recarga}`}
          reglas={datos}
          onGuardado={recargar}
        />
      )}
    </>
  );
}

/** Formulario, vista previa e historial del año. Para descartar o tras guardar, el padre cambia su key. */
function EditorRegla({ reglas, onGuardado }: { reglas: ReglasDelAnio; onGuardado: (mensaje: string) => void }) {
  const [datos, setDatos] = useState<DatosRegla>(() => datosIniciales(reglas));
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_380px]">
        <FormularioRegla
          reglas={reglas}
          datos={datos}
          onCambiar={(cambios) => setDatos((d) => ({ ...d, ...cambios }))}
          onDescartar={() => setDatos(datosIniciales(reglas))}
          onGuardar={() => setConfirmando(true)}
        />
        <VistaPrevia metodo={datos.metodo} criterio={datos.criterioDesempate} />
      </div>
      <HistorialVersiones versiones={reglas.historial} />
      {confirmando && (
        <ModalConfirmarRegla
          reglas={reglas}
          datos={datos}
          onCerrar={() => setConfirmando(false)}
          onListo={onGuardado}
        />
      )}
    </>
  );
}
