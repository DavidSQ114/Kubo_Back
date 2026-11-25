// matricula/application: matrícula en línea del apoderado (bloque M4, fase 6). Desde su portal ve a sus hijos con el
// proceso de matrícula del año, matricula a un hijo sin matrícula activa (datos del alumno confirmados, grado,
// responsable del pago y cada documento requerido en PDF o JPG de hasta 5 MB) y reemplaza los documentos observados.
// La matrícula queda En proceso con la solicitud «Documentos en revisión» y se avisa a los coordinadores. Los archivos
// se guardan en platform/archivos (área «matricula») y solo se descargan por el endpoint con permiso.
import {
  abrirArchivo,
  eliminarArchivo,
  guardarArchivo,
  validarArchivo,
  type ArchivoRecibido,
  type ArchivoValidado,
} from "@/platform/archivos";
import { prisma } from "@/platform/db/prisma";
import { esDuplicado, type Tx } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { registrarAvisos } from "@/platform/notificaciones";
import { fechaEnLima, listarAnios, listarGrados, NOMBRE_ESTADO_ANIO, type AnioVista } from "@/modules/academico";
import { estudianteParaMatricula, estudiantesVinculadosAPersona, personasDeCoordinadores } from "@/modules/comunidad";
import { usuariosDePersonas, type Autenticado } from "@/modules/identidad";
import { erroresMatricula as E } from "../domain/errores";
import { verificarAnioMatriculable, verificarResponsable } from "../domain/matriculas";
import { verificarHijoAutorizado } from "../domain/portalApoderado";
import { estadoProceso, NOMBRE_ESTADO_PROCESO, verificarProcesoAbierto, type EstadoProceso } from "../domain/proceso";
import {
  AREA_DOCUMENTOS_MATRICULA,
  estadoSegunDocumentos,
  MENSAJE_ARCHIVO_MATRICULA,
  NOMBRE_ESTADO_DOCUMENTO,
  NOMBRE_ESTADO_SOLICITUD,
  verificarDocumentosEnviados,
  verificarPuedeMatricular,
  verificarReemplazable,
  verificarSolicitudAbierta,
} from "../domain/solicitudes";
import { procesos, type ProcesoFila } from "../infrastructure/proceso";
import { matriculas } from "../infrastructure/repositorio";
import {
  documentosSubidos,
  matriculaEnProceso,
  solicitudes,
  type ArchivoGuardado,
  type SolicitudFila,
} from "../infrastructure/solicitudes";

const ENTIDAD = "solicitud_matricula";
const ENLACE_COORDINADOR = "/coordinador/solicitudes-matricula";

const reglasArchivo = { permitidos: ["PDF", "JPG"] as const, mensaje: MENSAJE_ARCHIVO_MATRICULA };

// ---------- Año del proceso ----------

const PRIORIDAD_ESTADO: Record<EstadoProceso, number> = { ABIERTO: 0, PROXIMO: 1, CERRADO: 2, SIN_CONFIGURAR: 3 };

/**
 * Año cuyo proceso de matrícula ve el apoderado: el abierto hoy; si no hay, el próximo en abrir; si no, el último que
 * cerró. null si ningún año tiene proceso (o todos están cerrados).
 */
export async function procesoVigente(
  hoy: string,
): Promise<{ anio: AnioVista; proceso: ProcesoFila; estado: EstadoProceso } | null> {
  const anios = (await listarAnios()).filter((a) => a.estado !== "CERRADO");
  const conProceso = (
    await Promise.all(anios.map(async (anio) => ({ anio, proceso: await procesos.delAnio(anio.id) })))
  ).flatMap((x) => (x.proceso ? [{ ...x, proceso: x.proceso, estado: estadoProceso(x.proceso, hoy) }] : []));
  conProceso.sort(
    (a, b) =>
      PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado] ||
      (a.estado === "CERRADO"
        ? b.proceso.fechaFin.localeCompare(a.proceso.fechaFin)
        : a.proceso.fechaInicio.localeCompare(b.proceso.fechaInicio)),
  );
  return conProceso[0] ?? null;
}

// ---------- Vista del apoderado ----------

/** Documentos de la solicitud con el nombre de cada requerido (los activos, con o sin archivo, y los subidos). */
export async function documentosDeSolicitud(s: SolicitudFila) {
  const requeridos = await procesos.todosLosDocumentos(s.procesoId);
  const subidoDe = new Map(s.documentos.map((d) => [d.documentoRequeridoId, d]));
  return requeridos
    .filter((r) => r.activo || subidoDe.has(r.id))
    .map((r) => {
      const d = subidoDe.get(r.id);
      return {
        documentoRequeridoId: r.id,
        nombre: r.nombre,
        obligatorio: r.obligatorio,
        documento: d
          ? {
              documentoId: d.id,
              nombreArchivo: d.nombreArchivo,
              tamanoBytes: d.tamanoBytes,
              estado: d.estado,
              nombreEstado: NOMBRE_ESTADO_DOCUMENTO[d.estado],
              observacion: d.observacion,
              subidoEn: d.subidoEn.toISOString(),
              revisadoEn: d.revisadoEn?.toISOString() ?? null,
            }
          : null,
      };
    });
}

/** Resumen de la solicitud para el apoderado y el coordinador. */
export async function vistaSolicitud(s: SolicitudFila) {
  return {
    solicitudId: s.id,
    matriculaId: s.matriculaId,
    gradoId: s.gradoId,
    estado: s.estado,
    nombreEstado: NOMBRE_ESTADO_SOLICITUD[s.estado],
    enviadaEn: s.enviadaEn.toISOString(),
    documentos: await documentosDeSolicitud(s),
  };
}

/**
 * Pantalla «Matricular» del apoderado: el proceso del año (estado, fechas y documentos), los grados y cada hijo con su
 * situación: si se puede matricular (y por qué no), sus apoderados para elegir el responsable del pago y la solicitud
 * enviada con el estado de cada documento.
 */
export async function matriculaEnLinea(auth: Autenticado) {
  const hoy = fechaEnLima(new Date());
  const [vigente, hijos, grados] = await Promise.all([
    procesoVigente(hoy),
    estudiantesVinculadosAPersona(auth.personaId),
    listarGrados(),
  ]);
  const proceso = vigente && {
    anioId: vigente.anio.id,
    anio: vigente.anio.anio,
    estado: vigente.estado,
    nombreEstado: NOMBRE_ESTADO_PROCESO[vigente.estado],
    fechaInicio: vigente.proceso.fechaInicio,
    fechaFin: vigente.proceso.fechaFin,
    documentos: vigente.proceso.documentos
      .filter((d) => d.activo)
      .map((d) => ({ documentoRequeridoId: d.id, nombre: d.nombre, obligatorio: d.obligatorio })),
  };
  const situacion = await Promise.all(
    hijos.map(async (h) => {
      const [estudiante, m] = await Promise.all([
        estudianteParaMatricula(h.estudianteId),
        vigente ? matriculas.vigente(h.estudianteId, vigente.anio.id) : Promise.resolve(null),
      ]);
      const s = m ? await solicitudes.deMatricula(m.id) : null;
      let motivo: string | null = null;
      try {
        if (!vigente) throw E.matriculaNoConfigurada(new Date().getFullYear());
        verificarProcesoAbierto(vigente.proceso, hoy, vigente.anio.anio);
        verificarAnioMatriculable(vigente.anio, NOMBRE_ESTADO_ANIO[vigente.anio.estado]);
        verificarPuedeMatricular(m && { estado: m.estado, tieneSolicitud: Boolean(s) }, vigente.anio.anio);
      } catch (e) {
        motivo = (e as Error).message;
      }
      return {
        estudianteId: h.estudianteId,
        nombres: h.nombres,
        nombreCompleto: `${h.nombres} ${h.apellidos}`,
        dni: h.dni,
        gradoIngresoId: estudiante?.gradoIngresoId ?? null,
        apoderados: (estudiante?.apoderados ?? []).map((a) => ({
          vinculoId: a.vinculoId,
          nombreCompleto: a.nombreCompleto,
          parentesco: a.parentesco,
          esPrincipal: a.esPrincipal,
        })),
        estadoMatricula: m?.estado ?? null,
        puedeMatricular: motivo === null,
        motivo,
        solicitud: s ? await vistaSolicitud(s) : null,
      };
    }),
  );
  return { hoy, proceso, grados, hijos: situacion };
}

// ---------- Enviar la solicitud ----------

export interface DatosSolicitud {
  gradoId: string;
  vinculoResponsableId: string;
  confirmaDatos: boolean;
  /** Archivo de cada documento requerido, por su id. */
  archivos: Record<string, ArchivoRecibido>;
}

/** El hijo debe estar vinculado a la persona en sesión (403 ESTUDIANTE_NO_VINCULADO). */
async function verificarHijo(auth: Autenticado, estudianteId: string) {
  const hijos = await estudiantesVinculadosAPersona(auth.personaId);
  verificarHijoAutorizado(
    hijos.map((h) => h.estudianteId),
    estudianteId,
  );
  return hijos.find((h) => h.estudianteId === estudianteId)!;
}

/** Guarda los archivos validados; si algo falla después, se borran. */
async function guardarArchivos(
  lista: { documentoRequeridoId: string; archivo: ArchivoValidado }[],
  requestId: string,
): Promise<(ArchivoGuardado & { documentoRequeridoId: string })[]> {
  const guardados: (ArchivoGuardado & { documentoRequeridoId: string })[] = [];
  try {
    for (const { documentoRequeridoId, archivo } of lista) {
      const clave = await guardarArchivo(AREA_DOCUMENTOS_MATRICULA, archivo, requestId);
      guardados.push({
        documentoRequeridoId,
        archivoClave: clave,
        nombreArchivo: archivo.nombre,
        mimeType: archivo.mime,
        tamanoBytes: archivo.tamanoBytes,
      });
    }
    return guardados;
  } catch (e) {
    await Promise.all(guardados.map((g) => eliminarArchivo(g.archivoClave, requestId)));
    throw e;
  }
}

/** Avisos de la campana a los coordinadores académicos (si la consulta falla, la operación sigue sin avisos). */
async function usuariosCoordinadores(): Promise<string[]> {
  try {
    return Object.values(await usuariosDePersonas(await personasDeCoordinadores()));
  } catch {
    return [];
  }
}

async function avisarCoordinadores(tx: Tx, solicitudId: string, titulo: string, mensaje: string) {
  const usuarios = await usuariosCoordinadores();
  await registrarAvisos(tx, {
    notificaciones: usuarios.map((usuarioId) => ({
      usuarioId,
      tipo: "SISTEMA" as const,
      titulo,
      mensaje,
      enlace: `${ENLACE_COORDINADOR}?solicitud=${solicitudId}`,
    })),
    correos: [],
    origen: { entidad: ENTIDAD, id: solicitudId },
  });
}

/**
 * El apoderado matricula a su hijo: con el proceso abierto, el hijo sin matrícula activa (o con el borrador del
 * registro), los datos confirmados, un grado, un responsable del pago vinculado y todos los documentos obligatorios.
 * Crea (o completa) la matrícula En proceso y la solicitud «Documentos en revisión», registra SOLICITAR_MATRICULA y
 * avisa a los coordinadores.
 */
export async function enviarSolicitud(
  auth: Autenticado,
  estudianteId: string,
  datos: DatosSolicitud,
  meta: MetaSolicitud,
) {
  const hijo = await verificarHijo(auth, estudianteId);
  const hoy = fechaEnLima(new Date());
  const vigente = await procesoVigente(hoy);
  if (!vigente) throw E.matriculaNoConfigurada(Number(hoy.slice(0, 4)));
  const { anio, proceso } = vigente;
  verificarProcesoAbierto(proceso, hoy, anio.anio);
  verificarAnioMatriculable(anio, NOMBRE_ESTADO_ANIO[anio.estado]);
  if (!datos.confirmaDatos) throw E.datosNoConfirmados();
  const grado = (await listarGrados()).find((g) => g.id === datos.gradoId);
  if (!grado) throw E.gradoNoValido();
  const estudiante = await estudianteParaMatricula(estudianteId);
  if (!estudiante?.activo) throw E.estudianteNoEncontrado();
  verificarResponsable(
    datos.vinculoResponsableId,
    estudiante.apoderados.map((a) => a.vinculoId),
  );
  const requeridos = proceso.documentos.filter((d) => d.activo);
  verificarDocumentosEnviados(requeridos, Object.keys(datos.archivos));
  const validados = requeridos
    .filter((r) => datos.archivos[r.id])
    .map((r) => ({ documentoRequeridoId: r.id, archivo: validarArchivo(datos.archivos[r.id], reglasArchivo) }));

  const guardados = await guardarArchivos(validados, meta.requestId);
  try {
    const solicitudId = await prisma.$transaction(async (tx) => {
      const actual = await matriculas.vigenteBloqueada(tx, estudianteId, anio.id);
      const conSolicitud = actual ? Boolean(await solicitudes.deMatricula(actual.id, tx)) : false;
      const accion = verificarPuedeMatricular(
        actual && { estado: actual.estado, tieneSolicitud: conSolicitud },
        anio.anio,
      );
      const matriculaId =
        accion === "COMPLETAR"
          ? (await matriculaEnProceso.responsable(tx, actual!.id, datos.vinculoResponsableId)).id
          : (
              await matriculaEnProceso.crear(tx, {
                estudianteId,
                anioAcademicoId: anio.id,
                vinculoResponsableId: datos.vinculoResponsableId,
                registradoPorId: auth.usuarioId,
              })
            ).id;
      const id = await solicitudes.crear(
        tx,
        { matriculaId, procesoId: proceso.id, gradoId: grado.id, creadoPorId: auth.usuarioId },
        guardados,
      );
      await registrarAuditoria(
        tx,
        {
          usuarioId: auth.usuarioId,
          entidad: ENTIDAD,
          entidadId: id,
          accion: "SOLICITAR_MATRICULA",
          nuevo: {
            matriculaId,
            estudianteId,
            anio: anio.anio,
            grado: grado.nombre,
            vinculoResponsableId: datos.vinculoResponsableId,
            documentos: guardados.length,
            borradorCompletado: accion === "COMPLETAR",
          },
        },
        meta,
      );
      await avisarCoordinadores(
        tx,
        id,
        "Nueva solicitud de matrícula",
        `${hijo.nombres} ${hijo.apellidos} · ${grado.nombre} · ${anio.anio} · ${guardados.length} documentos por revisar`,
      );
      return id;
    });
    return vistaSolicitud((await solicitudes.porId(solicitudId))!);
  } catch (e) {
    await Promise.all(guardados.map((g) => eliminarArchivo(g.archivoClave, meta.requestId)));
    if (esDuplicado(e, "uq_matricula_activa_por_anio")) throw E.solicitudExistente(anio.anio);
    throw e;
  }
}

/** Solicitud vigente del hijo en el año del proceso (404 si no la envió). */
async function solicitudDelHijo(estudianteId: string) {
  const vigente = await procesoVigente(fechaEnLima(new Date()));
  const m = vigente ? await matriculas.vigente(estudianteId, vigente.anio.id) : null;
  const s = m ? await solicitudes.deMatricula(m.id) : null;
  if (!s) throw E.solicitudNoEncontrada();
  return s;
}

/**
 * El apoderado reemplaza un documento observado (o sube uno opcional que faltaba). Vuelve a «En revisión», la
 * solicitud recalcula su estado, se registra REEMPLAZAR_DOCUMENTO_MATRICULA y se avisa a los coordinadores. El archivo
 * anterior se borra después de confirmar.
 */
export async function reemplazarDocumento(
  auth: Autenticado,
  estudianteId: string,
  documentoRequeridoId: string,
  archivoRecibido: ArchivoRecibido | null,
  meta: MetaSolicitud,
) {
  const hijo = await verificarHijo(auth, estudianteId);
  if (!archivoRecibido) throw E.documentoFaltante("el documento");
  const s = await solicitudDelHijo(estudianteId);
  const requerido = (await procesos.documentosActivos(s.procesoId)).find((d) => d.id === documentoRequeridoId);
  if (!requerido) throw E.documentoNoRequerido();
  const archivo = validarArchivo(archivoRecibido, reglasArchivo);
  const [guardado] = await guardarArchivos([{ documentoRequeridoId, archivo }], meta.requestId);
  let anterior: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      await solicitudes.bloquear(tx, s.id);
      const actual = (await solicitudes.porId(s.id, tx))!;
      verificarSolicitudAbierta(actual.estado);
      const previo = actual.documentos.find((d) => d.documentoRequeridoId === documentoRequeridoId) ?? null;
      verificarReemplazable(previo?.estado ?? null);
      anterior = previo?.archivoClave ?? null;
      await documentosSubidos.guardar(tx, s.id, documentoRequeridoId, guardado);
      const despues = (await solicitudes.porId(s.id, tx))!;
      const estado = estadoSegunDocumentos(await procesos.documentosActivos(s.procesoId, tx), despues.documentos);
      await solicitudes.cambiarEstado(tx, s.id, estado);
      await registrarAuditoria(
        tx,
        {
          usuarioId: auth.usuarioId,
          entidad: ENTIDAD,
          entidadId: s.id,
          accion: "REEMPLAZAR_DOCUMENTO_MATRICULA",
          anterior: previo ? { estado: previo.estado, observacion: previo.observacion } : undefined,
          nuevo: { documento: requerido.nombre, estado: "EN_REVISION", estadoSolicitud: estado },
        },
        meta,
      );
      await avisarCoordinadores(
        tx,
        s.id,
        "Documento de matrícula reemplazado",
        `${hijo.nombres} ${hijo.apellidos} · ${requerido.nombre} · listo para revisar`,
      );
    });
  } catch (e) {
    await eliminarArchivo(guardado.archivoClave, meta.requestId);
    throw e;
  }
  if (anterior) await eliminarArchivo(anterior, meta.requestId);
  return vistaSolicitud((await solicitudes.porId(s.id))!);
}

// ---------- Descarga con permiso ----------

/**
 * Archivo de un documento de matrícula: lo abre el Coordinador académico o un apoderado vinculado al alumno de la
 * solicitud (403 ESTUDIANTE_NO_VINCULADO para cualquier otro apoderado).
 */
export async function archivoDeDocumentoMatricula(auth: Autenticado, solicitudId: string, documentoId: string) {
  const s = await solicitudes.porId(solicitudId);
  if (!s) throw E.solicitudNoEncontrada();
  if (auth.rol === "APODERADO") await verificarHijo(auth, s.estudianteId);
  const d = s.documentos.find((x) => x.id === documentoId);
  if (!d) throw E.solicitudNoEncontrada();
  return {
    flujo: await abrirArchivo(d.archivoClave),
    archivo: { mime: d.mimeType, nombre: d.nombreArchivo, tamanoBytes: d.tamanoBytes },
  };
}
