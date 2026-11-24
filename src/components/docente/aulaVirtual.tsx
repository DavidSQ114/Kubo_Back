// DO-05 · Aula virtual del docente (US61, US62): piezas de la pantalla. M-16 Subir material de estudio, M-17 Agregar
// enlace de clase virtual, las tarjetas de los enlaces, la lista de unidades didácticas y la tabla de materiales. La
// validación real (tipo por contenido, 5 MB, URL y fechas) la hace el servidor; aquí solo se adelantan los avisos.
"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { mensajeError } from "@/components/portal";
import {
  abrirMaterial,
  BadgeEstadoEnlace,
  BadgeEstadoMaterial,
  iconoDeFormato,
  IconoEnlace,
  NOMBRE_FORMATO,
  NOMBRE_TIPO_ENLACE,
  pesoDeMaterial,
  type EstadoEnlace,
  type EstadoVisibilidad,
  type TipoEnlace,
  type TipoFormato,
} from "@/components/portal/aulaVirtual";
import { Alerta, Badge, Boton, Campo, Icono, Modal, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { entradaFechaHora, fechaDia, hoyEnLima, rangoDeHoras } from "@/lib/formato";

// ---------- Tipos de la API ----------

export interface CursoDelAula {
  asignacionId: string;
  curso: { id: string; codigo: string; nombre: string };
  seccion: { id: string; nombre: string };
  etiqueta: string;
}

export interface CursosDelAula {
  anio: { id: string; anio: number } | null;
  cursos: CursoDelAula[];
}

export interface UnidadVista {
  id: string;
  numero: number;
  titulo: string;
  activo: boolean;
}

export interface MaterialVista {
  id: string;
  titulo: string;
  tipo: TipoFormato;
  unidadId: string | null;
  estado: EstadoVisibilidad;
  publicadoEn: string | null;
  archivo: { nombre: string; mime: string; tamanoBytes: number } | null;
  url: string | null;
  creadoEn: string;
}

export interface EnlaceVista {
  id: string;
  tipo: TipoEnlace;
  titulo: string;
  url: string;
  inicio: string | null;
  fin: string | null;
  visible: boolean;
  estado: EstadoEnlace | null;
}

export interface AulaDelDocente {
  asignacionId: string;
  curso: { id: string; codigo: string; nombre: string };
  seccion: { id: string; nombre: string; etiqueta: string };
  anio: { id: string; anio: number };
  editable: boolean;
  unidades: UnidadVista[];
  materiales: MaterialVista[];
  enlaces: EnlaceVista[];
}

export const MENSAJE_ENLACE_INVALIDO = "Ingresa un enlace válido";
const MENSAJE_FORMATO = "Formato no permitido. Sube un PDF, PPTX, DOCX, XLSX o una imagen JPG o PNG.";
const MENSAJE_TAMANO = "El archivo supera el tamaño máximo de 5 MB. Elige un archivo más liviano.";
const TAMANO_MAXIMO = 5 * 1024 * 1024;
const LARGO_MAXIMO_TITULO = 150;
const EXTENSIONES = [".pdf", ".pptx", ".docx", ".xlsx", ".jpg", ".jpeg", ".png"];
const ACEPTA = EXTENSIONES.join(",");

/** Revisión previa de la URL: http o https con dominio (el servidor vuelve a validarla). */
export function esUrlValida(texto: string) {
  try {
    const url = new URL(texto.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

function revisarArchivo(archivo: File): string | null {
  if (archivo.size > TAMANO_MAXIMO) return MENSAJE_TAMANO;
  const nombre = archivo.name.toLowerCase();
  if (!EXTENSIONES.some((x) => nombre.endsWith(x)) || archivo.size === 0) return MENSAJE_FORMATO;
  return null;
}

// ---------- Piezas pequeñas ----------

/** Interruptor «Visible para los alumnos» de M-16 y M-17. */
function Interruptor({
  etiqueta,
  ayuda,
  activo,
  onCambio,
}: {
  etiqueta: string;
  ayuda: string;
  activo: boolean;
  onCambio: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 select-none">
      <input
        type="checkbox"
        role="switch"
        aria-checked={activo}
        checked={activo}
        onChange={(e) => onCambio(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-kubo-azul/40 ${activo ? "bg-verde-oscuro" : "bg-texto-3/40"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${activo ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-texto">{etiqueta}</span>
        <span className="text-[12px] leading-[1.4] text-texto-3">{ayuda}</span>
      </span>
    </label>
  );
}

/** Selector con la etiqueta encima, como `Campo`. */
function Selector({
  etiqueta,
  valor,
  onCambio,
  children,
  obligatorio,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  children: ReactNode;
  obligatorio?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[14px] font-medium text-texto-2">
      <span>
        {etiqueta}
        {obligatorio && <span className="text-rojo"> *</span>}
      </span>
      <select
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-lg border border-borde bg-white px-3 text-[16px] font-normal text-texto outline-none focus:border-kubo-azul"
      >
        {children}
      </select>
    </label>
  );
}

/** Botón de una acción de la tabla o de una tarjeta: solo el ícono, con su nombre para los lectores de pantalla. */
export function BotonIcono({
  icono,
  etiqueta,
  onClick,
  deshabilitado,
}: {
  icono: string;
  etiqueta: string;
  onClick: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      title={etiqueta}
      className="rounded-md p-2 hover:bg-fondo disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icono nombre={icono} size={18} />
    </button>
  );
}

// ---------- M-16 · Subir material de estudio ----------

export function ModalSubirMaterial({
  aula,
  onCerrar,
  onSubido,
}: {
  aula: AulaDelDocente;
  onCerrar: () => void;
  onSubido: (m: MaterialVista) => void;
}) {
  const activas = aula.unidades.filter((u) => u.activo);
  const [unidadId, setUnidadId] = useState(activas[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<"ARCHIVO" | "ENLACE">("ARCHIVO");
  const [url, setUrl] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [arrastrando, setArrastrando] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorUrl = tipo === "ENLACE" && intentado && !esUrlValida(url) ? MENSAJE_ENLACE_INVALIDO : undefined;
  const errorTitulo = intentado && !titulo.trim() ? "Ingresa el título del material" : undefined;

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

  async function subir() {
    setIntentado(true);
    setError(null);
    if (!titulo.trim() || !unidadId) return;
    if (tipo === "ENLACE" && !esUrlValida(url)) return;
    if (tipo === "ARCHIVO" && (!archivo || errorArchivo)) {
      if (!archivo) setError("Elige el archivo del material.");
      return;
    }
    setGuardando(true);
    try {
      const form = new FormData();
      form.set("unidadId", unidadId);
      form.set("titulo", titulo.trim());
      form.set("tipo", tipo);
      form.set("visible", String(visible));
      if (tipo === "ENLACE") form.set("url", url.trim());
      else if (archivo) form.set("archivo", archivo);
      const m = await api<MaterialVista>(`/aula-virtual/asignaciones/${aula.asignacionId}/materiales`, {
        method: "POST",
        body: form,
      });
      onSubido(m);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-subir"
      tonoIcono="azul"
      titulo="Subir material de estudio"
      subtitulo={`${aula.curso.nombre} · ${aula.seccion.etiqueta}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton icono="icon-subir-blanco" cargando={guardando} onClick={subir}>
            Subir material
          </Boton>
        </>
      }
    >
      {error && <Alerta tipo="error" titulo={error} />}
      <Campo
        etiqueta="Título del material"
        obligatorio
        value={titulo}
        maxLength={LARGO_MAXIMO_TITULO}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Práctica dirigida N.° 5"
        error={errorTitulo}
      />
      <div className="flex flex-col gap-4 sm:flex-row">
        <Selector etiqueta="Unidad o tema" obligatorio valor={unidadId} onCambio={setUnidadId}>
          {activas.map((u) => (
            <option key={u.id} value={u.id}>
              Unidad {u.numero} · {u.titulo}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Tipo" valor={tipo} onCambio={(v) => setTipo(v as "ARCHIVO" | "ENLACE")}>
          <option value="ARCHIVO">Archivo</option>
          <option value="ENLACE">Enlace</option>
        </Selector>
      </div>

      {tipo === "ENLACE" ? (
        <Campo
          etiqueta="Enlace (URL)"
          obligatorio
          icono="icon-enlace"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          error={errorUrl}
        />
      ) : (
        <>
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
            <span className="text-[14px] font-semibold text-texto">
              Arrastra el archivo aquí o haz clic para seleccionarlo
            </span>
            <span className="text-[12px] text-texto-3">PDF, PPTX, DOCX, XLSX, JPG o PNG · máximo 5 MB</span>
            <input
              type="file"
              accept={ACEPTA}
              className="sr-only"
              onChange={(e) => {
                elegirArchivo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {archivo && (
            <div
              className={`flex items-start gap-3 rounded-lg border p-3 ${errorArchivo ? "border-rojo/50 bg-rojo/5" : "border-borde bg-fondo"}`}
            >
              <Icono nombre={errorArchivo ? "alerta-err" : "icon-documento"} size={20} className="mt-0.5" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-[14px] font-medium text-texto">{archivo.name}</p>
                <p className="text-[12px] text-texto-3">{pesoDeMaterial(archivo.size)}</p>
                {errorArchivo && <p className="text-[12px] text-rojo-oscuro">{errorArchivo}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setArchivo(null);
                  setErrorArchivo(null);
                }}
                aria-label={`Quitar ${archivo.name}`}
                className="rounded-md p-1 hover:bg-white"
              >
                <Icono nombre="modal-x" size={16} />
              </button>
            </div>
          )}
        </>
      )}

      <Interruptor
        etiqueta="Visible para los alumnos"
        ayuda="Si lo desactivas, el material se guarda como borrador y solo tú puedes verlo."
        activo={visible}
        onCambio={setVisible}
      />
    </Modal>
  );
}

// ---------- M-17 · Agregar o editar enlace de clase virtual ----------

const TIPOS_ENLACE: TipoEnlace[] = ["CLASE_VIRTUAL", "ASESORIA", "TALLER"];

export function ModalEnlace({
  aula,
  enlace,
  onCerrar,
  onGuardado,
}: {
  aula: AulaDelDocente;
  /** El enlace que se edita; sin él, se agrega uno nuevo. */
  enlace: EnlaceVista | null;
  onCerrar: () => void;
  onGuardado: (e: EnlaceVista, nuevo: boolean) => void;
}) {
  const hoy = hoyEnLima();
  const [tipo, setTipo] = useState<TipoEnlace>(enlace?.tipo ?? "CLASE_VIRTUAL");
  const [titulo, setTitulo] = useState(enlace?.titulo ?? "");
  const [url, setUrl] = useState(enlace?.url ?? "");
  const [inicio, setInicio] = useState(enlace?.inicio ? entradaFechaHora(enlace.inicio) : `${hoy}T08:00`);
  const [fin, setFin] = useState(enlace?.fin ? entradaFechaHora(enlace.fin) : `${hoy}T09:00`);
  const [visible, setVisible] = useState(enlace?.visible ?? true);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorUrl = intentado && !esUrlValida(url) ? MENSAJE_ENLACE_INVALIDO : undefined;
  const errorTitulo = intentado && !titulo.trim() ? "Ingresa el título del enlace" : undefined;
  const errorFin = intentado && inicio && fin && fin <= inicio ? "El fin debe ser posterior al inicio" : undefined;

  async function guardar() {
    setIntentado(true);
    setError(null);
    if (!titulo.trim() || !esUrlValida(url) || !inicio || !fin || fin <= inicio) return;
    setGuardando(true);
    try {
      const cuerpo = { tipo, titulo: titulo.trim(), url: url.trim(), inicio, fin, visible };
      const r = enlace
        ? await api<EnlaceVista>(`/aula-virtual/enlaces/${enlace.id}`, { method: "PUT", body: cuerpo })
        : await api<EnlaceVista>(`/aula-virtual/asignaciones/${aula.asignacionId}/enlaces`, {
            method: "POST",
            body: cuerpo,
          });
      onGuardado(r, !enlace);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-video"
      tonoIcono="azul"
      titulo={enlace ? "Editar enlace de clase virtual" : "Agregar enlace de clase virtual"}
      subtitulo={`${aula.curso.nombre} · ${aula.seccion.etiqueta}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton icono="check-blanco" cargando={guardando} onClick={guardar}>
            Guardar enlace
          </Boton>
        </>
      }
    >
      {error && <Alerta tipo="error" titulo={error} />}
      <Selector etiqueta="Tipo de enlace" obligatorio valor={tipo} onCambio={(v) => setTipo(v as TipoEnlace)}>
        {TIPOS_ENLACE.map((t) => (
          <option key={t} value={t}>
            {NOMBRE_TIPO_ENLACE[t]}
          </option>
        ))}
      </Selector>
      <Campo
        etiqueta="Título"
        obligatorio
        value={titulo}
        maxLength={LARGO_MAXIMO_TITULO}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder={`Aula virtual de ${aula.curso.nombre} · ${aula.seccion.etiqueta}`}
        error={errorTitulo}
      />
      <Campo
        etiqueta="Enlace (URL)"
        obligatorio
        icono="icon-enlace"
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://meet.google.com/…"
        error={errorUrl}
      />
      <div className="flex flex-col gap-4 sm:flex-row">
        <Campo
          etiqueta="Inicio"
          obligatorio
          type="datetime-local"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          className="flex-1"
        />
        <Campo
          etiqueta="Fin"
          obligatorio
          type="datetime-local"
          value={fin}
          min={inicio}
          onChange={(e) => setFin(e.target.value)}
          error={errorFin}
          className="flex-1"
        />
      </div>
      <Interruptor
        etiqueta="Visible para los alumnos"
        ayuda="El enlace aparecerá en la pantalla «Mis cursos» de tus alumnos."
        activo={visible}
        onCambio={setVisible}
      />
      <Alerta tipo="info">
        La fecha y la hora son de Lima. Los alumnos verán «Entrar a clase» solo mientras el enlace esté activo, entre el
        inicio y el fin.
      </Alerta>
    </Modal>
  );
}

// ---------- Confirmar eliminación ----------

export function ModalEliminar({
  que,
  nombre,
  onCerrar,
  onConfirmar,
}: {
  /** «el material» o «el enlace». */
  que: string;
  nombre: string;
  onCerrar: () => void;
  onConfirmar: () => Promise<void>;
}) {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirmar() {
    setEliminando(true);
    setError(null);
    try {
      await onConfirmar();
    } catch (e) {
      setError(mensajeError(e));
      setEliminando(false);
    }
  }
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="act-trash"
      titulo={`¿Eliminar ${que}?`}
      subtitulo={nombre}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="peligro" cargando={eliminando} onClick={confirmar}>
            Eliminar
          </Boton>
        </>
      }
    >
      {error && <Alerta tipo="error" titulo={error} />}
      <p className="text-[15px] leading-[1.5] text-texto-2">
        Tus alumnos dejarán de verlo y no se podrá recuperar. Si solo quieres retirarlo por un tiempo, ocúltalo.
      </p>
    </Modal>
  );
}

// ---------- Enlaces (tarjetas de DO-05) ----------

export function TarjetaEnlace({
  enlace,
  editable,
  onEditar,
  onVisibilidad,
  onEliminar,
  onCopiado,
}: {
  enlace: EnlaceVista;
  editable: boolean;
  onEditar: () => void;
  onVisibilidad: () => void;
  onEliminar: () => void;
  onCopiado: (ok: boolean) => void;
}) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace.url);
      onCopiado(true);
    } catch {
      onCopiado(false);
    }
  }
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-4">
      <div className="flex items-center gap-3">
        <IconoEnlace tipo={enlace.tipo} />
        <span className="flex-1 text-[12px] font-semibold tracking-[0.6px] text-texto-3 uppercase">
          {NOMBRE_TIPO_ENLACE[enlace.tipo]}
        </span>
        {enlace.visible ? <BadgeEstadoEnlace estado={enlace.estado} /> : <Badge tono="gris">Oculto</Badge>}
      </div>
      <p className="text-[16px] font-semibold leading-[1.4] text-texto">{enlace.titulo}</p>
      {enlace.inicio && enlace.fin && (
        <p className="flex items-center gap-2 text-[13px] text-texto-2">
          <Icono nombre="icon-calendar-gris" size={16} />
          {rangoDeHoras(enlace.inicio, enlace.fin)}
        </p>
      )}
      <p className="flex min-w-0 items-center gap-2 rounded-md bg-fondo px-3 py-2 text-[13px] text-texto-2">
        <Icono nombre="icon-enlace" size={16} />
        <span className="truncate">{enlace.url.replace(/^https?:\/\//, "")}</span>
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1">
        <Boton variante="secundario" icono="act-copiar" onClick={copiar} className="mr-auto !px-3 !py-1.5 !text-[14px]">
          Copiar enlace
        </Boton>
        {editable && (
          <>
            <BotonIcono
              icono={enlace.visible ? "act-eye-off" : "act-eye"}
              etiqueta={enlace.visible ? `Ocultar ${enlace.titulo}` : `Mostrar ${enlace.titulo} a los alumnos`}
              onClick={onVisibilidad}
            />
            <BotonIcono icono="act-edit" etiqueta={`Editar ${enlace.titulo}`} onClick={onEditar} />
            <BotonIcono icono="act-trash" etiqueta={`Eliminar ${enlace.titulo}`} onClick={onEliminar} />
          </>
        )}
      </div>
    </li>
  );
}

// ---------- Unidades didácticas ----------

export function ListaUnidades({
  aula,
  onCambio,
  onError,
}: {
  aula: AulaDelDocente;
  onCambio: (unidades: UnidadVista[]) => void;
  onError: (mensaje: string) => void;
}) {
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<{ id: string; titulo: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const unidades = [...aula.unidades].sort((a, b) => a.numero - b.numero);
  const materialesDe = (id: string) => aula.materiales.filter((m) => m.unidadId === id).length;

  async function ejecutar(clave: string, accion: () => Promise<UnidadVista[]>) {
    setOcupado(clave);
    try {
      onCambio(await accion());
    } catch (e) {
      onError(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  }

  const reemplazar = (u: UnidadVista) => unidades.map((x) => (x.id === u.id ? u : x));

  const crear = () =>
    ejecutar("nueva", async () => {
      const u = await api<UnidadVista>(`/aula-virtual/asignaciones/${aula.asignacionId}/unidades`, {
        method: "POST",
        body: { titulo: nueva.trim() },
      });
      setNueva("");
      return [...unidades, u];
    });

  const editar = (id: string, cambios: { titulo?: string; activo?: boolean }) =>
    ejecutar(id, async () => {
      const u = await api<UnidadVista>(`/aula-virtual/unidades/${id}`, { method: "PATCH", body: cambios });
      setEditando(null);
      return reemplazar(u);
    });

  const mover = (id: string, direccion: "ARRIBA" | "ABAJO") =>
    ejecutar(id, () =>
      api<UnidadVista[]>(`/aula-virtual/unidades/${id}/mover`, { method: "POST", body: { direccion } }),
    );

  return (
    <div className="flex flex-col gap-3">
      {unidades.length === 0 && (
        <p className="rounded-lg bg-fondo px-4 py-3 text-[14px] text-texto-2">
          Aún no hay unidades. Crea la primera para organizar tus materiales.
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {unidades.map((u, i) => (
          <li
            key={u.id}
            className={`flex flex-wrap items-center gap-2 rounded-lg border border-borde px-3 py-2 ${u.activo ? "bg-white" : "bg-fondo"}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-kubo-azul/10 text-[13px] font-bold text-kubo-azul">
              {u.numero}
            </span>
            {editando?.id === u.id ? (
              <form
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editando.titulo.trim()) editar(u.id, { titulo: editando.titulo.trim() });
                }}
              >
                <input
                  aria-label={`Nuevo nombre de la unidad ${u.numero}`}
                  value={editando.titulo}
                  maxLength={LARGO_MAXIMO_TITULO}
                  onChange={(e) => setEditando({ id: u.id, titulo: e.target.value })}
                  className="h-9 min-w-0 flex-1 rounded-md border border-borde px-3 text-[15px] outline-none focus:border-kubo-azul"
                  autoFocus
                />
                <Boton type="submit" cargando={ocupado === u.id} className="!py-1.5">
                  Guardar
                </Boton>
                <Boton type="button" variante="secundario" onClick={() => setEditando(null)} className="!py-1.5">
                  Cancelar
                </Boton>
              </form>
            ) : (
              <>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[15px] font-semibold ${u.activo ? "text-texto" : "text-texto-3"}`}>
                    {u.titulo}
                  </span>
                  <span className="text-[12px] text-texto-3">
                    {materialesDe(u.id) === 1 ? "1 material" : `${materialesDe(u.id)} materiales`}
                    {u.activo ? "" : " · desactivada: los alumnos no la ven"}
                  </span>
                </span>
                {!u.activo && <Badge tono="gris">Desactivada</Badge>}
                {aula.editable && (
                  <span className="flex items-center">
                    <BotonIcono
                      icono="act-arriba"
                      etiqueta={`Subir la unidad ${u.titulo}`}
                      deshabilitado={i === 0 || ocupado !== null}
                      onClick={() => mover(u.id, "ARRIBA")}
                    />
                    <BotonIcono
                      icono="act-abajo"
                      etiqueta={`Bajar la unidad ${u.titulo}`}
                      deshabilitado={i === unidades.length - 1 || ocupado !== null}
                      onClick={() => mover(u.id, "ABAJO")}
                    />
                    <BotonIcono
                      icono="act-edit"
                      etiqueta={`Renombrar la unidad ${u.titulo}`}
                      onClick={() => setEditando({ id: u.id, titulo: u.titulo })}
                    />
                    <BotonIcono
                      icono={u.activo ? "act-eye-off" : "act-eye"}
                      etiqueta={u.activo ? `Desactivar la unidad ${u.titulo}` : `Activar la unidad ${u.titulo}`}
                      deshabilitado={ocupado !== null}
                      onClick={() => editar(u.id, { activo: !u.activo })}
                    />
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
      {aula.editable && (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (nueva.trim()) crear();
          }}
        >
          <Campo
            etiqueta="Nueva unidad"
            value={nueva}
            maxLength={LARGO_MAXIMO_TITULO}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="Unidad 4 · Ecuaciones"
            className="flex-1"
          />
          <Boton type="submit" variante="secundario" icono="icon-plus-gris" cargando={ocupado === "nueva"}>
            Crear unidad
          </Boton>
        </form>
      )}
    </div>
  );
}

// ---------- Materiales (tabla de DO-05; tarjetas en el celular) ----------

function AccionesMaterial({
  material,
  editable,
  ocupado,
  onAbrir,
  onPublicar,
  onOcultar,
  onEliminar,
}: {
  material: MaterialVista;
  editable: boolean;
  ocupado: boolean;
  onAbrir: () => void;
  onPublicar: () => void;
  onOcultar: () => void;
  onEliminar: () => void;
}) {
  return (
    <span className="flex items-center justify-end">
      <BotonIcono
        icono={material.tipo === "ENLACE" ? "icon-enlace" : "icon-descargar"}
        etiqueta={material.tipo === "ENLACE" ? `Abrir ${material.titulo}` : `Descargar ${material.titulo}`}
        onClick={onAbrir}
      />
      {editable &&
        (material.estado === "PUBLICADO" ? (
          <BotonIcono
            icono="act-eye-off"
            etiqueta={`Ocultar ${material.titulo}`}
            deshabilitado={ocupado}
            onClick={onOcultar}
          />
        ) : (
          <BotonIcono
            icono="act-publicar"
            etiqueta={`Publicar ${material.titulo}`}
            deshabilitado={ocupado}
            onClick={onPublicar}
          />
        ))}
      {editable && (
        <BotonIcono
          icono="act-trash"
          etiqueta={`Eliminar ${material.titulo}`}
          deshabilitado={ocupado}
          onClick={onEliminar}
        />
      )}
    </span>
  );
}

export function TablaMateriales({
  aula,
  onCambio,
  onEliminar,
  onError,
}: {
  aula: AulaDelDocente;
  onCambio: (m: MaterialVista, aviso: string) => void;
  onEliminar: (m: MaterialVista) => void;
  onError: (mensaje: string) => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const unidad = (id: string | null) => aula.unidades.find((u) => u.id === id);
  const etiquetaUnidad = (id: string | null) => {
    const u = unidad(id);
    return u ? `Unidad ${u.numero} · ${u.titulo}` : "Sin unidad";
  };

  async function cambiarEstado(m: MaterialVista, accion: "publicar" | "ocultar") {
    setOcupado(m.id);
    try {
      const r = await api<MaterialVista>(`/aula-virtual/materiales/${m.id}/${accion}`, { method: "POST" });
      onCambio(
        r,
        accion === "publicar"
          ? `«${m.titulo}» quedó publicado para tus alumnos.`
          : `«${m.titulo}» quedó oculto: tus alumnos ya no lo ven.`,
      );
    } catch (e) {
      onError(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  }

  async function abrir(m: MaterialVista) {
    if (m.tipo === "ENLACE" && m.url) {
      window.open(m.url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      await abrirMaterial(m);
    } catch (e) {
      onError(mensajeError(e));
    }
  }

  const acciones = (m: MaterialVista) => (
    <AccionesMaterial
      material={m}
      editable={aula.editable}
      ocupado={ocupado === m.id}
      onAbrir={() => abrir(m)}
      onPublicar={() => cambiarEstado(m, "publicar")}
      onOcultar={() => cambiarEstado(m, "ocultar")}
      onEliminar={() => onEliminar(m)}
    />
  );
  const peso = (m: MaterialVista) => (m.archivo ? pesoDeMaterial(m.archivo.tamanoBytes) : "—");
  const publicado = (m: MaterialVista) =>
    m.publicadoEn ? fechaDia(entradaFechaHora(m.publicadoEn).slice(0, 10)) : "—";

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-borde lg:block">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-fondo text-[13px] font-semibold text-texto-2">
            <tr>
              <th className="px-4 py-3">Material</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Unidad</th>
              <th className="px-3 py-3 text-right">Peso</th>
              <th className="px-3 py-3">Publicado</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {aula.materiales.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-medium text-texto">
                    <Icono nombre={iconoDeFormato(m.tipo)} size={18} />
                    {m.titulo}
                  </span>
                </td>
                <td className="px-3 py-3 text-texto-2">{NOMBRE_FORMATO[m.tipo]}</td>
                <td className="px-3 py-3 text-texto-2">{etiquetaUnidad(m.unidadId)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap text-texto-2">{peso(m)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-texto-2">{publicado(m)}</td>
                <td className="px-3 py-3">
                  <BadgeEstadoMaterial estado={m.estado} />
                </td>
                <td className="px-3 py-3">{acciones(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 lg:hidden">
        {aula.materiales.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-lg border border-borde p-3">
            <div className="flex items-start gap-2">
              <Icono nombre={iconoDeFormato(m.tipo)} size={18} className="mt-0.5" />
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-texto">{m.titulo}</span>
              <BadgeEstadoMaterial estado={m.estado} />
            </div>
            <p className="text-[13px] text-texto-2">
              {NOMBRE_FORMATO[m.tipo]} · {etiquetaUnidad(m.unidadId)} · {peso(m)}
            </p>
            {acciones(m)}
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------- Tarjeta de una sección de la pantalla ----------

export function Panel({
  icono,
  titulo,
  descripcion,
  accion,
  children,
}: {
  icono: string;
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tarjeta className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-kubo-azul/10">
          <Icono nombre={icono} size={20} />
        </span>
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">{titulo}</h2>
          <p className="text-[14px] leading-[1.4] text-texto-3">{descripcion}</p>
        </div>
        {accion}
      </div>
      {children}
    </Tarjeta>
  );
}
