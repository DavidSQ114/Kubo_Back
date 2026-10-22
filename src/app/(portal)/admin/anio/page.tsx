// AD-02 · Año académico y bimestres (US06, US07)
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeEstadoAnio,
  CANTIDAD_BIMESTRES,
  FormularioBimestres,
  LineaEstados,
  ModalCambioEstado,
  ModalCrearAnio,
  siguienteEstado,
  TRANSICIONES,
  type AnioAcademico,
} from "@/components/admin/anio";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia } from "@/lib/formato";

type Carga = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "lista"; anios: AnioAcademico[] };

export default function AnioAcademicoPage() {
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [recarga, setRecarga] = useState(0);
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [aCambiar, setACambiar] = useState<AnioAcademico | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const anios = await api<AnioAcademico[]>("/academico/anios");
        if (vigente) setCarga({ fase: "lista", anios });
      } catch (e) {
        if (vigente) setCarga({ fase: "error", mensaje: alertaError(e) });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [recarga]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const recargar = useCallback((mensaje?: string) => {
    if (mensaje) setAviso(mensaje);
    setRecarga((n) => n + 1);
  }, []);

  const anios = carga.fase === "lista" ? carga.anios : [];
  // Sin elección, se muestra el primer año que no esté cerrado (o el más reciente).
  const elegido =
    anios.find((a) => a.id === elegidoId) ?? anios.find((a) => a.estado !== "CERRADO") ?? anios[0] ?? null;

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] whitespace-pre text-texto-3">Configuración / Año y bimestres</p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Año académico y bimestres</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            Crea el año académico, define sus cuatro bimestres y avanza su estado: matrícula, clases, cierre y cierre
            definitivo.
          </p>
        </div>
        <Boton onClick={() => setCreando(true)}>Crear año académico</Boton>
      </div>

      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}

      {carga.fase === "cargando" && (
        <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando los años académicos…
        </Tarjeta>
      )}

      {carga.fase === "error" && (
        <Alerta tipo="error" titulo="No pudimos cargar los años académicos">
          {carga.mensaje}{" "}
          <button type="button" onClick={() => recargar()} className="font-semibold text-kubo-azul hover:underline">
            Reintentar
          </button>
        </Alerta>
      )}

      {carga.fase === "lista" && anios.length === 0 && (
        <Tarjeta className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-kubo-azul/10">
            <Icono nombre="icon-calendar" size={28} />
          </div>
          <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Aún no hay años académicos</h2>
          <p className="max-w-[440px] text-[14px] leading-[1.4] text-texto-2">
            Crea el primero con sus fechas de inicio y fin. Luego registra sus cuatro bimestres y abre la matrícula.
          </p>
          <Boton onClick={() => setCreando(true)}>Crear año académico</Boton>
        </Tarjeta>
      )}

      {anios.length > 0 && elegido && (
        <>
          <ListaAnios anios={anios} elegidoId={elegido.id} onElegir={setElegidoId} />
          <DetalleAnio
            key={elegido.id}
            anio={elegido}
            onCambiarEstado={() => setACambiar(elegido)}
            onGuardado={recargar}
          />
        </>
      )}

      <ModalCrearAnio
        abierto={creando}
        onCerrar={() => setCreando(false)}
        onCreado={(a) => {
          setCreando(false);
          setElegidoId(a.id);
          recargar(`Se creó el año académico ${a.anio}. Ahora registra sus bimestres.`);
        }}
      />
      <ModalCambioEstado anio={aCambiar} onCerrar={() => setACambiar(null)} onListo={recargar} />
    </>
  );
}

function ListaAnios({
  anios,
  elegidoId,
  onElegir,
}: {
  anios: AnioAcademico[];
  elegidoId: string;
  onElegir: (id: string) => void;
}) {
  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Años académicos</h2>
      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full min-w-[640px] border-collapse bg-white text-left">
          <thead>
            <tr className="border-b border-borde bg-fondo text-[13px] font-semibold leading-[1.4] text-texto-2">
              <th className="w-[110px] px-4 py-2.5 font-semibold">Año</th>
              <th className="px-4 py-2.5 font-semibold">Fechas</th>
              <th className="w-[150px] px-4 py-2.5 font-semibold">Bimestres</th>
              <th className="w-[150px] px-4 py-2.5 font-semibold">Estado</th>
              <th className="w-[120px] px-4 py-2.5 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {anios.map((a) => {
              const activo = a.id === elegidoId;
              return (
                <tr
                  key={a.id}
                  aria-selected={activo}
                  className={`border-b border-borde text-[14px] leading-[1.4] text-texto last:border-b-0 ${activo ? "bg-kubo-azul/5" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold">{a.anio}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fechaDia(a.fechaInicio)} al {fechaDia(a.fechaFin)}
                  </td>
                  <td className="px-4 py-3">
                    {a.periodos.length === CANTIDAD_BIMESTRES ? (
                      "4 de 4"
                    ) : (
                      <span className="text-texto-3">{a.periodos.length} de 4</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeEstadoAnio estado={a.estado} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {activo ? (
                      <span className="text-[13px] font-semibold text-kubo-azul">Seleccionado</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onElegir(a.id)}
                        className="text-[14px] font-semibold text-kubo-azul hover:underline"
                      >
                        Ver detalle
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

const claveBimestres = (anio: AnioAcademico) =>
  [anio.id, ...anio.periodos.map((p) => `${p.numero}:${p.fechaInicio}:${p.fechaFin}:${p.estado}`)].join("|");

function DetalleAnio({
  anio,
  onCambiarEstado,
  onGuardado,
}: {
  anio: AnioAcademico;
  onCambiarEstado: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const destino = siguienteEstado(anio.estado);
  const transicion = destino ? TRANSICIONES[destino] : null;
  return (
    <>
      <Tarjeta className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-[24px] font-semibold leading-[1.25] text-texto">Año {anio.anio}</h2>
              <BadgeEstadoAnio estado={anio.estado} />
            </div>
            <p className="text-[14px] leading-[1.4] text-texto-2">
              Del {fechaDia(anio.fechaInicio)} al {fechaDia(anio.fechaFin)}
            </p>
          </div>
          {transicion && (
            <Boton variante={transicion.peligro ? "peligro" : "primario"} onClick={onCambiarEstado}>
              {transicion.accion}
            </Boton>
          )}
        </div>
        <LineaEstados estado={anio.estado} />
        {anio.estado === "CERRADO" && (
          <Alerta tipo="info" titulo="Año cerrado">
            Este año ya no se puede modificar. Sus datos quedan disponibles para consulta.
          </Alerta>
        )}
      </Tarjeta>

      <Tarjeta className="p-6">
        {/* La key sigue a los bimestres guardados: el formulario se reinicia solo cuando llegan datos nuevos. */}
        <FormularioBimestres key={claveBimestres(anio)} anio={anio} onGuardado={onGuardado} />
      </Tarjeta>
    </>
  );
}
