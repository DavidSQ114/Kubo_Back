// AP-03 · Justificar una inasistencia (bloque M3, fase 7): el apoderado elige una falta o tardanza de su hijo de los
// últimos 7 días, escribe el motivo y, si quiere, adjunta un PDF o una imagen JPG de hasta 5 MB. El tutor de la sección
// la revisa; el estado de cada justificación enviada se ve aquí y llega como notificación.
"use client";

import { useState, type FormEvent } from "react";
import { BadgeEstado, useConsulta, type EstadoAsistencia } from "@/components/portal/asistencia";
import { Alerta, Badge, Boton, Modal, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { diaSemanaCorto, diaYHora, fechaDia } from "@/lib/formato";
import { mensajeError } from "./PortalApoderado";

interface Justificable {
  registroId: string;
  fecha: string;
  curso: string;
  horaInicio: string;
  estado: EstadoAsistencia;
}

interface Enviada {
  id: string;
  fecha: string;
  curso: string;
  horaInicio: string;
  motivo: string;
  archivo: { nombre: string } | null;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  enviadaEn: string;
  motivoRechazo: string | null;
}

interface Justificaciones {
  desde: string;
  hoy: string;
  justificables: Justificable[];
  enviadas: Enviada[];
}

const TAMANO_MAXIMO = 5 * 1024 * 1024;
const LARGO_MAXIMO_MOTIVO = 500;

const ESTADO: Record<Enviada["estado"], { texto: string; tono: "ambar" | "verde" | "rojo" }> = {
  PENDIENTE: { texto: "Pendiente de revisión", tono: "ambar" },
  APROBADA: { texto: "Aprobada", tono: "verde" },
  RECHAZADA: { texto: "Rechazada", tono: "rojo" },
};

function ModalJustificar({
  estudianteId,
  registro,
  onCerrar,
  onEnviada,
}: {
  estudianteId: string;
  registro: Justificable;
  onCerrar: () => void;
  onEnviada: (d: Justificaciones) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivoInvalido =
    archivo && (archivo.size > TAMANO_MAXIMO || !/\.(pdf|jpe?g)$/i.test(archivo.name))
      ? "El archivo debe ser un PDF o una imagen JPG de hasta 5 MB."
      : null;

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("registroId", registro.registroId);
      form.set("motivo", motivo.trim());
      if (archivo) form.set("archivo", archivo);
      onEnviada(
        await api<Justificaciones>(`/horarios/apoderado/hijos/${estudianteId}/justificaciones`, {
          method: "POST",
          body: form,
        }),
      );
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-info"
      tonoIcono="azul"
      titulo={`Justificar ${registro.estado === "FALTA" ? "falta" : "tardanza"}`}
      subtitulo={`${diaSemanaCorto(registro.fecha)} · ${registro.horaInicio} · ${registro.curso}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton
            onClick={() => enviar()}
            cargando={enviando}
            disabled={motivo.trim().length < 5 || archivoInvalido !== null}
          >
            Enviar justificación
          </Boton>
        </>
      }
    >
      <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
        <label htmlFor="motivo-justificacion-apoderado" className="text-[14px] font-semibold text-texto">
          Motivo <span className="text-rojo">*</span>
        </label>
        <textarea
          id="motivo-justificacion-apoderado"
          rows={3}
          maxLength={LARGO_MAXIMO_MOTIVO}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: Tuvo cita médica en la mañana."
          className="w-full rounded-md border border-borde bg-white px-3 py-2 text-[14px] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul"
        />
        <label htmlFor="archivo-justificacion" className="text-[14px] font-semibold text-texto">
          Constancia (opcional)
        </label>
        <input
          id="archivo-justificacion"
          type="file"
          accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="text-[14px] text-texto-2"
        />
        <p className="text-[12px] text-texto-3">PDF o JPG de hasta 5 MB. El tutor de la sección la revisará.</p>
        {archivoInvalido && <Alerta tipo="error" titulo={archivoInvalido} />}
        {error && <Alerta tipo="error" titulo={error} />}
      </form>
    </Modal>
  );
}

/** Tarjeta «Justificar inasistencias» de la asistencia del hijo (AP-03). */
export function JustificacionesDelHijo({ estudianteId, nombre }: { estudianteId: string; nombre: string }) {
  const { carga, reintentar } = useConsulta<Justificaciones>(
    `/horarios/apoderado/hijos/${estudianteId}/justificaciones`,
  );
  const [actual, setActual] = useState<Justificaciones | null>(null);
  const [eligiendo, setEligiendo] = useState<Justificable | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (carga.fase === "cargando") return null;
  if (carga.fase === "error") {
    return (
      <Alerta tipo="error" titulo="No pudimos cargar las justificaciones">
        {carga.mensaje}{" "}
        <button type="button" onClick={reintentar} className="font-semibold text-kubo-azul underline">
          Reintentar
        </button>
      </Alerta>
    );
  }
  const d = actual ?? carga.datos;
  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Justificar inasistencias</h2>
        <p className="text-[13px] leading-[1.5] text-texto-3">
          Faltas y tardanzas de {nombre} desde el {fechaDia(d.desde)} que todavía no están justificadas.
        </p>
      </div>
      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      {d.justificables.length === 0 ? (
        <p className="text-[14px] leading-[1.5] text-texto-2">
          No hay faltas ni tardanzas por justificar en estos días.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {d.justificables.map((r) => (
            <li key={r.registroId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 text-[14px] text-texto">
                {diaSemanaCorto(r.fecha)} · {r.horaInicio} · {r.curso}
              </span>
              <BadgeEstado estado={r.estado} />
              <Boton variante="secundario" className="!px-3 !py-1.5 !text-[14px]" onClick={() => setEligiendo(r)}>
                Justificar
              </Boton>
            </li>
          ))}
        </ul>
      )}
      {d.enviadas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-texto">Justificaciones enviadas</h3>
          <ul className="flex flex-col divide-y divide-borde">
            {d.enviadas.map((j) => (
              <li key={j.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14px] text-texto">
                    {diaSemanaCorto(j.fecha)} · {j.horaInicio} · {j.curso}
                  </span>
                  <span className="text-[12px] text-texto-3">
                    Enviada el {diaYHora(j.enviadaEn)}
                    {j.archivo ? ` · con ${j.archivo.nombre}` : ""}
                  </span>
                  {j.motivoRechazo && (
                    <span className="text-[13px] text-rojo-oscuro">Motivo del rechazo: {j.motivoRechazo}</span>
                  )}
                </div>
                <Badge tono={ESTADO[j.estado].tono}>{ESTADO[j.estado].texto}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      {eligiendo && (
        <ModalJustificar
          estudianteId={estudianteId}
          registro={eligiendo}
          onCerrar={() => setEligiendo(null)}
          onEnviada={(nuevo) => {
            setActual(nuevo);
            setEligiendo(null);
            setAviso("Justificación enviada: el tutor de la sección la revisará.");
          }}
        />
      )}
    </Tarjeta>
  );
}
