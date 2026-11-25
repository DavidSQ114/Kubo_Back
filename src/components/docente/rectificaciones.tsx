// M-08 · Solicitud de rectificación de nota (US41): modal del docente para un registro cerrado o publicado, la lista
// de sus solicitudes con su estado en DO-04 y las piezas que comparte la bandeja del Administrador (AD-15): estado de
// la solicitud y el cambio «B › A».
"use client";

import { useState } from "react";
import { BadgeLogro, LOGROS, NOMBRE_LOGRO, type Logro, type RegistroDeNotas } from "@/components/docente/notas";
import { mensajeError } from "@/components/portal";
import { Alerta, Badge, Boton, Icono, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { diaYHora } from "@/lib/formato";

// ---------- Tipos de la API (/api/v1/evaluacion/…/rectificaciones) ----------

export type EstadoSolicitud = "PENDIENTE" | "EN_REVISION" | "APROBADA" | "RECHAZADA" | "CANCELADA";

export interface SolicitudRectificacion {
  id: string;
  estado: EstadoSolicitud;
  /** «Pendiente de aprobación», «Aprobada» o «Rechazada». */
  nombreEstado: string;
  pendiente: boolean;
  asignacionId: string;
  periodoId: string;
  estadoRegistro: "ABIERTO" | "CERRADO" | "PUBLICADO";
  docente: { id: string; nombre: string; nombreCorto: string };
  anio: number;
  curso: { codigo: string; nombre: string };
  seccion: string;
  bimestre: { numero: number; nombre: string };
  matriculaId: string;
  estudiante: string;
  competencia: { competenciaPlanId: string; columna: string; codigo: string; nombre: string };
  valorAnterior: Logro;
  valorSolicitado: Logro;
  valorActual: Logro;
  motivo: string;
  motivoRechazo: string | null;
  solicitadoPor: string;
  solicitadoEn: string;
  resueltoPor: string | null;
  resueltoEn: string | null;
  esPropia: boolean;
}

export interface SolicitudCreada {
  solicitud: SolicitudRectificacion;
  aviso: { destinatarios: number; enviados: number };
}

/** Largo máximo del motivo (el mismo que valida el servidor). */
export const LARGO_MAXIMO_MOTIVO = 500;

export const claveNota = (matriculaId: string, competenciaPlanId: string) => `${matriculaId}|${competenciaPlanId}`;

// ---------- Piezas compartidas ----------

export function BadgeEstadoSolicitud({
  solicitud,
}: {
  solicitud: Pick<SolicitudRectificacion, "estado" | "nombreEstado">;
}) {
  const tono = solicitud.estado === "APROBADA" ? "verde" : solicitud.estado === "RECHAZADA" ? "rojo" : "ambar";
  return (
    <Badge tono={tono} punto>
      {solicitud.nombreEstado}
    </Badge>
  );
}

/** «B › A»: el logro registrado y el solicitado. */
export function CambioSolicitado({ de, a }: { de: Logro; a: Logro }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={`De ${de} a ${a}`}>
      <BadgeLogro logro={de} />
      <Icono nombre="pag-chevr" size={16} />
      <BadgeLogro logro={a} />
    </span>
  );
}

// ---------- M-08 · Solicitud de rectificación de nota ----------

/**
 * Modal del docente (US41, criterio 1): estudiante, competencia, valor correcto (distinto del registrado) y motivo.
 * Una nota con una solicitud pendiente no admite otra: se avisa y no se envía.
 */
export function ModalSolicitarRectificacion({
  registro,
  pendientes,
  onCerrar,
  onEnviada,
}: {
  registro: RegistroDeNotas;
  /** Notas («matrícula|competencia») con una solicitud pendiente de aprobación. */
  pendientes: Set<string>;
  onCerrar: () => void;
  onEnviada: (creada: SolicitudCreada) => void;
}) {
  const [matriculaId, setMatriculaId] = useState("");
  const [competenciaPlanId, setCompetenciaPlanId] = useState("");
  const [valor, setValor] = useState<Logro | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alumno = registro.alumnos.find((a) => a.matriculaId === matriculaId);
  const registrado = alumno?.notas[competenciaPlanId]?.logro ?? null;
  const yaPendiente = !!matriculaId && !!competenciaPlanId && pendientes.has(claveNota(matriculaId, competenciaPlanId));
  const completo = !!registrado && !!valor && valor !== registrado && motivo.trim().length > 0 && !yaPendiente;

  function elegirNota(nuevaMatricula: string, nuevaCompetencia: string) {
    setMatriculaId(nuevaMatricula);
    setCompetenciaPlanId(nuevaCompetencia);
    setValor(null);
    setError(null);
  }

  async function enviar() {
    if (!completo) return;
    setEnviando(true);
    setError(null);
    try {
      const creada = await api<SolicitudCreada>(
        `/evaluacion/registros/${registro.asignacionId}/bimestres/${registro.bimestre.id}/rectificaciones`,
        { method: "POST", body: { matriculaId, competenciaPlanId, valorCorrecto: valor, motivo: motivo.trim() } },
      );
      onEnviada(creada);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const estadoRegistro = registro.estado === "PUBLICADO" ? "registro publicado" : "registro cerrado";
  const claseSelect =
    "h-12 w-full rounded-lg border border-borde bg-white px-3 text-[16px] font-normal text-texto outline-none focus:border-kubo-azul";
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-comentario"
      tonoIcono="azul"
      titulo="Solicitud de rectificación de nota"
      subtitulo={`${registro.bimestre.nombre} · ${registro.curso.nombre} ${registro.seccion.etiqueta} · ${estadoRegistro}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton icono="icon-send" cargando={enviando} disabled={!completo} onClick={enviar}>
            Enviar solicitud
          </Boton>
        </>
      }
    >
      <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
        <span>
          Estudiante <span className="text-rojo">*</span>
        </span>
        <select
          value={matriculaId}
          onChange={(e) => elegirNota(e.target.value, competenciaPlanId)}
          className={claseSelect}
        >
          <option value="">Elige un estudiante</option>
          {registro.alumnos.map((a) => (
            <option key={a.matriculaId} value={a.matriculaId}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
        <span>
          Competencia <span className="text-rojo">*</span>
        </span>
        <select
          value={competenciaPlanId}
          onChange={(e) => elegirNota(matriculaId, e.target.value)}
          className={claseSelect}
        >
          <option value="">Elige una competencia</option>
          {registro.competencias.map((c, i) => (
            <option key={c.competenciaPlanId} value={c.competenciaPlanId}>
              {`C${i + 1} · ${c.nombre}`}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg bg-fondo p-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-texto-3">Logro registrado</span>
          {registrado ? (
            <BadgeLogro logro={registrado} />
          ) : (
            <span className="h-9 text-[14px] leading-9 text-texto-3">—</span>
          )}
        </div>
        <Icono nombre="pag-chevr" size={16} className="mt-5" />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium text-texto-2">
            Valor correcto <span className="text-rojo">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {LOGROS.map((l) => (
              <button
                key={l}
                type="button"
                title={NOMBRE_LOGRO[l]}
                aria-pressed={valor === l}
                disabled={!registrado || l === registrado}
                onClick={() => setValor(l)}
                className={`rounded-md ${valor === l ? "ring-2 ring-kubo-azul ring-offset-1" : ""} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <BadgeLogro logro={l} titulo={l === registrado ? "Es el valor registrado" : NOMBRE_LOGRO[l]} />
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      {yaPendiente && (
        <Alerta tipo="aviso" titulo="Esta nota ya tiene una solicitud pendiente de aprobación">
          Espera a que la coordinación académica la apruebe o la rechace antes de enviar otra.
        </Alerta>
      )}

      <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
        <span>
          Motivo del error <span className="text-rojo">*</span>
        </span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={LARGO_MAXIMO_MOTIVO}
          rows={3}
          placeholder="Por ejemplo: al digitar se registró B, pero la rúbrica indica logro esperado (A)."
          className="w-full rounded-lg border border-borde bg-white px-4 py-3 text-[15px] font-normal leading-[1.5] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul"
        />
      </label>

      <Alerta tipo="info">
        La solicitud quedará «Pendiente de aprobación» y se notificará a la coordinación académica. Te avisaremos si se
        aprueba o rechaza.
      </Alerta>
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}

// ---------- Mis solicitudes del registro (DO-04) ----------

/** Solicitudes del docente para el registro que está viendo, de la más reciente a la más antigua. */
export function SolicitudesDelRegistro({ solicitudes }: { solicitudes: SolicitudRectificacion[] }) {
  if (!solicitudes.length) return null;
  return (
    <section className="flex flex-col gap-3" aria-label="Mis solicitudes de rectificación">
      <h3 className="text-[16px] font-semibold text-texto">Mis solicitudes de rectificación</h3>
      <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
        {solicitudes.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[14px] font-semibold text-texto">
                {s.estudiante} · {s.competencia.columna}
              </p>
              <p className="text-[13px] text-texto-3">{`Enviada el ${diaYHora(s.solicitadoEn)} · ${s.motivo}`}</p>
              {s.estado === "RECHAZADA" && s.motivoRechazo && (
                <p className="text-[13px] text-rojo-oscuro">{`Motivo del rechazo: ${s.motivoRechazo}`}</p>
              )}
              {s.resueltoEn && s.estado !== "RECHAZADA" && (
                <p className="text-[13px] text-texto-3">{`Resuelta el ${diaYHora(s.resueltoEn)}`}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CambioSolicitado de={s.valorAnterior} a={s.valorSolicitado} />
              <BadgeEstadoSolicitud solicitud={s} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
