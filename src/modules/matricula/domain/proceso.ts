// matricula/domain: proceso de matrícula de cada año (bloque M4): fechas en que el apoderado puede matricular a su hijo
// desde su portal y la lista de documentos que debe subir (nombre y si es obligatorio). Fechas «AAAA-MM-DD» de Lima.
import { erroresMatricula as E } from "./errores";

/** Documentos que pide un proceso como máximo. */
export const MAXIMO_DOCUMENTOS_REQUERIDOS = 15;
/** Columna VARCHAR(100). */
export const LARGO_MAXIMO_NOMBRE_DOCUMENTO = 100;

/** Lista que propone la pantalla al configurar un año por primera vez. */
export const DOCUMENTOS_SUGERIDOS = [
  { nombre: "Partida de nacimiento", obligatorio: true },
  { nombre: "DNI del alumno", obligatorio: true },
  { nombre: "Libreta del año anterior", obligatorio: true },
  { nombre: "Constancia de no adeudo", obligatorio: false },
] as const;

export const ESTADOS_PROCESO = ["SIN_CONFIGURAR", "PROXIMO", "ABIERTO", "CERRADO"] as const;
export type EstadoProceso = (typeof ESTADOS_PROCESO)[number];

export const NOMBRE_ESTADO_PROCESO: Record<EstadoProceso, string> = {
  SIN_CONFIGURAR: "Sin configurar",
  PROXIMO: "Próximo",
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
};

export interface DocumentoPedido {
  /** Id de un documento que ya estaba en la lista (se conserva); sin id, es nuevo. */
  id?: string | null;
  nombre: string;
  obligatorio: boolean;
}

/** «2026-02-01» → «01/02/2026». */
export const fechaTexto = (fecha: string) => fecha.split("-").reverse().join("/");

/**
 * Valida la configuración: inicio no posterior al fin, de 1 a 15 documentos con nombre (hasta 100 caracteres) y sin
 * nombres repetidos (sin importar mayúsculas). Devuelve los documentos con el nombre limpio.
 */
export function verificarProceso(datos: { fechaInicio: string; fechaFin: string; documentos: DocumentoPedido[] }) {
  if (datos.fechaInicio > datos.fechaFin) throw E.fechasProcesoInvalidas();
  if (!datos.documentos.length) throw E.sinDocumentosRequeridos();
  if (datos.documentos.length > MAXIMO_DOCUMENTOS_REQUERIDOS)
    throw E.demasiadosDocumentos(MAXIMO_DOCUMENTOS_REQUERIDOS);
  const vistos = new Set<string>();
  return datos.documentos.map((d) => {
    const nombre = d.nombre.trim().replace(/\s+/g, " ");
    if (!nombre || nombre.length > LARGO_MAXIMO_NOMBRE_DOCUMENTO) throw E.documentoSinNombre();
    const clave = nombre.toLocaleLowerCase("es");
    if (vistos.has(clave)) throw E.documentoRepetido(nombre);
    vistos.add(clave);
    return { id: d.id ?? null, nombre, obligatorio: d.obligatorio };
  });
}

/** Estado del proceso en una fecha: sin configurar, próximo (antes del inicio), abierto o cerrado (después del fin). */
export function estadoProceso(proceso: { fechaInicio: string; fechaFin: string } | null, hoy: string): EstadoProceso {
  if (!proceso) return "SIN_CONFIGURAR";
  if (hoy < proceso.fechaInicio) return "PROXIMO";
  if (hoy > proceso.fechaFin) return "CERRADO";
  return "ABIERTO";
}

/** El apoderado solo matricula con el proceso abierto; si no, el mensaje dice desde o hasta cuándo. */
export function verificarProcesoAbierto(
  proceso: { fechaInicio: string; fechaFin: string } | null,
  hoy: string,
  anio: number,
) {
  const estado = estadoProceso(proceso, hoy);
  if (estado === "SIN_CONFIGURAR") throw E.matriculaNoConfigurada(anio);
  if (estado === "PROXIMO") throw E.matriculaAunNoAbre(fechaTexto(proceso!.fechaInicio));
  if (estado === "CERRADO") throw E.matriculaCerrada(fechaTexto(proceso!.fechaFin));
}

/** Los procesos de un año cerrado ya no cambian. */
export function verificarProcesoEditable(anio: { anio: number; estado: string }) {
  if (anio.estado === "CERRADO") throw E.anioCerradoProceso(anio.anio);
}

/**
 * Cambios en la lista: los documentos con id que siguen se actualizan (nombre, obligatorio y orden), los nuevos se
 * crean y los que ya no están quedan inactivos (no se borran: los documentos subidos los siguen nombrando).
 */
export function cambiosDocumentos(
  actuales: { id: string }[],
  pedidos: { id: string | null; nombre: string; obligatorio: boolean }[],
) {
  const idsActuales = new Set(actuales.map((d) => d.id));
  const conOrden = pedidos.map((d, i) => ({ ...d, orden: i + 1 }));
  const conservados = conOrden.filter((d) => d.id && idsActuales.has(d.id));
  const idsConservados = new Set(conservados.map((d) => d.id));
  return {
    actualizar: conservados as { id: string; nombre: string; obligatorio: boolean; orden: number }[],
    crear: conOrden.filter((d) => !d.id || !idsActuales.has(d.id)),
    desactivar: actuales.filter((d) => !idsConservados.has(d.id)).map((d) => d.id),
  };
}
