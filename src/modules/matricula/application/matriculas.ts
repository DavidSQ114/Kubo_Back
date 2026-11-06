// matricula/application: matrícula en sección (US18, RF14, AD-10), cronograma de pagos (US21, RF16) y anulación
// (M-19). Confirmar y generar el cronograma van en una sola transacción, con la fila de la sección bloqueada.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { obtenerParametro } from "@/platform/config/parametros";
import type { MetaSolicitud } from "@/platform/http/ruta";
import {
  aCentimos,
  deCentimos,
  fechaEnLima,
  listarGrados,
  listarSecciones,
  montosDelAnio,
  NOMBRE_ESTADO_ANIO,
  obtenerAnio,
  seccionBloqueadaParaMatricula,
  type SeccionVista,
} from "@/modules/academico";
import { estudianteParaMatricula, idsEstudiantesPorBusqueda, resumenEstudiantes } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import {
  esExtemporanea,
  generarCronograma,
  rangoPensiones,
  totalCentimos,
  type CuotaCronograma,
} from "../domain/cronograma";
import { erroresMatricula as E } from "../domain/errores";
import {
  textoMotivoAnulacion,
  verificarAnioMatriculable,
  verificarAnulable,
  verificarCompleta,
  verificarConfirmable,
  verificarCupo,
  verificarResponsable,
  type EstadoMatricula,
  type ModalidadPago,
  type MotivoAnulacionMatricula,
} from "../domain/matriculas";
import { contarPagosVigentes, cuotas, historial, matriculas, type MatriculaFila } from "../infrastructure/repositorio";

const etiquetaSeccion = (s: Pick<SeccionVista, "nombre" | "grado">) => `${s.grado.numero}° ${s.nombre}`;

/** Cuotas con el monto en texto («450.00») para la API. */
function vistaCronograma(lista: CuotaCronograma[]) {
  return {
    cuotas: lista.map(({ montoCentimos, ...c }) => ({ ...c, monto: deCentimos(montoCentimos) })),
    total: deCentimos(totalCentimos(lista)),
    extemporanea: esExtemporanea(lista),
    pensiones: rangoPensiones(lista),
  };
}

/** Montos del año en céntimos; sin montos el año no admite matrículas (422 SIN_MONTOS). */
async function montosParaMatricular(anioAcademicoId: string) {
  const m = await montosDelAnio(anioAcademicoId);
  if (!m.montoMatricula || !m.montoPension) throw E.sinMontos(m.anio);
  return { anio: m.anio, matricula: aCentimos(m.montoMatricula), pension: aCentimos(m.montoPension) };
}

function cronogramaPara(
  anio: number,
  fechaMatricula: string,
  montos: { matricula: number; pension: number },
  dia: unknown,
) {
  return generarCronograma({
    anio,
    fechaMatricula,
    montoMatriculaCentimos: montos.matricula,
    montoPensionCentimos: montos.pension,
    diaVencimiento: dia == null ? undefined : Number(dia),
  });
}

// ---------- Situación del estudiante para matricular (AD-10) ----------

/**
 * Lo que AD-10 necesita al elegir un estudiante: sus apoderados (responsable del pago), su matrícula vigente en el
 * año (En proceso o Matriculado) y el cronograma que se generaría hoy con los montos del año.
 */
export async function situacionEstudiante(estudianteId: string, anioAcademicoId: string) {
  const [estudiante, anio, montos, dia] = await Promise.all([
    estudianteParaMatricula(estudianteId),
    obtenerAnio(anioAcademicoId),
    montosDelAnio(anioAcademicoId),
    obtenerParametro("DIA_VENCIMIENTO", anioAcademicoId),
  ]);
  if (!estudiante?.activo) throw E.estudianteNoEncontrado();
  const vigente = await matriculas.vigente(estudianteId, anioAcademicoId);
  const hoy = fechaEnLima(new Date());
  const previsto =
    montos.montoMatricula && montos.montoPension
      ? vistaCronograma(
          cronogramaPara(
            anio.anio,
            hoy,
            { matricula: aCentimos(montos.montoMatricula), pension: aCentimos(montos.montoPension) },
            dia,
          ),
        )
      : null;
  return {
    estudiante,
    anio: { id: anio.id, anio: anio.anio, estado: anio.estado },
    matricula: vigente && {
      matriculaId: vigente.id,
      estado: vigente.estado,
      seccionId: vigente.seccionId,
      vinculoResponsableId: vigente.vinculoResponsableId,
      modalidadPago: vigente.modalidadPago,
      fechaMatricula: vigente.fechaMatricula,
    },
    montos: { montoMatricula: montos.montoMatricula, montoPension: montos.montoPension },
    cronogramaPrevisto: previsto,
  };
}

// ---------- Confirmar la matrícula y generar el cronograma (US18, US21) ----------

export interface DatosMatricula {
  estudianteId: string;
  anioAcademicoId: string;
  seccionId?: string | null;
  vinculoResponsableId?: string | null;
  modalidadPago: ModalidadPago;
}

/**
 * Matricula al estudiante en la sección (US18): confirma su matrícula En proceso o crea una nueva, y en la misma
 * transacción genera su cronograma (US21). Bloquea la fila de la sección y recién entonces cuenta las matrículas
 * Matriculado: de dos solicitudes simultáneas por la última vacante, solo una pasa.
 */
export async function confirmarMatricula(admin: Autenticado, datos: DatosMatricula, meta: MetaSolicitud) {
  verificarCompleta(datos);
  const seccionId = datos.seccionId!;
  const vinculoResponsableId = datos.vinculoResponsableId!;
  const anio = await obtenerAnio(datos.anioAcademicoId);
  verificarAnioMatriculable(anio, NOMBRE_ESTADO_ANIO[anio.estado]);
  const [montos, dia] = await Promise.all([
    montosParaMatricular(anio.id),
    obtenerParametro("DIA_VENCIMIENTO", anio.id),
  ]);

  let matriculaId: string;
  try {
    matriculaId = await prisma.$transaction(async (tx) => {
      const seccion = await seccionBloqueadaParaMatricula(tx, seccionId);
      if (!seccion) throw E.seccionNoEncontrada();
      if (seccion.anioAcademicoId !== anio.id) throw E.seccionOtroAnio();
      if (seccion.estado !== "ACTIVA") throw E.seccionInactiva();

      const estudiante = await estudianteParaMatricula(datos.estudianteId, tx);
      if (!estudiante?.activo) throw E.estudianteNoEncontrado();
      verificarResponsable(
        vinculoResponsableId,
        estudiante.apoderados.map((a) => a.vinculoId),
      );

      const vigente = await matriculas.vigenteBloqueada(tx, datos.estudianteId, anio.id);
      const accion = verificarConfirmable(vigente);
      // la vacante se valida recién aquí: las matrículas En proceso no la reservan
      verificarCupo(await matriculas.contarMatriculados(seccion.id, tx), seccion.aforoMaximo);

      const fechaMatricula = fechaEnLima(new Date());
      const confirmacion = { seccionId, vinculoResponsableId, modalidadPago: datos.modalidadPago, fechaMatricula };
      const id =
        accion === "CONFIRMAR"
          ? (await matriculas.confirmar(vigente!.id, confirmacion, tx)).id
          : (
              await matriculas.crear(
                {
                  ...confirmacion,
                  estudianteId: datos.estudianteId,
                  anioAcademicoId: anio.id,
                  registradoPorId: admin.usuarioId,
                },
                tx,
              )
            ).id;
      await historial.abrir(
        {
          matriculaId: id,
          seccionId,
          fechaInicio: fechaMatricula,
          registradoPorId: admin.usuarioId,
          motivo: "Matrícula",
        },
        tx,
      );

      const cronograma = cronogramaPara(anio.anio, fechaMatricula, montos, dia);
      await cuotas.crear(id, cronograma, tx);

      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "matricula",
          entidadId: id,
          accion: "CONFIRMAR_MATRICULA",
          anterior: vigente ? { estado: vigente.estado, seccionId: vigente.seccionId } : undefined,
          nuevo: {
            estado: "MATRICULADO",
            estudianteId: datos.estudianteId,
            anio: anio.anio,
            seccion: `${seccion.grado.numero}° ${seccion.nombre}`,
            seccionId,
            vinculoResponsableId,
            modalidadPago: datos.modalidadPago,
            fechaMatricula,
          },
        },
        meta,
      );
      const resumen = vistaCronograma(cronograma);
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "matricula",
          entidadId: id,
          accion: "GENERAR_CRONOGRAMA",
          nuevo: {
            cuotas: cronograma.length,
            total: resumen.total,
            extemporanea: resumen.extemporanea,
            pensiones: resumen.pensiones,
            montoMatricula: deCentimos(montos.matricula),
            montoPension: deCentimos(montos.pension),
          },
        },
        meta,
      );
      return id;
    });
  } catch (e) {
    // dos confirmaciones simultáneas del mismo estudiante sin borrador previo: el índice único rechaza la segunda
    if (esDuplicado(e, "uq_matricula_activa_por_anio")) throw E.yaMatriculado({ matriculaId: "", seccionId: null });
    throw e;
  }
  return detalleMatricula(matriculaId);
}

// ---------- Anular (M-19) ----------

/**
 * Anula una matrícula En proceso o Matriculado sin pagos: sus cuotas pendientes pasan a Anulado (US21), se cierra su
 * historial de sección (libera la vacante) y se registra ANULAR_MATRICULA con el motivo.
 */
export async function anularMatricula(
  admin: Autenticado,
  matriculaId: string,
  datos: { motivo: MotivoAnulacionMatricula; detalle: string },
  meta: MetaSolicitud,
) {
  await prisma.$transaction(async (tx) => {
    await matriculas.bloquearFila(tx, matriculaId);
    const m = await matriculas.porId(matriculaId, tx);
    if (!m) throw E.noEncontrada();
    verificarAnulable(m.estado, await contarPagosVigentes(matriculaId, tx));
    const ahora = new Date();
    const motivo = textoMotivoAnulacion(datos.motivo, datos.detalle);
    const cuotasAnuladas = await cuotas.anularPendientes(matriculaId, tx);
    await matriculas.anular(
      matriculaId,
      { anuladoPorId: admin.usuarioId, anuladoEn: ahora, motivoAnulacion: motivo },
      tx,
    );
    await historial.cerrar(matriculaId, fechaEnLima(ahora), tx);
    await registrarAuditoria(
      tx,
      {
        usuarioId: admin.usuarioId,
        entidad: "matricula",
        entidadId: matriculaId,
        accion: "ANULAR_MATRICULA",
        anterior: { estado: m.estado, seccionId: m.seccionId },
        nuevo: { estado: "ANULADO", cuotasAnuladas },
        motivo,
      },
      meta,
    );
  });
  return detalleMatricula(matriculaId);
}

// ---------- Listado y detalle (AD-10) ----------

export interface FiltroMatriculas {
  anioId: string;
  estado?: EstadoMatricula;
  gradoId?: string;
  seccionId?: string;
  q?: string;
  pagina: number;
  tamano: number;
}

/**
 * Matrículas del año con filtros y búsqueda por estudiante. Se filtra en memoria: un colegio tiene a lo sumo unos
 * cientos de matrículas por año, y así matricula no lee tablas de comunidad ni de académico.
 */
export async function listarMatriculas(f: FiltroMatriculas) {
  const [filas, secciones, grados] = await Promise.all([
    matriculas.delAnio(f.anioId, f.estado),
    listarSecciones(f.anioId),
    listarGrados(),
  ]);
  const seccionPorId = new Map(secciones.map((s) => [s.id, s]));
  const gradoPorId = new Map(grados.map((g) => [g.id, g]));
  const [estudiantes, coincidencias] = await Promise.all([
    resumenEstudiantes([...new Set(filas.map((m) => m.estudianteId))]),
    f.q ? idsEstudiantesPorBusqueda(f.q).then((ids) => new Set(ids)) : Promise.resolve(null),
  ]);

  const gradoDe = (m: MatriculaFila) => {
    const seccion = m.seccionId ? seccionPorId.get(m.seccionId) : undefined;
    if (seccion) return seccion.grado;
    const gradoIngreso = estudiantes[m.estudianteId]?.gradoIngresoId;
    return gradoIngreso ? gradoPorId.get(gradoIngreso) : undefined;
  };
  const filtradas = filas.filter(
    (m) =>
      (!f.seccionId || m.seccionId === f.seccionId) &&
      (!f.gradoId || gradoDe(m)?.id === f.gradoId) &&
      (!coincidencias || coincidencias.has(m.estudianteId)),
  );
  const pagina = filtradas.slice((f.pagina - 1) * f.tamano, f.pagina * f.tamano);
  return {
    items: pagina.map((m) => {
      const seccion = m.seccionId ? seccionPorId.get(m.seccionId) : undefined;
      const e = estudiantes[m.estudianteId];
      return {
        matriculaId: m.id,
        estudianteId: m.estudianteId,
        estudiante: { nombreCompleto: e?.nombreCompleto ?? "—", dni: e?.dni ?? "" },
        grado: gradoDe(m)?.nombre ?? null,
        seccion: seccion ? { id: seccion.id, nombre: etiquetaSeccion(seccion) } : null,
        fechaMatricula: m.fechaMatricula,
        estado: m.estado,
        modalidadPago: m.modalidadPago,
      };
    }),
    paginacion: {
      pagina: f.pagina,
      tamano: f.tamano,
      total: filtradas.length,
      paginas: Math.ceil(filtradas.length / f.tamano),
    },
  };
}

/** Detalle de una matrícula: estudiante, sección, apoderados (con el responsable del pago) y cronograma. */
export async function detalleMatricula(matriculaId: string) {
  const m = await matriculas.porId(matriculaId);
  if (!m) throw E.noEncontrada();
  const [estudiante, anio, secciones, lista, pagos] = await Promise.all([
    estudianteParaMatricula(m.estudianteId),
    obtenerAnio(m.anioAcademicoId),
    listarSecciones(m.anioAcademicoId),
    cuotas.deMatricula(m.id),
    contarPagosVigentes(m.id),
  ]);
  const seccion = secciones.find((s) => s.id === m.seccionId);
  const vigentes = lista.filter((c) => c.estado !== "ANULADO");
  return {
    matriculaId: m.id,
    estado: m.estado,
    fechaMatricula: m.fechaMatricula,
    modalidadPago: m.modalidadPago,
    anio: { id: anio.id, anio: anio.anio },
    estudiante: estudiante && {
      estudianteId: estudiante.estudianteId,
      nombreCompleto: estudiante.nombreCompleto,
      dni: estudiante.dni,
    },
    seccion: seccion
      ? {
          id: seccion.id,
          nombre: etiquetaSeccion(seccion),
          aula: seccion.aula?.nombre ?? null,
          tutor: seccion.tutor?.nombreCompleto ?? null,
        }
      : null,
    apoderados: (estudiante?.apoderados ?? []).map((a) => ({
      ...a,
      esResponsablePago: a.vinculoId === m.vinculoResponsableId,
    })),
    cronograma: {
      cuotas: lista,
      total: deCentimos(vigentes.reduce((suma, c) => suma + aCentimos(c.monto), 0)),
    },
    anulacion: m.anuladoEn ? { anuladoEn: m.anuladoEn, motivo: m.motivoAnulacion } : null,
    pagos,
    puedeAnular: (m.estado === "EN_PROCESO" || m.estado === "MATRICULADO") && pagos === 0,
  };
}
