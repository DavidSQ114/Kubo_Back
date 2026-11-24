// Piezas del aula virtual comunes al docente (DO-05) y al alumno (AL-05): tipos de la API, insignias del estado de un
// enlace (Programado, Activo, Finalizado; US62) y de un material (Borrador, Publicado, Oculto; US61), íconos por tipo y
// la descarga del archivo de un material por la API (nunca hay URLs públicas del almacén).
"use client";

import { Alerta, Badge, Icono, Spinner } from "@/components/ui";
import { abrirEnPestana, descargar } from "@/lib/api";

// ---------- Tipos de la API ----------

export type TipoFormato = "PDF" | "PPTX" | "DOCX" | "XLSX" | "IMAGEN" | "ENLACE";
export type EstadoVisibilidad = "BORRADOR" | "PUBLICADO" | "OCULTO";
export type TipoEnlace = "CLASE_VIRTUAL" | "ASESORIA" | "TALLER";
export type EstadoEnlace = "PROGRAMADO" | "ACTIVO" | "FINALIZADO";

export const NOMBRE_TIPO_ENLACE: Record<TipoEnlace, string> = {
  CLASE_VIRTUAL: "Clase virtual",
  ASESORIA: "Asesoría",
  TALLER: "Taller",
};

export const ICONO_TIPO_ENLACE: Record<TipoEnlace, string> = {
  CLASE_VIRTUAL: "icon-video",
  ASESORIA: "icon-asesoria",
  TALLER: "icon-taller",
};

export const NOMBRE_FORMATO: Record<TipoFormato, string> = {
  PDF: "PDF",
  PPTX: "PPTX",
  DOCX: "DOCX",
  XLSX: "XLSX",
  IMAGEN: "Imagen",
  ENLACE: "Enlace",
};

/** Ícono de la fila de un material según su tipo. */
export const iconoDeFormato = (tipo: TipoFormato) =>
  tipo === "ENLACE"
    ? "icon-enlace"
    : tipo === "IMAGEN"
      ? "icon-imagen"
      : tipo === "PDF"
        ? "icon-pdf"
        : "icon-documento";

// ---------- Insignias de estado ----------

const ESTADO_ENLACE: Record<EstadoEnlace, { texto: string; tono: "ambar" | "verde" | "gris" }> = {
  PROGRAMADO: { texto: "Programado", tono: "ambar" },
  ACTIVO: { texto: "Activo", tono: "verde" },
  FINALIZADO: { texto: "Finalizado", tono: "gris" },
};

/** Estado calculado por el servidor con la hora actual (US62, criterio 3). */
export function BadgeEstadoEnlace({ estado }: { estado: EstadoEnlace | null }) {
  if (!estado) return null;
  const e = ESTADO_ENLACE[estado];
  return (
    <Badge tono={e.tono} punto>
      {e.texto}
    </Badge>
  );
}

const ESTADO_MATERIAL: Record<EstadoVisibilidad, { texto: string; tono: "ambar" | "verde" | "gris" }> = {
  BORRADOR: { texto: "Borrador", tono: "ambar" },
  PUBLICADO: { texto: "Publicado", tono: "verde" },
  OCULTO: { texto: "Oculto", tono: "gris" },
};

export function BadgeEstadoMaterial({ estado }: { estado: EstadoVisibilidad }) {
  const e = ESTADO_MATERIAL[estado];
  return (
    <Badge tono={e.tono} punto>
      {e.texto}
    </Badge>
  );
}

/** Cuadro con el ícono del tipo de enlace (tarjetas de DO-05 y filas de AL-05). */
export function IconoEnlace({ tipo }: { tipo: TipoEnlace }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-verde/10">
      <Icono nombre={ICONO_TIPO_ENLACE[tipo]} size={20} />
    </span>
  );
}

// ---------- Archivo de un material ----------

const BYTES_POR_KB = 1024;

/** «820 KB», «1,6 MB». */
export function pesoDeMaterial(bytes: number) {
  if (bytes < BYTES_POR_KB * BYTES_POR_KB) return `${Math.max(1, Math.round(bytes / BYTES_POR_KB))} KB`;
  return `${(bytes / (BYTES_POR_KB * BYTES_POR_KB)).toFixed(1).replace(".", ",")} MB`;
}

export const rutaArchivoMaterial = (id: string) => `/aula-virtual/materiales/${id}/archivo`;

/** Un PDF o una imagen se abren en otra pestaña; PPTX, DOCX y XLSX se descargan. */
export async function abrirMaterial(m: { id: string; tipo: TipoFormato; archivo: { nombre: string } | null }) {
  if (!m.archivo) return;
  if (m.tipo === "PDF" || m.tipo === "IMAGEN") await abrirEnPestana(rutaArchivoMaterial(m.id));
  else await descargar(rutaArchivoMaterial(m.id), m.archivo.nombre);
}

// ---------- Estados de carga ----------

export function CargandoAula() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Cargando el aula virtual">
      <Spinner claro={false} />
    </div>
  );
}

export function ErrorAula({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <Alerta tipo="error" titulo="No pudimos cargar el aula virtual">
      {mensaje}{" "}
      <button type="button" onClick={onReintentar} className="font-semibold text-kubo-azul underline">
        Reintentar
      </button>
    </Alerta>
  );
}
