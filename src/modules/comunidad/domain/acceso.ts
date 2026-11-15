// comunidad/domain: regla pura de «Crear acceso al portal» de un estudiante (US49, AD-06). La cuenta se crea una sola
// vez y solo a un estudiante activo con matrícula vigente (ni retirado ni con la matrícula anulada).
import { erroresComunidad as E } from "./errores";

export interface SituacionDeAcceso {
  /** El perfil de estudiante y la persona están activos. */
  estudianteActivo: boolean;
  /** La persona ya tiene una cuenta (por este u otro perfil): ingresa con ella. */
  tieneCuenta: boolean;
  /** «Matriculado» en un año abierto; lo informa el módulo matricula. */
  matriculaVigente: boolean;
}

/** Lanza el error que impide crear el acceso; si no lanza, se puede crear. */
export function verificarAccesoCreable(situacion: SituacionDeAcceso): void {
  if (!situacion.estudianteActivo) throw E.estudianteNoEncontrado();
  if (situacion.tieneCuenta) throw E.accesoExistente();
  if (!situacion.matriculaVigente) throw E.sinMatriculaVigente();
}
