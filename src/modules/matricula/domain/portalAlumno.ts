// matricula/domain: reglas puras del portal del alumno (US49). Al portal solo entra el alumno con matrícula vigente:
// «Matriculado» en un año abierto. Un alumno retirado, con la matrícula anulada o «En proceso» no la tiene.
import { erroresMatricula as E } from "./errores";
import { matriculasDelPortal, type MatriculaDelHijo } from "./portalApoderado";

/**
 * Matrícula vigente del estudiante: la «Matriculado» del año en curso y, si no hay, la del año en cierre o en
 * matrícula. null si no tiene ninguna (retirado, anulado, en proceso o solo años cerrados).
 */
export function matriculaVigente<T extends MatriculaDelHijo>(lista: T[]): T | null {
  return matriculasDelPortal(lista).find((m) => m.estado === "MATRICULADO") ?? null;
}

/** Sin matrícula vigente no hay portal del alumno: 403 SIN_MATRICULA_VIGENTE. */
export function verificarMatriculaVigente<T>(matricula: T | null): T {
  if (!matricula) throw E.sinMatriculaVigente();
  return matricula;
}
