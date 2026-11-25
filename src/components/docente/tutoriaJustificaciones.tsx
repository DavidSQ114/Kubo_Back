// Mi tutoría · Justificaciones (bloque M3, fase 7): las justificaciones que enviaron los apoderados de la sección. El
// tutor o cotutor abre el archivo adjunto, aprueba (el registro queda justificado) o rechaza con motivo; el apoderado
// recibe la notificación. Debajo, las revisadas en los últimos 30 días.
"use client";

import { useState } from "react";
import { mensajeError } from "@/components/portal";
import {
  BadgeEstado,
  CargandoAsistencia,
  ErrorAsistencia,
  useConsulta,
  type EstadoAsistencia,
} from "@/components/portal/asistencia";
import { Alerta, Badge, Boton, Modal, Tarjeta } from "@/components/ui";
import { abrirEnPestana, api } from "@/lib/api";
import { diaSemanaCorto, diaYHora } from "@/lib/formato";
import { useTutoria } from "./tutoria";

interface Justificacion {
  id: string;
  registroId: string;
  matriculaId: string;
  alumno: string;
  presentadaPor: string | null;
  fecha: string;
  curso: string;
  horaInicio: string;
  estadoRegistro: EstadoAsistencia;
  motivo: string;
  archivo: { nombre: string; tamanoBytes: number | null } | null;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  enviadaEn: string;
  revisadaEn: string | null;
  motivoRechazo: string | null;
}

interface Justificaciones {
  pendientes: Justificacion[];
  revisadas: Justificacion[];
}

function Detalle({ j, seccionId }: { j: Justificacion; seccionId: string }) {
  const [error, setError] = useState<string | null>(null);
  async function verArchivo() {
    setError(null);
    try {
      await abrirEnPestana(`/horarios/tutoria/${seccionId}/justificaciones/${j.id}/archivo`);
    } catch (e) {
      setError(mensajeError(e));
    }
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[15px] font-semibold leading-[1.4] text-texto">{j.alumno}</span>
      <span className="flex flex-wrap items-center gap-2 text-[13px] text-texto-2">
        {diaSemanaCorto(j.fecha)} · {j.horaInicio} · {j.curso}
        <BadgeEstado estado={j.estadoRegistro} />
      </span>
      <p className="text-[14px] leading-[1.5] text-texto">«{j.motivo}»</p>
      <span className="text-[12px] text-texto-3">
        Enviada por {j.presentadaPor ?? "el apoderado"} el {diaYHora(j.enviadaEn)}
      </span>
      {j.archivo && (
        <button
          type="button"
          onClick={verArchivo}
          className="self-start text-[13px] font-semibold text-kubo-azul underline-offset-2 hover:underline"
        >
          Ver archivo adjunto ({j.archivo.nombre})
        </button>
      )}
      {error && <Alerta tipo="error" titulo={error} />}
    </div>
  );
}

function ModalRechazo({
  seccionId,
  j,
  onCerrar,
  onListo,
}: {
  seccionId: string;
  j: Justificacion;
  onCerrar: () => void;
  onListo: (d: Justificaciones) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function rechazar() {
    setEnviando(true);
    setError(null);
    try {
      onListo(
        await api<Justificaciones>(`/horarios/tutoria/${seccionId}/justificaciones/${j.id}/rechazar`, {
          method: "POST",
          body: { motivo: motivo.trim() },
        }),
      );
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(false);
    }
  }
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="alerta-err"
      titulo="Rechazar justificación"
      subtitulo={`${j.alumno} · ${diaSemanaCorto(j.fecha)} · ${j.curso}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="peligro" onClick={rechazar} cargando={enviando} disabled={motivo.trim().length < 5}>
            Rechazar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="motivo-rechazo" className="text-[14px] font-semibold text-texto">
          Motivo del rechazo <span className="text-rojo">*</span>
        </label>
        <textarea
          id="motivo-rechazo"
          rows={3}
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: La constancia es de otra fecha."
          className="w-full rounded-md border border-borde bg-white px-3 py-2 text-[14px] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul"
        />
        <p className="text-[12px] text-texto-3">El apoderado verá este motivo en su notificación.</p>
        {error && <Alerta tipo="error" titulo={error} />}
      </div>
    </Modal>
  );
}

export function JustificacionesTutoria() {
  const t = useTutoria();
  const ruta = `/horarios/tutoria/${t.seccion.id}/justificaciones`;
  const { carga, reintentar } = useConsulta<Justificaciones>(ruta);
  const [actual, setActual] = useState<Justificaciones | null>(null);
  const [aprobando, setAprobando] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<Justificacion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function aprobar(j: Justificacion) {
    setAprobando(j.id);
    setError(null);
    setAviso(null);
    try {
      setActual(await api<Justificaciones>(`${ruta}/${j.id}/aprobar`, { method: "POST" }));
      setAviso(`Se aprobó la justificación de ${j.alumno}: el registro quedó justificado.`);
    } catch (e) {
      setError(mensajeError(e));
    }
    setAprobando(null);
  }

  if (carga.fase === "cargando") return <CargandoAsistencia />;
  if (carga.fase === "error") return <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />;
  const d = actual ?? carga.datos;
  return (
    <div className="flex flex-col gap-4">
      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      {error && <Alerta tipo="error" titulo={error} />}
      <Tarjeta className="flex flex-col gap-3 p-4 lg:p-5">
        <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Por revisar ({d.pendientes.length})</h2>
        {d.pendientes.length === 0 ? (
          <p className="text-[14px] leading-[1.5] text-texto-2">
            No hay justificaciones pendientes. Los apoderados las envían desde la asistencia de su hijo, para faltas y
            tardanzas de los últimos 7 días.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {d.pendientes.map((j) => (
              <li key={j.id} className="flex flex-wrap items-start gap-3 py-3">
                <Detalle j={j} seccionId={t.seccion.id} />
                <div className="flex gap-2">
                  <Boton
                    variante="secundario"
                    className="!px-3 !py-1.5 !text-[14px]"
                    onClick={() => setRechazando(j)}
                    disabled={aprobando !== null}
                  >
                    Rechazar
                  </Boton>
                  <Boton
                    className="!px-3 !py-1.5 !text-[14px]"
                    onClick={() => aprobar(j)}
                    cargando={aprobando === j.id}
                    disabled={aprobando !== null}
                  >
                    Aprobar
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
      {d.revisadas.length > 0 && (
        <Tarjeta className="flex flex-col gap-3 p-4 lg:p-5">
          <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Revisadas en los últimos 30 días</h2>
          <ul className="flex flex-col divide-y divide-borde">
            {d.revisadas.map((j) => (
              <li key={j.id} className="flex flex-wrap items-start gap-3 py-3">
                <Detalle j={j} seccionId={t.seccion.id} />
                <div className="flex flex-col items-end gap-1">
                  <Badge tono={j.estado === "APROBADA" ? "verde" : "rojo"}>
                    {j.estado === "APROBADA" ? "Aprobada" : "Rechazada"}
                  </Badge>
                  {j.motivoRechazo && <span className="text-[12px] text-texto-3">{j.motivoRechazo}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      {rechazando && (
        <ModalRechazo
          seccionId={t.seccion.id}
          j={rechazando}
          onCerrar={() => setRechazando(null)}
          onListo={(nuevo) => {
            setActual(nuevo);
            setAviso(`Se rechazó la justificación de ${rechazando.alumno}.`);
            setRechazando(null);
          }}
        />
      )}
    </div>
  );
}
