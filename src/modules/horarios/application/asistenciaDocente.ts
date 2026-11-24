// horarios/application: registro de ingreso del personal docente (US32, AD-14). El administrador marca «Asistió» en
// el listado del día (Puntual hasta HORA_INICIO_JORNADA_DOCENTE, después Tardanza), registra la salida y justifica
// las inasistencias. Cada 15 minutos, scripts/tareasProgramadas.ts marca con falta a quien no fue marcado hasta
// HORA_LIMITE_ASISTENCIA_DOCENTE. Solo días lectivos y docentes activos; todo queda en la bitácora de auditoría.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { parametroHora } from "@/platform/config/parametros";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { fechaEnLima, listarAnios } from "@/modules/academico";
import { personalDocente } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { diaDeClases, MENSAJE_SIN_CLASES, motivoDiaNoLectivo, type MotivoSinClases } from "../domain/asistencia";
import {
  alcanzoHoraLimite,
  docentesSinMarcar,
  horaEnLima,
  ingresoPara,
  minutoDe,
  minutosParaLimite,
  resumenAsistenciaDocente,
  verificarDiaActual,
  verificarJustificable,
  verificarSalida,
  type EstadoAsistenciaDocente,
  type ResumenAsistenciaDocente,
} from "../domain/asistenciaDocente";
import { erroresAsistenciaDocente as E } from "../domain/errores";
import { asistenciaDocente, type RegistroDocenteFila } from "../infrastructure/asistenciaDocente";

const ENTIDAD = "asistencia_docente";

/** Mensajes para el administrador cuando la fecha no es lectiva (los de MENSAJE_SIN_CLASES hablan al docente). */
const MENSAJE_NO_LECTIVO: Record<Exclude<MotivoSinClases, "SIN_CLASES">, string> = {
  FIN_DE_SEMANA: "Es fin de semana: no se registra la asistencia docente.",
  SIN_ANIO_EN_CURSO: MENSAJE_SIN_CLASES.SIN_ANIO_EN_CURSO,
  FUERA_DE_BIMESTRE: "La fecha está fuera de los bimestres del año escolar: no se registra la asistencia docente.",
};

/** Por qué la fecha no es lectiva, con el mensaje; null si es un día de clases del año en curso. */
async function diaNoLectivo(fecha: string): Promise<{ anioId: string | null; mensaje: string | null }> {
  const anio = (await listarAnios()).find((a) => a.estado === "EN_CURSO") ?? null;
  const motivo = motivoDiaNoLectivo(fecha, anio?.periodos ?? null) as Exclude<MotivoSinClases, "SIN_CLASES"> | null;
  return { anioId: anio?.id ?? null, mensaje: motivo ? MENSAJE_NO_LECTIVO[motivo] : null };
}

const jornada = async () => ({
  horaInicioJornada: await parametroHora("HORA_INICIO_JORNADA_DOCENTE"),
  horaLimite: await parametroHora("HORA_LIMITE_ASISTENCIA_DOCENTE"),
});

// ---------- Vista del día (AD-14) ----------

export interface RegistroDelDia {
  id: string;
  estado: EstadoAsistenciaDocente;
  /** «07:31»; null en una inasistencia. */
  horaIngreso: string | null;
  horaSalida: string | null;
  justificacion: string | null;
  /** La inasistencia la marcó la verificación automática de la hora límite. */
  automatica: boolean;
}

export interface DocenteDelDia {
  docenteId: string;
  nombreCompleto: string;
  especialidad: string | null;
  /** Ya no está activo: aparece solo porque tiene un registro en la fecha. */
  inactivo: boolean;
  /** «07:45»: su primera clase de ese día en el horario publicado; null si no tiene clases. */
  primeraClase: string | null;
  registro: RegistroDelDia | null;
}

export interface AsistenciaDocenteDelDia {
  fecha: string;
  /** Fecha de hoy en Lima: solo en ella se registran ingresos y salidas. */
  hoy: string;
  /** «07:46»: hora actual de Lima. */
  horaActual: string;
  horaInicioJornada: string;
  horaLimite: string;
  /** Minutos que faltan hoy para la hora límite; 0 si ya pasó o si la fecha no es hoy. */
  minutosParaLimite: number;
  /** Mensaje si la fecha no es lectiva (fin de semana, sin año en curso o fuera de los bimestres); null si lo es. */
  diaNoLectivo: string | null;
  resumen: ResumenAsistenciaDocente;
  docentes: DocenteDelDia[];
}

const registroDelDia = (r: RegistroDocenteFila): RegistroDelDia => ({
  id: r.id,
  estado: r.estado,
  horaIngreso: r.horaIngreso && minutoDe(r.horaIngreso),
  horaSalida: r.horaSalida && minutoDe(r.horaSalida),
  justificacion: r.justificacion,
  automatica: r.registradoPorId === null,
});

/** Listado del día (por defecto, hoy): docentes activos con su registro, primera clase y contadores (AD-14). */
export async function asistenciaDocenteDelDia(
  filtro: { fecha?: string },
  ahora: Date = new Date(),
): Promise<AsistenciaDocenteDelDia> {
  const hoy = fechaEnLima(ahora);
  const fecha = filtro.fecha ?? hoy;
  const horaActual = minutoDe(horaEnLima(ahora));
  const [{ horaInicioJornada, horaLimite }, lectivo, registros] = await Promise.all([
    jornada(),
    diaNoLectivo(fecha),
    asistenciaDocente.deFecha(fecha),
  ]);
  const dia = diaDeClases(fecha);
  const [personal, primeras] = await Promise.all([
    personalDocente(registros.map((r) => r.docenteId)),
    lectivo.anioId && dia
      ? asistenciaDocente.primerasClases(lectivo.anioId, dia)
      : Promise.resolve<Record<string, string>>({}),
  ]);
  const porDocente = new Map(registros.map((r) => [r.docenteId, r]));
  const docentes = personal.map((d): DocenteDelDia => {
    const registro = porDocente.get(d.id);
    return {
      docenteId: d.id,
      nombreCompleto: d.nombreCompleto,
      especialidad: d.especialidad,
      inactivo: !d.activo,
      primeraClase: primeras[d.id] ?? null,
      registro: registro ? registroDelDia(registro) : null,
    };
  });
  return {
    fecha,
    hoy,
    horaActual,
    horaInicioJornada,
    horaLimite,
    minutosParaLimite: fecha === hoy ? minutosParaLimite(horaActual, horaLimite) : 0,
    diaNoLectivo: lectivo.mensaje,
    resumen: resumenAsistenciaDocente(docentes.map((d) => d.registro?.estado ?? null)),
    docentes,
  };
}

// ---------- Marcaciones del administrador ----------

/** Fecha de hoy, día lectivo y docente activo: lo que exigen el ingreso y la salida (US32, criterio 3). */
async function verificarMarcacion(datos: { docenteId: string; fecha: string }, ahora: Date) {
  verificarDiaActual(datos.fecha, fechaEnLima(ahora));
  const { mensaje } = await diaNoLectivo(datos.fecha);
  if (mensaje) throw E.diaNoLectivo(mensaje);
  const activos = await personalDocente();
  if (!activos.some((d) => d.id === datos.docenteId)) throw E.docenteNoDisponible();
}

/**
 * «Asistió» (US32, criterio 1): registra la hora exacta de ingreso y el estado Puntual o Tardanza. Si el docente ya
 * tenía la falta automática, pasa a Tardanza con la hora real (criterio 2). Solo el día actual de Lima.
 */
export async function registrarIngreso(
  admin: Autenticado,
  datos: { docenteId: string; fecha: string },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<RegistroDelDia> {
  await verificarMarcacion(datos, ahora);
  const hora = horaEnLima(ahora);
  const { horaInicioJornada } = await jornada();
  try {
    const registro = await prisma.$transaction(async (tx) => {
      await asistenciaDocente.bloquear(tx, datos.docenteId, datos.fecha);
      const actual = await asistenciaDocente.delDia(datos.docenteId, datos.fecha, tx);
      const ingreso = ingresoPara(actual, hora, horaInicioJornada);
      const nuevo = actual
        ? await asistenciaDocente.actualizar(
            actual.id,
            { estado: ingreso.estado, horaIngreso: hora, registradoPorId: admin.usuarioId },
            tx,
          )
        : await asistenciaDocente.crear(
            { ...datos, estado: ingreso.estado, horaIngreso: hora, registradoPorId: admin.usuarioId },
            tx,
          );
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: ENTIDAD,
          entidadId: nuevo.id,
          accion: ingreso.reemplazaFalta ? "REEMPLAZAR_FALTA_DOCENTE" : "REGISTRAR_INGRESO_DOCENTE",
          anterior: actual
            ? { estado: actual.estado, horaIngreso: null, automatica: actual.registradoPorId === null }
            : null,
          nuevo: { docenteId: datos.docenteId, fecha: datos.fecha, estado: nuevo.estado, horaIngreso: hora },
          motivo: ingreso.reemplazaFalta ? "El docente llegó después de la hora límite" : null,
        },
        meta,
      );
      return nuevo;
    });
    return registroDelDia(registro);
  } catch (e) {
    // otra solicitud registró el ingreso a la vez (clave única docente + fecha)
    if (esDuplicado(e)) throw E.ingresoYaRegistrado(minutoDe(hora));
    throw e;
  }
}

/** Hora de salida del día: necesita el ingreso y se registra una vez (US32). Solo el día actual de Lima. */
export async function registrarSalida(
  admin: Autenticado,
  datos: { docenteId: string; fecha: string },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<RegistroDelDia> {
  await verificarMarcacion(datos, ahora);
  const hora = horaEnLima(ahora);
  const registro = await prisma.$transaction(async (tx) => {
    await asistenciaDocente.bloquear(tx, datos.docenteId, datos.fecha);
    const actual = await asistenciaDocente.delDia(datos.docenteId, datos.fecha, tx);
    verificarSalida(actual, hora);
    const nuevo = await asistenciaDocente.actualizar(actual!.id, { horaSalida: hora }, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: ENTIDAD,
        entidadId: nuevo.id,
        accion: "REGISTRAR_SALIDA_DOCENTE",
        anterior: { horaSalida: null },
        nuevo: { docenteId: datos.docenteId, fecha: datos.fecha, horaSalida: hora },
      },
      meta,
    );
    return nuevo;
  });
  return registroDelDia(registro);
}

/** Justifica una inasistencia de cualquier fecha con motivo obligatorio: queda como «Falta justificada» (US32). */
export async function justificarFalta(
  admin: Autenticado,
  registroId: string,
  datos: { motivo: string },
  meta: MetaSolicitud,
): Promise<RegistroDelDia> {
  const registro = await prisma.$transaction(async (tx) => {
    const encontrado = await asistenciaDocente.porId(registroId, tx);
    if (!encontrado) throw errores.noEncontrado("El registro de asistencia");
    await asistenciaDocente.bloquear(tx, encontrado.docenteId, encontrado.fecha);
    const actual = (await asistenciaDocente.porId(registroId, tx))!;
    verificarJustificable(actual);
    const nuevo = await asistenciaDocente.actualizar(
      registroId,
      { estado: "FALTA_JUSTIFICADA", justificacion: datos.motivo },
      tx,
    );
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: ENTIDAD,
        entidadId: registroId,
        accion: "JUSTIFICAR_FALTA_DOCENTE",
        anterior: { estado: actual.estado },
        nuevo: { docenteId: actual.docenteId, fecha: actual.fecha, estado: nuevo.estado },
        motivo: datos.motivo,
      },
      meta,
    );
    return nuevo;
  });
  return registroDelDia(registro);
}

// ---------- Verificación automática (scripts/tareasProgramadas.ts) ----------

export interface ResultadoFaltasDocentes {
  fecha: string;
  hora: string;
  /** Docentes marcados con falta en esta ejecución (0 si ya estaban todos marcados). */
  marcadas: number;
  /** Por qué no se verificó: antes de la hora límite o día no lectivo; null si se verificó. */
  omitida: string | null;
}

/**
 * US32, criterio 2: desde la hora límite, marca «Inasistencia» a los docentes activos sin registro del día. Solo en
 * días lectivos. Es idempotente: la clave única (docente, fecha) impide repetir la falta, así que el timer de 15
 * minutos puede ejecutarla todas las veces que quiera.
 */
export async function marcarFaltasDocentes(ahora: Date = new Date()): Promise<ResultadoFaltasDocentes> {
  const fecha = fechaEnLima(ahora);
  const hora = minutoDe(horaEnLima(ahora));
  const { horaLimite } = await jornada();
  if (!alcanzoHoraLimite(hora, horaLimite)) {
    return { fecha, hora, marcadas: 0, omitida: `Aún no llega la hora límite (${horaLimite}).` };
  }
  const { mensaje } = await diaNoLectivo(fecha);
  if (mensaje) return { fecha, hora, marcadas: 0, omitida: mensaje };

  const [activos, registros] = await Promise.all([personalDocente(), asistenciaDocente.deFecha(fecha)]);
  const pendientes = docentesSinMarcar(
    activos.map((d) => d.id),
    registros.map((r) => r.docenteId),
  );
  const creadas = await prisma.$transaction(async (tx) => {
    const faltas = await asistenciaDocente.crearFaltas(pendientes, fecha, tx);
    for (const f of faltas) {
      await registrarAuditoria(tx, {
        usuarioId: null,
        entidad: ENTIDAD,
        entidadId: f.id,
        accion: "MARCAR_FALTA_DOCENTE",
        nuevo: { docenteId: f.docenteId, fecha, estado: "FALTA", horaLimite },
        motivo: `Sin marcar a la hora límite (${horaLimite}): verificación automática`,
      });
    }
    return faltas;
  });
  return { fecha, hora, marcadas: creadas.length, omitida: null };
}
