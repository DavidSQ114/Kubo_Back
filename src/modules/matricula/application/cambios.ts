// matricula/application: cambios sobre una matrícula Matriculado: traslado de sección (US19, M-05), retiro del
// estudiante (US57, M-18) y ficha de matrícula en PDF (US20, AD-10). Además, la «sección en una fecha» por historial,
// lista para asistencia y notas.
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import { obtenerParametro } from "@/platform/config/parametros";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { generarPdf, type DocumentoPdf } from "@/platform/pdf";
import { fechaEnLima, listarSecciones, obtenerAnio, seccionBloqueadaParaMatricula } from "@/modules/academico";
import { estudianteParaFicha, type EstudianteFicha } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import {
  cuotasAnulablesPorRetiro,
  instanteDeRetiro,
  NOMBRE_MOTIVO_RETIRO,
  seccionEnFecha,
  textoMotivoRetiro,
  verificarCupoDestino,
  verificarDestino,
  verificarFechaRetiro,
  verificarFechaTraslado,
  verificarFichaCompleta,
  verificarFichaDisponible,
  verificarMotivoRetiro,
  verificarRetirable,
  verificarTrasladable,
  type MotivoRetiro,
} from "../domain/cambios";
import { erroresMatricula as E } from "../domain/errores";
import { NOMBRE_ESTADO_MATRICULA } from "../domain/matriculas";
import { cuotas, historial, matriculas, type MatriculaFila } from "../infrastructure/repositorio";
import { detalleMatricula } from "./matriculas";

const INSTITUCION_POR_DEFECTO = "Institución Educativa Kubo";
const motivoTrasladoPorDefecto = "Traslado de sección";

async function matriculaExistente(matriculaId: string) {
  const m = await matriculas.porId(matriculaId);
  if (!m) throw E.noEncontrada();
  return m;
}

// ---------- Traslado de sección (US19) ----------

export interface DatosTraslado {
  seccionDestinoId: string;
  /** Fecha efectiva «AAAA-MM-DD»; por defecto, hoy en Lima. */
  fecha?: string | null;
  motivo?: string | null;
}

/**
 * Traslada la matrícula a otra sección del mismo grado y año (US19). En una transacción bloquea la fila de la sección
 * destino (como la confirmación de US18) antes de contar sus matriculados: dos traslados simultáneos no ocupan la
 * misma última vacante. Cierra el tramo actual del historial (fechaFin = fecha del traslado) y abre el nuevo, así
 * los registros anteriores siguen asociados a la sección de origen.
 */
export async function trasladarMatricula(
  admin: Autenticado,
  matriculaId: string,
  datos: DatosTraslado,
  meta: MetaSolicitud,
) {
  const previa = await matriculaExistente(matriculaId);
  verificarTrasladable(previa.estado);
  const [anio, secciones] = await Promise.all([
    obtenerAnio(previa.anioAcademicoId),
    listarSecciones(previa.anioAcademicoId),
  ]);
  const fecha = datos.fecha ?? fechaEnLima(new Date());
  const motivo = datos.motivo?.trim() || null;

  await prisma.$transaction(async (tx) => {
    // mismo orden de bloqueo que la confirmación (primero la sección, luego la matrícula) para no cruzarse con ella
    const destino = await seccionBloqueadaParaMatricula(tx, datos.seccionDestinoId);
    if (!destino) throw E.seccionNoEncontrada();
    await matriculas.bloquearFila(tx, matriculaId);
    const m = (await matriculas.porId(matriculaId, tx))!;
    verificarTrasladable(m.estado);
    const origen = secciones.find((s) => s.id === m.seccionId);
    if (!origen) throw E.seccionNoEncontrada();
    verificarDestino(
      { id: origen.id, anioAcademicoId: origen.anioAcademicoId, gradoId: origen.grado.id, estado: origen.estado },
      { id: destino.id, anioAcademicoId: destino.anioAcademicoId, gradoId: destino.grado.id, estado: destino.estado },
    );
    const tramo = await historial.vigente(matriculaId, tx);
    verificarFechaTraslado(fecha, {
      inicioSeccionActual: tramo?.fechaInicio ?? m.fechaMatricula,
      finAnio: anio.fechaFin,
    });
    verificarCupoDestino(await matriculas.contarMatriculados(destino.id, tx), destino.aforoMaximo);

    await historial.cerrar(matriculaId, fecha, tx);
    await historial.abrir(
      {
        matriculaId,
        seccionId: destino.id,
        fechaInicio: fecha,
        registradoPorId: admin.usuarioId,
        motivo: motivo ?? motivoTrasladoPorDefecto,
      },
      tx,
    );
    await matriculas.trasladar(matriculaId, destino.id, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "matricula",
        entidadId: matriculaId,
        accion: "TRASLADAR_SECCION",
        anterior: { seccionId: origen.id, seccion: `${origen.grado.numero}° ${origen.nombre}` },
        nuevo: { seccionId: destino.id, seccion: `${destino.grado.numero}° ${destino.nombre}`, fecha },
        motivo,
      },
      meta,
    );
  });
  return detalleMatricula(matriculaId);
}

// ---------- Retiro del estudiante (US57) ----------

export interface DatosRetiro {
  /** «AAAA-MM-DD»; por defecto, hoy en Lima. */
  fecha?: string | null;
  motivo?: MotivoRetiro | null;
  detalle?: string | null;
}

/**
 * Registra el retiro (US57): la matrícula pasa a Retirado (libera la vacante, porque solo cuentan las Matriculado),
 * se cierra su tramo del historial y se anulan las cuotas pendientes que vencen después de la fecha de retiro. Las
 * pagadas, las vencidas y las que tienen pagos se conservan.
 */
export async function retirarMatricula(
  admin: Autenticado,
  matriculaId: string,
  datos: DatosRetiro,
  meta: MetaSolicitud,
) {
  const motivo = verificarMotivoRetiro(datos.motivo);
  const previa = await matriculaExistente(matriculaId);
  verificarRetirable(previa.estado);
  const anio = await obtenerAnio(previa.anioAcademicoId);
  const fecha = datos.fecha ?? fechaEnLima(new Date());
  const detalle = datos.detalle?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await matriculas.bloquearFila(tx, matriculaId);
    const m = (await matriculas.porId(matriculaId, tx))!;
    verificarRetirable(m.estado);
    const tramo = await historial.vigente(matriculaId, tx);
    verificarFechaRetiro(fecha, {
      fechaMatricula: m.fechaMatricula,
      finAnio: anio.fechaFin,
      inicioSeccionActual: tramo?.fechaInicio,
    });

    const anulables = cuotasAnulablesPorRetiro(await cuotas.conPagos(matriculaId, tx), fecha);
    await cuotas.anularPorIds(
      anulables.map((c) => c.id),
      tx,
    );
    await matriculas.retirar(
      matriculaId,
      { retiradoEn: instanteDeRetiro(fecha), motivoRetiro: motivo, detalleRetiro: detalle },
      tx,
    );
    await historial.cerrar(matriculaId, fecha, tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "matricula",
        entidadId: matriculaId,
        accion: "RETIRAR_ESTUDIANTE",
        anterior: { estado: m.estado, seccionId: m.seccionId },
        nuevo: {
          estado: "RETIRADO",
          fechaRetiro: fecha,
          motivoRetiro: motivo,
          cuotasAnuladas: anulables.map(({ id, concepto, fechaVencimiento, monto }) => ({
            id,
            concepto,
            fechaVencimiento,
            monto,
          })),
        },
        motivo: textoMotivoRetiro(motivo, detalle),
      },
      meta,
    );
  });
  return detalleMatricula(matriculaId);
}

// ---------- Sección en una fecha (para asistencia y notas) ----------

/**
 * Sección en la que estaba la matrícula en esa fecha («AAAA-MM-DD»), según su historial: el día de un traslado ya
 * cuenta en la sección destino. null antes de matricularse o desde el retiro. La usarán asistencia y notas.
 */
export async function seccionDeMatriculaEnFecha(matriculaId: string, fecha: string): Promise<string | null> {
  return seccionEnFecha(await historial.deMatricula(matriculaId), fecha);
}

/** Matrículas (no anuladas) que estaban en la sección en esa fecha: la lista de una asistencia o un registro de notas. */
export const matriculasDeSeccionEnFecha = (seccionId: string, fecha: string) =>
  historial.matriculasDeSeccionEnFecha(seccionId, fecha);

// ---------- Ficha de matrícula en PDF (US20) ----------

const fechaCorta = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "");

/** «06/11/2026 10:24» en la hora de Lima. */
function fechaHoraLima(instante: Date) {
  const p = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instante);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} ${v("hour")}:${v("minute")}`;
}

function documentoFicha(datos: {
  institucion: string;
  m: MatriculaFila;
  anio: number;
  e: EstudianteFicha;
  seccion: { grado: string; nombre: string; aula: string | null; tutor: string | null };
  generadaEn: Date;
}): DocumentoPdf {
  const { m, e, seccion } = datos;
  const retiro: [string, string][] =
    m.estado === "RETIRADO" && m.retiradoEn && m.motivoRetiro
      ? [
          ["Fecha de retiro", fechaCorta(fechaEnLima(m.retiradoEn))],
          ["Motivo del retiro", NOMBRE_MOTIVO_RETIRO[m.motivoRetiro]],
          ...(m.detalleRetiro ? ([["Detalle del retiro", m.detalleRetiro]] as [string, string][]) : []),
        ]
      : [];
  return {
    nombre: "ficha-matricula",
    institucion: datos.institucion,
    titulo: `Ficha de matrícula ${datos.anio}`,
    subtitulo:
      m.estado === "RETIRADO"
        ? "Constancia de matrícula · estudiante retirado"
        : `${seccion.grado} · Sección ${seccion.nombre}`,
    bloques: [
      {
        tipo: "datos",
        titulo: "Datos del estudiante",
        filas: [
          ["Apellidos", e.apellidos],
          ["Nombres", e.nombres],
          ["DNI", e.dni],
          ["Fecha de nacimiento", fechaCorta(e.fechaNacimiento)],
          ["Sexo", e.sexo === "FEMENINO" ? "Femenino" : e.sexo === "MASCULINO" ? "Masculino" : ""],
          ["Dirección", e.direccion ?? ""],
          ["Colegio de procedencia", e.colegioProcedencia ?? ""],
        ],
      },
      {
        tipo: "datos",
        titulo: "Datos de la matrícula",
        filas: [
          ["Año académico", String(datos.anio)],
          ["Grado", seccion.grado],
          ["Sección", seccion.nombre],
          ["Aula", seccion.aula ?? ""],
          ["Tutor", seccion.tutor ?? ""],
          ["Fecha de matrícula", fechaCorta(m.fechaMatricula)],
          ["Modalidad de pago", m.modalidadPago === "ANUAL" ? "Anual" : "Mensual"],
          ["Estado", NOMBRE_ESTADO_MATRICULA[m.estado]],
          ...retiro,
        ],
      },
      {
        tipo: "tabla",
        titulo: "Apoderados",
        columnas: [
          { titulo: "Apellidos y nombres", ancho: 0.3 },
          { titulo: "DNI", ancho: 0.13 },
          { titulo: "Parentesco", ancho: 0.15 },
          { titulo: "Teléfono", ancho: 0.14 },
          { titulo: "Condición", ancho: 0.28 },
        ],
        filas: e.apoderados.map((a) => [
          a.nombreCompleto,
          a.dni,
          a.parentesco,
          a.telefono ?? "",
          [a.esPrincipal ? "Principal" : "", a.vinculoId === m.vinculoResponsableId ? "Responsable del pago" : ""]
            .filter(Boolean)
            .join(" · "),
        ]),
      },
      {
        tipo: "texto",
        texto:
          "Ficha generada con los datos registrados en Kubo al momento de la descarga. Cualquier cambio posterior se " +
          "refleja al generarla de nuevo.",
      },
    ],
    pie: `Generada el ${fechaHoraLima(datos.generadaEn)} (hora de Lima)`,
  };
}

/**
 * Ficha de matrícula en PDF (US20) con los datos actuales: no guarda el archivo ni crea registros de matrícula; solo
 * deja GENERAR_FICHA_MATRICULA en la auditoría (sin el contenido). Matriculado o, como constancia, Retirado.
 */
export async function generarFichaMatricula(admin: Autenticado, matriculaId: string, meta: MetaSolicitud) {
  const m = await matriculaExistente(matriculaId);
  verificarFichaDisponible(m.estado);
  const [e, anio, secciones, institucion] = await Promise.all([
    estudianteParaFicha(m.estudianteId),
    obtenerAnio(m.anioAcademicoId),
    listarSecciones(m.anioAcademicoId),
    obtenerParametro<string>("NOMBRE_INSTITUCION"),
  ]);
  const seccion = secciones.find((s) => s.id === m.seccionId);
  const responsable = e?.apoderados.find((a) => a.vinculoId === m.vinculoResponsableId);
  verificarFichaCompleta({
    dni: e?.dni,
    nombres: e?.nombres,
    apellidos: e?.apellidos,
    fechaNacimiento: e?.fechaNacimiento,
    grado: seccion?.grado.nombre,
    seccion: seccion?.nombre,
    fechaMatricula: m.fechaMatricula,
    modalidadPago: m.modalidadPago,
    apoderados: e?.apoderados.length ?? 0,
    responsablePago: responsable?.nombreCompleto,
  });

  const generadaEn = new Date();
  const bytes = await generarPdf(
    documentoFicha({
      institucion: typeof institucion === "string" && institucion.trim() ? institucion : INSTITUCION_POR_DEFECTO,
      m,
      anio: anio.anio,
      e: e!,
      seccion: {
        grado: seccion!.grado.nombre,
        nombre: seccion!.nombre,
        aula: seccion!.aula?.nombre ?? null,
        tutor: seccion!.tutor?.nombreCompleto ?? null,
      },
      generadaEn,
    }),
  );
  await prisma.$transaction((tx) =>
    registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "matricula",
        entidadId: matriculaId,
        accion: "GENERAR_FICHA_MATRICULA",
        nuevo: { estado: m.estado, generadaEn: generadaEn.toISOString(), bytes: bytes.byteLength },
      },
      meta,
    ),
  );
  return { bytes, nombreArchivo: `ficha-matricula-${anio.anio}-${matriculaId.slice(0, 8)}.pdf` };
}
