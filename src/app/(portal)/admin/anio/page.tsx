// AD-02 · Año académico y bimestres (US06, US07)
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeEstadoAnio,
  EncabezadoTarjeta,
  FormularioAnio,
  FormularioBimestres,
  ID_CAMPO_ANIO,
  matriculaHabilitada,
  ModalCambioEstado,
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

  function enfocarFormulario() {
    const campo = document.getElementById(ID_CAMPO_ANIO);
    campo?.scrollIntoView({ behavior: "smooth", block: "center" });
    campo?.focus();
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] whitespace-pre text-texto-3">Configuración / Año académico</p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Año académico y bimestres</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            Apertura el año escolar y define sus periodos de evaluación. Los docentes solo registran notas dentro de un
            bimestre activo.
          </p>
        </div>
        <Boton icono="icon-plus-blanco" onClick={enfocarFormulario}>
          Nuevo año académico
        </Boton>
      </div>

      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[460px_1fr]">
        <Tarjeta className="p-6">
          <FormularioAnio
            onCreado={(a) => {
              setElegidoId(a.id);
              recargar(`Se creó el año académico ${a.anio}. Ahora registra sus bimestres.`);
            }}
          />
        </Tarjeta>

        <Tarjeta className="flex flex-col gap-5 p-6">
          <EncabezadoTarjeta titulo="Años registrados" subtitulo="La matrícula se habilita solo para el año activo" />
          {carga.fase === "cargando" && (
            <div className="flex items-center justify-center gap-3 py-10 text-[14px] text-texto-2">
              <Spinner claro={false} /> Cargando los años académicos…
            </div>
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
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-borde px-6 py-10 text-center">
              <Icono nombre="icon-calendar" size={28} />
              <p className="text-[16px] font-semibold text-texto">Aún no hay años académicos</p>
              <p className="max-w-[360px] text-[14px] leading-[1.4] text-texto-2">
                Regístralo con el formulario de la izquierda. Luego define sus cuatro bimestres y abre la matrícula.
              </p>
            </div>
          )}
          {elegido && (
            <TablaAnios anios={anios} elegidoId={elegido.id} onElegir={setElegidoId} onCambiarEstado={setACambiar} />
          )}
          <Alerta tipo="info">
            Un año académico con matrículas registradas no puede eliminarse; solo cerrarse al finalizar el periodo.
          </Alerta>
          <div className="flex items-start gap-2">
            <Icono nombre="icon-info" size={16} className="mt-px" />
            <p className="text-[13px] leading-[1.4] text-texto-3">
              Estados del año académico: Planificado → En matrícula → En curso → En cierre → Cerrado. La matrícula solo
              se habilita cuando el año está En matrícula o En curso, y solo puede haber un año En curso a la vez.
            </p>
          </div>
        </Tarjeta>
      </div>

      {elegido && (
        <Tarjeta className="p-6">
          {/* La key sigue a los bimestres guardados: el formulario se reinicia solo cuando llegan datos nuevos. */}
          <FormularioBimestres key={claveBimestres(elegido)} anio={elegido} onGuardado={recargar} />
        </Tarjeta>
      )}

      <ModalCambioEstado anio={aCambiar} onCerrar={() => setACambiar(null)} onListo={recargar} />
    </>
  );
}

const claveBimestres = (anio: AnioAcademico) =>
  [anio.id, ...anio.periodos.map((p) => `${p.numero}:${p.fechaInicio}:${p.fechaFin}:${p.estado}`)].join("|");

function TablaAnios({
  anios,
  elegidoId,
  onElegir,
  onCambiarEstado,
}: {
  anios: AnioAcademico[];
  elegidoId: string;
  onElegir: (id: string) => void;
  onCambiarEstado: (anio: AnioAcademico) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-borde">
      <table className="w-full min-w-[520px] border-collapse bg-white text-left">
        <thead>
          <tr className="border-b border-borde bg-fondo text-[13px] font-semibold leading-[1.4] text-texto-2">
            <th className="w-[72px] px-4 py-3 font-semibold">Año</th>
            <th className="px-4 py-3 font-semibold">Vigencia</th>
            <th className="w-[130px] px-4 py-3 font-semibold">Estado</th>
            <th className="w-[150px] px-4 py-3">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {anios.map((a) => {
            const activo = a.id === elegidoId;
            const destino = siguienteEstado(a.estado);
            const transicion = destino ? TRANSICIONES[destino] : null;
            return (
              <tr
                key={a.id}
                aria-selected={activo}
                onClick={() => onElegir(a.id)}
                className={`cursor-pointer border-b border-borde text-[14px] leading-[1.4] text-texto last:border-b-0 ${
                  activo ? "bg-kubo-azul/5" : "hover:bg-fondo"
                }`}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onElegir(a.id)}
                    aria-label={`Ver los bimestres de ${a.anio}`}
                    className="text-[15px] font-semibold text-texto"
                  >
                    {a.anio}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <p className="whitespace-nowrap">
                    {fechaDia(a.fechaInicio)} – {fechaDia(a.fechaFin)}
                  </p>
                  <p className="text-[12px] text-texto-3">
                    {matriculaHabilitada(a.estado) ? "Matrícula habilitada" : "Matrícula no habilitada"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <BadgeEstadoAnio estado={a.estado} />
                </td>
                <td className="px-4 py-2 text-right">
                  {transicion && (
                    <Boton
                      variante={transicion.secundaria ? "secundario" : "primario"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCambiarEstado(a);
                      }}
                      className="whitespace-nowrap"
                    >
                      {transicion.accion}
                    </Boton>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
