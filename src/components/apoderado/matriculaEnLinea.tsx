// Piezas de «Matrícula» del portal del apoderado (bloque M4): tarjeta del proceso del año, tarjeta de cada hijo con su
// situación, formulario «Matricular» (datos del alumno confirmados, grado, responsable del pago y documentos en PDF o
// JPG de hasta 5 MB) y estado de cada documento de la solicitud con su observación y «Reemplazar».
"use client";

import { useState, type FormEvent } from "react";
import { Alerta, Badge, Boton, Casilla, Icono } from "@/components/ui";
import { abrirEnPestana, api } from "@/lib/api";
import { fechaDia, hoyEnLima } from "@/lib/formato";
import { mensajeError } from "./PortalApoderado";

// ---------- Tipos de la API (docs/api/matricula.md, «Matrícula en línea») ----------

type EstadoSolicitud = "EN_REVISION" | "OBSERVADA" | "APROBADA" | "MATRICULADA" | "ANULADA";
type EstadoDocumento = "EN_REVISION" | "APROBADO" | "OBSERVADO";

export interface DocumentoDeSolicitud {
  documentoRequeridoId: string;
  nombre: string;
  obligatorio: boolean;
  documento: {
    documentoId: string;
    nombreArchivo: string;
    tamanoBytes: number;
    estado: EstadoDocumento;
    nombreEstado: string;
    observacion: string | null;
    subidoEn: string;
    revisadoEn: string | null;
  } | null;
}

export interface Solicitud {
  solicitudId: string;
  matriculaId: string;
  gradoId: string;
  estado: EstadoSolicitud;
  nombreEstado: string;
  enviadaEn: string;
  documentos: DocumentoDeSolicitud[];
}

interface HijoParaMatricula {
  estudianteId: string;
  nombres: string;
  nombreCompleto: string;
  dni: string;
  gradoIngresoId: string | null;
  apoderados: { vinculoId: string; nombreCompleto: string; parentesco: string; esPrincipal: boolean }[];
  estadoMatricula: string | null;
  puedeMatricular: boolean;
  motivo: string | null;
  solicitud: Solicitud | null;
}

export interface MatriculaEnLinea {
  hoy: string;
  proceso: {
    anioId: string;
    anio: number;
    estado: "PROXIMO" | "ABIERTO" | "CERRADO";
    nombreEstado: string;
    fechaInicio: string;
    fechaFin: string;
    documentos: { documentoRequeridoId: string; nombre: string; obligatorio: boolean }[];
  } | null;
  grados: { id: string; numero: number; nombre: string }[];
  hijos: HijoParaMatricula[];
}

const TAMANO_MAXIMO = 5 * 1024 * 1024;
const MENSAJE_ARCHIVO = "Cada documento debe ser un PDF o una imagen JPG de hasta 5 MB.";
const archivoValido = (a: File) => a.size <= TAMANO_MAXIMO && /\.(pdf|jpe?g)$/i.test(a.name);

const TONO_SOLICITUD: Record<EstadoSolicitud, "celeste" | "ambar" | "verde" | "gris"> = {
  EN_REVISION: "celeste",
  OBSERVADA: "ambar",
  APROBADA: "verde",
  MATRICULADA: "verde",
  ANULADA: "gris",
};
const TONO_DOCUMENTO: Record<EstadoDocumento, "celeste" | "verde" | "ambar"> = {
  EN_REVISION: "celeste",
  APROBADO: "verde",
  OBSERVADO: "ambar",
};

export const rutaArchivoDocumento = (solicitudId: string, documentoId: string) =>
  `/matricula/solicitudes/${solicitudId}/documentos/${documentoId}/archivo`;

// ---------- Proceso del año ----------

export function TarjetaProceso({ proceso }: { proceso: MatriculaEnLinea["proceso"] }) {
  if (!proceso) {
    return (
      <Alerta tipo="info" titulo="El colegio todavía no abrió la matrícula en línea">
        Cuando la coordinación publique las fechas, podrás matricular a tus hijos desde aquí.
      </Alerta>
    );
  }
  const tono = proceso.estado === "ABIERTO" ? "verde" : proceso.estado === "PROXIMO" ? "celeste" : "ambar";
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-6"
      aria-label="Proceso de matrícula"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[20px] font-semibold text-texto">{`Matrícula ${proceso.anio}`}</h2>
        <Badge tono={tono} punto>
          {proceso.nombreEstado}
        </Badge>
      </div>
      <p className="text-[15px] text-texto-2">
        {`Del ${fechaDia(proceso.fechaInicio)} al ${fechaDia(proceso.fechaFin)}. Ten a la mano estos documentos en PDF o JPG (hasta 5 MB cada uno):`}
      </p>
      <ul className="flex flex-col gap-1 text-[14px] text-texto">
        {proceso.documentos.map((d) => (
          <li key={d.documentoRequeridoId} className="flex items-center gap-2">
            <Icono nombre="icon-pdf" size={16} />
            {d.nombre}
            {!d.obligatorio && <span className="text-texto-3">(opcional)</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Formulario «Matricular» ----------

function FormularioMatricula({
  hijo,
  datos,
  onEnviada,
  onCancelar,
}: {
  hijo: HijoParaMatricula;
  datos: MatriculaEnLinea;
  onEnviada: () => void;
  onCancelar: () => void;
}) {
  const proceso = datos.proceso!;
  const principal = hijo.apoderados.find((a) => a.esPrincipal) ?? hijo.apoderados[0];
  const [confirma, setConfirma] = useState(false);
  const [gradoId, setGradoId] = useState(hijo.gradoIngresoId ?? "");
  const [responsable, setResponsable] = useState(principal?.vinculoId ?? "");
  const [archivos, setArchivos] = useState<Record<string, File | null>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const faltan = proceso.documentos.filter((d) => d.obligatorio && !archivos[d.documentoRequeridoId]);
  const invalidos = Object.values(archivos).filter((a): a is File => Boolean(a) && !archivoValido(a!));
  const listo = confirma && gradoId && responsable && !faltan.length && !invalidos.length;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!listo) return;
    setEnviando(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("gradoId", gradoId);
      form.set("vinculoResponsableId", responsable);
      form.set("confirmaDatos", String(confirma));
      for (const [id, archivo] of Object.entries(archivos)) if (archivo) form.set(`documento:${id}`, archivo);
      await api(`/matricula/apoderado/hijos/${hijo.estudianteId}/matricula`, { method: "POST", body: form });
      onEnviada();
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  const selector = "w-full rounded-lg border border-borde bg-white px-4 py-3 text-[16px] text-texto";

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 border-t border-borde pt-4" noValidate>
      <div className="flex flex-col gap-2 rounded-lg bg-fondo p-4 text-[14px]">
        <span className="font-semibold text-texto">Datos del alumno</span>
        <span className="text-texto-2">{`${hijo.nombreCompleto} · DNI ${hijo.dni}`}</span>
        <Casilla etiqueta="Confirmo que los datos del alumno son correctos" checked={confirma} onChange={setConfirma} />
        <span className="text-[12px] text-texto-3">
          Si algún dato está mal, comunícate con la secretaría del colegio.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
          <span>
            Grado al que se matricula <span className="text-rojo">*</span>
          </span>
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className={selector}>
            <option value="">Elige el grado</option>
            {datos.grados.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
          <span>
            Responsable del pago <span className="text-rojo">*</span>
          </span>
          <select value={responsable} onChange={(e) => setResponsable(e.target.value)} className={selector}>
            <option value="">Elige el responsable</option>
            {hijo.apoderados.map((a) => (
              <option key={a.vinculoId} value={a.vinculoId}>{`${a.nombreCompleto} (${a.parentesco})`}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-semibold text-texto">Documentos</span>
        <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {proceso.documentos.map((d) => {
            const archivo = archivos[d.documentoRequeridoId];
            const id = `doc-${hijo.estudianteId}-${d.documentoRequeridoId}`;
            return (
              <li key={d.documentoRequeridoId} className="flex flex-col gap-1.5 px-3 py-3">
                <label htmlFor={id} className="text-[14px] text-texto">
                  {d.nombre}{" "}
                  {d.obligatorio ? (
                    <span className="text-rojo">*</span>
                  ) : (
                    <span className="text-texto-3">(opcional)</span>
                  )}
                </label>
                <input
                  id={id}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                  onChange={(e) =>
                    setArchivos((x) => ({ ...x, [d.documentoRequeridoId]: e.target.files?.[0] ?? null }))
                  }
                  className="text-[14px] text-texto-2"
                />
                {archivo && !archivoValido(archivo) && (
                  <span className="text-[13px] text-rojo-oscuro">{MENSAJE_ARCHIVO}</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[12px] text-texto-3">PDF o JPG de hasta 5 MB por documento.</p>
      </div>
      {error && <Alerta tipo="error" titulo={error} />}
      <div className="flex flex-wrap justify-end gap-3">
        <Boton variante="secundario" type="button" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={enviando} disabled={!listo}>
          Enviar matrícula
        </Boton>
      </div>
      {!listo && (
        <p className="text-right text-[13px] text-texto-3">
          {!confirma
            ? "Confirma los datos del alumno."
            : faltan.length
              ? `Falta subir: ${faltan.map((d) => d.nombre).join(", ")}.`
              : "Completa el grado y el responsable del pago."}
        </p>
      )}
    </form>
  );
}

// ---------- Documentos de la solicitud ----------

function BotonReemplazar({
  estudianteId,
  documento,
  onReemplazado,
}: {
  estudianteId: string;
  documento: DocumentoDeSolicitud;
  onReemplazado: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `reemplazo-${documento.documentoRequeridoId}`;

  async function subir(archivo: File | null) {
    if (!archivo) return;
    if (!archivoValido(archivo)) {
      setError(MENSAJE_ARCHIVO);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("archivo", archivo);
      await api(`/matricula/apoderado/hijos/${estudianteId}/matricula/documentos/${documento.documentoRequeridoId}`, {
        method: "POST",
        body: form,
      });
      onReemplazado();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <label
        htmlFor={id}
        className={`cursor-pointer rounded-md bg-white px-3 py-1.5 text-[14px] font-semibold text-kubo-azul ring-1 ring-inset ring-borde hover:bg-fondo ${enviando ? "opacity-50" : ""}`}
      >
        {enviando ? "Subiendo…" : documento.documento ? "Reemplazar" : "Subir"}
      </label>
      <input
        id={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
        disabled={enviando}
        onChange={(e) => subir(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
      {error && <span className="max-w-[240px] text-right text-[12px] text-rojo-oscuro">{error}</span>}
    </span>
  );
}

export function DocumentosDeSolicitud({
  solicitud,
  estudianteId,
  onCambio,
}: {
  solicitud: Solicitud;
  /** Solo el apoderado reemplaza: sin estudianteId la lista es de lectura (coordinador). */
  estudianteId?: string;
  onCambio?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const abierta = solicitud.estado !== "MATRICULADA" && solicitud.estado !== "ANULADA";
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
        {solicitud.documentos.map((d) => (
          <li key={d.documentoRequeridoId} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
            <span className="flex min-w-0 flex-col gap-1 text-[14px]">
              <span className="font-semibold text-texto">
                {d.nombre}
                {!d.obligatorio && <span className="font-normal text-texto-3"> (opcional)</span>}
              </span>
              {d.documento ? (
                <button
                  type="button"
                  onClick={() =>
                    abrirEnPestana(rutaArchivoDocumento(solicitud.solicitudId, d.documento!.documentoId)).catch((e) =>
                      setError(mensajeError(e)),
                    )
                  }
                  className="self-start truncate text-[13px] text-kubo-azul hover:underline"
                >
                  {d.documento.nombreArchivo}
                </button>
              ) : (
                <span className="text-[13px] text-texto-3">Sin archivo</span>
              )}
              {d.documento?.estado === "OBSERVADO" && d.documento.observacion && (
                <span className="text-[13px] text-ambar-oscuro">{`Observación: ${d.documento.observacion}`}</span>
              )}
            </span>
            <span className="flex items-center gap-3">
              {d.documento && (
                <Badge tono={TONO_DOCUMENTO[d.documento.estado]} punto>
                  {d.documento.nombreEstado}
                </Badge>
              )}
              {estudianteId && abierta && (!d.documento || d.documento.estado === "OBSERVADO") && (
                <BotonReemplazar estudianteId={estudianteId} documento={d} onReemplazado={() => onCambio?.()} />
              )}
            </span>
          </li>
        ))}
      </ul>
      {error && <Alerta tipo="error" titulo={error} />}
    </div>
  );
}

// ---------- Tarjeta de cada hijo ----------

export function TarjetaHijo({
  hijo,
  datos,
  onCambio,
}: {
  hijo: HijoParaMatricula;
  datos: MatriculaEnLinea;
  onCambio: (mensaje?: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const s = hijo.solicitud;
  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-borde bg-white p-6"
      aria-label={hijo.nombreCompleto}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[18px] font-semibold text-texto">{hijo.nombreCompleto}</h3>
          <span className="text-[14px] text-texto-3">{`DNI ${hijo.dni}`}</span>
        </div>
        {s ? (
          <Badge tono={TONO_SOLICITUD[s.estado]} punto>
            {s.nombreEstado}
          </Badge>
        ) : (
          hijo.puedeMatricular && !abierto && <Boton onClick={() => setAbierto(true)}>Matricular</Boton>
        )}
      </div>
      {!s && !hijo.puedeMatricular && hijo.motivo && <p className="text-[14px] text-texto-2">{hijo.motivo}</p>}
      {abierto && !s && (
        <FormularioMatricula
          hijo={hijo}
          datos={datos}
          onCancelar={() => setAbierto(false)}
          onEnviada={() => {
            setAbierto(false);
            onCambio(`Enviaste la matrícula de ${hijo.nombres}. La coordinación revisará sus documentos.`);
          }}
        />
      )}
      {s && (
        <>
          <p className="text-[14px] text-texto-2">
            {s.estado === "OBSERVADA"
              ? "La coordinación observó algún documento: revisa la observación y reemplázalo."
              : s.estado === "APROBADA"
                ? "Los documentos fueron aprobados. La coordinación asignará la sección."
                : s.estado === "MATRICULADA"
                  ? "La matrícula está confirmada. Ya puedes ver su cronograma en «Pagos»."
                  : `Enviada el ${fechaDia(hoyEnLima(new Date(s.enviadaEn)))}. La coordinación está revisando los documentos.`}
          </p>
          <DocumentosDeSolicitud
            solicitud={s}
            estudianteId={hijo.estudianteId}
            onCambio={() => onCambio("Documento enviado: la coordinación lo revisará.")}
          />
        </>
      )}
    </section>
  );
}
