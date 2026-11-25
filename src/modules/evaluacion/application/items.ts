// evaluacion/application: gestión de los ítems de evaluación de una competencia en un registro (bloque M2, DO-04
// «Ítems»): crea, edita, reordena y elimina con la lista completa en una sola transacción. Solo el docente de la
// asignación, en el bimestre activo y con el registro ABIERTO, con el cierre bloqueado. Si el cambio borra
// calificaciones o deja alumnos sin nota (y sin sus evidencias), pide confirmación; luego recalcula las notas de la
// competencia y lo deja en la auditoría (GUARDAR_ITEMS_EVALUACION) y en la bitácora de notas (origen ITEMS).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { competenciasDelPlan, fechaEnLima, reglaDelBimestre } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import { erroresEvaluacion as E, type ImpactoCambioItems } from "../domain/errores";
import {
  prepararItems,
  recalcularNotas,
  sumaDePesos,
  verificarConfirmacion,
  type ItemDeCompetencia,
  type ItemPedido,
} from "../domain/items";
import { situacionDelRegistro, verificarEditable } from "../domain/notas";
import { columnasDelRegistro } from "../domain/rectificacion";
import {
  calificacionesItem,
  cierres,
  estadoDeRegistro,
  evidencias,
  itemsEvaluacion,
  notas,
} from "../infrastructure/repositorio";
import { aplicarRecalculo, calcularNotaDeItems, type ResumenRecalculo } from "./recalculoItems";
import { alumnosDelRegistro, armarRegistro, cargarContexto, etiquetaDe, type RegistroDeNotas } from "./registroNotas";

export interface ItemsGuardados extends RegistroDeNotas {
  itemsGuardados: {
    creados: number;
    editados: number;
    eliminados: number;
    impacto: ImpactoCambioItems;
    recalculo: ResumenRecalculo;
  };
}

/**
 * Reemplaza los ítems de una competencia del registro por la lista pedida (en ese orden). Sin `confirmar`, un cambio
 * que borra calificaciones o quita notas responde 409 CONFIRMAR_CAMBIO_ITEMS con lo que se perdería.
 */
export async function guardarItems(
  auth: Autenticado,
  ids: { asignacionId: string; periodoId: string; competenciaPlanId: string },
  datos: { items: ItemPedido[]; confirmar: boolean },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<ItemsGuardados> {
  const { asignacion, bimestre, docente } = await cargarContexto(auth, ids.asignacionId, ids.periodoId, ahora);
  verificarEditable(
    situacionDelRegistro(estadoDeRegistro(await cierres.de(asignacion.id, bimestre.id)), bimestre.activo),
  );
  const competencias = await competenciasDelPlan(asignacion.planEstudioId);
  const competencia = competencias.find((c) => c.competenciaPlanId === ids.competenciaPlanId);
  if (!competencia) throw E.notaFueraDelRegistro();
  const regla = await reglaDelBimestre(asignacion.anio.id, bimestre.numero);
  if (!regla) throw E.sinReglaConsolidacion();
  const alumnos = await alumnosDelRegistro(asignacion.seccion.id, null, fechaEnLima(ahora));
  const columnas = columnasDelRegistro(competencias);

  const resumen = await prisma.$transaction(async (tx) => {
    const cierre = await cierres.asegurarYBloquear(tx, {
      asignacionDocenteId: asignacion.id,
      periodoEvaluacionId: bimestre.id,
      reglaConsolidacionId: regla.id,
    });
    verificarEditable(situacionDelRegistro(estadoDeRegistro(cierre), bimestre.activo));
    const actuales = (await itemsEvaluacion.delCierre(cierre.id, tx)).filter(
      (i) => i.competenciaPlanId === ids.competenciaPlanId,
    );
    const preparados = prepararItems(datos.items, actuales);
    const eliminados = actuales.filter((a) => !preparados.some((p) => p.id === a.id));
    const calificaciones = await calificacionesItem.delCierre(cierre.id, tx);
    const borradas = calificaciones.filter((c) => eliminados.some((e) => e.id === c.itemId));

    // el estado al que se llega: los ítems nuevos aún no tienen id ni calificaciones
    const futuros: ItemDeCompetencia[] = preparados.map((p) => ({
      id: p.id ?? `nuevo-${p.orden}`,
      competenciaPlanId: ids.competenciaPlanId,
      nombre: p.nombre,
      peso: p.peso,
      orden: p.orden,
    }));
    const cambios = recalcularNotas({
      competenciaPlanIds: [ids.competenciaPlanId],
      items: futuros,
      matriculaIds: alumnos.map((a) => a.matriculaId),
      calificaciones: calificaciones.filter((c) => !borradas.includes(c)),
      notas: await notas.delCierre(cierre.id, tx),
      calcular: calcularNotaDeItems,
    });
    const impacto: ImpactoCambioItems = {
      itemsEliminados: eliminados.filter((e) => borradas.some((b) => b.itemId === e.id)).map((e) => e.nombre),
      calificacionesBorradas: borradas.length,
      notasQuitadas: cambios.quitar.length,
      evidenciasBorradas: await evidencias.contarDeNotas(
        cambios.quitar.map((q) => q.id),
        tx,
      ),
    };
    verificarConfirmacion(impacto, datos.confirmar);

    await itemsEvaluacion.eliminar(
      tx,
      eliminados.map((e) => e.id),
    );
    let editados = 0;
    for (const p of preparados) {
      const actual = p.id ? actuales.find((a) => a.id === p.id) : null;
      if (!actual) {
        await itemsEvaluacion.crear(tx, {
          cierreId: cierre.id,
          competenciaPlanId: ids.competenciaPlanId,
          nombre: p.nombre,
          peso: p.peso,
          orden: p.orden,
        });
      } else if (actual.nombre !== p.nombre || actual.peso !== p.peso || actual.orden !== p.orden) {
        await itemsEvaluacion.actualizar(tx, actual.id, { nombre: p.nombre, peso: p.peso, orden: p.orden });
        editados += 1;
      }
    }
    const contexto = {
      usuarioId: auth.usuarioId,
      usuarioNombre: docente.nombreCompleto,
      docenteId: docente.id,
      docenteNombre: docente.nombreCompleto,
      anio: asignacion.anio.anio,
      curso: { codigo: asignacion.curso.codigo, nombre: asignacion.curso.nombre },
      seccion: etiquetaDe(asignacion.seccion),
      bimestre: { numero: bimestre.numero, nombre: bimestre.nombre },
    };
    const recalculo = await aplicarRecalculo(tx, {
      cierreId: cierre.id,
      cambios,
      usuarioId: auth.usuarioId,
      contexto,
      nombres: new Map(alumnos.map((a) => [a.matriculaId, a.nombre])),
      columnas,
    });
    const lista = (items: { nombre: string; peso: number; orden: number }[]) =>
      items.map(({ nombre, peso, orden }) => ({ nombre, peso, orden }));
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "cierre_calificacion",
        entidadId: cierre.id,
        accion: "GUARDAR_ITEMS_EVALUACION",
        anterior: { items: lista(actuales) },
        nuevo: {
          anio: asignacion.anio.anio,
          curso: asignacion.curso.codigo,
          seccion: etiquetaDe(asignacion.seccion),
          bimestre: bimestre.numero,
          competencia: competencia.codigo,
          items: lista(preparados),
          sumaPesos: sumaDePesos(preparados.map((p) => p.peso)),
          impacto,
          recalculo,
        },
      },
      meta,
    );
    const creados = preparados.filter((p) => !p.id).length;
    return { creados, editados, eliminados: eliminados.length, impacto, recalculo };
  });
  return { ...(await armarRegistro(asignacion, bimestre, ahora)), itemsGuardados: resumen };
}
