// aula-virtual/application: cómo se muestran las unidades, los materiales y los enlaces en DO-05 (docente) y AL-05
// (alumno). Las fechas viajan en ISO (UTC); la pantalla las muestra en la hora de Lima. El estado del enlace se calcula
// aquí, en el servidor, con la hora actual (US62).
import {
  estadoEnlace,
  type EstadoEnlace,
  type EstadoVisibilidad,
  type TipoEnlace,
  type TipoFormato,
} from "../domain/reglas";
import type { EnlaceFila, MaterialFila, UnidadFila } from "../infrastructure/repositorio";

export interface UnidadVista {
  id: string;
  numero: number;
  titulo: string;
  activo: boolean;
}

export interface ArchivoDeMaterial {
  /** Nombre original saneado. */
  nombre: string;
  mime: string;
  tamanoBytes: number;
}

export interface MaterialVista {
  id: string;
  titulo: string;
  tipo: TipoFormato;
  unidadId: string | null;
  estado: EstadoVisibilidad;
  publicadoEn: string | null;
  /** Archivo del material; null en uno tipo ENLACE. */
  archivo: ArchivoDeMaterial | null;
  /** URL de un material tipo ENLACE; null en un archivo. */
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
  /** Programado, Activo o Finalizado según la hora actual; null si el enlace no tiene fechas. */
  estado: EstadoEnlace | null;
}

export const vistaDeUnidad = (u: UnidadFila): UnidadVista => ({
  id: u.id,
  numero: u.numero,
  titulo: u.titulo,
  activo: u.activo,
});

export function vistaDeMaterial(m: MaterialFila): MaterialVista {
  return {
    id: m.id,
    titulo: m.titulo,
    tipo: m.tipoFormato,
    unidadId: m.unidadId,
    estado: m.estado,
    publicadoEn: m.publicadoEn?.toISOString() ?? null,
    archivo:
      m.archivoClave && m.nombreArchivo && m.mimeType && m.tamanoBytes != null
        ? { nombre: m.nombreArchivo, mime: m.mimeType, tamanoBytes: m.tamanoBytes }
        : null,
    url: m.tipoFormato === "ENLACE" ? m.urlArchivo : null,
    creadoEn: m.createdAt.toISOString(),
  };
}

export function vistaDeEnlace(e: EnlaceFila, ahora: Date): EnlaceVista {
  return {
    id: e.id,
    tipo: e.tipoEnlace,
    titulo: e.titulo,
    url: e.urlMeet,
    inicio: e.fechaProgramada?.toISOString() ?? null,
    fin: e.fechaFin?.toISOString() ?? null,
    visible: e.visible,
    estado: e.fechaProgramada && e.fechaFin ? estadoEnlace(e.fechaProgramada, e.fechaFin, ahora) : null,
  };
}
