// horarios/application: publicación del horario de una sección (US31, RF24, AD-13). Exige que cada curso del plan
// tenga tantos bloques como horas semanales; el borrador pasa a PUBLICADO y la versión anterior a ARCHIVADO en la
// misma transacción. Después avisa por correo a los docentes de la sección (la notificación en la aplicación
// llega con US55).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { enviarCorreo } from "@/platform/correo";
import { logger } from "@/platform/logger";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { planDeSeccion } from "@/modules/academico";
import { contactosDeDocentes } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { planDePublicacion, verificarPublicable } from "../domain/publicacion";
import { verificarEditable } from "../domain/reglas";
import { etiquetaSeccion } from "../domain/tipos";
import { clases, horarios } from "../infrastructure/repositorio";
import {
  bloquesDelAnio,
  cargarSeccion,
  clasesAsignadas,
  cursosDelPlan,
  obtenerCuadricula,
  vistasDeClases,
  type CuadriculaVista,
} from "./cuadricula";

export interface AvisoPublicacion {
  /** Docentes con clases en la versión publicada. */
  docentes: number;
  /** Correos enviados (un docente sin correo o un fallo del servidor de correo no revierten la publicación). */
  enviados: number;
}

export interface HorarioPublicado extends CuadriculaVista {
  aviso: AvisoPublicacion;
}

interface Publicacion {
  seccion: string;
  anio: number;
  version: number;
  esActualizacion: boolean;
  docenteIds: string[];
}

/** Avisa a los docentes de la sección. Nunca lanza: la publicación ya está confirmada. */
async function avisarDocentes(p: Publicacion, meta: MetaSolicitud): Promise<AvisoPublicacion> {
  const aviso: AvisoPublicacion = { docentes: p.docenteIds.length, enviados: 0 };
  try {
    const contactos = await contactosDeDocentes(p.docenteIds);
    const hecho = p.esActualizacion ? "se actualizó" : "se publicó";
    // allSettled: un correo que falla no impide contar ni enviar los demás
    const resultados = await Promise.allSettled(
      contactos.map((c) =>
        enviarCorreo({
          para: c.email,
          asunto: `Kubo · Horario de ${p.seccion} ${p.esActualizacion ? "actualizado" : "publicado"}`,
          texto:
            `Hola, ${c.nombres}:\n\n` +
            `El horario de ${p.seccion} del año ${p.anio} ${hecho} (versión ${p.version}). ` +
            "Ingresa a Kubo para revisar tus clases en «Mi horario».\n\n" +
            "Este es un mensaje automático: no lo respondas.",
        }),
      ),
    );
    aviso.enviados = resultados.filter((r) => r.status === "fulfilled" && r.value).length;
  } catch (e) {
    logger.warn("No se pudo avisar a los docentes del horario publicado", {
      requestId: meta.requestId,
      error: (e as Error).message,
    });
  }
  return aviso;
}

/**
 * Publica el borrador de la sección (US31). Si ya había una versión publicada, queda ARCHIVADA (solo lectura) y
 * sus clases dejan de ocupar docentes y aulas.
 */
export async function publicarHorario(
  admin: Autenticado,
  seccionId: string,
  meta: MetaSolicitud,
): Promise<HorarioPublicado> {
  const publicacion = await prisma.$transaction(async (tx): Promise<Publicacion> => {
    const seccion = await cargarSeccion(seccionId, tx);
    verificarEditable({ estado: seccion.estado, anioEstado: seccion.anio.estado });
    await horarios.bloquearAnio(tx, seccion.anio.id);
    const { publicar, archivar } = planDePublicacion(await horarios.deSeccion(seccionId, tx));
    await horarios.bloquearFila(tx, publicar.id);

    const filas = await clases.delHorario(publicar.id, tx);
    const plan = await planDeSeccion(seccion, tx);
    const delAnio = await bloquesDelAnio(seccion.anio.id, tx);
    const vistas = await vistasDeClases(filas, tx);
    verificarPublicable(cursosDelPlan(plan), clasesAsignadas(vistas), delAnio);

    // primero se archiva la anterior: solo puede haber una versión PUBLICADA por sección
    if (archivar) await horarios.cambiarEstado(archivar.id, { estado: "ARCHIVADO" }, tx);
    const publicado = await horarios.cambiarEstado(
      publicar.id,
      { estado: "PUBLICADO", publicadoPorId: admin.usuarioId, publicadoEn: new Date() },
      tx,
    );
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "horario",
        entidadId: publicar.id,
        accion: "PUBLICAR_HORARIO",
        anterior: {
          seccionId,
          version: publicar.version,
          estado: publicar.estado,
          publicada: archivar ? { horarioId: archivar.id, version: archivar.version, estado: archivar.estado } : null,
        },
        nuevo: {
          seccionId,
          version: publicado.version,
          estado: publicado.estado,
          clases: filas.length,
          archivada: archivar ? { horarioId: archivar.id, version: archivar.version, estado: "ARCHIVADO" } : null,
        },
      },
      meta,
    );
    return {
      seccion: etiquetaSeccion(seccion),
      anio: seccion.anio.anio,
      version: publicado.version,
      esActualizacion: archivar !== null,
      docenteIds: [...new Set(filas.map((f) => f.docenteId))],
    };
  });
  const aviso = await avisarDocentes(publicacion, meta);
  return { ...(await obtenerCuadricula(seccionId)), aviso };
}
