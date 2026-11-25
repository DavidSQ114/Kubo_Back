// evaluacion/application: registro de notas cualitativas del docente (US37, DO-04) con las evidencias de cada
// calificación (US38), cierre y consolidación del bimestre (US39, M-10) y bloqueo del registro cerrado (US40). El docente sale de la sesión, nunca de la URL: un curso
// o una sección de otro docente responde 403. El registro de un curso y sección en un bimestre es cierre_calificacion.
// Cada nota guardada queda en la bitácora de notas (US03) en la misma transacción. Bloque M2: una competencia con ítems
// de evaluación muestra sus ítems y la calificación de cada alumno; su nota se calcula al guardar (recalculoItems).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { despacharCorreos, registrarAvisos } from "@/platform/notificaciones";
import {
  asignacionParaNotas,
  competenciasDelPlan,
  consolidarLogro,
  fechaEnLima,
  listarAsignaciones,
  listarAnios,
  reglaDelBimestre,
  verificarCompetenciasConfiguradas,
  type AsignacionParaNotas,
  type AnioVista,
  type ReglaDelBimestre,
} from "@/modules/academico";
import { docentesProviderComunidad, nombresDeUsuarios, resumenEstudiantes } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { datosDeMatriculas, matriculasDeSeccionEnFecha } from "@/modules/matricula";
import { coordinadoresDestinatarios, avisosPara, type Destinatarios } from "./avisos";
import { erroresEvaluacion as E, type Pendiente } from "../domain/errores";
import {
  avanceDelRegistro,
  cambiosDeNotas,
  entradaDeConsolidacion,
  esBimestreActivo,
  pendientesDelRegistro,
  situacionDelRegistro,
  verificarCeldas,
  verificarCompletitud,
  verificarEditable,
  type AlumnoDelRegistro,
  type AvanceDelRegistro,
  type BimestreDeNotas,
  type EstadoRegistro,
  type LogroNota,
  type NotaPedida,
  type SituacionDelRegistro,
} from "../domain/notas";
import { evidenciasPorNota, type EvidenciaVista } from "../domain/evidencias";
import {
  cambiosDeCalificaciones,
  notaDeItems,
  pesosCompletos,
  recalcularNotas,
  sumaDePesos,
  verificarCalificaciones,
  verificarSinItems,
  type CalificacionPedida,
  type MotivoSinNota,
} from "../domain/items";
import { columnasDelRegistro } from "../domain/rectificacion";
import {
  calificacionesItem,
  cierres,
  estadoDeRegistro,
  evidencias,
  itemsEvaluacion,
  notas,
  resultados,
  type NotaFila,
} from "../infrastructure/repositorio";
import { registrarEnBitacora, type CambioDeNota } from "./bitacora";
import {
  aplicarRecalculo,
  calcularNotaDeItems,
  eliminarArchivosHuerfanos,
  type ResumenRecalculo,
} from "./recalculoItems";
import { vistaDeEvidencia } from "./vistaEvidencias";

// ---------- Vistas ----------

export interface BimestreVista extends BimestreDeNotas {
  /** Hoy (en Lima) se califica en este bimestre. */
  activo: boolean;
}

export interface CursoDelDocente {
  asignacionId: string;
  curso: { id: string; codigo: string; nombre: string };
  grado: { id: string; numero: number; nombre: string };
  seccion: { id: string; nombre: string };
  /** «3° B». */
  etiqueta: string;
  /** Estado del registro en cada bimestre, por id de bimestre. */
  estados: Record<string, EstadoRegistro>;
}

export interface MisRegistros {
  anio: { id: string; anio: number; estado: string } | null;
  bimestres: BimestreVista[];
  /** Bimestre que se califica hoy; null fuera de los bimestres o sin año en curso. */
  bimestreActivoId: string | null;
  cursos: CursoDelDocente[];
}

export interface NotaVista {
  logro: LogroNota;
  /** Logro antes del último cambio, quién lo cambió y cuándo (US37). */
  logroAnterior: LogroNota | null;
  registradoPor: string | null;
  registradoEn: string;
  modificadoPor: string | null;
  modificadoEn: string | null;
  /** Evidencias de la calificación (US38): la celda muestra el ícono con su número. */
  evidencias: EvidenciaVista[];
}

export interface AlumnoDeRegistro {
  matriculaId: string;
  /** «Castillo Ramos, Bruno». */
  nombre: string;
  /** Notas por id de competencia del plan; las que faltan no aparecen. */
  notas: Record<string, NotaVista>;
  /** Todas sus competencias calificadas. */
  completo: boolean;
  /** Calificación de cada ítem de evaluación, por id de ítem (bloque M2). */
  calificaciones: Record<string, LogroNota>;
  /** Competencias con ítems en las que el alumno no tiene nota, con el porqué (bloque M2), por id de competencia. */
  sinNota: Record<string, { motivo: MotivoSinNota; mensaje: string }>;
  /**
   * Logro consolidado del curso: el guardado al cerrar o, en un registro abierto y completo, el que resultaría con
   * la regla que rige en el bimestre (vista previa). null si aún le faltan competencias.
   */
  consolidado: LogroNota | null;
}

export interface RegistroDeNotas extends SituacionDelRegistro {
  asignacionId: string;
  curso: { id: string; codigo: string; nombre: string };
  seccion: { id: string; nombre: string; etiqueta: string };
  anio: { id: string; anio: number };
  bimestre: BimestreVista;
  estado: EstadoRegistro;
  cerradoEn: string | null;
  cerradoPor: string | null;
  /** Versión de la regla de consolidación: la usada al cerrar o la que rige en el bimestre (US12). */
  regla: Omit<ReglaDelBimestre, "id"> | null;
  competencias: {
    competenciaPlanId: string;
    codigo: string;
    nombre: string;
    orden: number;
    peso: number | null;
    /** Ítems de evaluación de la competencia en este registro (bloque M2); vacío: se califica directo. */
    items: ItemVista[];
    /** Suma de los pesos de sus ítems y si es 100 (con ítems, su nota solo se calcula si lo es). */
    sumaPesos: number;
    pesosCompletos: boolean;
  }[];
  alumnos: AlumnoDeRegistro[];
  avance: AvanceDelRegistro;
  pendientes: Pendiente[];
}

export interface ItemVista {
  id: string;
  nombre: string;
  peso: number;
  orden: number;
  /** Alumnos con este ítem calificado: al eliminarlo, se pide confirmación. */
  calificaciones: number;
}

export const etiquetaDe = (s: { nombre: string; grado: { numero: number } }) => `${s.grado.numero}° ${s.nombre}`;
export const nombreDeLista = (p: { nombres: string; apellidos: string }) => `${p.apellidos}, ${p.nombres}`;

async function docenteEnSesion(auth: Autenticado) {
  const docente = await docentesProviderComunidad.docentePorPersona(auth.personaId);
  if (!docente) throw errores.accesoDenegado();
  return docente;
}

function bimestresDe(anio: AnioVista, hoy: string): BimestreVista[] {
  return [...anio.periodos]
    .sort((a, b) => a.numero - b.numero)
    .map((p) => {
      const b = {
        id: p.id,
        numero: p.numero,
        nombre: p.nombre,
        fechaInicio: p.fechaInicio,
        fechaFin: p.fechaFin,
        estado: p.estado,
      };
      return { ...b, activo: esBimestreActivo(b, anio.estado, hoy) };
    });
}

/** Asignación del docente en sesión y el bimestre pedido, que debe ser de su mismo año. */
export async function cargarContexto(auth: Autenticado, asignacionId: string, periodoId: string, ahora: Date) {
  const docente = await docenteEnSesion(auth);
  const asignacion = await asignacionParaNotas(asignacionId);
  if (!asignacion) throw errores.noEncontrado("El curso");
  // un curso o una sección ajena (o una asignación que ya no está activa) no se ve ni se califica
  if (asignacion.docenteId !== docente.id || !asignacion.activo) throw errores.accesoDenegado();
  const anio = (await listarAnios()).find((a) => a.id === asignacion.anio.id)!;
  const bimestre = bimestresDe(anio, fechaEnLima(ahora)).find((b) => b.id === periodoId);
  if (!bimestre) throw E.bimestreAjeno();
  return { asignacion, bimestre, docente };
}

/**
 * Alumnos del registro: en uno cerrado, los que se consolidaron; en uno abierto, los que hoy tienen matrícula
 * vigente (MATRICULADO) en la sección, por apellido. Un alumno trasladado o retirado sale de la lista, pero sus
 * notas se conservan.
 */
export async function alumnosDelRegistro(seccionId: string, cerrados: string[] | null, hoy: string) {
  let ids = cerrados;
  if (!ids) {
    const enSeccion = await matriculasDeSeccionEnFecha(seccionId, hoy);
    const datos = Object.values(await datosDeMatriculas(enSeccion));
    ids = datos.filter((m) => m.estado === "MATRICULADO").map((m) => m.matriculaId);
  }
  const datos = Object.values(await datosDeMatriculas(ids));
  const estudiantes = await resumenEstudiantes(datos.map((m) => m.estudianteId));
  return datos
    .flatMap((m): AlumnoDelRegistro[] => {
      const e = estudiantes[m.estudianteId];
      return e ? [{ matriculaId: m.matriculaId, nombre: nombreDeLista(e), dni: e.dni }] : [];
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

type CompetenciaVista = Pick<
  RegistroDeNotas["competencias"][number],
  "competenciaPlanId" | "codigo" | "nombre" | "orden" | "peso"
>;

/** Logro consolidado de un alumno con la regla del bimestre (US12) y el detalle que se guarda con él. */
export function consolidarAlumno(
  regla: ReglaDelBimestre,
  competencias: CompetenciaVista[],
  delAlumno: Pick<NotaFila, "competenciaPlanId" | "logro" | "createdAt" | "modificadoEn">[],
) {
  const entrada = entradaDeConsolidacion(
    competencias,
    delAlumno.map((n) => ({
      competenciaPlanId: n.competenciaPlanId,
      logro: n.logro,
      fecha: n.modificadoEn ?? n.createdAt,
    })),
  );
  const logro = consolidarLogro(entrada.logros, regla, entrada.pesos);
  return {
    logro,
    detalle: {
      regla: {
        id: regla.id,
        version: regla.version,
        nombre: regla.nombre,
        metodo: regla.metodo,
        criterioDesempate: regla.criterioDesempate,
      },
      logros: entrada.detalle,
    },
  };
}

/** Vista previa del consolidado de un registro abierto; si los pesos no permiten calcularlo, no se muestra. */
function vistaPrevia(regla: ReglaDelBimestre | null, competencias: CompetenciaVista[], delAlumno: NotaFila[]) {
  if (!regla || delAlumno.length < competencias.length) return null;
  try {
    return consolidarAlumno(regla, competencias, delAlumno).logro;
  } catch {
    return null;
  }
}

export async function armarRegistro(
  asignacion: AsignacionParaNotas,
  bimestre: BimestreVista,
  ahora: Date,
): Promise<RegistroDeNotas> {
  const [cierre, lista] = await Promise.all([
    cierres.de(asignacion.id, bimestre.id),
    competenciasDelPlan(asignacion.planEstudioId),
  ]);
  const estado = estadoDeRegistro(cierre);
  const cerrado = estado !== "ABIERTO";
  const [guardadas, consolidados, delCierre, items, calificaciones] = cierre
    ? await Promise.all([
        notas.delCierre(cierre.id),
        cerrado ? resultados.delCierre(cierre.id) : [],
        evidencias.delCierre(cierre.id),
        itemsEvaluacion.delCierre(cierre.id),
        calificacionesItem.delCierre(cierre.id),
      ])
    : [[], [], [], [], []];
  const evidenciasDe = evidenciasPorNota(delCierre);
  const itemsDe = (competenciaPlanId: string) => items.filter((i) => i.competenciaPlanId === competenciaPlanId);
  const competencias = [...lista]
    .sort((a, b) => a.orden - b.orden)
    .map((c) => {
      const propios = itemsDe(c.competenciaPlanId);
      return {
        competenciaPlanId: c.competenciaPlanId,
        codigo: c.codigo,
        nombre: c.nombre,
        orden: c.orden,
        peso: c.peso,
        items: propios.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          peso: i.peso,
          orden: i.orden,
          calificaciones: calificaciones.filter((x) => x.itemId === i.id).length,
        })),
        sumaPesos: sumaDePesos(propios.map((i) => i.peso)),
        pesosCompletos: pesosCompletos(propios.map((i) => i.peso)),
      };
    });
  const alumnos = await alumnosDelRegistro(
    asignacion.seccion.id,
    cerrado ? consolidados.map((r) => r.matriculaId) : null,
    fechaEnLima(ahora),
  );
  const regla = await reglaDelBimestre(asignacion.anio.id, bimestre.numero);
  // en un registro cerrado, la versión que se usó al cerrar (guardada en el cierre y en cada resultado)
  const reglaUsada = cerrado
    ? ((consolidados[0]?.detalleCalculo as { regla?: ReglaDelBimestre } | undefined)?.regla ?? regla)
    : regla;
  const usuarios = await nombresDeUsuarios([
    ...guardadas.flatMap((n) => [n.registradoPorId, ...(n.modificadoPorId ? [n.modificadoPorId] : [])]),
    ...(cierre?.cerradoPorId ? [cierre.cerradoPorId] : []),
  ]);

  const vistaAlumnos = alumnos.map((a): AlumnoDeRegistro => {
    const delAlumno = guardadas.filter((n) => n.matriculaId === a.matriculaId);
    const porCompetencia = Object.fromEntries(
      delAlumno.map((n): [string, NotaVista] => [
        n.competenciaPlanId,
        {
          logro: n.logro,
          logroAnterior: n.logroAnterior,
          registradoPor: usuarios[n.registradoPorId]?.nombreCorto ?? null,
          registradoEn: n.createdAt.toISOString(),
          modificadoPor: n.modificadoPorId ? (usuarios[n.modificadoPorId]?.nombreCorto ?? null) : null,
          modificadoEn: n.modificadoEn?.toISOString() ?? null,
          evidencias: (evidenciasDe.get(n.id) ?? []).map(vistaDeEvidencia),
        },
      ]),
    );
    const completo = competencias.every((c) => porCompetencia[c.competenciaPlanId]);
    const delAlumnoItems = new Map(
      calificaciones.filter((x) => x.matriculaId === a.matriculaId).map((x) => [x.itemId, x.valor] as const),
    );
    const sinNota = Object.fromEntries(
      competencias.flatMap((c) => {
        if (!c.items.length || porCompetencia[c.competenciaPlanId]) return [];
        const r = notaDeItems(c.items, delAlumnoItems, calcularNotaDeItems);
        return r.estado === "SIN_NOTA" ? [[c.competenciaPlanId, { motivo: r.motivo, mensaje: r.mensaje }]] : [];
      }),
    );
    return {
      matriculaId: a.matriculaId,
      nombre: a.nombre,
      notas: porCompetencia,
      calificaciones: Object.fromEntries(delAlumnoItems),
      sinNota,
      completo,
      consolidado: cerrado
        ? (consolidados.find((r) => r.matriculaId === a.matriculaId)?.logroConsolidado ?? null)
        : completo
          ? vistaPrevia(regla, competencias, delAlumno)
          : null,
    };
  });

  return {
    asignacionId: asignacion.id,
    curso: asignacion.curso,
    seccion: { id: asignacion.seccion.id, nombre: asignacion.seccion.nombre, etiqueta: etiquetaDe(asignacion.seccion) },
    anio: { id: asignacion.anio.id, anio: asignacion.anio.anio },
    bimestre,
    estado,
    ...situacionDelRegistro(estado, bimestre.activo),
    cerradoEn: cierre?.cerradoEn?.toISOString() ?? null,
    cerradoPor: cierre?.cerradoPorId ? (usuarios[cierre.cerradoPorId]?.nombreCorto ?? null) : null,
    regla: reglaUsada
      ? {
          version: reglaUsada.version,
          nombre: reglaUsada.nombre,
          metodo: reglaUsada.metodo,
          criterioDesempate: reglaUsada.criterioDesempate,
        }
      : null,
    competencias,
    alumnos: vistaAlumnos,
    avance: avanceDelRegistro(alumnos, competencias, guardadas),
    pendientes: cerrado ? [] : pendientesDelRegistro(alumnos, competencias, guardadas),
  };
}

/**
 * Registro cerrado o publicado de cualquier docente, en solo lectura, para que el Administrador lo revise antes de
 * publicarlo (US39, criterio 4; AD-15 «Ver»). Un registro abierto no se muestra aquí: sus notas aún son provisionales.
 */
export async function registroDeCierre(cierreId: string, ahora: Date = new Date()): Promise<RegistroDeNotas> {
  const cierre = await cierres.porId(cierreId);
  if (!cierre || estadoDeRegistro(cierre) === "ABIERTO") throw E.registroNoEncontrado();
  const asignacion = (await asignacionParaNotas(cierre.asignacionDocenteId))!;
  const anio = (await listarAnios()).find((a) => a.id === asignacion.anio.id)!;
  const bimestre = bimestresDe(anio, fechaEnLima(ahora)).find((b) => b.id === cierre.periodoEvaluacionId)!;
  return armarRegistro(asignacion, bimestre, ahora);
}

// ---------- US37 · Mis registros y registro de notas ----------

/**
 * Cursos y secciones del docente en sesión (solo los suyos) en el año en curso o, si no hay, en su año más reciente,
 * con los bimestres del año y el estado de cada registro (pestañas de DO-04).
 */
export async function misRegistros(auth: Autenticado, ahora: Date = new Date()): Promise<MisRegistros> {
  const docente = await docenteEnSesion(auth);
  const [asignaciones, anios] = await Promise.all([listarAsignaciones(docente.id), listarAnios()]);
  const conCursos = anios.filter((a) => asignaciones.some((x) => x.anio.id === a.id));
  const anio = conCursos.find((a) => a.estado === "EN_CURSO") ?? [...conCursos].sort((a, b) => b.anio - a.anio)[0];
  if (!anio) return { anio: null, bimestres: [], bimestreActivoId: null, cursos: [] };

  const bimestres = bimestresDe(anio, fechaEnLima(ahora));
  const delAnio = asignaciones.filter((a) => a.anio.id === anio.id);
  const filas = await cierres.deAsignaciones(delAnio.map((a) => a.id));
  const cursos = delAnio
    .map((a) => ({
      asignacionId: a.id,
      curso: a.curso,
      grado: a.grado,
      seccion: a.seccion,
      etiqueta: etiquetaDe({ nombre: a.seccion.nombre, grado: a.grado }),
      estados: Object.fromEntries(
        bimestres.map((b) => [
          b.id,
          estadoDeRegistro(filas.find((c) => c.asignacionDocenteId === a.id && c.periodoEvaluacionId === b.id) ?? null),
        ]),
      ),
    }))
    .sort(
      (a, b) =>
        a.curso.nombre.localeCompare(b.curso.nombre, "es") ||
        a.grado.numero - b.grado.numero ||
        a.seccion.nombre.localeCompare(b.seccion.nombre, "es"),
    );
  return {
    anio: { id: anio.id, anio: anio.anio, estado: anio.estado },
    bimestres,
    bimestreActivoId: bimestres.find((b) => b.activo)?.id ?? null,
    cursos,
  };
}

/** Grilla de alumnos por competencias de un curso y sección del docente en un bimestre (US37, DO-04). */
export async function registroDeNotas(
  auth: Autenticado,
  asignacionId: string,
  periodoId: string,
  ahora: Date = new Date(),
): Promise<RegistroDeNotas> {
  const { asignacion, bimestre } = await cargarContexto(auth, asignacionId, periodoId, ahora);
  return armarRegistro(asignacion, bimestre, ahora);
}

export interface NotasGuardadas extends RegistroDeNotas {
  guardado: {
    nuevas: number;
    modificadas: number;
    sinCambio: number;
    /** Calificaciones de ítems nuevas y cambiadas, y las notas que se recalcularon con ellas (bloque M2). */
    calificaciones: { nuevas: number; modificadas: number };
    recalculo: ResumenRecalculo;
  };
}

/**
 * Guarda notas del registro: se puede guardar una parte y volver luego (US37). Solo en el bimestre activo y con el
 * registro abierto; cada cambio guarda el logro anterior, quién lo cambió y cuándo. Bloque M2: también guarda
 * calificaciones de ítems y, en la misma transacción, recalcula las notas de las competencias afectadas; una
 * competencia con ítems no recibe nota directa.
 */
export async function guardarNotas(
  auth: Autenticado,
  asignacionId: string,
  periodoId: string,
  datos: { notas: NotaPedida[]; calificaciones?: CalificacionPedida[] },
  ahora: Date = new Date(),
  /** requestId del log al borrar los archivos de evidencias de notas quitadas por el recálculo (bloque M5). */
  requestId: string | null = null,
): Promise<NotasGuardadas> {
  const pedidasItems = datos.calificaciones ?? [];
  const { asignacion, bimestre, docente } = await cargarContexto(auth, asignacionId, periodoId, ahora);
  const actual = await cierres.de(asignacion.id, bimestre.id);
  // registro cerrado (US40) o bimestre no activo (US37): se rechaza aunque la petición no venga de la pantalla
  verificarEditable(situacionDelRegistro(estadoDeRegistro(actual), bimestre.activo));

  const competencias = await competenciasDelPlan(asignacion.planEstudioId);
  verificarCompetenciasConfiguradas(competencias);
  const alumnos = await alumnosDelRegistro(asignacion.seccion.id, null, fechaEnLima(ahora));
  verificarCeldas(datos.notas, alumnos, competencias);
  const regla = await reglaDelBimestre(asignacion.anio.id, bimestre.numero);
  if (!regla) throw E.sinReglaConsolidacion();
  const columnas = columnasDelRegistro(competencias);
  const nombres = new Map(alumnos.map((a) => [a.matriculaId, a.nombre]));
  const cambio = (
    n: { id: string; matriculaId: string; competenciaPlanId: string },
    cierreId: string,
    anterior: LogroNota | null,
    nuevo: LogroNota,
  ): CambioDeNota => ({
    notaId: n.id,
    cierreId,
    matriculaId: n.matriculaId,
    competenciaPlanId: n.competenciaPlanId,
    anterior,
    nuevo,
    estudiante: nombres.get(n.matriculaId)!,
    competencia: columnas.get(n.competenciaPlanId)!,
  });

  const resumen = await prisma.$transaction(async (tx) => {
    const cierre = await cierres.asegurarYBloquear(tx, {
      asignacionDocenteId: asignacion.id,
      periodoEvaluacionId: bimestre.id,
      reglaConsolidacionId: regla.id,
    });
    // otro guardado o un cierre pudo terminar mientras esta transacción esperaba el bloqueo
    verificarEditable(situacionDelRegistro(estadoDeRegistro(cierre), bimestre.activo));
    const items = await itemsEvaluacion.delCierre(cierre.id, tx);
    verificarSinItems(datos.notas, items, columnas);
    verificarCalificaciones(
      pedidasItems,
      items,
      alumnos.map((a) => a.matriculaId),
    );
    const guardadas = await notas.delCierre(cierre.id, tx);
    const cambios = cambiosDeNotas(guardadas, datos.notas);
    const creadas = cambios.nuevas.length ? await notas.crear(tx, cierre.id, cambios.nuevas, auth.usuarioId) : [];
    for (const m of cambios.modificadas) {
      await notas.cambiar(tx, m.id, { logro: m.logro, logroAnterior: m.anterior, modificadoPorId: auth.usuarioId });
    }
    // US03: cada nota nueva o cambiada, con su valor anterior, en la misma transacción
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
    await registrarEnBitacora(tx, { ...contexto, origen: "REGISTRO", solicitudId: null }, [
      ...creadas.map((n) => cambio(n, cierre.id, null, n.logro)),
      ...cambios.modificadas.map((m) =>
        cambio(
          guardadas.find((g) => g.id === m.id)!,
          cierre.id,
          m.anterior,
          m.logro,
        ),
      ),
    ]);

    // Bloque M2: calificaciones de ítems y recálculo de las competencias que tocan
    const deItems = cambiosDeCalificaciones(await calificacionesItem.delCierre(cierre.id, tx), pedidasItems);
    if (deItems.nuevas.length) {
      await calificacionesItem.crear(
        tx,
        deItems.nuevas.map((c) => ({ itemId: c.itemId, matriculaId: c.matriculaId, valor: c.logro })),
        auth.usuarioId,
      );
    }
    for (const m of deItems.modificadas) await calificacionesItem.cambiar(tx, m.id, m.logro, auth.usuarioId);
    const tocadas = new Set(pedidasItems.map((c) => c.itemId));
    const { resumen: recalculo, archivosHuerfanos } = await aplicarRecalculo(tx, {
      cierreId: cierre.id,
      cambios: recalcularNotas({
        competenciaPlanIds: items.filter((i) => tocadas.has(i.id)).map((i) => i.competenciaPlanId),
        items,
        matriculaIds: alumnos.map((a) => a.matriculaId),
        calificaciones: await calificacionesItem.delCierre(cierre.id, tx),
        notas: await notas.delCierre(cierre.id, tx),
        calcular: calcularNotaDeItems,
      }),
      usuarioId: auth.usuarioId,
      contexto,
      nombres,
      columnas,
    });
    return {
      nuevas: cambios.nuevas.length,
      modificadas: cambios.modificadas.length,
      sinCambio: cambios.sinCambio + deItems.sinCambio,
      calificaciones: { nuevas: deItems.nuevas.length, modificadas: deItems.modificadas.length },
      recalculo,
      archivosHuerfanos,
    };
  });
  // los archivos de las evidencias borradas con sus notas, solo después de confirmar la transacción
  const { archivosHuerfanos, ...guardado } = resumen;
  await eliminarArchivosHuerfanos(archivosHuerfanos, requestId ?? "sin-solicitud");
  return { ...(await armarRegistro(asignacion, bimestre, ahora)), guardado };
}

// ---------- US39 · Cierre y consolidación del bimestre ----------

export interface AvisoCierre {
  /** Coordinadores académicos activos con correo. */
  coordinadores: number;
  /** Correos enviados (un fallo del correo no revierte el cierre). */
  enviados: number;
}

export interface RegistroCerrado extends RegistroDeNotas {
  aviso: AvisoCierre;
}

interface Cierre {
  curso: string;
  seccion: string;
  bimestre: string;
  anio: number;
  docente: string;
  estudiantes: number;
}

/** Notificación y correo a los coordinadores académicos: el registro está consolidado y listo para publicar (US39, US55). */
function avisoDeCierre(c: Cierre, destinatarios: Destinatarios) {
  return avisosPara(destinatarios, {
    tipo: "NOTAS",
    titulo: "Registro listo para publicar",
    mensaje: `${c.docente} cerró ${c.curso} ${c.seccion} · ${c.bimestre}`,
    enlace: "/coordinador/notas",
    asunto: `Kubo · Notas consolidadas de ${c.curso} ${c.seccion} (${c.bimestre})`,
    cuerpo:
      `${c.docente} cerró el registro de notas de ${c.curso} ${c.seccion} del ${c.bimestre} ${c.anio}. ` +
      `Se consolidó el logro del curso de ${c.estudiantes} estudiantes y el registro está listo para su ` +
      "publicación a los apoderados.",
  });
}

/**
 * Cierra el registro del bimestre (US39): exige todas las competencias de todos los alumnos; en una transacción
 * calcula el logro consolidado del curso de cada alumno con la versión de la regla que rige en el bimestre (US12),
 * guarda el resultado y la versión usada, y pasa el registro a CERRADO, y notifica a los coordinadores académicos (US55).
 * Luego intenta el correo: si falla, queda en la bandeja de salida sin revertir el cierre.
 */
export async function cerrarRegistro(
  auth: Autenticado,
  asignacionId: string,
  periodoId: string,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<RegistroCerrado> {
  const { asignacion, bimestre } = await cargarContexto(auth, asignacionId, periodoId, ahora);
  verificarEditable(
    situacionDelRegistro(estadoDeRegistro(await cierres.de(asignacion.id, bimestre.id)), bimestre.activo),
  );
  const competencias = await competenciasDelPlan(asignacion.planEstudioId);
  verificarCompetenciasConfiguradas(competencias);
  const alumnos = await alumnosDelRegistro(asignacion.seccion.id, null, fechaEnLima(ahora));
  const regla = await reglaDelBimestre(asignacion.anio.id, bimestre.numero);
  if (!regla) throw E.sinReglaConsolidacion();
  const docente = (await nombresDeUsuarios([auth.usuarioId]))[auth.usuarioId]?.nombreCompleto ?? "El docente";
  const coordinadores = await coordinadoresDestinatarios(meta);

  const correoIds = await prisma.$transaction(async (tx) => {
    const fila = await cierres.de(asignacion.id, bimestre.id, tx);
    // sin notas no hay registro: si hay alumnos, todos están pendientes
    if (!fila) {
      verificarCompletitud(alumnos, competencias, []);
      throw E.sinAlumnos();
    }
    await cierres.bloquearFila(tx, fila.id);
    // dos cierres a la vez: el segundo espera el bloqueo y encuentra el registro ya cerrado
    const bloqueada = (await cierres.de(asignacion.id, bimestre.id, tx))!;
    verificarEditable(situacionDelRegistro(estadoDeRegistro(bloqueada), bimestre.activo));
    const guardadas = await notas.delCierre(fila.id, tx);
    verificarCompletitud(alumnos, competencias, guardadas);

    const calculados = alumnos.map((a) => {
      const r = consolidarAlumno(
        regla,
        competencias,
        guardadas.filter((n) => n.matriculaId === a.matriculaId),
      );
      return { matriculaId: a.matriculaId, logroConsolidado: r.logro, detalleCalculo: r.detalle };
    });
    await resultados.guardar(tx, fila.id, calculados);
    await cierres.cerrar(tx, fila.id, {
      reglaConsolidacionId: regla.id,
      cerradoPorId: auth.usuarioId,
      cerradoEn: ahora,
    });

    const distribucion = { AD: 0, A: 0, B: 0, C: 0 };
    for (const c of calculados) distribucion[c.logroConsolidado] += 1;
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "cierre_calificacion",
        entidadId: fila.id,
        accion: "CERRAR_REGISTRO_NOTAS",
        anterior: { estado: bloqueada.estado },
        nuevo: {
          estado: "CERRADO",
          anio: asignacion.anio.anio,
          curso: asignacion.curso.codigo,
          seccion: etiquetaDe(asignacion.seccion),
          bimestre: bimestre.numero,
          regla: { version: regla.version, metodo: regla.metodo, criterioDesempate: regla.criterioDesempate },
          estudiantes: calculados.length,
          competencias: competencias.length,
          notas: guardadas.length,
          consolidados: distribucion,
        },
      },
      meta,
    );
    const cierre: Cierre = {
      curso: asignacion.curso.nombre,
      seccion: etiquetaDe(asignacion.seccion),
      bimestre: bimestre.nombre,
      anio: asignacion.anio.anio,
      docente,
      estudiantes: calculados.length,
    };
    return registrarAvisos(tx, {
      ...avisoDeCierre(cierre, coordinadores),
      origen: { entidad: "cierre_calificacion", id: fila.id },
    });
  });
  const aviso: AvisoCierre = {
    coordinadores: coordinadores.contactos.length,
    enviados: await despacharCorreos(correoIds, meta.requestId),
  };
  return { ...(await armarRegistro(asignacion, bimestre, ahora)), aviso };
}
