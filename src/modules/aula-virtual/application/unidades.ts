// aula-virtual/application: unidades didácticas del aula de un curso y sección (DO-05): crear, renombrar, ordenar y
// desactivar o volver a activar. Una unidad no se borra: desactivada, sus materiales dejan de verse para los alumnos
// (US67) y el docente los conserva.
import { prisma } from "@/platform/db/prisma";
import type { Autenticado } from "@/modules/identidad";
import { erroresAulaVirtual as E } from "../domain/errores";
import { siguienteNumero, vecinaParaMover, type Direccion } from "../domain/reglas";
import { unidades } from "../infrastructure/repositorio";
import { asignacionDelDocente, asignacionDelRecurso } from "./contexto";
import { vistaDeUnidad, type UnidadVista } from "./vistas";

/** Crea una unidad al final del orden, con el número siguiente al mayor. */
export async function crearUnidad(auth: Autenticado, asignacionId: string, titulo: string): Promise<UnidadVista> {
  const a = await asignacionDelDocente(auth, asignacionId, { escritura: true });
  const creada = await prisma.$transaction(async (tx) => {
    await unidades.bloquearDeAsignacion(tx, a.id);
    const existentes = await unidades.deAsignacion(a.id, tx);
    return unidades.crear(tx, {
      asignacionDocenteId: a.id,
      numero: siguienteNumero(existentes.map((u) => u.numero)),
      titulo,
    });
  });
  return vistaDeUnidad(creada);
}

async function unidadDelDocente(auth: Autenticado, unidadId: string) {
  const unidad = await unidades.porId(unidadId);
  if (!unidad) throw E.unidadNoEncontrada();
  await asignacionDelRecurso(auth, unidad.asignacionDocenteId, E.unidadNoEncontrada, { escritura: true });
  return unidad;
}

/** Renombra la unidad y/o la desactiva o vuelve a activar. */
export async function editarUnidad(
  auth: Autenticado,
  unidadId: string,
  datos: { titulo?: string; activo?: boolean },
): Promise<UnidadVista> {
  const unidad = await unidadDelDocente(auth, unidadId);
  return vistaDeUnidad(await prisma.$transaction((tx) => unidades.actualizar(tx, unidad.id, datos)));
}

/** Sube o baja la unidad un lugar en el orden (intercambia su número con la vecina). Devuelve todas las unidades. */
export async function moverUnidad(auth: Autenticado, unidadId: string, direccion: Direccion): Promise<UnidadVista[]> {
  const unidad = await unidadDelDocente(auth, unidadId);
  const lista = await prisma.$transaction(async (tx) => {
    await unidades.bloquearDeAsignacion(tx, unidad.asignacionDocenteId);
    const actuales = await unidades.deAsignacion(unidad.asignacionDocenteId, tx);
    const actual = actuales.find((u) => u.id === unidad.id);
    if (!actual) throw E.unidadNoEncontrada();
    const vecina = vecinaParaMover(actuales, actual.id, direccion);
    if (vecina) await unidades.intercambiarNumeros(tx, actual, vecina);
    return unidades.deAsignacion(unidad.asignacionDocenteId, tx);
  });
  return lista.map(vistaDeUnidad);
}
