// horarios/application: publicación del horario de una sección (US31, RF24, AD-13). Exige que cada curso del plan
// tenga tantos bloques como horas semanales; el borrador pasa a PUBLICADO y la versión anterior a ARCHIVADO en la
// misma transacción. En esa transacción también notifica a los docentes, a los apoderados y a los alumnos de la
// sección (US55); el correo a los docentes sale después de confirmar (si falla, queda en la bandeja de salida).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { logger } from "@/platform/logger";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { despacharCorreos, registrarAvisos, type AvisoInterno, type CorreoSaliente } from "@/platform/notificaciones";
import { fechaEnLima, planDeSeccion } from "@/modules/academico";
import { apoderadosDeEstudiantes, contactosDeDocentes, personasDeDocentes } from "@/modules/comunidad";
import { usuariosDePersonas, type Autenticado } from "@/modules/identidad";
import { datosDeMatriculas, matriculasDeSeccionEnFecha } from "@/modules/matricula";
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

/** Personas de la sección que reciben el aviso: alumnos matriculados hoy y sus apoderados vinculados. */
interface FamiliasDeSeccion {
  /** Por persona del alumno, su nombre de pila. */
  alumnos: Map<string, string>;
  /** Por persona del apoderado, los nombres de pila de sus hijos en la sección. */
  apoderados: Map<string, string[]>;
}

const SIN_FAMILIAS: FamiliasDeSeccion = { alumnos: new Map(), apoderados: new Map() };

/** Alumnos matriculados hoy en la sección y sus apoderados (US55). Si falla, la publicación sigue sin ellos. */
async function familiasDeSeccion(seccionId: string, meta: MetaSolicitud): Promise<FamiliasDeSeccion> {
  try {
    const matriculaIds = await matriculasDeSeccionEnFecha(seccionId, fechaEnLima(new Date()));
    const datos = await datosDeMatriculas(matriculaIds);
    const estudiantes = await apoderadosDeEstudiantes(Object.values(datos).map((d) => d.estudianteId));
    const familias: FamiliasDeSeccion = { alumnos: new Map(), apoderados: new Map() };
    for (const e of Object.values(estudiantes)) {
      const nombre = e.nombres.split(" ")[0];
      familias.alumnos.set(e.personaId, nombre);
      for (const a of e.apoderados)
        familias.apoderados.set(a.personaId, [...(familias.apoderados.get(a.personaId) ?? []), nombre]);
    }
    return familias;
  } catch (e) {
    logger.warn("No se pudo preparar el aviso del horario para las familias", {
      requestId: meta.requestId,
      error: (e as Error).message,
    });
    return SIN_FAMILIAS;
  }
}

/**
 * Avisos de la publicación (US31, US55): notificación a los docentes con clases en la versión publicada, a los
 * alumnos de la sección y a sus apoderados; correo a los docentes (como hasta ahora). Nunca lanza: sin avisos, la
 * publicación sigue.
 */
async function avisosDeHorario(
  p: Publicacion,
  familias: FamiliasDeSeccion,
  meta: MetaSolicitud,
): Promise<{ notificaciones: AvisoInterno[]; correos: CorreoSaliente[] }> {
  try {
    const [contactos, personasDocentes] = await Promise.all([
      contactosDeDocentes(p.docenteIds),
      personasDeDocentes(p.docenteIds),
    ]);
    const usuarios = await usuariosDePersonas([
      ...Object.values(personasDocentes),
      ...familias.alumnos.keys(),
      ...familias.apoderados.keys(),
    ]);
    const hecho = p.esActualizacion ? "se actualizó" : "se publicó";
    const titulo = `Horario de ${p.seccion} ${p.esActualizacion ? "actualizado" : "publicado"}`;
    const detalle = `Versión ${p.version} del año ${p.anio}.`;
    const notificaciones: AvisoInterno[] = [];
    const avisar = (personaId: string, mensaje: string, enlace: string) => {
      const usuarioId = usuarios[personaId];
      if (usuarioId) notificaciones.push({ usuarioId, tipo: "HORARIO", titulo, mensaje, enlace });
    };
    for (const personaId of Object.values(personasDocentes)) {
      avisar(personaId, `${detalle} Revisa tus clases en «Mi horario».`, "/docente/horario");
    }
    for (const [personaId, hijos] of familias.apoderados) {
      avisar(personaId, `${detalle} Es el horario de ${hijos.join(" y ")}.`, "/apoderado/horario");
    }
    for (const personaId of familias.alumnos.keys()) {
      avisar(personaId, `${detalle} Revisa tus clases en «Mi horario».`, "/alumno/horario");
    }
    const correos = contactos.map((c) => ({
      para: c.email,
      asunto: `Kubo · ${titulo}`,
      texto:
        `Hola, ${c.nombres}:\n\n` +
        `El horario de ${p.seccion} del año ${p.anio} ${hecho} (versión ${p.version}). ` +
        "Ingresa a Kubo para revisar tus clases en «Mi horario».\n\n" +
        "Este es un mensaje automático: no lo respondas.",
    }));
    return { notificaciones, correos };
  } catch (e) {
    logger.warn("No se pudo preparar el aviso del horario publicado", {
      requestId: meta.requestId,
      error: (e as Error).message,
    });
    return { notificaciones: [], correos: [] };
  }
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
  const familias = await familiasDeSeccion(seccionId, meta);
  const resultado = await prisma.$transaction(async (tx) => {
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
    const publicacion: Publicacion = {
      seccion: etiquetaSeccion(seccion),
      anio: seccion.anio.anio,
      version: publicado.version,
      esActualizacion: archivar !== null,
      docenteIds: [...new Set(filas.map((f) => f.docenteId))],
    };
    const avisos = await avisosDeHorario(publicacion, familias, meta);
    const correoIds = await registrarAvisos(tx, { ...avisos, origen: { entidad: "horario", id: publicar.id } });
    return { docentes: publicacion.docenteIds.length, correoIds };
  });
  const aviso = { docentes: resultado.docentes, enviados: await despacharCorreos(resultado.correoIds, meta.requestId) };
  return { ...(await obtenerCuadricula(seccionId)), aviso };
}
