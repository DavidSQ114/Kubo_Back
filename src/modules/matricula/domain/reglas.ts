// matricula/domain: reglas puras de la matrícula «En proceso» que deja el registro del estudiante (US17).
import { erroresMatricula as E } from "./errores";

export interface AnioCandidato {
  id: string;
  anio: number;
  estado: string;
}

/**
 * Año de la matrícula en borrador: el que está «En matrícula» y, si no hay, el «En curso» (incorporaciones durante el
 * año). Si hay varios en matrícula, el más próximo. Sin ninguno: 422 SIN_ANIO_EN_MATRICULA.
 */
export function anioParaBorrador(anios: AnioCandidato[]): AnioCandidato {
  const ordenados = [...anios].sort((a, b) => a.anio - b.anio);
  const elegido = ordenados.find((a) => a.estado === "EN_MATRICULA") ?? ordenados.find((a) => a.estado === "EN_CURSO");
  if (!elegido) throw E.sinAnioEnMatricula();
  return elegido;
}
