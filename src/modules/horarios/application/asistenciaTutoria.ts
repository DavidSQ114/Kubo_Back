// horarios/application: asistencia de la tutoría (bloque M3, «Mi tutoría» del docente). El tutor o cotutor de una
// sección del año en curso ve el inicio de su tutoría (alumnos, faltas de hoy y alumnos con aviso por umbral) y trabaja
// sobre las clases existentes de su sección, dentro del bimestre en curso: registra la asistencia de cualquier clase
// (la sesión sigue a nombre del docente de la clase y el tutor queda como quien registró), la modifica sin el plazo de
// 24 horas con motivo y auditoría, y justifica faltas y tardanzas. Cada caso de uso pasa por tutoriaDelDocente (403).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import {
  asignacionesDeClases,
  fechaEnLima,
  obtenerAnio,
  tutoriaDelDocente,
  type TutoriaDelDocente,
} from "@/modules/academico";
import { docentesProviderComunidad, resumenEstudiantes } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { datosDeMatriculas, matriculasDeSeccionEnFecha } from "@/modules/matricula";
import {
  cambiosDeAsistencia,
  diaDeClases,
  nombreDeLista,
  verificarListaCompleta,
  type Bimestre,
  type EstadoAsistencia,
  type MarcaDeAsistencia,
} from "../domain/asistencia";
import { erroresTutoria as E } from "../domain/errores";
import { bimestreEnCurso, estadoJustificado, situacionDeAlumno, verificarFechaDeTutoria } from "../domain/tutoria";
import type { Dia } from "../domain/tipos";
import { asistencias, sesiones, type SesionFila } from "../infrastructure/asistencia";
import { justificaciones } from "../infrastructure/justificaciones";
import { clases } from "../infrastructure/repositorio";
import {
  aplicarCorreccion,
  alumnosDeLista,
  armarDetalle,
  bloquesPorId,
  cargarSesion,
  estadoDeRegistro,
  plazoDeCorreccion,
  sinOrden,
  type BloqueDeClase,
  type EstadoDeRegistro,
  type SesionDetalle,
} from "./asistencia";
import { anioDeAsistencia, leerUmbrales } from "./asistenciaPortales";
import { avisarPorInasistencias, type AvisosEnviados } from "./avisosAsistencia";
import { vistasDeClases, type ClaseVista } from "./cuadricula";

// ---------- Comunes ----------

export interface BimestreDeTutoria extends Bimestre {
  id: string;
}

/** Bimestres del año de la tutoría (con su id) y el que contiene la fecha de hoy. */
async function bimestresDeTutoria(t: TutoriaDelDocente, hoy: string) {
  const anio = await obtenerAnio(t.anio.id);
  const bimestres: BimestreDeTutoria[] = anio.periodos.map((p) => ({
    id: p.id,
    numero: p.numero,
    nombre: p.nombre,
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
  }));
  return { bimestres, enCurso: bimestreEnCurso(bimestres, hoy) };
}

export interface AlumnoDeTutoria {
  matriculaId: string;
  estudianteId: string;
  /** «Álvarez Torres, Camila». */
  nombre: string;
  dni: string;
  fechaMatricula: string;
}

/** Alumnos con matrícula vigente en la sección en la fecha (sin retirados, trasladados ni anulados), por apellido. */
export async function alumnosDeLaSeccion(seccionId: string, fecha: string): Promise<AlumnoDeTutoria[]> {
  const ids = await matriculasDeSeccionEnFecha(seccionId, fecha);
  const datos = Object.values(await datosDeMatriculas(ids)).filter((m) => m.estado === "MATRICULADO");
  const estudiantes = await resumenEstudiantes(datos.map((m) => m.estudianteId));
  return datos
    .flatMap((m) => {
      const e = estudiantes[m.estudianteId];
      return e
        ? [
            {
              matriculaId: m.matriculaId,
              estudianteId: m.estudianteId,
              nombre: nombreDeLista(e),
              dni: e.dni,
              fechaMatricula: m.fechaMatricula,
            },
          ]
        : [];
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Nombres del tutor y del cotutor de la sección. */
async function equipoDeTutoria(t: TutoriaDelDocente) {
  const ids = [t.seccion.tutorId, t.seccion.cotutorId].filter((x): x is string => x !== null);
  const docentes = await docentesProviderComunidad.docentesPorId(ids);
  const nombre = (id: string | null) => docentes.find((d) => d.id === id)?.nombreCompleto ?? null;
  return { tutor: nombre(t.seccion.tutorId), cotutor: nombre(t.seccion.cotutorId) };
}

const cabecera = async (t: TutoriaDelDocente) => ({
  rol: t.rol,
  seccion: { id: t.seccion.id, etiqueta: t.seccion.etiqueta, grado: t.seccion.grado },
  anio: t.anio,
  ...(await equipoDeTutoria(t)),
});

export type CabeceraDeTutoria = Awaited<ReturnType<typeof cabecera>>;

// ---------- Inicio de la tutoría ----------

export interface FaltaDeHoy {
  registroId: string;
  curso: string;
  horaInicio: string;
  estado: EstadoAsistencia;
}

export interface AlumnoConFaltaHoy {
  matriculaId: string;
  nombre: string;
  /** Clases de hoy en que faltó, con o sin justificar. */
  faltas: FaltaDeHoy[];
}

export interface AlumnoConAviso {
  matriculaId: string;
  nombre: string;
  faltasDelMes: number;
  faltasDelAnio: number;
  porcentaje: number;
  nivel: "SIN_RIESGO" | "AVISO" | "RIESGO";
  alertaDelMes: boolean;
}

export interface InicioDeTutoria extends CabeceraDeTutoria {
  hoy: string;
  bimestre: BimestreDeTutoria | null;
  totalAlumnos: number;
  /** Clases de la sección hoy en el horario publicado y cuántas tienen la asistencia registrada. */
  clasesDeHoy: { programadas: number; registradas: number };
  faltasDeHoy: AlumnoConFaltaHoy[];
  alumnosConAviso: AlumnoConAviso[];
  umbrales: { faltasMes: number; porcentajeAviso: number; porcentajeRiesgo: number };
  /** Justificaciones de apoderados por revisar (fase 7). */
  justificacionesPendientes: number;
}

const esFalta = (e: EstadoAsistencia) => e === "FALTA" || e === "FALTA_JUSTIFICADA";

/** Curso de cada asignación de las clases (para nombrar los registros). */
async function cursosDeAsignaciones(asignacionIds: string[]): Promise<Map<string, string>> {
  const asignaciones = await asignacionesDeClases([...new Set(asignacionIds)]);
  return new Map(asignaciones.map((a) => [a.id, a.curso.nombre]));
}

/**
 * Inicio de «Mi tutoría»: la sección, la cantidad de alumnos, las faltas de hoy (por alumno y clase) y los alumnos con
 * aviso por umbral, calculados como los avisos por correo (US52): solo cuentan las faltas sin justificar, así que un
 * alumno sale de la lista cuando el tutor justifica sus faltas.
 */
export async function inicioDeTutoria(
  auth: Autenticado,
  seccionId: string,
  ahora: Date = new Date(),
): Promise<InicioDeTutoria> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const hoy = fechaEnLima(ahora);
  const [anio, { enCurso }, alumnos, umbrales, encabezado] = await Promise.all([
    anioDeAsistencia(t.anio.id),
    bimestresDeTutoria(t, hoy),
    alumnosDeLaSeccion(seccionId, hoy),
    leerUmbrales(t.anio.id),
    cabecera(t),
  ]);

  const [delAnio, deHoy, sesionesDeHoy, justificacionesPendientes] = await Promise.all([
    asistencias.deMatriculas(
      alumnos.map((a) => a.matriculaId),
      { fechaInicio: anio.fechaInicio, fechaFin: hoy },
    ),
    asistencias.deSeccion(seccionId, { fechaInicio: hoy, fechaFin: hoy }),
    sesiones.enFecha(hoy, [seccionId]),
    justificaciones.pendientesDeSeccion(seccionId),
  ]);
  const dia = diaDeClases(hoy);
  const programadas = dia ? (await clases.publicadasDeSeccion(seccionId)).filter((c) => c.dia === dia).length : 0;

  const cursos = await cursosDeAsignaciones(deHoy.map((r) => r.asignacionDocenteId));
  const faltasDeHoy = alumnos.flatMap((a): AlumnoConFaltaHoy[] => {
    const faltas = deHoy
      .filter((r) => r.matriculaId === a.matriculaId && esFalta(r.estado))
      .sort((x, y) => x.horaInicio.localeCompare(y.horaInicio))
      .map((r) => ({
        registroId: r.id,
        curso: cursos.get(r.asignacionDocenteId) ?? "Clase",
        horaInicio: r.horaInicio,
        estado: r.estado,
      }));
    return faltas.length ? [{ matriculaId: a.matriculaId, nombre: a.nombre, faltas }] : [];
  });

  const alumnosConAviso = alumnos.flatMap((a): AlumnoConAviso[] => {
    const s = situacionDeAlumno(
      delAnio.filter((r) => r.matriculaId === a.matriculaId),
      { bimestres: anio.bimestres, fechaMatricula: a.fechaMatricula, hoy, umbrales },
    );
    return s.conAviso
      ? [
          {
            matriculaId: a.matriculaId,
            nombre: a.nombre,
            faltasDelMes: s.faltasDelMes,
            faltasDelAnio: s.faltasDelAnio,
            porcentaje: s.porcentaje,
            nivel: s.nivel,
            alertaDelMes: s.alertaDelMes,
          },
        ]
      : [];
  });

  return {
    ...encabezado,
    hoy,
    bimestre: enCurso,
    totalAlumnos: alumnos.length,
    clasesDeHoy: { programadas, registradas: sesionesDeHoy.filter((s) => s.cerradaEn).length },
    faltasDeHoy,
    alumnosConAviso: alumnosConAviso.sort((x, y) => y.porcentaje - x.porcentaje || x.nombre.localeCompare(y.nombre)),
    umbrales: {
      faltasMes: umbrales.faltasMes,
      porcentajeAviso: Math.round(umbrales.aviso * 1000) / 10,
      porcentajeRiesgo: Math.round(umbrales.riesgo * 1000) / 10,
    },
    justificacionesPendientes,
  };
}

// ---------- (a) Clases del día y registro ----------

export interface ClaseDelDiaDeTutoria {
  claseId: string;
  curso: ClaseVista["curso"];
  docente: ClaseVista["docente"];
  aula: ClaseVista["aula"];
  bloque: BloqueDeClase;
  /** Sesión ya abierta en esa fecha, con el estado de su registro; null si aún no se abre. */
  sesion: ({ id: string } & Pick<EstadoDeRegistro, "registrada" | "registradaEn" | "resumen">) | null;
}

export interface ClasesDelDiaDeTutoria extends CabeceraDeTutoria {
  fecha: string;
  dia: Dia | null;
  hoy: string;
  /** Bimestre en curso: el rango de fechas que el tutor puede elegir; null si no hay. */
  bimestre: BimestreDeTutoria | null;
  /** Por qué no hay clases que mostrar; null si hay. */
  mensaje: string | null;
  clases: ClaseDelDiaDeTutoria[];
}

/**
 * Clases de la sección en una fecha del bimestre en curso (por defecto, hoy), según el horario publicado, con su
 * sesión si ya se abrió. Sin bimestre en curso o en fin de semana responde la lista vacía con el mensaje.
 */
export async function clasesDelDiaDeTutoria(
  auth: Autenticado,
  seccionId: string,
  filtro: { fecha?: string },
  ahora: Date = new Date(),
): Promise<ClasesDelDiaDeTutoria> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const hoy = fechaEnLima(ahora);
  const [{ enCurso }, encabezado] = await Promise.all([bimestresDeTutoria(t, hoy), cabecera(t)]);
  const fecha = filtro.fecha ?? hoy;
  const dia = diaDeClases(fecha);
  const base = { ...encabezado, fecha, dia, hoy, bimestre: enCurso };
  if (!enCurso) return { ...base, mensaje: E.sinBimestreEnCurso().message, clases: [] };
  // una fecha elegida fuera del bimestre o futura es un error; hoy en fin de semana, solo un aviso
  if (filtro.fecha || dia) verificarFechaDeTutoria(fecha, enCurso, hoy);
  if (!dia) return { ...base, mensaje: E.finDeSemana().message, clases: [] };

  const filas = (await clases.publicadasDeSeccion(seccionId)).filter((c) => c.dia === dia);
  if (!filas.length) {
    return { ...base, mensaje: "La sección no tiene clases ese día en el horario publicado.", clases: [] };
  }
  const [vistas, delDia, abiertas, plazoHoras] = await Promise.all([
    vistasDeClases(filas),
    bloquesPorId(filas.map((c) => c.bloqueId)),
    sesiones.enFecha(fecha, [seccionId]),
    plazoDeCorreccion(),
  ]);
  const estados = await asistencias.estadosDeSesiones(abiertas.map((s) => s.id));
  const lista = vistas
    .map((c) => {
      const bloque = delDia.get(c.bloqueId)!;
      const sesion = abiertas.find((s) => s.clase.bloqueId === c.bloqueId);
      const registro = sesion && estadoDeRegistro(sesion, estados.get(sesion.id), plazoHoras, ahora);
      return {
        orden: bloque.orden,
        clase: {
          claseId: c.id,
          curso: c.curso,
          docente: c.docente,
          aula: c.aula,
          bloque: sinOrden(bloque),
          sesion:
            sesion && registro
              ? {
                  id: sesion.id,
                  registrada: registro.registrada,
                  registradaEn: registro.registradaEn,
                  resumen: registro.resumen,
                }
              : null,
        },
      };
    })
    .sort((a, b) => a.orden - b.orden)
    .map((x) => x.clase);
  return { ...base, mensaje: null, clases: lista };
}

export interface SesionDeTutoria extends SesionDetalle {
  tutoria: CabeceraDeTutoria;
  /** Bimestre en curso en el que el tutor puede registrar y modificar. */
  bimestre: string | null;
}

/** La sesión vista por el tutor: editable dentro del bimestre en curso, sin el plazo de 24 horas del docente. */
async function detalleParaTutor(t: TutoriaDelDocente, sesion: SesionFila, ahora: Date): Promise<SesionDeTutoria> {
  const hoy = fechaEnLima(ahora);
  const [detalle, { enCurso }, encabezado] = await Promise.all([
    armarDetalle(sesion, false, ahora),
    bimestresDeTutoria(t, hoy),
    cabecera(t),
  ]);
  let motivoSoloLectura: string | null = null;
  try {
    verificarFechaDeTutoria(sesion.fecha, enCurso, hoy);
  } catch (e) {
    motivoSoloLectura = (e as Error).message;
  }
  return {
    ...detalle,
    editable: motivoSoloLectura === null,
    editableHasta: null,
    motivoSoloLectura,
    tutoria: encabezado,
  };
}

/** La sesión debe ser de una clase de la sección de la tutoría (403 si no). */
function verificarSesionDeLaSeccion(t: TutoriaDelDocente, sesion: SesionFila) {
  if (sesion.clase.seccionId !== t.seccion.id) throw E.claseDeOtraSeccion();
}

/**
 * Abre (o reutiliza) la sesión de una clase de la sección en una fecha del bimestre en curso. La sesión queda a
 * nombre del docente de la clase, no del tutor: así la ve en «Asistencia» como suya.
 */
export async function abrirClaseDeTutoria(
  auth: Autenticado,
  seccionId: string,
  datos: { claseId: string; fecha: string },
  ahora: Date = new Date(),
): Promise<SesionDeTutoria> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const clase = await clases.porId(datos.claseId);
  if (!clase || clase.seccionId !== seccionId) throw E.claseDeOtraSeccion();
  const hoy = fechaEnLima(ahora);
  const { enCurso } = await bimestresDeTutoria(t, hoy);
  verificarFechaDeTutoria(datos.fecha, enCurso, hoy);
  if (clase.estadoHorario !== "PUBLICADO" || clase.dia !== diaDeClases(datos.fecha)) throw E.claseFueraDeFecha();

  // como en abrirSesion: si el horario se volvió a publicar, la sesión ya abierta de ese bloque es la misma
  const yaAbierta = (await sesiones.enFecha(datos.fecha, [seccionId])).find((s) => s.clase.bloqueId === clase.bloqueId);
  const sesion =
    yaAbierta ??
    (await sesiones.abrir({
      detalleHorarioId: clase.id,
      docenteId: clase.docenteId,
      fecha: datos.fecha,
      iniciadaEn: ahora,
    }));
  return detalleParaTutor(t, sesion, ahora);
}

/** Una sesión de la sección, vista por el tutor. */
export async function sesionDeTutoria(
  auth: Autenticado,
  seccionId: string,
  sesionId: string,
  ahora: Date = new Date(),
): Promise<SesionDeTutoria> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const sesion = await cargarSesion(sesionId);
  verificarSesionDeLaSeccion(t, sesion);
  return detalleParaTutor(t, sesion, ahora);
}

export interface SesionDeTutoriaGuardada extends SesionDeTutoria {
  avisos: AvisosEnviados;
}

/**
 * Registra la lista de una sesión de la sección (bloque M3, a): crea los registros que faltan con el tutor como quien
 * registró. Si la lista cambia registros que ya existían, es una modificación (b): exige motivo y queda en la
 * auditoría como cualquier corrección del tutor. Sin el plazo de 24 horas, pero solo en el bimestre en curso.
 */
export async function guardarAsistenciaDeTutoria(
  auth: Autenticado,
  seccionId: string,
  sesionId: string,
  datos: { alumnos: MarcaDeAsistencia[]; motivo?: string | null },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<SesionDeTutoriaGuardada> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const previa = await cargarSesion(sesionId);
  verificarSesionDeLaSeccion(t, previa);
  const hoy = fechaEnLima(ahora);
  const { enCurso } = await bimestresDeTutoria(t, hoy);
  verificarFechaDeTutoria(previa.fecha, enCurso, hoy);
  const lista = await alumnosDeLista(previa, await asistencias.deSesion(sesionId));
  const marcas = verificarListaCompleta(
    lista.map(({ matriculaId, nombre }) => ({ matriculaId, nombre })),
    datos.alumnos,
  );

  const conFalta = await prisma.$transaction(async (tx) => {
    await sesiones.bloquearFila(tx, sesionId);
    const sesion = (await sesiones.porId(sesionId, tx))!;
    const { nuevos, correcciones } = cambiosDeAsistencia(await asistencias.deSesion(sesionId, tx), marcas);
    if (correcciones.length && !datos.motivo) throw E.motivoRequerido();
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
      await registrarAuditoria(
        tx,
        {
          usuarioId: auth.usuarioId,
          entidad: "sesion_clase",
          entidadId: sesionId,
          accion: "REGISTRAR_ASISTENCIA_TUTORIA",
          nuevo: {
            seccionId,
            fecha: sesion.fecha,
            docenteDeLaClaseId: sesion.docenteId,
            registros: nuevos.length,
            rol: t.rol,
          },
        },
        meta,
      );
    }
    for (const c of correcciones) {
      await asistencias.corregir(tx, c.registro.id, {
        estado: c.estado,
        observacion: c.observacion,
        ...(c.registro.estado !== c.estado ? { estadoAnterior: c.registro.estado } : {}),
        modificadoPorId: auth.usuarioId,
        modificadoEn: ahora,
        motivoCambio: datos.motivo!,
      });
      await registrarAuditoria(
        tx,
        {
          usuarioId: auth.usuarioId,
          entidad: "asistencia_estudiante",
          entidadId: c.registro.id,
          accion: "CORREGIR_ASISTENCIA",
          anterior: { estado: c.registro.estado, observacion: c.registro.observacion },
          nuevo: {
            estado: c.estado,
            observacion: c.observacion,
            sesionClaseId: sesionId,
            matriculaId: c.registro.matriculaId,
            fecha: sesion.fecha,
            por: "TUTOR",
          },
          motivo: datos.motivo!,
        },
        meta,
      );
    }
    if (!sesion.cerradaEn) await sesiones.marcarRegistrada(sesionId, ahora, tx);
    return [
      ...nuevos.filter((m) => m.estado === "FALTA").map((m) => m.matriculaId),
      ...correcciones
        .filter((c) => c.estado === "FALTA" && c.registro.estado !== "FALTA")
        .map((c) => c.registro.matriculaId),
    ];
  });

  const avisos = await avisarPorInasistencias(conFalta, previa.fecha, meta);
  return { ...(await detalleParaTutor(t, await cargarSesion(sesionId), ahora)), avisos };
}

// ---------- (b) Modificar y (c) justificar ----------

/** El registro debe ser de una clase de la sección y de una fecha del bimestre en curso (con la fila bloqueada). */
async function verificacionDelTutor(t: TutoriaDelDocente, ahora: Date) {
  const hoy = fechaEnLima(ahora);
  const { enCurso } = await bimestresDeTutoria(t, hoy);
  return (sesion: SesionFila) => {
    if (sesion.clase.seccionId !== t.seccion.id) throw E.registroDeOtraSeccion();
    verificarFechaDeTutoria(sesion.fecha, enCurso, hoy);
  };
}

/**
 * Modificación del tutor (bloque M3, b): cambia el estado o la observación de un registro de su sección dentro del
 * bimestre en curso, sin el plazo de 24 horas del docente, con motivo obligatorio y auditoría (como la del
 * coordinador, M-20).
 */
export async function corregirAsistenciaDeTutoria(
  auth: Autenticado,
  seccionId: string,
  registroId: string,
  datos: { estado: EstadoAsistencia; observacion?: string | null; motivo: string },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<SesionDeTutoriaGuardada> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const corregido = await aplicarCorreccion(auth, registroId, datos, meta, ahora, {
    accion: "CORREGIR_ASISTENCIA",
    por: "TUTOR",
    verificar: await verificacionDelTutor(t, ahora),
  });
  const avisos = await avisarPorInasistencias(
    corregido.pasaAFalta ? [corregido.matriculaId] : [],
    corregido.sesion.fecha,
    meta,
  );
  return { ...(await detalleParaTutor(t, corregido.sesion, ahora)), avisos };
}

/**
 * Justificación del tutor (bloque M3, c): una falta pasa a falta justificada y una tardanza, a tardanza justificada,
 * con motivo y auditoría (JUSTIFICAR_ASISTENCIA). Desde ese momento la falta no cuenta para los avisos por umbral.
 * `permitirFueraDelBimestre` lo usa la aprobación de una justificación del apoderado, que ya validó su plazo al enviarla.
 */
export async function justificarAsistenciaDeTutoria(
  auth: Autenticado,
  seccionId: string,
  registroId: string,
  datos: { motivo: string },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
  opciones: { permitirFueraDelBimestre?: boolean } = {},
): Promise<{ registroId: string; estado: EstadoAsistencia; fecha: string; matriculaId: string }> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const verificar = await verificacionDelTutor(t, ahora);
  const r = await aplicarCorreccion(
    auth,
    registroId,
    { estado: "FALTA_JUSTIFICADA", motivo: datos.motivo },
    meta,
    ahora,
    {
      accion: "JUSTIFICAR_ASISTENCIA",
      por: "TUTOR",
      verificar: (sesion) => {
        if (opciones.permitirFueraDelBimestre) {
          if (sesion.clase.seccionId !== t.seccion.id) throw E.registroDeOtraSeccion();
        } else verificar(sesion);
      },
      estadoDesde: (actual) => estadoJustificado(actual.estado),
    },
  );
  return { registroId, estado: r.estado, fecha: r.sesion.fecha, matriculaId: r.matriculaId };
}
