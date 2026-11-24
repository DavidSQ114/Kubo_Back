// aula-virtual/application: quién puede hacer qué en el aula virtual. El docente sale de la sesión, nunca de la URL:
// solo gestiona sus asignaciones activas (curso y sección) y solo escribe en las del año EN_CURSO. El alumno se resuelve
// por su matrícula vigente (matricula): solo ve el aula de su sección.
import { errores } from "@/platform/http/errores";
import { asignacionParaNotas, type AsignacionParaNotas } from "@/modules/academico";
import { docentesProviderComunidad } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { erroresAulaVirtual as E } from "../domain/errores";

export const etiquetaDe = (s: { nombre: string; grado: { numero: number } }) => `${s.grado.numero}° ${s.nombre}`;

/** Perfil Docente de la persona en sesión; sin él, 403. */
export async function docenteEnSesion(auth: Autenticado) {
  const docente = await docentesProviderComunidad.docentePorPersona(auth.personaId);
  if (!docente) throw errores.accesoDenegado();
  return docente;
}

/**
 * Asignación (curso y sección) del docente en sesión. Una inexistente responde 404; una de otro docente o desactivada,
 * 403. Para escribir, además, debe ser del año EN_CURSO (422 ANIO_NO_EN_CURSO).
 */
export async function asignacionDelDocente(
  auth: Autenticado,
  asignacionId: string,
  opciones: { escritura: boolean },
): Promise<AsignacionParaNotas> {
  const docente = await docenteEnSesion(auth);
  const asignacion = await asignacionParaNotas(asignacionId);
  if (!asignacion) throw errores.noEncontrado("El curso");
  if (asignacion.docenteId !== docente.id || !asignacion.activo) throw errores.accesoDenegado();
  if (opciones.escritura && asignacion.anio.estado !== "EN_CURSO") throw E.anioNoEnCurso();
  return asignacion;
}

/**
 * Lo mismo para un recurso del aula (unidad, material o enlace) pedido por su id: si es de otro docente se responde
 * con el `noEncontrado` del recurso (404), sin revelar que existe.
 */
export async function asignacionDelRecurso(
  auth: Autenticado,
  asignacionId: string,
  noEncontrado: () => Error,
  opciones: { escritura: boolean },
): Promise<AsignacionParaNotas> {
  try {
    return await asignacionDelDocente(auth, asignacionId, opciones);
  } catch (e) {
    if ((e as { codigo?: string }).codigo === "ACCESO_DENEGADO") throw noEncontrado();
    throw e;
  }
}
