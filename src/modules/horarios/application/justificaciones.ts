// horarios/application: justificación de faltas y tardanzas que envía el apoderado (bloque M3, fase 7). Desde la
// asistencia de su hijo (AP-03) el apoderado justifica una falta o tardanza de los últimos 7 días con un motivo y,
// opcional, un PDF o JPG de hasta 5 MB (platform/archivos, área «justificaciones»). El tutor o cotutor la ve en «Mi
// tutoría» y la aprueba (el registro queda justificado en la misma transacción) o la rechaza con motivo; el apoderado
// recibe la notificación en la aplicación. Todo queda en la auditoría.
import {
  guardarArchivo,
  abrirArchivo,
  eliminarArchivo,
  validarArchivo,
  type ArchivoRecibido,
} from "@/platform/archivos";
import { registrarAuditoria } from "@/platform/auditoria";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { esDuplicado } from "@/platform/db/tipos";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { registrarAvisos } from "@/platform/notificaciones";
import { asignacionesDeClases, fechaEnLima, tutoriaDelDocente, type TutoriaDelDocente } from "@/modules/academico";
import { nombresDeUsuarios, resumenEstudiantes } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { datosDeMatriculas, matriculaDelHijo } from "@/modules/matricula";
import { nombreDeLista, type EstadoAsistencia } from "../domain/asistencia";
import { erroresTutoria as E } from "../domain/errores";
import {
  esJustificable,
  estadoJustificado,
  inicioDelPlazoDeJustificacion,
  verificarJustificacionDelApoderado,
  verificarJustificacionPendiente,
  type EstadoJustificacion,
} from "../domain/tutoria";
import { justificaciones, registrosJustificables, type JustificacionFila } from "../infrastructure/justificaciones";
import { aplicarCorreccion } from "./asistencia";

const AREA_JUSTIFICACIONES = "justificaciones";
export const MENSAJE_ARCHIVO_JUSTIFICACION = "El archivo debe ser un PDF o una imagen JPG de hasta 5 MB.";
/** Días hacia atrás de las justificaciones ya revisadas que el tutor sigue viendo. */
const DIAS_DE_REVISADAS = 30;
const MS_POR_DIA = 86_400_000;

/** Nombre del curso de cada asignación. */
async function cursos(asignacionIds: string[]) {
  const a = await asignacionesDeClases([...new Set(asignacionIds)]);
  return new Map(a.map((x) => [x.id, x.curso.nombre]));
}

export interface JustificacionVista {
  id: string;
  registroId: string;
  fecha: string;
  curso: string;
  horaInicio: string;
  /** Estado actual del registro de asistencia. */
  estadoRegistro: EstadoAsistencia;
  motivo: string;
  archivo: { nombre: string; tamanoBytes: number | null } | null;
  estado: EstadoJustificacion;
  enviadaEn: string;
  revisadaEn: string | null;
  motivoRechazo: string | null;
}

function vista(j: JustificacionFila, nombresCurso: Map<string, string>): JustificacionVista {
  return {
    id: j.id,
    registroId: j.registro.id,
    fecha: j.registro.fecha,
    curso: nombresCurso.get(j.registro.asignacionDocenteId) ?? "Clase",
    horaInicio: j.registro.horaInicio,
    estadoRegistro: j.registro.estado,
    motivo: j.motivo,
    archivo: j.archivoClave ? { nombre: j.nombreArchivo ?? "archivo", tamanoBytes: j.tamanoBytes } : null,
    estado: j.estado,
    enviadaEn: j.createdAt.toISOString(),
    revisadaEn: j.revisadaEn?.toISOString() ?? null,
    motivoRechazo: j.motivoRechazo,
  };
}

// ---------- Apoderado ----------

export interface JustificacionesDelHijo {
  /** Primer día que todavía se puede justificar («AAAA-MM-DD»). */
  desde: string;
  hoy: string;
  /** Faltas y tardanzas sin justificar de los últimos 7 días, sin una justificación pendiente. */
  justificables: { registroId: string; fecha: string; curso: string; horaInicio: string; estado: EstadoAsistencia }[];
  enviadas: JustificacionVista[];
}

/** Lo que el apoderado puede justificar de su hijo y lo que ya envió (403 si no es su hijo). */
export async function justificacionesDelHijo(
  auth: Autenticado,
  estudianteId: string,
  ahora: Date = new Date(),
): Promise<JustificacionesDelHijo> {
  const m = await matriculaDelHijo(auth, estudianteId);
  const hoy = fechaEnLima(ahora);
  const desde = inicioDelPlazoDeJustificacion(hoy);
  const [registros, enviadas] = await Promise.all([
    registrosJustificables.deMatricula(m.matriculaId, { fechaInicio: desde, fechaFin: hoy }),
    justificaciones.deMatricula(m.matriculaId),
  ]);
  const nombres = await cursos([
    ...registros.map((r) => r.asignacionDocenteId),
    ...enviadas.map((j) => j.registro.asignacionDocenteId),
  ]);
  const conPendiente = new Set(enviadas.filter((j) => j.estado === "PENDIENTE").map((j) => j.registro.id));
  return {
    desde,
    hoy,
    justificables: registros
      .filter((r) => esJustificable(r.estado) && !conPendiente.has(r.id))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.horaInicio.localeCompare(b.horaInicio))
      .map((r) => ({
        registroId: r.id,
        fecha: r.fecha,
        curso: nombres.get(r.asignacionDocenteId) ?? "Clase",
        horaInicio: r.horaInicio,
        estado: r.estado,
      })),
    enviadas: enviadas.map((j) => vista(j, nombres)),
  };
}

/**
 * El apoderado envía la justificación de una falta o tardanza de su hijo de los últimos 7 días. El archivo se valida
 * por su contenido y se guarda antes de la transacción; si esta falla, se borra del almacén.
 */
export async function enviarJustificacion(
  auth: Autenticado,
  estudianteId: string,
  datos: { registroId: string; motivo: string; archivo: ArchivoRecibido | null },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<JustificacionesDelHijo> {
  const archivo = datos.archivo
    ? validarArchivo(datos.archivo, { permitidos: ["PDF", "JPG"], mensaje: MENSAJE_ARCHIVO_JUSTIFICACION })
    : null;
  const m = await matriculaDelHijo(auth, estudianteId);
  const registro = await registrosJustificables.porId(datos.registroId);
  if (!registro || registro.matriculaId !== m.matriculaId) throw E.registroDeOtroAlumno();
  verificarJustificacionDelApoderado(registro, fechaEnLima(ahora));

  const clave = archivo ? await guardarArchivo(AREA_JUSTIFICACIONES, archivo, meta.requestId) : null;
  try {
    await prisma.$transaction(async (tx) => {
      const { id } = await justificaciones.crear(tx, {
        asistenciaEstudianteId: registro.id,
        presentadaPorId: auth.usuarioId,
        motivo: datos.motivo,
        archivoClave: clave,
        nombreArchivo: archivo?.nombre ?? null,
        mimeType: archivo?.mime ?? null,
        tamanoBytes: archivo?.tamanoBytes ?? null,
      });
      await registrarAuditoria(
        tx,
        {
          usuarioId: auth.usuarioId,
          entidad: "justificacion_asistencia",
          entidadId: id,
          accion: "ENVIAR_JUSTIFICACION",
          nuevo: { registroId: registro.id, matriculaId: m.matriculaId, fecha: registro.fecha, conArchivo: !!clave },
        },
        meta,
      );
    });
  } catch (e) {
    if (clave) await eliminarArchivo(clave, meta.requestId);
    if (esDuplicado(e, "uq_justificacion_pendiente_por_registro")) throw E.justificacionPendiente();
    throw e;
  }
  return justificacionesDelHijo(auth, estudianteId, ahora);
}

// ---------- Tutor ----------

export interface JustificacionDeTutoria extends JustificacionVista {
  matriculaId: string;
  alumno: string;
  presentadaPor: string | null;
}

/** Justificaciones de la sección: las pendientes y las revisadas en los últimos 30 días. */
export async function justificacionesDeTutoria(
  auth: Autenticado,
  seccionId: string,
  ahora: Date = new Date(),
): Promise<{ pendientes: JustificacionDeTutoria[]; revisadas: JustificacionDeTutoria[] }> {
  await tutoriaDelDocente(auth, seccionId);
  const filas = await justificaciones.deSeccion(seccionId, new Date(ahora.getTime() - DIAS_DE_REVISADAS * MS_POR_DIA));
  const [nombres, matriculas, usuarios] = await Promise.all([
    cursos(filas.map((j) => j.registro.asignacionDocenteId)),
    datosDeMatriculas(filas.map((j) => j.registro.matriculaId)),
    nombresDeUsuarios(filas.map((j) => j.presentadaPorId)),
  ]);
  const estudiantes = await resumenEstudiantes(Object.values(matriculas).map((m) => m.estudianteId));
  const lista = filas.map((j): JustificacionDeTutoria => {
    const e = estudiantes[matriculas[j.registro.matriculaId]?.estudianteId];
    return {
      ...vista(j, nombres),
      matriculaId: j.registro.matriculaId,
      alumno: e ? nombreDeLista(e) : "Alumno",
      presentadaPor: usuarios[j.presentadaPorId]?.nombreCompleto ?? null,
    };
  });
  return {
    pendientes: lista.filter((j) => j.estado === "PENDIENTE"),
    revisadas: lista.filter((j) => j.estado !== "PENDIENTE").reverse(),
  };
}

/** Carga la justificación y comprueba que sea de una clase de la sección de la tutoría (403 si no). */
async function justificacionDeLaSeccion(t: TutoriaDelDocente, id: string) {
  const j = await justificaciones.porId(id);
  if (!j) throw E.justificacionNoEncontrada();
  if (j.registro.seccionId !== t.seccion.id) throw E.registroDeOtraSeccion();
  return j;
}

/** Archivo adjunto de una justificación de la sección. */
export async function archivoDeJustificacion(auth: Autenticado, seccionId: string, id: string) {
  const t = await tutoriaDelDocente(auth, seccionId);
  const j = await justificacionDeLaSeccion(t, id);
  if (!j.archivoClave || !j.mimeType) throw errores.noEncontrado("El archivo");
  return {
    flujo: await abrirArchivo(j.archivoClave),
    archivo: { mime: j.mimeType, nombre: j.nombreArchivo ?? "justificacion", tamanoBytes: j.tamanoBytes },
  };
}

/** Notificación al apoderado que envió la justificación, dentro de la transacción de la revisión. */
async function avisarAlApoderado(tx: Tx, j: JustificacionFila, aprobada: boolean, motivoRechazo?: string) {
  const fecha = j.registro.fecha.split("-").reverse().join("/");
  await registrarAvisos(tx, {
    notificaciones: [
      {
        usuarioId: j.presentadaPorId,
        tipo: "ASISTENCIA",
        titulo: aprobada ? "Justificación aprobada" : "Justificación rechazada",
        mensaje: aprobada
          ? `El tutor aprobó la justificación del ${fecha}: el registro quedó como justificado.`
          : `El tutor rechazó la justificación del ${fecha}. Motivo: ${motivoRechazo}`,
        enlace: "/apoderado/asistencia",
      },
    ],
    correos: [],
    origen: { entidad: "justificacion_asistencia", id: j.id },
  });
}

/**
 * Aprueba una justificación pendiente: el registro pasa a falta o tardanza justificada (con la auditoría
 * JUSTIFICAR_ASISTENCIA) y la justificación queda APROBADA, todo en una transacción. Si el tutor ya había justificado
 * el registro, solo se aprueba la justificación.
 */
export async function aprobarJustificacion(
  auth: Autenticado,
  seccionId: string,
  id: string,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
) {
  const t = await tutoriaDelDocente(auth, seccionId);
  const j = await justificacionDeLaSeccion(t, id);
  verificarJustificacionPendiente(j.estado);
  const aprobar = async (tx: Tx) => {
    await justificaciones.bloquearFila(tx, id);
    verificarJustificacionPendiente((await justificaciones.porId(id, tx))!.estado);
    await justificaciones.revisar(tx, id, { estado: "APROBADA", revisadaPorId: auth.usuarioId, revisadaEn: ahora });
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "justificacion_asistencia",
        entidadId: id,
        accion: "APROBAR_JUSTIFICACION",
        anterior: { estado: "PENDIENTE" },
        nuevo: { estado: "APROBADA", registroId: j.registro.id, rol: t.rol },
      },
      meta,
    );
    await avisarAlApoderado(tx, j, true);
  };
  if (esJustificable(j.registro.estado)) {
    await aplicarCorreccion(
      auth,
      j.registro.id,
      { estado: estadoJustificado(j.registro.estado), motivo: `Justificación del apoderado: ${j.motivo}` },
      meta,
      ahora,
      {
        accion: "JUSTIFICAR_ASISTENCIA",
        por: "TUTOR",
        verificar: (sesion) => {
          if (sesion.clase.seccionId !== t.seccion.id) throw E.registroDeOtraSeccion();
        },
        estadoDesde: (actual) => estadoJustificado(actual.estado),
        alGuardar: aprobar,
      },
    );
  } else {
    await prisma.$transaction(aprobar);
  }
  return justificacionesDeTutoria(auth, seccionId, ahora);
}

/** Rechaza una justificación pendiente con motivo; el registro no cambia y el apoderado recibe la notificación. */
export async function rechazarJustificacion(
  auth: Autenticado,
  seccionId: string,
  id: string,
  datos: { motivo: string },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
) {
  const t = await tutoriaDelDocente(auth, seccionId);
  const j = await justificacionDeLaSeccion(t, id);
  await prisma.$transaction(async (tx) => {
    await justificaciones.bloquearFila(tx, id);
    verificarJustificacionPendiente((await justificaciones.porId(id, tx))!.estado);
    await justificaciones.revisar(tx, id, {
      estado: "RECHAZADA",
      revisadaPorId: auth.usuarioId,
      revisadaEn: ahora,
      motivoRechazo: datos.motivo,
    });
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "justificacion_asistencia",
        entidadId: id,
        accion: "RECHAZAR_JUSTIFICACION",
        anterior: { estado: "PENDIENTE" },
        nuevo: { estado: "RECHAZADA", registroId: j.registro.id, rol: t.rol },
        motivo: datos.motivo,
      },
      meta,
    );
    await avisarAlApoderado(tx, j, false, datos.motivo);
  });
  return justificacionesDeTutoria(auth, seccionId, ahora);
}
