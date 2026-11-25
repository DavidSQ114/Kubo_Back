// matricula/application: cuotas extraordinarias (bloque M4). El Coordinador académico ve la vista previa (cantidad y
// total), crea el lote (una cuota por matrícula Matriculado del destino) y puede anular el lote o una cuota sin pagar.
// Todo se audita y se avisa en la campana a los apoderados responsables del pago. Las cuotas aparecen en el estado de
// cuenta, en AP-02 (también en el pago en línea) y en el recibo como cualquier otra cuota.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { registrarAvisos, type AvisoInterno } from "@/platform/notificaciones";
import {
  aCentimos,
  deCentimos,
  fechaEnLima,
  listarGrados,
  listarSecciones,
  NOMBRE_ESTADO_ANIO,
  obtenerAnio,
} from "@/modules/academico";
import { nombresDeUsuarios, resumenEstudiantes, responsablesDeVinculos } from "@/modules/comunidad";
import { usuariosDePersonas, type Autenticado } from "@/modules/identidad";
import { erroresMatricula as E } from "../domain/errores";
import {
  conceptoExtraValido,
  matriculasDelDestino,
  NOMBRE_DESTINO_LOTE,
  resumenLote,
  verificarAnioParaLote,
  verificarConMatriculas,
  verificarDestino,
  verificarExtraordinariaAnulable,
  verificarLoteAnulable,
  verificarVencimientoLote,
  type DestinoLote,
} from "../domain/extraordinarias";
import { motivoValido } from "../domain/mora";
import { lotes, type LoteFila } from "../infrastructure/extraordinarias";
import { cuotasAnulables } from "../infrastructure/mora";
import { matriculas, type MatriculaFila } from "../infrastructure/repositorio";

const ENTIDAD_LOTE = "lote_cuota_extraordinaria";
const ENLACE_PAGOS = "/apoderado/pagos";

export interface DatosLote {
  anioAcademicoId: string;
  concepto: string;
  /** «50.00». */
  monto: string;
  /** «AAAA-MM-DD». */
  fechaVencimiento: string;
  destino: DestinoLote;
  destinoId?: string | null;
}

const etiquetaSeccion = (s: { nombre: string; grado: { numero: number } }) => `${s.grado.numero}° ${s.nombre}`;

/**
 * Valida los datos y resuelve el destino: nombre («3° B», «Valeria Quispe Rojas», «Todo el año 2026») y matrículas
 * Matriculado que reciben la cuota. Con `tx`, lee las matrículas dentro de la transacción de la creación.
 */
async function prepararLote(datos: DatosLote, tx?: Tx) {
  const concepto = conceptoExtraValido(datos.concepto);
  const montoCentimos = aCentimos(datos.monto);
  verificarVencimientoLote(datos.fechaVencimiento, fechaEnLima(new Date()));
  verificarDestino(datos.destino, datos.destinoId);
  const anio = await obtenerAnio(datos.anioAcademicoId);
  verificarAnioParaLote(anio, NOMBRE_ESTADO_ANIO[anio.estado]);
  const [secciones, todas] = await Promise.all([
    listarSecciones(anio.id),
    matriculas.delAnio(anio.id, "MATRICULADO", tx),
  ]);
  const destinoId = datos.destino === "ANIO" ? null : datos.destinoId!;
  let destinoNombre = `Todo el año ${anio.anio}`;
  if (datos.destino === "SECCION") {
    const s = secciones.find((x) => x.id === destinoId);
    if (!s) throw E.destinoNoEncontrado();
    destinoNombre = etiquetaSeccion(s);
  } else if (datos.destino === "GRADO") {
    const g = (await listarGrados()).find((x) => x.id === destinoId);
    if (!g) throw E.destinoNoEncontrado();
    destinoNombre = g.nombre;
  } else if (datos.destino === "ALUMNO") {
    const e = (await resumenEstudiantes([destinoId!]))[destinoId!];
    if (!e) throw E.destinoNoEncontrado();
    destinoNombre = e.nombreCompleto;
  }
  const gradoDeSeccion = new Map(secciones.map((s) => [s.id, s.grado.id]));
  const elegidas = matriculasDelDestino(todas, { destino: datos.destino, destinoId }, gradoDeSeccion);
  verificarConMatriculas(elegidas.length);
  const seccionPorId = new Map(secciones.map((s) => [s.id, s]));
  return { anio, concepto, montoCentimos, destinoId, destinoNombre, elegidas, seccionPorId };
}

/** Alumnos que reciben la cuota, ordenados por nombre, con su sección. */
async function alumnosDe(
  lista: MatriculaFila[],
  seccionPorId: Map<string, { nombre: string; grado: { numero: number } }>,
) {
  const estudiantes = await resumenEstudiantes([...new Set(lista.map((m) => m.estudianteId))]);
  return lista
    .map((m) => {
      const s = m.seccionId ? seccionPorId.get(m.seccionId) : undefined;
      return {
        matriculaId: m.id,
        estudianteId: m.estudianteId,
        nombreCompleto: estudiantes[m.estudianteId]?.nombreCompleto ?? "—",
        seccion: s ? etiquetaSeccion(s) : null,
      };
    })
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
}

/** Vista previa del lote (antes de confirmar): cuántas cuotas se generarían y el total, con la lista de alumnos. */
export async function vistaPreviaLote(datos: DatosLote) {
  const p = await prepararLote(datos);
  return {
    anio: { id: p.anio.id, anio: p.anio.anio },
    concepto: p.concepto,
    monto: deCentimos(p.montoCentimos),
    fechaVencimiento: datos.fechaVencimiento,
    destino: datos.destino,
    nombreDestino: NOMBRE_DESTINO_LOTE[datos.destino],
    destinoNombre: p.destinoNombre,
    cantidad: p.elegidas.length,
    total: deCentimos(p.montoCentimos * p.elegidas.length),
    alumnos: await alumnosDe(p.elegidas, p.seccionPorId),
  };
}

/** Avisos de la campana a los apoderados responsables del pago de las matrículas (los que tienen cuenta). */
async function avisosParaResponsables(
  lista: { vinculoResponsableId: string | null; estudianteId: string }[],
  aviso: (estudiante: string) => { titulo: string; mensaje: string },
): Promise<AvisoInterno[]> {
  const responsables = await responsablesDeVinculos(
    lista.flatMap((m) => (m.vinculoResponsableId ? [m.vinculoResponsableId] : [])),
  );
  const usuarios = await usuariosDePersonas([...new Set(Object.values(responsables).map((r) => r.personaId))]);
  const estudiantes = await resumenEstudiantes([...new Set(lista.map((m) => m.estudianteId))]);
  return lista.flatMap((m) => {
    const responsable = m.vinculoResponsableId ? responsables[m.vinculoResponsableId] : undefined;
    const usuarioId = responsable ? usuarios[responsable.personaId] : undefined;
    if (!usuarioId) return [];
    return [
      {
        usuarioId,
        tipo: "PAGO" as const,
        enlace: ENLACE_PAGOS,
        ...aviso(estudiantes[m.estudianteId]?.nombres ?? "Tu hijo"),
      },
    ];
  });
}

/**
 * Crea el lote y sus cuotas en una transacción: las matrículas del destino se vuelven a leer dentro de ella, se
 * registra CREAR_LOTE_EXTRAORDINARIO y se avisa a los apoderados responsables.
 */
export async function crearLote(coordinador: Autenticado, datos: DatosLote, meta: MetaSolicitud) {
  const loteId = await prisma.$transaction(async (tx) => {
    const p = await prepararLote(datos, tx);
    const id = await lotes.crear(
      tx,
      {
        anioAcademicoId: p.anio.id,
        concepto: p.concepto,
        montoCentimos: p.montoCentimos,
        fechaVencimiento: datos.fechaVencimiento,
        destino: datos.destino,
        destinoId: p.destinoId,
        destinoNombre: p.destinoNombre,
        creadoPorId: coordinador.usuarioId,
      },
      p.elegidas.map((m) => m.id),
    );
    const monto = deCentimos(p.montoCentimos);
    await registrarAuditoria(
      tx,
      {
        usuarioId: coordinador.usuarioId,
        entidad: ENTIDAD_LOTE,
        entidadId: id,
        accion: "CREAR_LOTE_EXTRAORDINARIO",
        nuevo: {
          anio: p.anio.anio,
          concepto: p.concepto,
          monto,
          fechaVencimiento: datos.fechaVencimiento,
          destino: datos.destino,
          destinoNombre: p.destinoNombre,
          cuotas: p.elegidas.length,
          total: deCentimos(p.montoCentimos * p.elegidas.length),
        },
      },
      meta,
    );
    const notificaciones = await avisosParaResponsables(p.elegidas, (estudiante) => ({
      titulo: "Nueva cuota extraordinaria",
      mensaje: `${estudiante} · ${p.concepto} · S/ ${monto} · vence el ${datos.fechaVencimiento.split("-").reverse().join("/")}`,
    }));
    await registrarAvisos(tx, { notificaciones, correos: [], origen: { entidad: ENTIDAD_LOTE, id } });
    return id;
  });
  return detalleLote(loteId);
}

/** Lotes del año, del más reciente al más antiguo, con el resumen de sus cuotas. */
export async function listarLotes(anioAcademicoId: string) {
  const lista = await lotes.delAnio(anioAcademicoId);
  const nombres = await nombresDeUsuarios([...new Set(lista.map((l) => l.creadoPorId))]);
  return { items: lista.map((l) => vistaLote(l, nombres[l.creadoPorId]?.nombreCompleto ?? null)) };
}

function vistaLote(l: LoteFila, creadoPor: string | null) {
  const r = resumenLote(l.cuotas.map((c) => ({ estado: c.estado, montoCentimos: aCentimos(c.monto) })));
  return {
    loteId: l.id,
    concepto: l.concepto,
    monto: l.monto,
    fechaVencimiento: l.fechaVencimiento,
    destino: l.destino,
    nombreDestino: NOMBRE_DESTINO_LOTE[l.destino],
    destinoNombre: l.destinoNombre,
    estado: l.estado,
    creadoEn: l.createdAt.toISOString(),
    creadoPor,
    anulacion: l.anuladoEn ? { anuladoEn: l.anuladoEn.toISOString(), motivo: l.motivoAnulacion } : null,
    resumen: { ...r, total: deCentimos(r.totalCentimos), totalCentimos: undefined },
  };
}

/** Lote con cada cuota: alumno, sección y estado. */
export async function detalleLote(loteId: string) {
  const l = await lotes.porId(loteId);
  if (!l) throw E.loteNoEncontrado();
  const [nombres, lista, secciones] = await Promise.all([
    nombresDeUsuarios([l.creadoPorId]),
    matriculas.porIds(l.cuotas.map((c) => c.matriculaId)),
    listarSecciones(l.anioAcademicoId),
  ]);
  const alumnos = await alumnosDe(lista, new Map(secciones.map((s) => [s.id, s])));
  const alumnoDe = new Map(alumnos.map((a) => [a.matriculaId, a]));
  return {
    ...vistaLote(l, nombres[l.creadoPorId]?.nombreCompleto ?? null),
    cuotas: l.cuotas
      .map((c) => ({ cuotaId: c.id, estado: c.estado, monto: c.monto, ...alumnoDe.get(c.matriculaId)! }))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)),
  };
}

/**
 * Anula el lote: sus cuotas Pendiente pasan a Anulado con el motivo; las pagadas se conservan. Registra
 * ANULAR_LOTE_EXTRAORDINARIO y avisa a los apoderados de las cuotas anuladas.
 */
export async function anularLote(
  coordinador: Autenticado,
  loteId: string,
  datos: { motivo: string },
  meta: MetaSolicitud,
) {
  const motivo = motivoValido(datos.motivo);
  await prisma.$transaction(async (tx) => {
    await lotes.bloquear(tx, loteId);
    const l = await lotes.porId(loteId, tx);
    if (!l) throw E.loteNoEncontrado();
    verificarLoteAnulable(l.estado);
    const ids = await lotes.pendientesBloqueadas(tx, loteId);
    const anuladoEn = new Date();
    const anuladas = await cuotasAnulables.anular(tx, ids, {
      anuladoPorId: coordinador.usuarioId,
      anuladoEn,
      motivoAnulacion: motivo,
    });
    await lotes.anular(tx, loteId, { anuladoPorId: coordinador.usuarioId, anuladoEn, motivoAnulacion: motivo });
    await registrarAuditoria(
      tx,
      {
        usuarioId: coordinador.usuarioId,
        entidad: ENTIDAD_LOTE,
        entidadId: loteId,
        accion: "ANULAR_LOTE_EXTRAORDINARIO",
        anterior: { estado: l.estado, pendientes: ids.length },
        nuevo: {
          estado: "ANULADO",
          cuotasAnuladas: anuladas,
          pagadasConservadas: l.cuotas.filter((c) => c.estado === "PAGADO").length,
        },
        motivo,
      },
      meta,
    );
    const anuladasIds = new Set(ids);
    const afectadas = await matriculas.porIds(
      l.cuotas.filter((c) => anuladasIds.has(c.id)).map((c) => c.matriculaId),
      tx,
    );
    const notificaciones = await avisosParaResponsables(afectadas, (estudiante) => ({
      titulo: "Cuota extraordinaria anulada",
      mensaje: `${estudiante} · ${l.concepto} · ya no debe pagarse`,
    }));
    await registrarAvisos(tx, { notificaciones, correos: [], origen: { entidad: ENTIDAD_LOTE, id: loteId } });
  });
  return detalleLote(loteId);
}

/** Anula una cuota extraordinaria Pendiente con motivo (ANULAR_CUOTA_EXTRAORDINARIA) y avisa a su apoderado. */
export async function anularCuotaExtraordinaria(
  coordinador: Autenticado,
  cuotaId: string,
  datos: { motivo: string },
  meta: MetaSolicitud,
) {
  const motivo = motivoValido(datos.motivo);
  return prisma.$transaction(async (tx) => {
    const cuota = await cuotasAnulables.bloqueada(tx, cuotaId);
    if (!cuota) throw E.cuotaNoEncontrada();
    verificarExtraordinariaAnulable(cuota);
    await cuotasAnulables.anular(tx, [cuota.id], {
      anuladoPorId: coordinador.usuarioId,
      anuladoEn: new Date(),
      motivoAnulacion: motivo,
    });
    await registrarAuditoria(
      tx,
      {
        usuarioId: coordinador.usuarioId,
        entidad: "concepto_cobro",
        entidadId: cuota.id,
        accion: "ANULAR_CUOTA_EXTRAORDINARIA",
        anterior: { estado: cuota.estado, concepto: cuota.concepto, monto: cuota.monto },
        nuevo: { estado: "ANULADO", matriculaId: cuota.matriculaId, loteId: cuota.loteId },
        motivo,
      },
      meta,
    );
    const notificaciones = await avisosParaResponsables([cuota], (estudiante) => ({
      titulo: "Cuota extraordinaria anulada",
      mensaje: `${estudiante} · ${cuota.concepto} · ya no debe pagarse`,
    }));
    await registrarAvisos(tx, { notificaciones, correos: [], origen: { entidad: "concepto_cobro", id: cuota.id } });
    return { cuotaId: cuota.id, estado: "ANULADO" as const, concepto: cuota.concepto, monto: cuota.monto, motivo };
  });
}
