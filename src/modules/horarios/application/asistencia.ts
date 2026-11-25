// horarios/application: asistencia de alumnos por sesión de clase. El docente ve sus clases de hoy según el horario
// publicado, abre la sesión y registra la lista (US35, DO-03); puede corregirla dentro del plazo del parámetro
// PLAZO_CORRECCION_ASISTENCIA_H (US36). El administrador corrige fuera de plazo con motivo y auditoría (M-20).
// El docente sale de la sesión, nunca de la URL: una clase o una sesión de otro docente responde 403.
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { parametroNumero } from "@/platform/config/parametros";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { asignacionesDeClases, fechaEnLima, listarAnios } from "@/modules/academico";
import { docentesProviderComunidad, nombresDeUsuarios, resumenEstudiantes } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { datosDeMatriculas, matriculasDeSeccionEnFecha } from "@/modules/matricula";
import {
  bimestreDeReferencia,
  cambiosDeAsistencia,
  dentroDelPlazo,
  diaDeClases,
  edicionDeSesion,
  MENSAJE_SIN_CLASES,
  motivoDiaNoLectivo,
  nombreDeLista,
  resumenDeSesion,
  verificarCorreccion,
  verificarFechaDeRegistro,
  verificarListaCompleta,
  verificarPlazoDeCorreccion,
  type EstadoAsistencia,
  type MarcaDeAsistencia,
  type MotivoSinClases,
  type Rango,
  type ResumenDeSesion,
} from "../domain/asistencia";
import { erroresAsistencia as E } from "../domain/errores";
import type { Dia } from "../domain/tipos";
import {
  asistencias,
  clasesDeSeccion,
  sesiones,
  type RegistroFila,
  type SesionFila,
} from "../infrastructure/asistencia";
import { bloques, clases } from "../infrastructure/repositorio";
import { anioDeAsistencia, leerUmbrales } from "./asistenciaPortales";
import { avisarPorInasistencias, type AvisosEnviados } from "./avisosAsistencia";
import { cargarSeccion, vistasDeClases, type ClaseVista, type DocenteDeClase } from "./cuadricula";

/** Días hacia atrás que el docente ve en «Registros anteriores» (los de más de 24 horas ya son de solo lectura). */
const DIAS_DE_HISTORIAL = 7;
const MS_POR_DIA = 86_400_000;

export const plazoDeCorreccion = () => parametroNumero("PLAZO_CORRECCION_ASISTENCIA_H");

async function docenteEnSesion(auth: Autenticado) {
  const docente = await docentesProviderComunidad.docentePorPersona(auth.personaId);
  if (!docente) throw errores.accesoDenegado();
  return docente;
}

/** Año escolar en curso (a lo más uno), con sus bimestres; null si no hay. */
async function anioEnCurso() {
  return (await listarAnios()).find((a) => a.estado === "EN_CURSO") ?? null;
}

// ---------- Vistas ----------

export interface BloqueDeClase {
  id: string;
  horaInicio: string;
  horaFin: string;
  etiqueta: string;
}

export interface EstadoDeRegistro {
  /** La lista ya se guardó al menos una vez. */
  registrada: boolean;
  registradaEn: string | null;
  /** Hasta cuándo puede corregirla el docente (US36). */
  editableHasta: string | null;
  /** El docente puede guardar ahora: registrar hoy por primera vez o corregir dentro del plazo. */
  editable: boolean;
  /** «El plazo para modificar esta asistencia ha expirado (24 horas)», o por qué no se puede registrar. */
  motivoSoloLectura: string | null;
  /** Contadores de la lista; null si aún no se registra. */
  resumen: ResumenDeSesion | null;
}

export interface SesionVista extends EstadoDeRegistro {
  id: string;
  fecha: string;
  dia: Dia;
  curso: ClaseVista["curso"];
  seccion: ClaseVista["seccion"];
  aula: ClaseVista["aula"];
  docente: DocenteDeClase;
  bloque: BloqueDeClase;
}

export interface AlumnoDeSesion {
  /** Id del registro de asistencia; null si el alumno aún no tiene estado en esta sesión. */
  registroId: string | null;
  matriculaId: string;
  /** «Álvarez Torres, Camila». */
  nombre: string;
  /** Solo en la vista del coordinador académico (M-20). */
  dni: string | null;
  estado: EstadoAsistencia | null;
  observacion: string | null;
  /** Estado que tenía antes de la última corrección, quién la hizo, cuándo y por qué (US36). */
  estadoAnterior: EstadoAsistencia | null;
  registradoPor: string | null;
  registradoEn: string | null;
  modificadoPor: string | null;
  modificadoEn: string | null;
  motivoCambio: string | null;
  /** Faltas sin justificar y tardanzas acumuladas en este curso durante el bimestre (DO-03). */
  faltas: number;
  tardanzas: number;
}

export interface SesionDetalle extends SesionVista {
  plazoHoras: number;
  /** Bimestre al que corresponden los contadores por alumno; null si la fecha no cae en ninguno. */
  bimestre: string | null;
  /** Faltas a partir de las cuales se resalta a un alumno en la lista (UMBRAL_FALTAS_MES). */
  faltasParaResaltar: number;
  /** Alumnos con matrícula vigente en la sección ese día (sin retirados ni anulados), por apellido. */
  alumnos: AlumnoDeSesion[];
}

export function estadoDeRegistro(
  sesion: Pick<SesionFila, "fecha" | "cerradaEn">,
  estados: EstadoAsistencia[] | undefined,
  plazoHoras: number,
  ahora: Date,
): EstadoDeRegistro {
  const e = edicionDeSesion(
    { fecha: sesion.fecha, registradaEn: sesion.cerradaEn },
    plazoHoras,
    ahora,
    fechaEnLima(ahora),
  );
  return {
    registrada: e.registrada,
    registradaEn: sesion.cerradaEn?.toISOString() ?? null,
    editableHasta: e.editableHasta?.toISOString() ?? null,
    editable: e.editable,
    motivoSoloLectura: e.motivoSoloLectura,
    resumen: e.registrada ? resumenDeSesion(estados ?? []) : null,
  };
}

export async function bloquesPorId(ids: string[]): Promise<Map<string, BloqueDeClase & { orden: number }>> {
  const filas = await Promise.all([...new Set(ids)].map((id) => bloques.porId(id)));
  return new Map(
    filas.flatMap((b) =>
      b
        ? [[b.id, { id: b.id, orden: b.orden, horaInicio: b.horaInicio, horaFin: b.horaFin, etiqueta: b.etiqueta }]]
        : [],
    ),
  );
}

export const sinOrden = ({ id, horaInicio, horaFin, etiqueta }: BloqueDeClase): BloqueDeClase => ({
  id,
  horaInicio,
  horaFin,
  etiqueta,
});

/** Sesiones con los nombres de su clase y el estado de su registro, de la más reciente a la más antigua. */
async function vistasDeSesiones(filas: SesionFila[], ahora: Date): Promise<SesionVista[]> {
  if (!filas.length) return [];
  const [vistas, delDia, estados, plazoHoras] = await Promise.all([
    vistasDeClases(filas.map((s) => s.clase)),
    bloquesPorId(filas.map((s) => s.clase.bloqueId)),
    asistencias.estadosDeSesiones(filas.map((s) => s.id)),
    plazoDeCorreccion(),
  ]);
  return filas
    .map((s, i) => {
      const clase = vistas[i];
      return {
        id: s.id,
        fecha: s.fecha,
        dia: s.clase.dia,
        curso: clase.curso,
        seccion: clase.seccion,
        aula: clase.aula,
        docente: clase.docente,
        bloque: sinOrden(delDia.get(s.clase.bloqueId)!),
        ...estadoDeRegistro(s, estados.get(s.id), plazoHoras, ahora),
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.bloque.horaInicio.localeCompare(b.bloque.horaInicio));
}

interface AlumnoDeLista {
  matriculaId: string;
  nombre: string;
  dni: string;
}

/**
 * Lista de la sesión: quienes tenían matrícula vigente en la sección ese día (sin retirados ni anulados, según el
 * historial de secciones) y, en una sesión ya registrada, quienes tienen un registro aunque después se hayan
 * retirado o trasladado.
 */
export async function alumnosDeLista(sesion: SesionFila, registros: RegistroFila[]): Promise<AlumnoDeLista[]> {
  const enFecha = new Set(await matriculasDeSeccionEnFecha(sesion.clase.seccionId, sesion.fecha));
  const conRegistro = new Set(registros.map((r) => r.matriculaId));
  const datos = Object.values(await datosDeMatriculas([...enFecha, ...conRegistro]));
  const deLaLista = datos.filter((m) => conRegistro.has(m.matriculaId) || m.estado === "MATRICULADO");
  const estudiantes = await resumenEstudiantes(deLaLista.map((m) => m.estudianteId));
  return deLaLista
    .flatMap((m) => {
      const e = estudiantes[m.estudianteId];
      return e ? [{ matriculaId: m.matriculaId, nombre: nombreDeLista(e), dni: e.dni }] : [];
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Faltas y tardanzas de cada alumno en este curso durante el bimestre de la sesión, y el nombre del bimestre. */
async function contadoresDelCurso(sesion: SesionFila, matriculaIds: string[]) {
  const seccion = await cargarSeccion(sesion.clase.seccionId);
  const anio = await anioDeAsistencia(seccion.anio.id);
  const bimestre = bimestreDeReferencia(anio.bimestres, sesion.fecha);
  const rango: Rango = bimestre ?? anio;
  // el mismo curso puede estar en varias clases de la semana y en versiones anteriores del horario
  const deLaSeccion = await clasesDeSeccion(sesion.clase.seccionId);
  const asignaciones = await asignacionesDeClases(deLaSeccion.map((c) => c.asignacionDocenteId));
  const cursoDe = (asignacionId: string) => asignaciones.find((a) => a.id === asignacionId)?.curso.id;
  const cursoId = cursoDe(sesion.clase.asignacionDocenteId);
  const delCurso = deLaSeccion.filter((c) => cursoDe(c.asignacionDocenteId) === cursoId).map((c) => c.id);
  return {
    anioId: anio.id,
    bimestre: bimestre?.nombre ?? null,
    contadores: await asistencias.contadores(delCurso, matriculaIds, rango),
  };
}

export async function armarDetalle(
  sesion: SesionFila,
  paraAdministrador: boolean,
  ahora: Date,
): Promise<SesionDetalle> {
  const registros = await asistencias.deSesion(sesion.id);
  const [[vista], lista] = await Promise.all([vistasDeSesiones([sesion], ahora), alumnosDeLista(sesion, registros)]);
  const [{ anioId, bimestre, contadores }, usuarios, plazoHoras] = await Promise.all([
    contadoresDelCurso(
      sesion,
      lista.map((a) => a.matriculaId),
    ),
    nombresDeUsuarios(registros.flatMap((r) => [r.registradoPorId, ...(r.modificadoPorId ? [r.modificadoPorId] : [])])),
    plazoDeCorreccion(),
  ]);
  const alumnos = lista.map((a): AlumnoDeSesion => {
    const r = registros.find((x) => x.matriculaId === a.matriculaId);
    const c = contadores.get(a.matriculaId);
    return {
      registroId: r?.id ?? null,
      matriculaId: a.matriculaId,
      nombre: a.nombre,
      dni: paraAdministrador ? a.dni : null,
      estado: r?.estado ?? null,
      observacion: r?.observacion ?? null,
      estadoAnterior: r?.estadoAnterior ?? null,
      registradoPor: r ? (usuarios[r.registradoPorId]?.nombreCorto ?? null) : null,
      registradoEn: r?.registradoEn.toISOString() ?? null,
      modificadoPor: r?.modificadoPorId ? (usuarios[r.modificadoPorId]?.nombreCorto ?? null) : null,
      modificadoEn: r?.modificadoEn?.toISOString() ?? null,
      motivoCambio: r?.motivoCambio ?? null,
      faltas: c?.faltas ?? 0,
      tardanzas: c?.tardanzas ?? 0,
    };
  });
  return {
    ...vista,
    // el resumen de una sesión sin registrar cuenta a todos como «sin marcar»
    resumen: resumenDeSesion(alumnos.map((a) => a.estado)),
    plazoHoras,
    bimestre,
    faltasParaResaltar: (await leerUmbrales(anioId)).faltasMes,
    alumnos,
  };
}

export async function cargarSesion(sesionId: string): Promise<SesionFila> {
  const sesion = await sesiones.porId(sesionId);
  if (!sesion) throw errores.noEncontrado("La sesión de clase");
  return sesion;
}

// ---------- US35 · Clases de hoy y sesión de clase ----------

export interface ClaseDeHoy {
  /** Id de la clase en el horario publicado: con él se abre la sesión. */
  claseId: string;
  curso: ClaseVista["curso"];
  seccion: ClaseVista["seccion"];
  aula: ClaseVista["aula"];
  bloque: BloqueDeClase;
  /** Sesión ya abierta para hoy, con el estado de su registro; null si aún no se abre. */
  sesion: ({ id: string } & EstadoDeRegistro) | null;
}

export interface ClasesDeHoy {
  /** Fecha de hoy en Lima. */
  fecha: string;
  dia: Dia | null;
  /** Por qué no hay clases hoy, con el mensaje para el docente; null si tiene clases. */
  sinClases: { motivo: MotivoSinClases; mensaje: string } | null;
  clases: ClaseDeHoy[];
}

/**
 * Clases de hoy del docente en sesión, según el horario PUBLICADO del año en curso y la fecha de Lima (US35). En fin
 * de semana, fuera de los bimestres o sin clases ese día devuelve la lista vacía con un mensaje claro.
 */
export async function clasesDeHoy(auth: Autenticado, ahora: Date = new Date()): Promise<ClasesDeHoy> {
  const docente = await docenteEnSesion(auth);
  const fecha = fechaEnLima(ahora);
  const dia = diaDeClases(fecha);
  const anio = await anioEnCurso();
  const sinClases = (motivo: MotivoSinClases): ClasesDeHoy => ({
    fecha,
    dia,
    sinClases: { motivo, mensaje: MENSAJE_SIN_CLASES[motivo] },
    clases: [],
  });
  const motivo = motivoDiaNoLectivo(fecha, anio?.periodos ?? null);
  if (motivo || !anio) return sinClases(motivo ?? "SIN_ANIO_EN_CURSO");
  const filas = (await clases.publicadasDelDocente(docente.id, anio.id)).filter((c) => c.dia === dia);
  if (!filas.length) return sinClases("SIN_CLASES");

  const [vistas, delDia, abiertas, plazoHoras] = await Promise.all([
    vistasDeClases(filas),
    bloquesPorId(filas.map((c) => c.bloqueId)),
    sesiones.enFecha(fecha, [...new Set(filas.map((c) => c.seccionId))]),
    plazoDeCorreccion(),
  ]);
  const estados = await asistencias.estadosDeSesiones(abiertas.map((s) => s.id));
  const deHoy = vistas.map((c) => {
    const bloque = delDia.get(c.bloqueId)!;
    const sesion = abiertas.find((s) => s.clase.seccionId === c.seccion.id && s.clase.bloqueId === c.bloqueId);
    return {
      orden: bloque.orden,
      clase: {
        claseId: c.id,
        curso: c.curso,
        seccion: c.seccion,
        aula: c.aula,
        bloque: sinOrden(bloque),
        sesion: sesion
          ? { id: sesion.id, ...estadoDeRegistro(sesion, estados.get(sesion.id), plazoHoras, ahora) }
          : null,
      },
    };
  });
  return {
    fecha,
    dia,
    sinClases: null,
    clases: deHoy.sort((a, b) => a.orden - b.orden).map((c) => c.clase),
  };
}

/**
 * Abre la sesión de una clase del docente para hoy: la crea si no existe y devuelve la lista de alumnos (US35). No
 * abre fechas futuras ni pasadas, ni una clase que no es suya o que no está programada ese día en el horario
 * publicado.
 */
export async function abrirSesion(
  auth: Autenticado,
  datos: { claseId: string; fecha?: string },
  ahora: Date = new Date(),
): Promise<SesionDetalle> {
  const docente = await docenteEnSesion(auth);
  const clase = await clases.porId(datos.claseId);
  if (!clase) throw errores.noEncontrado("La clase");
  if (clase.docenteId !== docente.id) throw E.claseAjena();

  const hoy = fechaEnLima(ahora);
  const fecha = datos.fecha ?? hoy;
  verificarFechaDeRegistro(fecha, hoy);
  const anio = await anioEnCurso();
  const motivo = motivoDiaNoLectivo(fecha, anio?.periodos ?? null);
  if (motivo) throw E.diaSinClases(MENSAJE_SIN_CLASES[motivo]);
  const seccion = await cargarSeccion(clase.seccionId);
  if (clase.estadoHorario !== "PUBLICADO" || clase.dia !== diaDeClases(fecha) || seccion.anio.id !== anio?.id) {
    throw E.claseFueraDeHorario();
  }

  // si el horario se volvió a publicar hoy, la sesión abierta con la versión anterior sigue siendo la de este bloque
  const yaAbierta = (await sesiones.enFecha(fecha, [clase.seccionId])).find((s) => s.clase.bloqueId === clase.bloqueId);
  const sesion =
    yaAbierta ??
    (await sesiones.abrir({ detalleHorarioId: clase.id, docenteId: docente.id, fecha, iniciadaEn: ahora }));
  if (sesion.docenteId !== docente.id) throw E.claseAjena();
  return armarDetalle(sesion, false, ahora);
}

/**
 * Sesiones de clase. El docente ve solo las suyas: las de la fecha indicada o, sin fecha, las de los últimos días
 * (para corregir dentro del plazo o consultar). El coordinador académico ve todas las de la fecha (por defecto, hoy).
 */
export async function listarSesiones(
  auth: Autenticado,
  filtro: { fecha?: string },
  ahora: Date = new Date(),
): Promise<{ fecha: string | null; sesiones: SesionVista[] }> {
  const hoy = fechaEnLima(ahora);
  if (auth.rol === "COORDINADOR") {
    const fecha = filtro.fecha ?? hoy;
    return { fecha, sesiones: await vistasDeSesiones(await sesiones.deFecha(fecha), ahora) };
  }
  const docente = await docenteEnSesion(auth);
  const desde = fechaEnLima(new Date(ahora.getTime() - DIAS_DE_HISTORIAL * MS_POR_DIA));
  const rango: Rango = filtro.fecha
    ? { fechaInicio: filtro.fecha, fechaFin: filtro.fecha }
    : { fechaInicio: desde, fechaFin: hoy };
  return {
    fecha: filtro.fecha ?? null,
    sesiones: await vistasDeSesiones(await sesiones.delDocente(docente.id, rango), ahora),
  };
}

/** Una sesión con su lista de alumnos. El docente solo abre las suyas (403 CLASE_AJENA); el coordinador académico, todas. */
export async function detalleDeSesion(
  auth: Autenticado,
  sesionId: string,
  ahora: Date = new Date(),
): Promise<SesionDetalle> {
  const sesion = await cargarSesion(sesionId);
  if (auth.rol === "COORDINADOR") return armarDetalle(sesion, true, ahora);
  const docente = await docenteEnSesion(auth);
  if (sesion.docenteId !== docente.id) throw E.claseAjena();
  return armarDetalle(sesion, false, ahora);
}

// ---------- US35 y US36 · Guardar y corregir ----------

export interface SesionGuardada extends SesionDetalle {
  avisos: AvisosEnviados;
}

/**
 * Guarda la lista de una sesión del docente. La primera vez registra a todos (US35: si falta marcar alguno, «Existen
 * alumnos sin estado de asistencia registrado»); después corrige solo lo que cambió, dentro del plazo, y deja en el
 * registro quién lo cambió, cuándo y el estado anterior (US36). Tras guardar avisa por correo si algún alumno alcanza
 * un umbral de inasistencias (US52).
 */
export async function guardarAsistencia(
  auth: Autenticado,
  sesionId: string,
  datos: { alumnos: MarcaDeAsistencia[] },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<SesionGuardada> {
  const docente = await docenteEnSesion(auth);
  const previa = await cargarSesion(sesionId);
  if (previa.docenteId !== docente.id) throw E.claseAjena();
  const plazoHoras = await plazoDeCorreccion();
  const verificarQueSePuedeGuardar = (sesion: SesionFila) => {
    if (sesion.cerradaEn) verificarPlazoDeCorreccion(sesion.cerradaEn, plazoHoras, ahora);
    else verificarFechaDeRegistro(sesion.fecha, fechaEnLima(ahora));
  };
  // el plazo se comprueba antes que la lista: una sesión vencida responde que expiró, no que faltan alumnos
  verificarQueSePuedeGuardar(previa);
  const lista = await alumnosDeLista(previa, await asistencias.deSesion(sesionId));
  // sin el DNI: los alumnos que falten marcar viajan en los detalles del error
  const marcas = verificarListaCompleta(
    lista.map(({ matriculaId, nombre }) => ({ matriculaId, nombre })),
    datos.alumnos,
  );

  const conFalta = await prisma.$transaction(async (tx) => {
    await sesiones.bloquearFila(tx, sesionId);
    const sesion = (await sesiones.porId(sesionId, tx))!;
    verificarQueSePuedeGuardar(sesion);
    const { nuevos, correcciones } = cambiosDeAsistencia(await asistencias.deSesion(sesionId, tx), marcas);
    if (nuevos.length) {
      await asistencias.crearVarias(
        tx,
        nuevos.map((m) => ({
          sesionClaseId: sesionId,
          matriculaId: m.matriculaId,
          estado: m.estado,
          observacion: m.observacion,
          registradoPorId: auth.usuarioId,
          registradoEn: ahora,
        })),
      );
    }
    for (const c of correcciones) {
      await asistencias.corregir(tx, c.registro.id, {
        estado: c.estado,
        observacion: c.observacion,
        ...(c.registro.estado !== c.estado ? { estadoAnterior: c.registro.estado } : {}),
        modificadoPorId: auth.usuarioId,
        modificadoEn: ahora,
      });
    }
    if (!sesion.cerradaEn) await sesiones.marcarRegistrada(sesionId, ahora, tx);
    // solo una falta nueva (registrada o corregida a «Ausente») puede hacer que se alcance un umbral
    return [
      ...nuevos.filter((m) => m.estado === "FALTA").map((m) => m.matriculaId),
      ...correcciones.filter((c) => c.estado === "FALTA").map((c) => c.registro.matriculaId),
    ];
  });

  const avisos = await avisarPorInasistencias(conFalta, previa.fecha, meta);
  return { ...(await armarDetalle(await cargarSesion(sesionId), false, ahora)), avisos };
}

export interface DatosCorreccion {
  estado: EstadoAsistencia;
  observacion?: string | null;
  motivo: string;
}

export interface OpcionesCorreccion {
  /** Acción de la bitácora: CORREGIR_ASISTENCIA o, para el tutor, JUSTIFICAR_ASISTENCIA (bloque M3). */
  accion: "CORREGIR_ASISTENCIA" | "JUSTIFICAR_ASISTENCIA";
  /** Quién corrige: el coordinador académico o el tutor de la sección (bloque M3). */
  por: "COORDINADOR" | "TUTOR";
  /** Comprobación extra con la fila bloqueada (el tutor: que el registro sea de su sección y del bimestre en curso). */
  verificar?: (sesion: SesionFila, actual: RegistroFila) => void;
  /** Estado nuevo calculado desde el actual (la justificación); si no se da, se usa `datos.estado`. */
  estadoDesde?: (actual: RegistroFila) => EstadoAsistencia;
}

/**
 * Corrige un registro dentro de una transacción con la fila bloqueada: guarda el estado anterior, quién y cuándo lo
 * cambió y el motivo, y lo deja en la bitácora de auditoría con el valor anterior y el nuevo. La usan la corrección
 * del coordinador (M-20) y la del tutor (bloque M3).
 */
export async function aplicarCorreccion(
  actor: Autenticado,
  registroId: string,
  datos: DatosCorreccion,
  meta: MetaSolicitud,
  ahora: Date,
  opciones: OpcionesCorreccion,
) {
  const plazoHoras = await plazoDeCorreccion();
  return prisma.$transaction(async (tx) => {
    await asistencias.bloquearFila(tx, registroId);
    const actual = await asistencias.porId(registroId, tx);
    if (!actual) throw errores.noEncontrado("El registro de asistencia");
    const sesion = (await sesiones.porId(actual.sesionClaseId, tx))!;
    opciones.verificar?.(sesion, actual);
    const estado = opciones.estadoDesde ? opciones.estadoDesde(actual) : datos.estado;
    // sin observación en la solicitud se conserva la que tenía
    const observacion = datos.observacion === undefined ? actual.observacion : datos.observacion;
    verificarCorreccion(actual, { estado, observacion });
    await asistencias.corregir(tx, registroId, {
      estado,
      observacion,
      ...(actual.estado !== estado ? { estadoAnterior: actual.estado } : {}),
      modificadoPorId: actor.usuarioId,
      modificadoEn: ahora,
      motivoCambio: datos.motivo,
    });
    await registrarAuditoria(
      tx,
      {
        usuarioId: actor.usuarioId,
        entidad: "asistencia_estudiante",
        entidadId: registroId,
        accion: opciones.accion,
        anterior: { estado: actual.estado, observacion: actual.observacion },
        nuevo: {
          estado,
          observacion,
          sesionClaseId: sesion.id,
          matriculaId: actual.matriculaId,
          fecha: sesion.fecha,
          fueraDePlazo: sesion.cerradaEn ? !dentroDelPlazo(sesion.cerradaEn, plazoHoras, ahora) : false,
          por: opciones.por,
        },
        motivo: datos.motivo,
      },
      meta,
    );
    return {
      sesion,
      matriculaId: actual.matriculaId,
      estado,
      pasaAFalta: actual.estado !== "FALTA" && estado === "FALTA",
    };
  });
}

/**
 * Corrección del coordinador académico (US36, criterio 3; M-20): cambia el estado o la observación de un registro aunque el
 * plazo del docente haya vencido. El motivo es obligatorio y el cambio queda en la bitácora de auditoría con el valor
 * anterior y el nuevo.
 */
export async function corregirAsistencia(
  admin: Autenticado,
  registroId: string,
  datos: DatosCorreccion,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<SesionGuardada> {
  const corregido = await aplicarCorreccion(admin, registroId, datos, meta, ahora, {
    accion: "CORREGIR_ASISTENCIA",
    por: "COORDINADOR",
  });

  const avisos = await avisarPorInasistencias(
    corregido.pasaAFalta ? [corregido.matriculaId] : [],
    corregido.sesion.fecha,
    meta,
  );
  return { ...(await armarDetalle(corregido.sesion, true, ahora)), avisos };
}
