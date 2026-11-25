// matricula/application: bandeja de solicitudes de matrícula del Coordinador académico (bloque M4, fase 7). Filtra por
// estado, abre cada documento por el endpoint con permiso y lo aprueba u observa con motivo; el apoderado recibe un
// aviso en cada cambio. Con todos los obligatorios aprobados, asigna la sección con el flujo de matrícula de siempre
// (confirmarMatricula: Matriculado, cronograma y cuota de ingreso si es alumno nuevo).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { registrarAvisos } from "@/platform/notificaciones";
import { listarGrados, listarSecciones } from "@/modules/academico";
import { estudianteParaMatricula, nombresDeUsuarios, resumenEstudiantes } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { erroresMatricula as E } from "../domain/errores";
import type { ModalidadPago } from "../domain/matriculas";
import {
  estadoSegunDocumentos,
  NOMBRE_ESTADO_DOCUMENTO,
  NOMBRE_ESTADO_SOLICITUD,
  revisarDocumento,
  verificarListaParaAsignar,
  verificarSolicitudAbierta,
  type DecisionDocumento,
  type EstadoSolicitud,
} from "../domain/solicitudes";
import { procesos } from "../infrastructure/proceso";
import { documentosSubidos, solicitudes } from "../infrastructure/solicitudes";
import { confirmarMatricula } from "./matriculas";
import { vistaSolicitud } from "./solicitudes";

const ENTIDAD = "solicitud_matricula";

/** Bandeja: solicitudes del año (las más antiguas primero) con el avance de la revisión de sus documentos. */
export async function bandejaSolicitudes(filtro: { anioId: string; estado?: EstadoSolicitud }) {
  const [lista, grados] = await Promise.all([solicitudes.delAnio(filtro.anioId, filtro.estado), listarGrados()]);
  const [estudiantes, apoderados] = await Promise.all([
    resumenEstudiantes([...new Set(lista.map((s) => s.estudianteId))]),
    nombresDeUsuarios([...new Set(lista.map((s) => s.creadoPorId))]),
  ]);
  const gradoDe = new Map(grados.map((g) => [g.id, g.nombre]));
  const items = await Promise.all(
    lista.map(async (s) => {
      const requeridos = await procesos.documentosActivos(s.procesoId);
      const cuenta = (estado: string) => s.documentos.filter((d) => d.estado === estado).length;
      return {
        solicitudId: s.id,
        estudianteId: s.estudianteId,
        estudiante: estudiantes[s.estudianteId]?.nombreCompleto ?? "—",
        dni: estudiantes[s.estudianteId]?.dni ?? "",
        grado: gradoDe.get(s.gradoId) ?? "—",
        apoderado: apoderados[s.creadoPorId]?.nombreCompleto ?? null,
        enviadaEn: s.enviadaEn.toISOString(),
        estado: s.estado,
        nombreEstado: NOMBRE_ESTADO_SOLICITUD[s.estado],
        documentos: {
          requeridos: requeridos.length,
          aprobados: cuenta("APROBADO"),
          observados: cuenta("OBSERVADO"),
          enRevision: cuenta("EN_REVISION"),
        },
      };
    }),
  );
  const totales = Object.fromEntries(
    (Object.keys(NOMBRE_ESTADO_SOLICITUD) as EstadoSolicitud[]).map((e) => [
      e,
      items.filter((i) => i.estado === e).length,
    ]),
  );
  return { items, totales };
}

/** Detalle: alumno, apoderados, documentos y las secciones activas del grado pedido para asignar. */
export async function detalleSolicitud(solicitudId: string) {
  const s = await solicitudes.porId(solicitudId);
  if (!s) throw E.solicitudNoEncontrada();
  const [estudiante, secciones, grados, nombres, vista] = await Promise.all([
    estudianteParaMatricula(s.estudianteId),
    listarSecciones(s.anioAcademicoId),
    listarGrados(),
    nombresDeUsuarios([s.creadoPorId]),
    vistaSolicitud(s),
  ]);
  const requeridos = await procesos.documentosActivos(s.procesoId);
  let pendientes: string[] = [];
  try {
    verificarListaParaAsignar(requeridos, s.documentos);
  } catch (e) {
    pendientes = ((e as { detalles?: { nombres?: string[] } }).detalles?.nombres ?? []) as string[];
  }
  return {
    ...vista,
    anioAcademicoId: s.anioAcademicoId,
    grado: grados.find((g) => g.id === s.gradoId)?.nombre ?? "—",
    estudiante: estudiante && {
      estudianteId: estudiante.estudianteId,
      nombreCompleto: estudiante.nombreCompleto,
      dni: estudiante.dni,
    },
    apoderado: nombres[s.creadoPorId]?.nombreCompleto ?? null,
    responsable: estudiante?.apoderados.find((a) => a.vinculoId === s.vinculoResponsableId)?.nombreCompleto ?? null,
    puedeAsignar: s.estado === "APROBADA",
    documentosPendientes: pendientes,
    secciones: secciones
      .filter((x) => x.grado.id === s.gradoId && x.estado === "ACTIVA")
      .map((x) => ({
        seccionId: x.id,
        nombre: `${x.grado.numero}° ${x.nombre}`,
        aula: x.aula?.nombre ?? null,
        tutor: x.tutor?.nombreCompleto ?? null,
        vacantes: x.vacantes,
      })),
  };
}

/**
 * Aprueba u observa (con motivo) un documento En revisión. La solicitud recalcula su estado, se registra
 * REVISAR_DOCUMENTO_MATRICULA y el apoderado recibe el aviso (con la observación si la hay).
 */
export async function revisarDocumentoSolicitud(
  coordinador: Autenticado,
  solicitudId: string,
  documentoId: string,
  datos: { decision: DecisionDocumento; observacion?: string | null },
  meta: MetaSolicitud,
) {
  await prisma.$transaction(async (tx) => {
    await solicitudes.bloquear(tx, solicitudId);
    const s = await solicitudes.porId(solicitudId, tx);
    if (!s) throw E.solicitudNoEncontrada();
    verificarSolicitudAbierta(s.estado);
    const d = s.documentos.find((x) => x.id === documentoId);
    if (!d) throw E.solicitudNoEncontrada();
    const r = revisarDocumento(d.estado, datos.decision, datos.observacion);
    await documentosSubidos.revisar(tx, d.id, {
      ...r,
      revisadoPorId: coordinador.usuarioId,
      revisadoEn: new Date(),
    });
    const requeridos = await procesos.todosLosDocumentos(s.procesoId, tx);
    const nombre = requeridos.find((x) => x.id === d.documentoRequeridoId)?.nombre ?? "Documento";
    const despues = (await solicitudes.porId(solicitudId, tx))!;
    const estado = estadoSegunDocumentos(
      requeridos.filter((x) => x.activo),
      despues.documentos,
    );
    await solicitudes.cambiarEstado(tx, solicitudId, estado);
    await registrarAuditoria(
      tx,
      {
        usuarioId: coordinador.usuarioId,
        entidad: ENTIDAD,
        entidadId: solicitudId,
        accion: "REVISAR_DOCUMENTO_MATRICULA",
        anterior: { documento: nombre, estado: d.estado },
        nuevo: { documento: nombre, estado: r.estado, estadoSolicitud: estado },
        motivo: r.observacion,
      },
      meta,
    );
    const alumno = (await resumenEstudiantes([s.estudianteId]))[s.estudianteId]?.nombres ?? "Tu hijo";
    await registrarAvisos(tx, {
      notificaciones: [
        {
          usuarioId: s.creadoPorId,
          tipo: "SISTEMA",
          titulo: r.estado === "OBSERVADO" ? "Documento de matrícula observado" : "Documento de matrícula aprobado",
          mensaje:
            r.estado === "OBSERVADO"
              ? `${alumno} · ${nombre}: ${r.observacion}. Reemplázalo en «Matrícula».`
              : `${alumno} · ${nombre} · ${NOMBRE_ESTADO_DOCUMENTO.APROBADO}${estado === "APROBADA" ? ". Todos los documentos están aprobados." : ""}`,
          enlace: "/apoderado/matricula",
        },
      ],
      correos: [],
      origen: { entidad: ENTIDAD, id: solicitudId },
    });
  });
  return detalleSolicitud(solicitudId);
}

/**
 * Asigna la sección (del grado pedido) con el flujo de matrícula de siempre: confirmarMatricula valida los documentos
 * obligatorios aprobados, deja la matrícula Matriculado con su cronograma (y la cuota de ingreso si corresponde),
 * marca la solicitud y avisa al apoderado.
 */
export async function asignarSeccionSolicitud(
  coordinador: Autenticado,
  solicitudId: string,
  datos: { seccionId: string; modalidadPago: ModalidadPago },
  meta: MetaSolicitud,
) {
  const s = await solicitudes.porId(solicitudId);
  if (!s) throw E.solicitudNoEncontrada();
  verificarSolicitudAbierta(s.estado);
  verificarListaParaAsignar(await procesos.documentosActivos(s.procesoId), s.documentos);
  return confirmarMatricula(
    coordinador,
    {
      estudianteId: s.estudianteId,
      anioAcademicoId: s.anioAcademicoId,
      seccionId: datos.seccionId,
      vinculoResponsableId: s.vinculoResponsableId,
      modalidadPago: datos.modalidadPago,
    },
    meta,
  );
}
