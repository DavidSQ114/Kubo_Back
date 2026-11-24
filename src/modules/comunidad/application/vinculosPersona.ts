// comunidad/application: vínculos en el detalle de una persona (D-12, AD-06). De un estudiante, sus apoderados con
// el parentesco, quién es el principal y quién responde por el pago; de un apoderado, sus hijos con la sección y el
// estado de su matrícula más reciente (la da matricula por el puerto RegistrosMatriculaProvider).
import { errores } from "@/platform/http/errores";
import { personas, vinculos } from "../infrastructure/repositorio";
import { registrosMatriculaProvider, type MatriculaReciente } from "../puertos";

export interface VinculoDePersona {
  vinculoId: string;
  /** La otra persona del vínculo: el apoderado (de un estudiante) o el hijo (de un apoderado). */
  personaId: string;
  nombreCompleto: string;
  /** Su perfil y su persona siguen activos. */
  activo: boolean;
  parentesco: string;
  esPrincipal: boolean;
  autorizado: boolean;
  /** Es el responsable del pago en la matrícula más reciente del estudiante. */
  responsablePago: boolean;
  /** Solo en los hijos: su matrícula más reciente; null si no tiene. */
  matricula: Omit<MatriculaReciente, "vinculoResponsableId"> | null;
}

export interface VinculosDePersona {
  /** Si la persona es estudiante: sus apoderados (el principal primero). */
  apoderados: VinculoDePersona[];
  /** Si la persona es apoderado: sus hijos. */
  hijos: VinculoDePersona[];
}

type Perfil = { activo: boolean; persona: { id: string; nombres: string; apellidos: string; activo: boolean } };

const datosDe = (p: Perfil) => ({
  personaId: p.persona.id,
  nombreCompleto: `${p.persona.nombres} ${p.persona.apellidos}`,
  activo: p.activo && p.persona.activo,
});

/** Apoderados e hijos de la persona, con la matrícula más reciente de cada estudiante involucrado. */
export async function vinculosDePersona(personaId: string): Promise<VinculosDePersona> {
  if (!(await personas.porIds([personaId])).length) throw errores.noEncontrado("La persona");
  const filas = await vinculos.dePersona(personaId);
  if (!filas.length) return { apoderados: [], hijos: [] };
  const recientes = await registrosMatriculaProvider().matriculasRecientes([
    ...new Set(filas.map((v) => v.estudiante.id)),
  ]);
  const comun = (v: (typeof filas)[number]) => ({
    vinculoId: v.id,
    parentesco: v.parentesco,
    esPrincipal: v.esPrincipal,
    autorizado: v.autorizado,
    responsablePago: recientes[v.estudiante.id]?.vinculoResponsableId === v.id,
  });
  const resultado: VinculosDePersona = { apoderados: [], hijos: [] };
  for (const v of filas) {
    if (v.estudiante.persona.id === personaId) {
      resultado.apoderados.push({ ...comun(v), ...datosDe(v.apoderado), matricula: null });
    } else {
      const reciente = recientes[v.estudiante.id];
      const matricula = reciente ? { anio: reciente.anio, estado: reciente.estado, seccion: reciente.seccion } : null;
      resultado.hijos.push({ ...comun(v), ...datosDe(v.estudiante), matricula });
    }
  }
  return resultado;
}
