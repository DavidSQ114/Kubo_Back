// horarios/domain: días, tipos de bloque, estados de un horario y textos compartidos por las reglas y los errores
// del módulo (US27–US31, pantalla AD-13). Las horas viajan como texto "HH:MM".

export const DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"] as const;
export type Dia = (typeof DIAS)[number];

export const NOMBRE_DIA: Record<Dia, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
};

export const TIPOS_BLOQUE = ["CLASE", "RECREO"] as const;
export type TipoBloque = (typeof TIPOS_BLOQUE)[number];

/** Estados de una versión del horario. El valor COMPLETO de la base no se usa. */
export const ESTADOS_HORARIO = ["BORRADOR", "PUBLICADO", "ARCHIVADO"] as const;
export type EstadoHorario = (typeof ESTADOS_HORARIO)[number];

export interface BloqueNuevo {
  orden: number;
  horaInicio: string;
  horaFin: string;
  tipo: TipoBloque;
  etiqueta: string;
}

export interface Bloque extends BloqueNuevo {
  id: string;
}

/** «5° A»: grado y nombre de la sección, como en el Figma. */
export function etiquetaSeccion(seccion: { nombre: string; grado: { numero: number } }): string {
  return `${seccion.grado.numero}° ${seccion.nombre}`;
}

/** «martes 12:35 – 13:20»: día y bloque dentro de un mensaje. */
export function describirBloque(dia: Dia, bloque: { horaInicio: string; horaFin: string }): string {
  return `${NOMBRE_DIA[dia].toLowerCase()} ${bloque.horaInicio} – ${bloque.horaFin}`;
}
