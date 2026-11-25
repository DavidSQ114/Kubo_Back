// Piezas de «Solicitudes de matrícula» del Coordinador académico (bloque M4): detalle de una solicitud con cada
// documento (abrirlo, aprobarlo u observarlo con motivo) y la asignación de la sección cuando todos los obligatorios
// están aprobados.
"use client";

import { useState } from "react";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Campo, Modal } from "@/components/ui";
import { abrirEnPestana, api } from "@/lib/api";
import { fechaDia, hoyEnLima } from "@/lib/formato";
import { rutaArchivoDocumento, type Solicitud } from "@/components/apoderado/matriculaEnLinea";

export type EstadoSolicitud = Solicitud["estado"];

export const ESTADOS_SOLICITUD: { valor: EstadoSolicitud; texto: string }[] = [
  { valor: "EN_REVISION", texto: "Documentos en revisión" },
  { valor: "OBSERVADA", texto: "Con observaciones" },
  { valor: "APROBADA", texto: "Documentos aprobados" },
  { valor: "MATRICULADA", texto: "Matriculado" },
  { valor: "ANULADA", texto: "Anulada" },
];

export const TONO_SOLICITUD: Record<EstadoSolicitud, "celeste" | "ambar" | "verde" | "gris"> = {
  EN_REVISION: "celeste",
  OBSERVADA: "ambar",
  APROBADA: "verde",
  MATRICULADA: "verde",
  ANULADA: "gris",
};

export interface SolicitudListada {
  solicitudId: string;
  estudianteId: string;
  estudiante: string;
  dni: string;
  grado: string;
  apoderado: string | null;
  enviadaEn: string;
  estado: EstadoSolicitud;
  nombreEstado: string;
  documentos: { requeridos: number; aprobados: number; observados: number; enRevision: number };
}

export interface DetalleSolicitud extends Solicitud {
  anioAcademicoId: string;
  grado: string;
  estudiante: { estudianteId: string; nombreCompleto: string; dni: string } | null;
  apoderado: string | null;
  responsable: string | null;
  puedeAsignar: boolean;
  documentosPendientes: string[];
  secciones: {
    seccionId: string;
    nombre: string;
    aula: string | null;
    tutor: string | null;
    vacantes: { disponibles: number; matriculados: number; aforo: number };
  }[];
}

const TONO_DOCUMENTO = { EN_REVISION: "celeste", APROBADO: "verde", OBSERVADO: "ambar" } as const;

export const fechaEnvio = (instante: string) => fechaDia(hoyEnLima(new Date(instante)));

function FilaDocumento({
  solicitud,
  documento,
  onRevisado,
}: {
  solicitud: DetalleSolicitud;
  documento: DetalleSolicitud["documentos"][number];
  onRevisado: (d: DetalleSolicitud) => void;
}) {
  const [observando, setObservando] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = documento.documento;
  const abierta = solicitud.estado !== "MATRICULADA" && solicitud.estado !== "ANULADA";

  async function revisar(decision: "APROBAR" | "OBSERVAR") {
    if (decision === "OBSERVAR" && !observacion.trim()) {
      setError("Escribe qué debe corregir el apoderado.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      onRevisado(
        await api<DetalleSolicitud>(
          `/matricula/solicitudes/${solicitud.solicitudId}/documentos/${d!.documentoId}/revisar`,
          { method: "POST", body: { decision, observacion: decision === "OBSERVAR" ? observacion.trim() : null } },
        ),
      );
    } catch (e) {
      setError(alertaError(e));
      setEnviando(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1 text-[14px]">
          <span className="font-semibold text-texto">
            {documento.nombre}
            {!documento.obligatorio && <span className="font-normal text-texto-3"> (opcional)</span>}
          </span>
          {d ? (
            <button
              type="button"
              onClick={() =>
                abrirEnPestana(rutaArchivoDocumento(solicitud.solicitudId, d.documentoId)).catch((e) =>
                  setError(alertaError(e)),
                )
              }
              className="self-start truncate text-[13px] text-kubo-azul hover:underline"
            >
              {`Abrir ${d.nombreArchivo}`}
            </button>
          ) : (
            <span className="text-[13px] text-texto-3">El apoderado no lo subió</span>
          )}
          {d?.estado === "OBSERVADO" && d.observacion && (
            <span className="text-[13px] text-ambar-oscuro">{`Observación: ${d.observacion}`}</span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {d && (
            <Badge tono={TONO_DOCUMENTO[d.estado]} punto>
              {d.nombreEstado}
            </Badge>
          )}
          {d?.estado === "EN_REVISION" && abierta && !observando && (
            <>
              <Boton variante="secundario" onClick={() => setObservando(true)} disabled={enviando}>
                Observar
              </Boton>
              <Boton variante="exito" onClick={() => revisar("APROBAR")} cargando={enviando}>
                Aprobar
              </Boton>
            </>
          )}
        </span>
      </div>
      {observando && (
        <div className="flex flex-col gap-2 rounded-lg bg-fondo p-3">
          <Campo
            etiqueta="Observación para el apoderado"
            obligatorio
            maxLength={300}
            placeholder="Por ejemplo, la imagen no se lee; sube una foto más nítida"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setObservando(false)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={() => revisar("OBSERVAR")} cargando={enviando}>
              Observar documento
            </Boton>
          </div>
        </div>
      )}
      {error && <Alerta tipo="error" titulo={error} />}
    </li>
  );
}

export function ModalSolicitud({
  solicitud,
  onCerrar,
  onCambio,
  onMatriculado,
}: {
  solicitud: DetalleSolicitud;
  onCerrar: () => void;
  onCambio: (d: DetalleSolicitud) => void;
  onMatriculado: (mensaje: string) => void;
}) {
  const [seccionId, setSeccionId] = useState("");
  const [modalidad, setModalidad] = useState<"MENSUAL" | "ANUAL">("MENSUAL");
  const [asignando, setAsignando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nombre = solicitud.estudiante?.nombreCompleto ?? "el alumno";

  async function asignar() {
    if (!seccionId) {
      setError("Elige la sección.");
      return;
    }
    setAsignando(true);
    setError(null);
    try {
      await api(`/matricula/solicitudes/${solicitud.solicitudId}/asignar-seccion`, {
        method: "POST",
        body: { seccionId, modalidadPago: modalidad },
      });
      const seccion = solicitud.secciones.find((s) => s.seccionId === seccionId);
      onMatriculado(`${nombre} quedó matriculado en ${seccion?.nombre ?? "la sección"}. Se generó su cronograma.`);
    } catch (e) {
      setError(alertaError(e));
      setAsignando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="nav-usercheck-azul"
      tonoIcono="azul"
      titulo={`Solicitud de matrícula · ${nombre}`}
      subtitulo={`${solicitud.estudiante ? `DNI ${solicitud.estudiante.dni} · ` : ""}${solicitud.grado} · enviada el ${fechaEnvio(solicitud.enviadaEn)}`}
      pie={
        <Boton variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-[14px] text-texto-2">
        <Badge tono={TONO_SOLICITUD[solicitud.estado]} punto>
          {solicitud.nombreEstado}
        </Badge>
        <span>{`Apoderado: ${solicitud.apoderado ?? "—"} · Responsable del pago: ${solicitud.responsable ?? "—"}`}</span>
      </div>
      <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
        {solicitud.documentos.map((d) => (
          <FilaDocumento key={d.documentoRequeridoId} solicitud={solicitud} documento={d} onRevisado={onCambio} />
        ))}
      </ul>
      {solicitud.estado === "MATRICULADA" && <Alerta tipo="exito" titulo="La matrícula ya está confirmada." />}
      {solicitud.estado !== "MATRICULADA" && solicitud.estado !== "ANULADA" && !solicitud.puedeAsignar && (
        <Alerta tipo="info" titulo="Para asignar la sección deben estar aprobados todos los documentos obligatorios">
          {solicitud.documentosPendientes.length ? `Faltan: ${solicitud.documentosPendientes.join(", ")}.` : null}
        </Alerta>
      )}
      {solicitud.puedeAsignar && (
        <div className="flex flex-col gap-3 rounded-lg border border-borde p-4">
          <span className="text-[15px] font-semibold text-texto">Asignar sección</span>
          {solicitud.secciones.length === 0 ? (
            <Alerta tipo="aviso" titulo={`No hay secciones activas de ${solicitud.grado} en el año.`} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Selector etiqueta="Sección" obligatorio valor={seccionId} onCambiar={setSeccionId}>
                <option value="">Elige la sección</option>
                {solicitud.secciones.map((s) => (
                  <option key={s.seccionId} value={s.seccionId} disabled={s.vacantes.disponibles < 1}>
                    {`${s.nombre} · ${s.vacantes.disponibles} vacante${s.vacantes.disponibles === 1 ? "" : "s"}`}
                  </option>
                ))}
              </Selector>
              <Selector
                etiqueta="Modalidad de pago"
                valor={modalidad}
                onCambiar={(v) => setModalidad(v as "MENSUAL" | "ANUAL")}
              >
                <option value="MENSUAL">Mensual</option>
                <option value="ANUAL">Anual</option>
              </Selector>
            </div>
          )}
          <p className="text-[13px] text-texto-3">
            Al confirmar, la matrícula pasa a «Matriculado» y se genera su cronograma (con la cuota de ingreso si es
            alumno nuevo). El apoderado recibe un aviso.
          </p>
          <div className="flex justify-end">
            <Boton icono="check-blanco" onClick={asignar} cargando={asignando} disabled={!solicitud.secciones.length}>
              Confirmar matrícula
            </Boton>
          </div>
        </div>
      )}
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}
