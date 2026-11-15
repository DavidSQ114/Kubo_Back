// horarios/application: asignar, cambiar o vaciar la clase de un bloque del borrador (US28, RF22, modal M-06), con
// la validación de cruces de docente (US29) y de aula (US30) contra el borrador y la versión publicada de las
// demás secciones del año. Editar un horario publicado crea un borrador a partir de él (US31).
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import {
  asignacionesDeClases,
  aulasPorId,
  planDeSeccion,
  seccionParaHorario,
  type SeccionParaHorario,
} from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import { erroresHorarios as E, type DetalleCruce } from "../domain/errores";
import { borradorDe, publicadaDe, siguienteVersion } from "../domain/publicacion";
import {
  buscarCruces,
  verificarBloqueAsignable,
  verificarClaseCompleta,
  verificarDocenteDelCurso,
  verificarEditable,
  type ClaseCandidata,
  type DatosClase,
} from "../domain/reglas";
import { etiquetaSeccion, type Bloque, type Dia } from "../domain/tipos";
import {
  bloques,
  clases,
  esCruceEnBase,
  horarios,
  type ClaseFila,
  type HorarioFila,
} from "../infrastructure/repositorio";
import { cargarSeccion, obtenerCuadricula, type CuadriculaVista } from "./cuadricula";

export interface Celda {
  dia: Dia;
  bloqueId: string;
}

/**
 * Sección editable (activa y del periodo académico activo) con los cambios de horarios de su año serializados
 * hasta el fin de la transacción.
 */
async function prepararEdicion(tx: Tx, seccionId: string): Promise<SeccionParaHorario> {
  const seccion = await cargarSeccion(seccionId, tx);
  verificarEditable({ estado: seccion.estado, anioEstado: seccion.anio.estado });
  await horarios.bloquearAnio(tx, seccion.anio.id);
  return seccion;
}

/**
 * Borrador de la sección. Si no existe se crea: vacío si la sección aún no tiene horario, o con las clases de la
 * versión publicada (US31: editar un horario publicado crea un borrador nuevo a partir de él).
 */
async function borradorParaEditar(tx: Tx, seccionId: string, versiones: HorarioFila[]): Promise<HorarioFila> {
  const existente = borradorDe(versiones);
  if (existente) return existente;
  const nuevo = await horarios.crear({ seccionId, version: siguienteVersion(versiones) }, tx);
  const publicada = publicadaDe(versiones);
  if (publicada) await clases.copiar(publicada.id, nuevo.id, tx);
  return nuevo;
}

/** Lanza «Error: Cruce de Docente» o «Error: Aula Ocupada» con la sección, el día y el bloque del conflicto. */
async function verificarSinCruces(candidata: ClaseCandidata, bloque: Bloque, aulaNombre: string, tx?: Tx) {
  const cruces = buscarCruces(candidata, await clases.ocupacionesDelBloque(candidata.dia, candidata.bloqueId, tx));
  const choque = cruces.docente ?? cruces.aula;
  if (!choque) return;
  const otra = await seccionParaHorario(choque.seccionId, tx);
  const detalle: DetalleCruce = {
    seccion: { id: choque.seccionId, etiqueta: otra ? etiquetaSeccion(otra) : "otra sección" },
    dia: candidata.dia,
    bloque: { id: bloque.id, horaInicio: bloque.horaInicio, horaFin: bloque.horaFin },
    estadoHorario: choque.estadoHorario,
  };
  throw cruces.docente ? E.cruceDocente(detalle) : E.aulaOcupada(aulaNombre, detalle);
}

/** Datos de una clase para la bitácora: sin nombres de personas, solo identificadores y el curso. */
async function resumenClase(clase: ClaseFila, horario: HorarioFila, bloque: Bloque, tx: Tx) {
  const [asignacion] = await asignacionesDeClases([clase.asignacionDocenteId], tx);
  return {
    seccionId: clase.seccionId,
    horarioId: horario.id,
    version: horario.version,
    dia: clase.dia,
    bloque: `${bloque.horaInicio} – ${bloque.horaFin}`,
    curso: asignacion?.curso.codigo ?? null,
    docenteId: clase.docenteId,
    aulaId: clase.aulaId,
  };
}

/**
 * Asigna (o cambia) la clase de un bloque: curso, docente y aula obligatorios, el docente debe tener asignado el
 * curso en la sección y ni él ni el aula pueden estar en otra sección en ese día y bloque (US28, US29, US30).
 */
export async function asignarClase(
  admin: Autenticado,
  seccionId: string,
  celda: Celda,
  datos: DatosClase,
  meta: MetaSolicitud,
): Promise<CuadriculaVista> {
  const completa = verificarClaseCompleta(datos);
  const candidata: ClaseCandidata = {
    seccionId,
    dia: celda.dia,
    bloqueId: celda.bloqueId,
    docenteId: completa.docenteId,
    aulaId: completa.aulaId,
  };
  // lo que la transacción alcanzó a validar, para explicar un rechazo de la base
  const validado: { bloque: Bloque | null; aula: string } = { bloque: null, aula: "El aula" };
  try {
    await prisma.$transaction(async (tx) => {
      const seccion = await prepararEdicion(tx, seccionId);
      const delCatalogo = await bloques.porId(celda.bloqueId, tx);
      const bloque = verificarBloqueAsignable(delCatalogo?.anioAcademicoId === seccion.anio.id ? delCatalogo : null);
      const plan = await planDeSeccion(seccion, tx);
      const asignacion = verificarDocenteDelCurso(
        plan.map((p) => ({ cursoId: p.curso.id, asignacion: p.asignacion })),
        completa.cursoId,
        completa.docenteId,
      );
      const [aula] = await aulasPorId([completa.aulaId], tx);
      if (!aula) throw errores.noEncontrado("El aula");
      if (!aula.activo) throw E.aulaInactiva();
      validado.bloque = bloque;
      validado.aula = aula.nombre;
      await verificarSinCruces(candidata, bloque, aula.nombre, tx);

      const borrador = await borradorParaEditar(tx, seccionId, await horarios.deSeccion(seccionId, tx));
      const anterior = await clases.enCelda(borrador.id, celda.dia, celda.bloqueId, tx);
      const nuevos = { aulaId: aula.id, asignacionDocenteId: asignacion.id, docenteId: asignacion.docenteId };
      const clase = anterior
        ? await clases.actualizar(anterior.id, nuevos, tx)
        : await clases.crear({ ...nuevos, horarioId: borrador.id, seccionId, ...celda }, tx);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "detalle_horario",
          entidadId: clase.id,
          accion: "ASIGNAR_CLASE",
          anterior: anterior ? await resumenClase(anterior, borrador, bloque, tx) : null,
          nuevo: await resumenClase(clase, borrador, bloque, tx),
        },
        meta,
      );
    });
  } catch (e) {
    // La base rechazó la clase (uq_detalle_cruce_docente o uq_detalle_cruce_aula): otra solicitud guardó a la vez
    // el mismo docente o la misma aula. Se vuelve a validar, ya con esa clase confirmada, para dar el mensaje.
    if (!esCruceEnBase(e) || !validado.bloque) throw e;
    await verificarSinCruces(candidata, validado.bloque, validado.aula);
    throw e;
  }
  return obtenerCuadricula(seccionId);
}

/** Vacía un bloque del borrador (US28). Si la sección solo tiene la versión publicada, crea antes el borrador. */
export async function quitarClase(
  admin: Autenticado,
  seccionId: string,
  celda: Celda,
  meta: MetaSolicitud,
): Promise<CuadriculaVista> {
  await prisma.$transaction(async (tx) => {
    const seccion = await prepararEdicion(tx, seccionId);
    const bloque = await bloques.porId(celda.bloqueId, tx);
    if (!bloque || bloque.anioAcademicoId !== seccion.anio.id) throw errores.noEncontrado("El bloque horario");
    const versiones = await horarios.deSeccion(seccionId, tx);
    const vigente = borradorDe(versiones) ?? publicadaDe(versiones);
    if (!vigente || !(await clases.enCelda(vigente.id, celda.dia, celda.bloqueId, tx))) {
      throw errores.noEncontrado("La clase");
    }
    const borrador = await borradorParaEditar(tx, seccionId, versiones);
    const clase = (await clases.enCelda(borrador.id, celda.dia, celda.bloqueId, tx))!;
    const anterior = await resumenClase(clase, borrador, bloque, tx);
    await clases.eliminar(clase.id, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "detalle_horario",
        entidadId: clase.id,
        accion: "QUITAR_CLASE",
        anterior,
        nuevo: { seccionId, horarioId: borrador.id, version: borrador.version, dia: celda.dia, bloque: null },
      },
      meta,
    );
  });
  return obtenerCuadricula(seccionId);
}

/**
 * Abre un borrador para editar el horario de la sección (US31): con las clases de la versión publicada o, si la
 * sección aún no tiene horario, vacío. Si ya hay un borrador, lo devuelve tal cual.
 */
export async function crearBorrador(seccionId: string): Promise<CuadriculaVista> {
  await prisma.$transaction(async (tx) => {
    await prepararEdicion(tx, seccionId);
    await borradorParaEditar(tx, seccionId, await horarios.deSeccion(seccionId, tx));
  });
  return obtenerCuadricula(seccionId);
}
