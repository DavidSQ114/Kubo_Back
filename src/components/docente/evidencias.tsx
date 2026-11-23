// M-07 · Adjuntar evidencia pedagógica (US38, DO-04): el docente adjunta a una calificación guardada un comentario para
// el apoderado y/o un archivo PDF o JPG de hasta 5 MB, y ve y elimina las evidencias ya guardadas mientras el registro
// esté abierto; con el registro cerrado o publicado, solo las ve. Incluye la marca de la celda con el número de
// evidencias y los tipos de la API. La validación real (tipo por contenido y tamaño) la hace el servidor.
"use client";

import { useState, type DragEvent } from "react";
import { BadgeLogro, columnaDe, type AlumnoDeRegistro, type RegistroDeNotas } from "@/components/docente/notas";
import { mensajeError } from "@/components/portal";
import { Alerta, Badge, Boton, Icono, Modal } from "@/components/ui";
import { abrirEnPestana, api, descargar } from "@/lib/api";
import { cantidad, diaYHora } from "@/lib/formato";

// ---------- Tipos de la API ----------

export interface ArchivoDeEvidencia {
  nombre: string;
  /** PDF, JPG… según el contenido. */
  tipo: string | null;
  mime: string;
  tamanoBytes: number;
}

export interface EvidenciaVista {
  id: string;
  comentario: string | null;
  archivo: ArchivoDeEvidencia | null;
  subidoEn: string;
}

export interface EvidenciaAgregada {
  evidencia: EvidenciaVista;
  registro: RegistroDeNotas;
}

export const MENSAJE_ARCHIVO_EVIDENCIA =
  "Formato no permitido o archivo demasiado pesado (máx. 5 MB, formatos PDF/JPG)";
export const LARGO_MAXIMO_COMENTARIO = 1000;
const TAMANO_MAXIMO = 5 * 1024 * 1024;
const BYTES_POR_KB = 1024;
const EXTENSIONES = [".pdf", ".jpg", ".jpeg"];

export const rutaArchivoEvidencia = (id: string) => `/evaluacion/evidencias/${id}/archivo`;

/** «820 KB», «1,2 MB». */
export function pesoLegible(bytes: number) {
  if (bytes < BYTES_POR_KB * BYTES_POR_KB) return `${Math.max(1, Math.round(bytes / BYTES_POR_KB))} KB`;
  return `${(bytes / (BYTES_POR_KB * BYTES_POR_KB)).toFixed(1).replace(".", ",")} MB`;
}

export const esImagen = (archivo: ArchivoDeEvidencia) => archivo.tipo === "JPG" || archivo.tipo === "PNG";

/** Ver un archivo de evidencia: un PDF se abre en otra pestaña; lo demás se descarga. */
export async function verArchivoDeEvidencia(e: EvidenciaVista) {
  if (!e.archivo) return;
  if (e.archivo.tipo === "PDF" || esImagen(e.archivo)) await abrirEnPestana(rutaArchivoEvidencia(e.id));
  else await descargar(rutaArchivoEvidencia(e.id), e.archivo.nombre);
}

/** Revisión previa en el navegador (el servidor vuelve a validar por el contenido real). */
function revisarArchivo(archivo: File): string | null {
  const nombre = archivo.name.toLowerCase();
  if (!EXTENSIONES.some((x) => nombre.endsWith(x)) || archivo.size === 0 || archivo.size > TAMANO_MAXIMO) {
    return MENSAJE_ARCHIVO_EVIDENCIA;
  }
  return null;
}

// ---------- Lista de evidencias guardadas ----------

function EvidenciaGuardada({
  evidencia,
  editable,
  eliminando,
  onEliminar,
  onError,
}: {
  evidencia: EvidenciaVista;
  editable: boolean;
  eliminando: boolean;
  onEliminar: () => void;
  onError: (mensaje: string) => void;
}) {
  const [abriendo, setAbriendo] = useState(false);
  async function ver() {
    setAbriendo(true);
    try {
      await verArchivoDeEvidencia(evidencia);
    } catch (e) {
      onError(mensajeError(e));
    } finally {
      setAbriendo(false);
    }
  }
  const a = evidencia.archivo;
  return (
    <li className="flex items-start gap-3 rounded-lg border border-borde bg-white p-3">
      <Icono nombre={a ? (esImagen(a) ? "icon-imagen" : "icon-pdf") : "icon-comentario"} size={20} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {a && (
          <button
            type="button"
            onClick={ver}
            disabled={abriendo}
            className="truncate text-left text-[14px] font-semibold text-kubo-azul underline-offset-2 hover:underline"
          >
            {a.nombre}
          </button>
        )}
        {evidencia.comentario && (
          <p className="text-[14px] leading-[1.5] whitespace-pre-line text-texto">{evidencia.comentario}</p>
        )}
        <p className="text-[12px] text-texto-3">
          {a ? `${pesoLegible(a.tamanoBytes)} · ` : ""}Guardada el {diaYHora(evidencia.subidoEn)}
        </p>
      </div>
      {editable && (
        <button
          type="button"
          onClick={onEliminar}
          disabled={eliminando}
          aria-label={`Eliminar la evidencia${a ? ` ${a.nombre}` : ""}`}
          title="Eliminar evidencia"
          className="rounded-md p-1.5 hover:bg-fondo disabled:opacity-50"
        >
          <Icono nombre="act-trash" size={18} />
        </button>
      )}
    </li>
  );
}

// ---------- M-07 ----------

export interface CeldaElegida {
  matriculaId: string;
  /** null: se abrió desde la columna «Evidencia» y el docente elige la competencia. */
  competenciaPlanId: string | null;
}

/**
 * Evidencias de una calificación. Con el registro ABIERTO se agregan y eliminan; cerrado o publicado, solo se ven. Solo
 * se ofrecen competencias con la calificación ya guardada (la evidencia se asocia a una calificación).
 */
export function ModalEvidencias({
  registro,
  celda,
  onCerrar,
  onCambio,
}: {
  registro: RegistroDeNotas;
  celda: CeldaElegida;
  onCerrar: () => void;
  /** El registro actualizado tras guardar o eliminar, y el aviso para la pantalla. */
  onCambio: (registro: RegistroDeNotas, aviso: string) => void;
}) {
  const alumno = registro.alumnos.find((a) => a.matriculaId === celda.matriculaId) as AlumnoDeRegistro;
  const calificadas = registro.competencias
    .map((c, i) => ({ ...c, columna: columnaDe(i) }))
    .filter((c) => alumno.notas[c.competenciaPlanId]);
  const [competenciaId, setCompetenciaId] = useState(
    celda.competenciaPlanId ?? calificadas[0]?.competenciaPlanId ?? "",
  );
  const [comentario, setComentario] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editable = registro.estado === "ABIERTO";
  const competencia = calificadas.find((c) => c.competenciaPlanId === competenciaId);
  const nota = competencia ? alumno.notas[competencia.competenciaPlanId] : undefined;
  const guardadas = nota?.evidencias ?? [];
  const base = `/evaluacion/registros/${registro.asignacionId}/bimestres/${registro.bimestre.id}/evidencias`;
  const puedeGuardar = !!competencia && (comentario.trim() !== "" || (archivo && !errorArchivo));

  function elegirArchivo(f: File | null | undefined) {
    if (!f) return;
    setArchivo(f);
    setErrorArchivo(revisarArchivo(f));
  }

  function soltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setArrastrando(false);
    elegirArchivo(e.dataTransfer.files[0]);
  }

  async function guardar() {
    if (!competencia || !puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("matriculaId", alumno.matriculaId);
      form.set("competenciaPlanId", competencia.competenciaPlanId);
      if (comentario.trim()) form.set("comentario", comentario.trim());
      if (archivo) form.set("archivo", archivo);
      const r = await api<EvidenciaAgregada>(base, { method: "POST", body: form });
      onCambio(r.registro, `Evidencia guardada para ${alumno.nombre} en ${competencia.columna}.`);
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    setEliminando(id);
    setError(null);
    try {
      const r = await api<RegistroDeNotas>(`${base}/${id}`, { method: "DELETE" });
      onCambio(r, `Se eliminó una evidencia de ${alumno.nombre}.`);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEliminando(null);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-clip"
      tonoIcono="azul"
      titulo={editable ? "Adjuntar evidencia pedagógica" : "Evidencias de la calificación"}
      subtitulo={`${registro.curso.nombre} ${registro.seccion.etiqueta} · ${registro.bimestre.nombre}`}
      pie={
        editable ? (
          <>
            <Boton variante="secundario" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton icono="check-blanco" cargando={guardando} disabled={!puedeGuardar} onClick={guardar}>
              Guardar evidencia
            </Boton>
          </>
        ) : (
          <Boton onClick={onCerrar}>Cerrar</Boton>
        )
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-fondo px-4 py-3">
        <p className="text-[15px] font-semibold text-texto">{alumno.nombre}</p>
        {competencia && nota && (
          <span className="flex items-center gap-3 text-[13px] text-texto-3">
            {competencia.columna} · {competencia.nombre}
            <BadgeLogro logro={nota.logro} />
          </span>
        )}
      </div>

      {calificadas.length === 0 ? (
        <Alerta tipo="aviso" titulo="Aún no hay calificaciones guardadas">
          Guarda primero la calificación de {alumno.nombre}: la evidencia se asocia a una calificación registrada.
        </Alerta>
      ) : (
        celda.competenciaPlanId === null && (
          <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
            Competencia calificada
            <select
              value={competenciaId}
              onChange={(e) => setCompetenciaId(e.target.value)}
              className="h-11 w-full rounded-lg border border-borde bg-white px-3 text-[16px] font-normal text-texto outline-none focus:border-kubo-azul"
            >
              {calificadas.map((c) => (
                <option key={c.competenciaPlanId} value={c.competenciaPlanId}>
                  {c.columna} · {c.nombre} ({alumno.notas[c.competenciaPlanId].logro})
                </option>
              ))}
            </select>
          </label>
        )
      )}

      {error && <Alerta tipo="error" titulo={error} />}

      {guardadas.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Evidencias guardadas">
          <h3 className="text-[14px] font-semibold text-texto-2">
            {cantidad(guardadas.length, "evidencia guardada", "evidencias guardadas")}
          </h3>
          <ul className="flex flex-col gap-2">
            {guardadas.map((e) => (
              <EvidenciaGuardada
                key={e.id}
                evidencia={e}
                editable={editable}
                eliminando={eliminando === e.id}
                onEliminar={() => eliminar(e.id)}
                onError={setError}
              />
            ))}
          </ul>
        </section>
      )}
      {!editable && guardadas.length === 0 && competencia && (
        <p className="text-[14px] text-texto-2">Esta calificación no tiene evidencias.</p>
      )}

      {editable && competencia && (
        <>
          <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
            Comentario para el apoderado
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={LARGO_MAXIMO_COMENTARIO}
              rows={3}
              placeholder="Describe qué muestra la evidencia sobre el logro del estudiante."
              className="w-full resize-y rounded-lg border border-borde bg-white px-4 py-3 text-[16px] leading-[1.5] font-normal text-texto outline-none focus:border-kubo-azul"
            />
            <span className="self-end text-[12px] font-normal text-texto-3">
              {comentario.length} / {LARGO_MAXIMO_COMENTARIO}
            </span>
          </label>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center focus-within:ring-2 focus-within:ring-kubo-azul/40 ${arrastrando ? "border-kubo-azul bg-kubo-azul/5" : "border-celeste/60 bg-fondo"}`}
          >
            <Icono nombre="icon-subir" size={24} />
            <span className="text-[14px] font-semibold text-kubo-azul">Arrastra un archivo o selecciónalo</span>
            <span className="text-[12px] text-texto-3">Formatos PDF o JPG · máximo 5 MB</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
              className="sr-only"
              onChange={(e) => {
                elegirArchivo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>

          {archivo && (
            <div
              className={`flex items-start gap-3 rounded-lg border p-3 ${errorArchivo ? "border-rojo/50 bg-rojo/5" : "border-borde bg-white"}`}
            >
              <Icono
                nombre={errorArchivo ? "alerta-err" : archivo.type.startsWith("image/") ? "icon-imagen" : "icon-pdf"}
                size={20}
                className="mt-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-[14px] font-medium text-texto">{archivo.name}</p>
                <p className="text-[12px] text-texto-3">{pesoLegible(archivo.size)}</p>
                {errorArchivo && <p className="text-[12px] text-rojo-oscuro">{errorArchivo}</p>}
              </div>
              {!errorArchivo && (
                <Badge tono="verde" punto>
                  Listo
                </Badge>
              )}
              <button
                type="button"
                onClick={() => {
                  setArchivo(null);
                  setErrorArchivo(null);
                }}
                aria-label={`Quitar ${archivo.name}`}
                className="rounded-md p-1 hover:bg-fondo"
              >
                <Icono nombre="modal-x" size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
