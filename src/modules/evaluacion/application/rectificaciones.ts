// evaluacion/application: solicitud de rectificación de nota (US41). El docente la pide desde un registro CERRADO o
// PUBLICADO (DO-04, M-08) y queda «Pendiente de aprobación»; el Administrador la aprueba o la rechaza en «Notas y
// rectificaciones» (AD-15). Al aprobar, en una sola transacción: la nota cambia al valor pedido (el único camino que
// deja pasar tg_nota_registro_cerrado), se recalcula el consolidado del curso del alumno con la versión de la regla
// usada al cerrar y se registra en la bitácora de notas (US03) y en la auditoría general (RF03). La solicitud nueva
// notifica a los administradores y su resolución, al docente, en la misma transacción (US55); el correo sale después.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado, type Tx } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { despacharCorreos, registrarAvisos } from "@/platform/notificaciones";
import {
  asignacionesParaNotas,
  competenciasDelPlan,
  listarAnios,
  type AsignacionParaNotas,
  type CompetenciaDelPlan,
  type ReglaDelBimestre,
} from "@/modules/academico";
import { docentesProviderComunidad, nombresDeUsuarios, resumenEstudiantes } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { datosDeMatriculas } from "@/modules/matricula";
import { administradoresDestinatarios, avisosPara, docenteDestinatario, type Destinatarios } from "./avisos";
import { erroresEvaluacion as E } from "../domain/errores";
import type { EstadoRegistro, LogroNota } from "../domain/notas";
import {
  columnaDeCompetencia,
  columnasDelRegistro,
  esPendiente,
  NOMBRE_ESTADO_SOLICITUD,
  pesosDelCierre,
  verificarResolucion,
  verificarSolicitud,
  verificarValorVigente,
  type CompetenciaDeColumna,
  type EstadoSolicitud,
} from "../domain/rectificacion";
import {
  cierres,
  estadoDeRegistro,
  habilitarRectificacion,
  notas,
  resultados,
  solicitudes,
  type SolicitudFila,
} from "../infrastructure/repositorio";
import { registrarEnBitacora } from "./bitacora";
import { cargarContexto, consolidarAlumno, etiquetaDe, nombreDeLista } from "./registroNotas";

/** El docente ve sus últimas solicitudes; más que esto no cabe en DO-04. */
const LIMITE_SOLICITUDES_DOCENTE = 200;

// ---------- Vista ----------

export interface SolicitudVista {
  id: string;
  estado: EstadoSolicitud;
  /** «Pendiente de aprobación», «Aprobada» o «Rechazada». */
  nombreEstado: string;
  pendiente: boolean;
  asignacionId: string;
  periodoId: string;
  estadoRegistro: EstadoRegistro;
  docente: { id: string; nombre: string; nombreCorto: string };
  anio: number;
  curso: { codigo: string; nombre: string };
  /** «3° B». */
  seccion: string;
  bimestre: { numero: number; nombre: string };
  matriculaId: string;
  /** «Castillo Ramos, Bruno». */
  estudiante: string;
  competencia: { competenciaPlanId: string; columna: string; codigo: string; nombre: string };
  valorAnterior: LogroNota;
  valorSolicitado: LogroNota;
  /** Valor que tiene hoy la nota. */
  valorActual: LogroNota;
  motivo: string;
  motivoRechazo: string | null;
  solicitadoPor: string;
  solicitadoEn: string;
  resueltoPor: string | null;
  resueltoEn: string | null;
  /** La pidió el usuario en sesión: no puede aprobarla ni rechazarla. */
  esPropia: boolean;
}

interface ContextoDeNota {
  nota: { id: string; cierreId: string; matriculaId: string; competenciaPlanId: string; logro: LogroNota };
  cierre: { id: string; estado: EstadoRegistro };
  asignacion: AsignacionParaNotas;
  bimestre: { id: string; numero: number; nombre: string };
  docente: { id: string; nombre: string; nombreCorto: string };
  estudiante: string;
  competencia: CompetenciaDeColumna & { competenciaPlanId: string };
  competencias: CompetenciaDelPlan[];
}

/** Curso, sección, bimestre, docente, estudiante y competencia de cada nota (por id de nota). */
async function contextoDeNotas(notaIds: string[]): Promise<Map<string, ContextoDeNota>> {
  const filas = await notas.porIds([...new Set(notaIds)]);
  if (!filas.length) return new Map();
  const listaCierres = await cierres.porIds([...new Set(filas.map((n) => n.cierreId))]);
  const asignaciones = await asignacionesParaNotas(listaCierres.map((c) => c.asignacionDocenteId));
  const planes = [...new Set(asignaciones.map((a) => a.planEstudioId))];
  const [anios, competenciasPorPlan, matriculas, docentes] = await Promise.all([
    listarAnios(),
    Promise.all(planes.map(async (p) => [p, await competenciasDelPlan(p)] as const)),
    datosDeMatriculas(filas.map((n) => n.matriculaId)),
    docentesProviderComunidad.docentesPorId([...new Set(asignaciones.map((a) => a.docenteId))]),
  ]);
  const estudiantes = await resumenEstudiantes(Object.values(matriculas).map((m) => m.estudianteId));
  const periodos = new Map(anios.flatMap((a) => a.periodos.map((p) => [p.id, p] as const)));
  const planesMapa = new Map(competenciasPorPlan);

  const contexto = new Map<string, ContextoDeNota>();
  for (const n of filas) {
    const cierre = listaCierres.find((c) => c.id === n.cierreId)!;
    const asignacion = asignaciones.find((a) => a.id === cierre.asignacionDocenteId)!;
    const competencias = planesMapa.get(asignacion.planEstudioId)!;
    const docente = docentes.find((d) => d.id === asignacion.docenteId);
    const estudiante = estudiantes[matriculas[n.matriculaId]?.estudianteId ?? ""];
    const periodo = periodos.get(cierre.periodoEvaluacionId)!;
    const columna = columnasDelRegistro(competencias).get(n.competenciaPlanId)!;
    contexto.set(n.id, {
      nota: n,
      cierre: { id: cierre.id, estado: estadoDeRegistro(cierre) },
      asignacion,
      bimestre: { id: periodo.id, numero: periodo.numero, nombre: periodo.nombre },
      docente: {
        id: asignacion.docenteId,
        nombre: docente?.nombreCompleto ?? "Docente",
        nombreCorto: docente?.nombreCorto ?? "Docente",
      },
      estudiante: estudiante ? nombreDeLista(estudiante) : "Estudiante",
      competencia: { ...columna, competenciaPlanId: n.competenciaPlanId },
      competencias,
    });
  }
  return contexto;
}

async function vistas(filas: SolicitudFila[], usuarioId: string): Promise<SolicitudVista[]> {
  const contexto = await contextoDeNotas(filas.map((s) => s.notaId));
  const usuarios = await nombresDeUsuarios(
    filas.flatMap((s) => [s.solicitadoPorId, ...(s.resueltoPorId ? [s.resueltoPorId] : [])]),
  );
  return filas.flatMap((s): SolicitudVista[] => {
    const c = contexto.get(s.notaId);
    if (!c) return [];
    return [
      {
        id: s.id,
        estado: s.estado,
        nombreEstado: NOMBRE_ESTADO_SOLICITUD[s.estado],
        pendiente: esPendiente(s.estado),
        asignacionId: c.asignacion.id,
        periodoId: c.bimestre.id,
        estadoRegistro: c.cierre.estado,
        docente: c.docente,
        anio: c.asignacion.anio.anio,
        curso: { codigo: c.asignacion.curso.codigo, nombre: c.asignacion.curso.nombre },
        seccion: etiquetaDe(c.asignacion.seccion),
        bimestre: { numero: c.bimestre.numero, nombre: c.bimestre.nombre },
        matriculaId: c.nota.matriculaId,
        estudiante: c.estudiante,
        competencia: {
          competenciaPlanId: c.competencia.competenciaPlanId,
          columna: columnaDeCompetencia(c.competencia.columna),
          codigo: c.competencia.codigo,
          nombre: c.competencia.nombre,
        },
        valorAnterior: s.valorAnterior,
        valorSolicitado: s.valorSolicitado,
        valorActual: c.nota.logro,
        motivo: s.motivo,
        motivoRechazo: s.motivoRechazo,
        solicitadoPor: usuarios[s.solicitadoPorId]?.nombreCompleto ?? "Docente",
        solicitadoEn: s.createdAt.toISOString(),
        resueltoPor: s.resueltoPorId ? (usuarios[s.resueltoPorId]?.nombreCompleto ?? null) : null,
        resueltoEn: s.resueltoEn?.toISOString() ?? null,
        esPropia: s.solicitadoPorId === usuarioId,
      },
    ];
  });
}

// ---------- Avisos por correo (nunca revierten la operación) ----------

export interface AvisoRectificacion {
  /** Destinatarios con correo. */
  destinatarios: number;
  enviados: number;
}

/** Notificación y correo a los administradores: hay una solicitud nueva (US41, criterio 1; US55). */
function avisoDeSolicitud(s: SolicitudVista, administradores: Destinatarios) {
  return avisosPara(administradores, {
    tipo: "RECTIFICACION",
    titulo: "Nueva solicitud de rectificación",
    mensaje: `${s.docente.nombreCorto} · ${s.curso.nombre} ${s.seccion} · ${s.competencia.columna}`,
    enlace: "/admin/notas",
    asunto: `Kubo · Solicitud de rectificación de nota (${s.curso.nombre} ${s.seccion})`,
    cuerpo:
      `${s.solicitadoPor} solicitó rectificar una nota del registro cerrado de ${s.curso.nombre} ${s.seccion} ` +
      `(${s.bimestre.nombre} ${s.anio}).\n\n` +
      `Estudiante: ${s.estudiante}\nCompetencia: ${s.competencia.columna} · ${s.competencia.nombre}\n` +
      `Cambio solicitado: ${s.valorAnterior} → ${s.valorSolicitado}\nMotivo: ${s.motivo}\n\n` +
      "La solicitud está «Pendiente de aprobación» en Académico / Notas y rectificaciones.",
  });
}

interface Resolucion {
  estado: "APROBADA" | "RECHAZADA";
  valorAnterior: LogroNota;
  valorSolicitado: LogroNota;
  /** Valor que queda en la nota. */
  valorActual: LogroNota;
  motivoRechazo: string | null;
}

/** Notificación y correo al docente con el resultado: «Aprobada» o «Rechazada» con el motivo (US41, criterio 3). */
function avisoDeResolucion(c: ContextoDeNota, r: Resolucion, docente: Destinatarios) {
  const estado = NOMBRE_ESTADO_SOLICITUD[r.estado];
  const curso = `${c.asignacion.curso.nombre} ${etiquetaDe(c.asignacion.seccion)}`;
  const detalle =
    r.estado === "APROBADA"
      ? `La nota cambió de ${r.valorAnterior} a ${r.valorSolicitado} y se recalculó el logro del curso.`
      : `Motivo del rechazo: ${r.motivoRechazo}\n\nLa nota no se modificó: sigue en ${r.valorActual}.`;
  return avisosPara(docente, {
    tipo: "RECTIFICACION",
    titulo: `Rectificación ${estado.toLowerCase()}`,
    mensaje:
      `${curso} · ${c.estudiante} · ${c.competencia.columna}: ${r.valorAnterior} → ${r.valorSolicitado}` +
      (r.estado === "RECHAZADA" ? ` · Motivo: ${r.motivoRechazo}` : ""),
    enlace: "/docente/notas",
    asunto: `Kubo · Solicitud de rectificación ${estado.toLowerCase()} (${curso})`,
    cuerpo:
      `Tu solicitud de rectificación de la nota de ${c.estudiante} en ${c.competencia.columna} · ` +
      `${c.competencia.nombre} (${curso}, ${c.bimestre.nombre} ${c.asignacion.anio.anio}) está «${estado}».` +
      `\n\n${detalle}`,
  });
}

// ---------- Docente: solicitar y ver sus solicitudes ----------

export interface DatosSolicitud {
  matriculaId: string;
  competenciaPlanId: string;
  valorCorrecto: LogroNota;
  motivo: string;
}

export interface SolicitudCreada {
  solicitud: SolicitudVista;
  aviso: AvisoRectificacion;
}

/**
 * Solicitud de rectificación de una nota de un registro CERRADO o PUBLICADO del docente en sesión (US41, criterio 1).
 * Un curso o una sección de otro docente responde 403 (como el registro de notas). Queda «Pendiente de aprobación» y,
 * en la misma transacción, se notifica a los administradores (US55); si el correo falla, la solicitud se conserva.
 */
export async function solicitarRectificacion(
  auth: Autenticado,
  asignacionId: string,
  periodoId: string,
  datos: DatosSolicitud,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<SolicitudCreada> {
  const { asignacion, bimestre } = await cargarContexto(auth, asignacionId, periodoId, ahora);
  const cierre = await cierres.de(asignacion.id, bimestre.id);
  if (!cierre) throw E.registroAbierto();
  const nota = await notas.deCelda(cierre.id, datos.matriculaId, datos.competenciaPlanId);
  verificarSolicitud({
    estadoRegistro: estadoDeRegistro(cierre),
    logroActual: nota?.logro ?? null,
    valorCorrecto: datos.valorCorrecto,
    hayPendiente: nota ? await solicitudes.hayPendiente(nota.id) : false,
  });
  const administradores = await administradoresDestinatarios(meta);
  const creada = await prisma.$transaction(async (tx) => {
    let fila: SolicitudFila;
    try {
      fila = await solicitudes.crear(
        {
          notaId: nota!.id,
          valorAnterior: nota!.logro,
          valorSolicitado: datos.valorCorrecto,
          motivo: datos.motivo,
          solicitadoPorId: auth.usuarioId,
        },
        tx,
      );
    } catch (e) {
      // dos solicitudes a la vez para la misma nota: el índice parcial deja pasar solo una
      if (esDuplicado(e, "uq_solicitud_rectificacion_pendiente_por_nota")) throw E.rectificacionPendiente();
      throw e;
    }
    const [vista] = await vistas([fila], auth.usuarioId);
    const correoIds = await registrarAvisos(tx, {
      ...avisoDeSolicitud(vista, administradores),
      origen: { entidad: "solicitud_rectificacion", id: fila.id },
    });
    return { solicitud: vista, correoIds };
  });
  const enviados = await despacharCorreos(creada.correoIds, meta.requestId);
  return { solicitud: creada.solicitud, aviso: { destinatarios: administradores.contactos.length, enviados } };
}

/** Solicitudes que pidió el docente en sesión con su estado (DO-04), de la más reciente a la más antigua. */
export async function misRectificaciones(auth: Autenticado): Promise<SolicitudVista[]> {
  const docente = await docentesProviderComunidad.docentePorPersona(auth.personaId);
  if (!docente) throw errores.accesoDenegado();
  return vistas(await solicitudes.delSolicitante(auth.usuarioId, LIMITE_SOLICITUDES_DOCENTE), auth.usuarioId);
}

// ---------- Administrador: bandeja, aprobar y rechazar ----------

export interface FiltroBandeja {
  estado: "PENDIENTES" | "RESUELTAS";
  pagina: number;
  tamano: number;
}

/** Bandeja de AD-15 «Solicitudes de rectificación»: pendientes (las más antiguas primero) o resueltas. */
export async function bandejaRectificaciones(auth: Autenticado, f: FiltroBandeja) {
  const [{ items, total }, pendientes] = await Promise.all([
    solicitudes.listar({ pendientes: f.estado === "PENDIENTES", pagina: f.pagina, tamano: f.tamano }),
    solicitudes.contarPendientes(),
  ]);
  return {
    items: await vistas(items, auth.usuarioId),
    pendientes,
    paginacion: { pagina: f.pagina, tamano: f.tamano, total, paginas: Math.ceil(total / f.tamano) },
  };
}

export interface SolicitudResuelta {
  solicitud: SolicitudVista;
  /** Logro consolidado del curso del alumno antes y después (solo al aprobar). */
  consolidado: { anterior: LogroNota | null; nuevo: LogroNota } | null;
  aviso: AvisoRectificacion;
}

/** Solicitud a resolver con todo su contexto; la propia o la ya resuelta se rechazan antes de abrir la transacción. */
async function cargarParaResolver(auth: Autenticado, solicitudId: string) {
  const s = await solicitudes.porId(solicitudId);
  if (!s) throw E.solicitudNoEncontrada();
  verificarResolucion({ estado: s.estado, solicitadoPorId: s.solicitadoPorId, usuarioId: auth.usuarioId });
  const c = (await contextoDeNotas([s.notaId])).get(s.notaId)!;
  const admin = (await nombresDeUsuarios([auth.usuarioId]))[auth.usuarioId]?.nombreCompleto ?? "Administrador";
  return { c, admin };
}

/** Bloquea la solicitud y vuelve a verificarla: de dos aprobaciones (o rechazos) a la vez, solo una se aplica. */
async function bloquearParaResolver(tx: Tx, auth: Autenticado, id: string) {
  await solicitudes.bloquearFila(tx, id);
  const s = (await solicitudes.porId(id, tx))!;
  verificarResolucion({ estado: s.estado, solicitadoPorId: s.solicitadoPorId, usuarioId: auth.usuarioId });
  return s;
}

/**
 * Aprueba la rectificación (US41, criterio 2). En una transacción: la nota pasa al valor solicitado, se recalcula el
 * consolidado del curso del alumno con la versión de la regla (y los pesos) que se usaron al cerrar, y el cambio se
 * registra en la bitácora de notas con origen RECTIFICACION y en la auditoría general. Si el registro está PUBLICADO,
 * el apoderado y el alumno ven el valor corregido. Luego avisa al docente.
 */
export async function aprobarRectificacion(
  auth: Autenticado,
  solicitudId: string,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<SolicitudResuelta> {
  const { c, admin } = await cargarParaResolver(auth, solicitudId);
  const docente = await docenteDestinatario(c.docente.id, meta);
  const resultado = await prisma.$transaction(async (tx) => {
    const s = await bloquearParaResolver(tx, auth, solicitudId);
    await cierres.bloquearFila(tx, c.cierre.id);
    const cierre = (await cierres.porId(c.cierre.id, tx))!;
    if (estadoDeRegistro(cierre) === "ABIERTO") throw E.registroAbierto();
    const actual = (await notas.porId(s.notaId, tx))!;
    verificarValorVigente(actual.logro, s.valorAnterior);

    await solicitudes.resolver(tx, s.id, {
      estado: "APROBADA",
      motivoRechazo: null,
      resueltoPorId: auth.usuarioId,
      resueltoEn: ahora,
    });
    // el único camino que el trigger de US40 deja pasar: esta solicitud, ya APROBADA, y exactamente este cambio
    await habilitarRectificacion(tx, s.id);
    await notas.cambiar(tx, s.notaId, {
      logro: s.valorSolicitado,
      logroAnterior: s.valorAnterior,
      modificadoPorId: auth.usuarioId,
    });
    await habilitarRectificacion(tx, null);

    // consolidado del curso del alumno con la versión de la regla usada al cerrar (guardada en su resultado)
    const previo = await resultados.deMatricula(cierre.id, actual.matriculaId, tx);
    const regla = (previo?.detalleCalculo as { regla?: ReglaDelBimestre } | undefined)?.regla;
    if (!previo || !regla) throw E.sinReglaConsolidacion();
    const competencias = pesosDelCierre(
      c.competencias.map((x) => ({
        competenciaPlanId: x.competenciaPlanId,
        codigo: x.codigo,
        nombre: x.nombre,
        orden: x.orden,
        peso: x.peso,
      })),
      previo.detalleCalculo,
    );
    const delAlumno = (await notas.delCierre(cierre.id, tx)).filter((n) => n.matriculaId === actual.matriculaId);
    const r = consolidarAlumno(regla, competencias, delAlumno);
    await resultados.actualizar(tx, cierre.id, actual.matriculaId, {
      logroConsolidado: r.logro,
      detalleCalculo: r.detalle,
    });

    await registrarEnBitacora(
      tx,
      {
        usuarioId: auth.usuarioId,
        usuarioNombre: admin,
        docenteId: c.docente.id,
        docenteNombre: c.docente.nombre,
        anio: c.asignacion.anio.anio,
        curso: { codigo: c.asignacion.curso.codigo, nombre: c.asignacion.curso.nombre },
        seccion: etiquetaDe(c.asignacion.seccion),
        bimestre: { numero: c.bimestre.numero, nombre: c.bimestre.nombre },
        origen: "RECTIFICACION",
        solicitudId: s.id,
      },
      [
        {
          notaId: s.notaId,
          cierreId: cierre.id,
          matriculaId: actual.matriculaId,
          competenciaPlanId: actual.competenciaPlanId,
          anterior: s.valorAnterior,
          nuevo: s.valorSolicitado,
          estudiante: c.estudiante,
          competencia: c.competencia,
        },
      ],
    );
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "nota",
        entidadId: s.notaId,
        accion: "APROBAR_RECTIFICACION_NOTA",
        anterior: { logro: s.valorAnterior, consolidado: previo.logroConsolidado },
        nuevo: {
          logro: s.valorSolicitado,
          consolidado: r.logro,
          solicitudId: s.id,
          anio: c.asignacion.anio.anio,
          curso: c.asignacion.curso.codigo,
          seccion: etiquetaDe(c.asignacion.seccion),
          bimestre: c.bimestre.numero,
          competencia: columnaDeCompetencia(c.competencia.columna),
          estadoRegistro: estadoDeRegistro(cierre),
        },
        motivo: s.motivo,
      },
      meta,
    );
    const correoIds = await registrarAvisos(tx, {
      ...avisoDeResolucion(
        c,
        {
          estado: "APROBADA",
          valorAnterior: s.valorAnterior,
          valorSolicitado: s.valorSolicitado,
          valorActual: s.valorSolicitado,
          motivoRechazo: null,
        },
        docente,
      ),
      origen: { entidad: "solicitud_rectificacion", id: s.id },
    });
    return { consolidado: { anterior: previo.logroConsolidado, nuevo: r.logro }, correoIds };
  });
  const aviso = {
    destinatarios: docente.contactos.length,
    enviados: await despacharCorreos(resultado.correoIds, meta.requestId),
  };
  const [solicitud] = await vistas([(await solicitudes.porId(solicitudId))!], auth.usuarioId);
  return { solicitud, consolidado: resultado.consolidado, aviso };
}

/**
 * Rechaza la rectificación con un motivo obligatorio (US41, criterio 3): la nota no cambia, se registra en la
 * auditoría general y se avisa al docente con el estado «Rechazada» y el motivo.
 */
export async function rechazarRectificacion(
  auth: Autenticado,
  solicitudId: string,
  datos: { motivo: string },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<SolicitudResuelta> {
  const { c } = await cargarParaResolver(auth, solicitudId);
  const docente = await docenteDestinatario(c.docente.id, meta);
  const correoIds = await prisma.$transaction(async (tx) => {
    const s = await bloquearParaResolver(tx, auth, solicitudId);
    await solicitudes.resolver(tx, s.id, {
      estado: "RECHAZADA",
      motivoRechazo: datos.motivo,
      resueltoPorId: auth.usuarioId,
      resueltoEn: ahora,
    });
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "solicitud_rectificacion",
        entidadId: s.id,
        accion: "RECHAZAR_RECTIFICACION_NOTA",
        anterior: { estado: s.estado },
        nuevo: {
          estado: "RECHAZADA",
          notaId: s.notaId,
          valorAnterior: s.valorAnterior,
          valorSolicitado: s.valorSolicitado,
          curso: c.asignacion.curso.codigo,
          seccion: etiquetaDe(c.asignacion.seccion),
          bimestre: c.bimestre.numero,
        },
        motivo: datos.motivo,
      },
      meta,
    );
    const actual = await notas.porId(s.notaId, tx);
    return registrarAvisos(tx, {
      ...avisoDeResolucion(
        c,
        {
          estado: "RECHAZADA",
          valorAnterior: s.valorAnterior,
          valorSolicitado: s.valorSolicitado,
          valorActual: actual?.logro ?? s.valorAnterior,
          motivoRechazo: datos.motivo,
        },
        docente,
      ),
      origen: { entidad: "solicitud_rectificacion", id: s.id },
    });
  });
  const aviso = {
    destinatarios: docente.contactos.length,
    enviados: await despacharCorreos(correoIds, meta.requestId),
  };
  const [solicitud] = await vistas([(await solicitudes.porId(solicitudId))!], auth.usuarioId);
  return { solicitud, consolidado: null, aviso };
}
