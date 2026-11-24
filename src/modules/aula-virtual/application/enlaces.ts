// aula-virtual/application: enlaces de clase virtual (US62, DO-05 y M-17). El docente registra el tipo (Clase virtual,
// Asesoría o Taller), el título, la URL http o https y el inicio y el fin en la hora de Lima; si es visible, los alumnos
// de la sección lo ven en «Mis cursos» con su estado calculado (Programado, Activo o Finalizado). Mostrar, ocultar y
// eliminar quedan en la auditoría, y mostrarlo avisa a los alumnos de la sección.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { registrarAvisos } from "@/platform/notificaciones";
import type { AsignacionParaNotas } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import { erroresAulaVirtual as E } from "../domain/errores";
import {
  instanteDeLima,
  NOMBRE_TIPO_ENLACE,
  validarUrl,
  verificarCambioVisibilidad,
  verificarFechasEnlace,
  type TipoEnlace,
} from "../domain/reglas";
import { enlaces, type DatosEnlaceFila, type EnlaceFila } from "../infrastructure/repositorio";
import { avisosDePublicacion, cuentasDeAlumnos } from "./avisos";
import { asignacionDelDocente, asignacionDelRecurso, etiquetaDe } from "./contexto";
import { vistaDeEnlace, type EnlaceVista } from "./vistas";

export interface DatosEnlace {
  tipo: TipoEnlace;
  titulo: string;
  url: string;
  /** «2026-11-24T10:00» en la hora de Lima. */
  inicio: string;
  fin: string;
  visible: boolean;
}

/** Valida la URL («Ingresa un enlace válido») y que el fin sea posterior al inicio. */
function filaDeEnlace(datos: DatosEnlace): DatosEnlaceFila {
  const urlMeet = validarUrl(datos.url);
  const fechaProgramada = instanteDeLima(datos.inicio);
  const fechaFin = instanteDeLima(datos.fin);
  verificarFechasEnlace(fechaProgramada, fechaFin);
  return { tipoEnlace: datos.tipo, titulo: datos.titulo, urlMeet, fechaProgramada, fechaFin, visible: datos.visible };
}

function resumenParaAuditoria(e: EnlaceFila, a: AsignacionParaNotas) {
  return {
    tipo: e.tipoEnlace,
    titulo: e.titulo,
    url: e.urlMeet,
    inicio: e.fechaProgramada?.toISOString() ?? null,
    fin: e.fechaFin?.toISOString() ?? null,
    visible: e.visible,
    anio: a.anio.anio,
    curso: a.curso.codigo,
    seccion: etiquetaDe(a.seccion),
  };
}

/** Auditoría de mostrar u ocultar y, al mostrar, aviso MATERIAL a los alumnos de la sección. */
async function registrarVisibilidad(
  tx: Tx,
  datos: {
    auth: Autenticado;
    enlace: EnlaceFila;
    asignacion: AsignacionParaNotas;
    anterior: unknown;
    destinatarios: string[];
    meta: MetaSolicitud;
  },
) {
  const { auth, enlace, asignacion, meta } = datos;
  await registrarAuditoria(
    tx,
    {
      usuarioId: auth.usuarioId,
      entidad: "enlace_virtual",
      entidadId: enlace.id,
      accion: enlace.visible ? "PUBLICAR_ENLACE" : "OCULTAR_ENLACE",
      anterior: datos.anterior,
      nuevo: resumenParaAuditoria(enlace, asignacion),
    },
    meta,
  );
  if (!enlace.visible) return;
  await registrarAvisos(tx, {
    notificaciones: avisosDePublicacion(datos.destinatarios, {
      titulo: `${NOMBRE_TIPO_ENLACE[enlace.tipoEnlace]} en ${asignacion.curso.nombre}`,
      mensaje: `Tu docente publicó «${enlace.titulo}». Revisa la fecha y la hora en «Mis cursos».`,
      cursoId: asignacion.curso.id,
    }),
    correos: [],
    origen: { entidad: "enlace_virtual", id: enlace.id },
  });
}

/** Registra un enlace en el curso y sección (US62, criterio 1). Si es visible, avisa a los alumnos. */
export async function crearEnlace(
  auth: Autenticado,
  asignacionId: string,
  datos: DatosEnlace,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<EnlaceVista> {
  const fila = filaDeEnlace(datos);
  const a = await asignacionDelDocente(auth, asignacionId, { escritura: true });
  const destinatarios = fila.visible ? await cuentasDeAlumnos(a.seccion.id, meta, ahora) : [];
  const creado = await prisma.$transaction(async (tx) => {
    const enlace = await enlaces.crear(tx, { ...fila, asignacionDocenteId: a.id });
    if (enlace.visible) {
      await registrarVisibilidad(tx, { auth, enlace, asignacion: a, anterior: null, destinatarios, meta });
    }
    return enlace;
  });
  return vistaDeEnlace(creado, ahora);
}

async function enlaceDelDocente(auth: Autenticado, enlaceId: string) {
  const enlace = await enlaces.porId(enlaceId);
  if (!enlace) throw E.enlaceNoEncontrado();
  const asignacion = await asignacionDelRecurso(auth, enlace.asignacionDocenteId, E.enlaceNoEncontrado, {
    escritura: true,
  });
  return { enlace, asignacion };
}

/** Reemplaza los datos del enlace. Si cambia la visibilidad, queda en la auditoría (y al mostrarlo, se avisa). */
export async function editarEnlace(
  auth: Autenticado,
  enlaceId: string,
  datos: DatosEnlace,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<EnlaceVista> {
  const fila = filaDeEnlace(datos);
  const { enlace, asignacion } = await enlaceDelDocente(auth, enlaceId);
  const destinatarios =
    fila.visible && !enlace.visible ? await cuentasDeAlumnos(asignacion.seccion.id, meta, ahora) : [];
  const editado = await prisma.$transaction(async (tx) => {
    await enlaces.bloquearFila(tx, enlace.id);
    const actual = (await enlaces.porId(enlace.id, tx))!;
    const nuevo = await enlaces.actualizar(tx, enlace.id, fila);
    if (actual.visible !== nuevo.visible) {
      const anterior = resumenParaAuditoria(actual, asignacion);
      await registrarVisibilidad(tx, { auth, enlace: nuevo, asignacion, anterior, destinatarios, meta });
    }
    return nuevo;
  });
  return vistaDeEnlace(editado, ahora);
}

/** Muestra (publica) u oculta el enlace para los alumnos de la sección. */
export async function cambiarVisibilidadEnlace(
  auth: Autenticado,
  enlaceId: string,
  visible: boolean,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<EnlaceVista> {
  const { enlace, asignacion } = await enlaceDelDocente(auth, enlaceId);
  verificarCambioVisibilidad(enlace.visible, visible);
  const destinatarios = visible ? await cuentasDeAlumnos(asignacion.seccion.id, meta, ahora) : [];
  const cambiado = await prisma.$transaction(async (tx) => {
    await enlaces.bloquearFila(tx, enlace.id);
    const actual = (await enlaces.porId(enlace.id, tx))!;
    verificarCambioVisibilidad(actual.visible, visible);
    const nuevo = await enlaces.actualizar(tx, enlace.id, { visible });
    await registrarVisibilidad(tx, {
      auth,
      enlace: nuevo,
      asignacion,
      anterior: { visible: actual.visible },
      destinatarios,
      meta,
    });
    return nuevo;
  });
  return vistaDeEnlace(cambiado, ahora);
}

/** Elimina el enlace (auditado). */
export async function eliminarEnlace(auth: Autenticado, enlaceId: string, meta: MetaSolicitud): Promise<void> {
  const { enlace, asignacion } = await enlaceDelDocente(auth, enlaceId);
  await prisma.$transaction(async (tx) => {
    await enlaces.bloquearFila(tx, enlace.id);
    await enlaces.eliminar(tx, enlace.id);
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "enlace_virtual",
        entidadId: enlace.id,
        accion: "ELIMINAR_ENLACE",
        anterior: resumenParaAuditoria(enlace, asignacion),
      },
      meta,
    );
  });
}
