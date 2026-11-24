// evaluacion/application: evidencias pedagógicas (US38, DO-04) y su archivo para el docente, el apoderado y el alumno
// (US47, AP-04 y AL-03). El docente del curso y la sección adjunta a una calificación ya guardada un comentario y/o un
// archivo PDF o JPG de hasta 5 MB, y lo borra mientras el registro esté ABIERTO. El archivo va al almacén de
// platform/archivos (nunca hay URLs públicas): se descarga solo por la API, que valida el permiso en cada pedido.
import { prisma } from "@/platform/db/prisma";
import {
  abrirArchivo,
  eliminarArchivo,
  guardarArchivo,
  validarArchivo,
  type ArchivoRecibido,
} from "@/platform/archivos";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { asignacionParaNotas } from "@/modules/academico";
import { docentesProviderComunidad, estudianteDePersona, estudiantesVinculadosAPersona } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { datosDeMatriculas, restriccionPorDeuda } from "@/modules/matricula";
import { erroresEvaluacion as E } from "../domain/errores";
import {
  AREA_EVIDENCIAS,
  FORMATOS_EVIDENCIA,
  MENSAJE_ARCHIVO_EVIDENCIA,
  normalizarComentario,
  verificarContenidoEvidencia,
  verificarEvidenciasEditables,
  type EvidenciaVista,
} from "../domain/evidencias";
import {
  cierres,
  estadoDeRegistro,
  evidencias,
  notas,
  type EvidenciaConRegistro,
  type EvidenciaFila,
} from "../infrastructure/repositorio";
import { cargarContexto, etiquetaDe, registroDeNotas, type RegistroDeNotas } from "./registroNotas";
import { vistaDeEvidencia } from "./vistaEvidencias";

/** Lo que queda en la auditoría: sin el comentario ni el nombre del archivo (pueden llevar datos personales). */
function resumenParaAuditoria(
  e: EvidenciaFila,
  contexto: { anio: number; curso: string; seccion: string; bimestre: number; competenciaPlanId: string },
) {
  return {
    notaId: e.notaId,
    ...contexto,
    largoComentario: e.comentario ? e.comentario.length : 0,
    archivo: e.archivoClave ? { clave: e.archivoClave, mime: e.mimeType, tamanoBytes: e.tamanoBytes } : null,
  };
}

// ---------- US38 · Adjuntar y eliminar (docente) ----------

export interface DatosEvidencia {
  matriculaId: string;
  competenciaPlanId: string;
  comentario: string | null;
  archivo: ArchivoRecibido | null;
}

export interface EvidenciaAgregada {
  evidencia: EvidenciaVista;
  registro: RegistroDeNotas;
}

/**
 * Adjunta una evidencia a la calificación de un estudiante en una competencia (US38). Primero valida el contenido y el
 * tipo real del archivo; luego, que el registro sea del docente y esté ABIERTO y que la calificación esté guardada.
 * El archivo se guarda antes de la transacción y, si esta falla, se borra del almacén.
 */
export async function agregarEvidencia(
  auth: Autenticado,
  asignacionId: string,
  periodoId: string,
  datos: DatosEvidencia,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<EvidenciaAgregada> {
  const comentario = normalizarComentario(datos.comentario);
  verificarContenidoEvidencia({ comentario, tieneArchivo: !!datos.archivo });
  const archivo = datos.archivo
    ? validarArchivo(datos.archivo, { permitidos: FORMATOS_EVIDENCIA, mensaje: MENSAJE_ARCHIVO_EVIDENCIA })
    : null;

  const { asignacion, bimestre } = await cargarContexto(auth, asignacionId, periodoId, ahora);
  const cierre = await cierres.de(asignacion.id, bimestre.id);
  verificarEvidenciasEditables(estadoDeRegistro(cierre));
  const nota = cierre ? await notas.deCelda(cierre.id, datos.matriculaId, datos.competenciaPlanId) : null;
  if (!cierre || !nota) throw E.notaSinCalificar();

  const clave = archivo ? await guardarArchivo(AREA_EVIDENCIAS, archivo, meta.requestId) : null;
  try {
    const creada = await prisma.$transaction(async (tx) => {
      // un cierre que termina mientras se sube el archivo deja el registro en solo lectura
      await cierres.bloquearFila(tx, cierre.id);
      verificarEvidenciasEditables(estadoDeRegistro(await cierres.porId(cierre.id, tx)));
      const fila = await evidencias.crear(tx, {
        notaId: nota.id,
        comentario,
        archivoClave: clave,
        nombreArchivo: archivo?.nombre ?? null,
        mimeType: archivo?.mime ?? null,
        tamanoBytes: archivo?.tamanoBytes ?? null,
        subidoPorId: auth.usuarioId,
      });
      await registrarAuditoria(
        tx,
        {
          usuarioId: auth.usuarioId,
          entidad: "evidencia_pedagogica",
          entidadId: fila.id,
          accion: "AGREGAR_EVIDENCIA",
          nuevo: resumenParaAuditoria(fila, {
            anio: asignacion.anio.anio,
            curso: asignacion.curso.codigo,
            seccion: etiquetaDe(asignacion.seccion),
            bimestre: bimestre.numero,
            competenciaPlanId: datos.competenciaPlanId,
          }),
        },
        meta,
      );
      return fila;
    });
    return {
      evidencia: vistaDeEvidencia(creada),
      registro: await registroDeNotas(auth, asignacionId, periodoId, ahora),
    };
  } catch (e) {
    if (clave) await eliminarArchivo(clave, meta.requestId);
    throw e;
  }
}

/**
 * Elimina una evidencia del registro (US38) mientras esté ABIERTO. El archivo se borra del almacén después de confirmar
 * la transacción: si el almacén falla, la evidencia ya no existe y la clave queda en el log como huérfana.
 */
export async function eliminarEvidencia(
  auth: Autenticado,
  asignacionId: string,
  periodoId: string,
  evidenciaId: string,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<RegistroDeNotas> {
  const { asignacion, bimestre } = await cargarContexto(auth, asignacionId, periodoId, ahora);
  const cierre = await cierres.de(asignacion.id, bimestre.id);
  const evidencia = await evidencias.conRegistro(evidenciaId);
  if (!cierre || !evidencia || evidencia.cierreId !== cierre.id) throw E.evidenciaNoEncontrada();
  verificarEvidenciasEditables(estadoDeRegistro(cierre));

  await prisma.$transaction(async (tx) => {
    await cierres.bloquearFila(tx, cierre.id);
    verificarEvidenciasEditables(estadoDeRegistro(await cierres.porId(cierre.id, tx)));
    await evidencias.eliminar(tx, evidencia.id);
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "evidencia_pedagogica",
        entidadId: evidencia.id,
        accion: "ELIMINAR_EVIDENCIA",
        anterior: resumenParaAuditoria(evidencia, {
          anio: asignacion.anio.anio,
          curso: asignacion.curso.codigo,
          seccion: etiquetaDe(asignacion.seccion),
          bimestre: bimestre.numero,
          competenciaPlanId: evidencia.competenciaPlanId,
        }),
      },
      meta,
    );
  });
  if (evidencia.archivoClave) await eliminarArchivo(evidencia.archivoClave, meta.requestId);
  return registroDeNotas(auth, asignacionId, periodoId, ahora);
}

// ---------- US38 y US47 · Archivo de la evidencia ----------

/** Docente: solo el asignado al curso y la sección del registro, en cualquier estado del registro. */
async function puedeVerDocente(auth: Autenticado, e: EvidenciaConRegistro) {
  const [docente, asignacion] = await Promise.all([
    docentesProviderComunidad.docentePorPersona(auth.personaId),
    asignacionParaNotas(e.asignacionDocenteId),
  ]);
  return !!docente && asignacion?.docenteId === docente.id;
}

/**
 * Apoderado y alumno (US47): solo con el registro PUBLICADO y solo su hijo vinculado o él mismo. El apoderado, además,
 * sin restricción por deuda (US26): 403 LIBRETA_RESTRINGIDA, como su libreta. Al alumno no se le aplica, igual que en
 * «Mis notas» (US51).
 */
async function puedeVerFamilia(auth: Autenticado, e: EvidenciaConRegistro) {
  if (e.estadoCierre !== "PUBLICADO") return false;
  const matricula = (await datosDeMatriculas([e.matriculaId]))[e.matriculaId];
  if (!matricula) return false;
  if (auth.rol === "ALUMNO") {
    return (await estudianteDePersona(auth.personaId))?.estudianteId === matricula.estudianteId;
  }
  const hijos = await estudiantesVinculadosAPersona(auth.personaId);
  if (!hijos.some((h) => h.estudianteId === matricula.estudianteId)) return false;
  const restriccion = await restriccionPorDeuda(matricula.matriculaId, matricula.anioAcademicoId);
  if (restriccion.restringido) throw E.libretaRestringida(restriccion.mensaje!);
  return true;
}

/**
 * Archivo de una evidencia para verlo (JPG o PDF, inline) o descargarlo. A quien no le corresponde (apoderado ajeno,
 * otro alumno, registro sin publicar, curso de otro docente) se le responde 404: no se revela que la evidencia existe.
 */
export async function archivoDeEvidencia(auth: Autenticado, evidenciaId: string) {
  const e = await evidencias.conRegistro(evidenciaId);
  if (!e) throw E.evidenciaNoEncontrada();
  const permitido =
    auth.rol === "DOCENTE"
      ? await puedeVerDocente(auth, e)
      : auth.rol === "APODERADO" || auth.rol === "ALUMNO"
        ? await puedeVerFamilia(auth, e)
        : false;
  if (!permitido || !e.archivoClave || !e.mimeType || !e.nombreArchivo) throw E.evidenciaNoEncontrada();
  return {
    flujo: await abrirArchivo(e.archivoClave),
    archivo: { mime: e.mimeType, nombre: e.nombreArchivo, tamanoBytes: e.tamanoBytes },
  };
}
