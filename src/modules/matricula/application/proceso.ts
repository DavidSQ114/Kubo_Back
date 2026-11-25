// matricula/application: proceso de matrícula de cada año (bloque M4). El Coordinador académico fija las fechas en
// que los apoderados matriculan desde su portal y los documentos que deben subir; cada cambio registra
// CONFIGURAR_PROCESO_MATRICULA con los valores anteriores.
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { fechaEnLima, NOMBRE_ESTADO_ANIO, obtenerAnio } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import {
  cambiosDocumentos,
  DOCUMENTOS_SUGERIDOS,
  estadoProceso,
  NOMBRE_ESTADO_PROCESO,
  verificarProceso,
  verificarProcesoEditable,
  type DocumentoPedido,
} from "../domain/proceso";
import { procesos, type ProcesoFila } from "../infrastructure/proceso";

const resumen = (p: ProcesoFila | null) =>
  p && {
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
    documentos: p.documentos.filter((d) => d.activo).map((d) => ({ nombre: d.nombre, obligatorio: d.obligatorio })),
  };

/** Proceso de matrícula del año con su estado de hoy y los documentos activos; sin configurar, los sugeridos. */
export async function procesoDelAnio(anioAcademicoId: string) {
  const [anio, p] = await Promise.all([obtenerAnio(anioAcademicoId), procesos.delAnio(anioAcademicoId)]);
  const estado = estadoProceso(p, fechaEnLima(new Date()));
  return {
    anio: { id: anio.id, anio: anio.anio, estado: anio.estado, nombreEstado: NOMBRE_ESTADO_ANIO[anio.estado] },
    configurado: Boolean(p),
    estado,
    nombreEstado: NOMBRE_ESTADO_PROCESO[estado],
    fechaInicio: p?.fechaInicio ?? null,
    fechaFin: p?.fechaFin ?? null,
    actualizadoEn: p?.updatedAt.toISOString() ?? null,
    documentos: p
      ? p.documentos
          .filter((d) => d.activo)
          .map((d) => ({ documentoId: d.id, nombre: d.nombre, obligatorio: d.obligatorio }))
      : [],
    sugeridos: DOCUMENTOS_SUGERIDOS,
  };
}

/** Guarda las fechas y la lista de documentos del año (Coordinador académico), con auditoría. */
export async function guardarProceso(
  coordinador: Autenticado,
  anioAcademicoId: string,
  datos: { fechaInicio: string; fechaFin: string; documentos: DocumentoPedido[] },
  meta: MetaSolicitud,
) {
  const documentos = verificarProceso(datos);
  const anio = await obtenerAnio(anioAcademicoId);
  verificarProcesoEditable(anio);
  await prisma.$transaction(async (tx) => {
    const anterior = await procesos.delAnio(anioAcademicoId, tx);
    const procesoId = await procesos.guardarFechas(tx, {
      anioAcademicoId,
      fechaInicio: datos.fechaInicio,
      fechaFin: datos.fechaFin,
      actualizadoPorId: coordinador.usuarioId,
    });
    await procesos.aplicarDocumentos(
      tx,
      procesoId,
      cambiosDocumentos(anterior?.documentos.filter((d) => d.activo) ?? [], documentos),
    );
    await registrarAuditoria(
      tx,
      {
        usuarioId: coordinador.usuarioId,
        entidad: "proceso_matricula",
        entidadId: procesoId,
        accion: "CONFIGURAR_PROCESO_MATRICULA",
        anterior: resumen(anterior) ?? undefined,
        nuevo: {
          anio: anio.anio,
          fechaInicio: datos.fechaInicio,
          fechaFin: datos.fechaFin,
          documentos: documentos.map((d) => ({ nombre: d.nombre, obligatorio: d.obligatorio })),
        },
      },
      meta,
    );
  });
  return procesoDelAnio(anioAcademicoId);
}
