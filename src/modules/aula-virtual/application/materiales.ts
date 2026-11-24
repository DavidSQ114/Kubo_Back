// aula-virtual/application: materiales de estudio (US61, DO-05 y M-16). El docente sube a una unidad activa un archivo
// PDF, PPTX, DOCX, XLSX o imagen JPG o PNG de hasta 5 MB, o un enlace http o https, como borrador o publicado; luego lo
// publica, lo oculta o lo elimina. Publicar, ocultar y eliminar quedan en la auditoría y publicar avisa a los alumnos
// de la sección. El archivo va al almacén privado de platform/archivos y solo se descarga por la API con permiso.
import { prisma } from "@/platform/db/prisma";
import {
  abrirArchivo,
  eliminarArchivo,
  guardarArchivo,
  validarArchivo,
  type ArchivoRecibido,
} from "@/platform/archivos";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { registrarAvisos } from "@/platform/notificaciones";
import type { AsignacionParaNotas } from "@/modules/academico";
import type { Autenticado } from "@/modules/identidad";
import { erroresAulaVirtual as E, MENSAJE_FORMATO_MATERIAL, MENSAJE_TAMANO_MATERIAL } from "../domain/errores";
import {
  ARCHIVOS_MATERIAL,
  AREA_MATERIALES,
  estadoInicial,
  formatoDeArchivo,
  materialVisibleParaAlumno,
  validarUrl,
  verificarOcultable,
  verificarPublicable,
} from "../domain/reglas";
import { materiales, unidades, type MaterialFila } from "../infrastructure/repositorio";
import { alumnoYCursoDelMaterial } from "./aulaAlumno";
import { avisosDePublicacion, cuentasDeAlumnos } from "./avisos";
import { asignacionDelDocente, asignacionDelRecurso, etiquetaDe } from "./contexto";
import { vistaDeMaterial, type MaterialVista } from "./vistas";

/** Reglas del archivo de un material: el motivo del rechazo distingue formato y tamaño (US61, criterio 2). */
export const REGLAS_ARCHIVO_MATERIAL = {
  permitidos: ARCHIVOS_MATERIAL,
  mensaje: MENSAJE_FORMATO_MATERIAL,
  mensajeTamano: MENSAJE_TAMANO_MATERIAL,
};

/** Lo que queda en la auditoría: sin el nombre original del archivo (puede llevar datos personales). */
function resumenParaAuditoria(m: MaterialFila, a: AsignacionParaNotas) {
  return {
    titulo: m.titulo,
    tipo: m.tipoFormato,
    estado: m.estado,
    unidadId: m.unidadId,
    anio: a.anio.anio,
    curso: a.curso.codigo,
    seccion: etiquetaDe(a.seccion),
    archivo: m.archivoClave ? { clave: m.archivoClave, mime: m.mimeType, tamanoBytes: m.tamanoBytes } : null,
    url: m.tipoFormato === "ENLACE" ? m.urlArchivo : null,
  };
}

/** Avisos MATERIAL a los alumnos con cuenta de la sección por un material recién publicado. */
async function registrarAvisoMaterial(
  tx: Parameters<typeof registrarAvisos>[0],
  m: MaterialFila,
  a: AsignacionParaNotas,
  usuarioIds: string[],
) {
  await registrarAvisos(tx, {
    notificaciones: avisosDePublicacion(usuarioIds, {
      titulo: `Nuevo material en ${a.curso.nombre}`,
      mensaje: `Tu docente publicó «${m.titulo}». Revísalo en «Mis cursos».`,
      cursoId: a.curso.id,
    }),
    correos: [],
    origen: { entidad: "material_estudio", id: m.id },
  });
}

// ---------- Subir (US61, criterios 1 y 2) ----------

export interface DatosMaterial {
  unidadId: string;
  titulo: string;
  tipo: "ARCHIVO" | "ENLACE";
  url: string | null;
  visible: boolean;
  archivo: ArchivoRecibido | null;
}

/**
 * Sube un material a una unidad activa del curso y sección. Primero valida el formato y el tamaño del archivo (o la
 * URL del enlace); el archivo se guarda antes de la transacción y, si esta falla, se borra del almacén.
 */
export async function subirMaterial(
  auth: Autenticado,
  asignacionId: string,
  datos: DatosMaterial,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<MaterialVista> {
  const esEnlace = datos.tipo === "ENLACE";
  const url = esEnlace ? validarUrl(datos.url ?? "") : null;
  if (!esEnlace && !datos.archivo) throw E.materialSinArchivo();
  const archivo = !esEnlace && datos.archivo ? validarArchivo(datos.archivo, REGLAS_ARCHIVO_MATERIAL) : null;

  const a = await asignacionDelDocente(auth, asignacionId, { escritura: true });
  const unidad = await unidades.porId(datos.unidadId);
  if (!unidad || unidad.asignacionDocenteId !== a.id) throw E.unidadNoEncontrada();
  if (!unidad.activo) throw E.unidadInactiva();
  const estado = estadoInicial(datos.visible);
  const destinatarios = estado === "PUBLICADO" ? await cuentasDeAlumnos(a.seccion.id, meta, ahora) : [];

  const clave = archivo ? await guardarArchivo(AREA_MATERIALES, archivo, meta.requestId) : null;
  try {
    const creado = await prisma.$transaction(async (tx) => {
      const fila = await materiales.crear(tx, {
        asignacionDocenteId: a.id,
        unidadId: unidad.id,
        titulo: datos.titulo,
        tipoFormato: archivo ? formatoDeArchivo(archivo.tipo) : "ENLACE",
        urlArchivo: url,
        archivoClave: clave,
        nombreArchivo: archivo?.nombre ?? null,
        tamanoBytes: archivo?.tamanoBytes ?? null,
        mimeType: archivo?.mime ?? null,
        estado,
        publicadoEn: estado === "PUBLICADO" ? ahora : null,
        subidoPorId: auth.usuarioId,
      });
      if (estado === "PUBLICADO") {
        await registrarAuditoria(
          tx,
          {
            usuarioId: auth.usuarioId,
            entidad: "material_estudio",
            entidadId: fila.id,
            accion: "PUBLICAR_MATERIAL",
            nuevo: resumenParaAuditoria(fila, a),
          },
          meta,
        );
        await registrarAvisoMaterial(tx, fila, a, destinatarios);
      }
      return fila;
    });
    return vistaDeMaterial(creado);
  } catch (e) {
    if (clave) await eliminarArchivo(clave, meta.requestId);
    throw e;
  }
}

// ---------- Publicar, ocultar y eliminar (US61, criterio 3) ----------

async function materialDelDocente(auth: Autenticado, materialId: string) {
  const material = await materiales.porId(materialId);
  if (!material) throw E.materialNoEncontrado();
  const a = await asignacionDelRecurso(auth, material.asignacionDocenteId, E.materialNoEncontrado, {
    escritura: true,
  });
  return { material, asignacion: a };
}

/** Publica un borrador o vuelve a publicar uno oculto: los alumnos de la sección lo ven y reciben el aviso. */
export async function publicarMaterial(
  auth: Autenticado,
  materialId: string,
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<MaterialVista> {
  const { material, asignacion } = await materialDelDocente(auth, materialId);
  verificarPublicable(material.estado);
  const destinatarios = await cuentasDeAlumnos(asignacion.seccion.id, meta, ahora);
  const publicado = await prisma.$transaction(async (tx) => {
    await materiales.bloquearFila(tx, material.id);
    const actual = (await materiales.porId(material.id, tx))!;
    verificarPublicable(actual.estado);
    const fila = await materiales.cambiarEstado(tx, material.id, { estado: "PUBLICADO", publicadoEn: ahora });
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "material_estudio",
        entidadId: fila.id,
        accion: "PUBLICAR_MATERIAL",
        anterior: { estado: actual.estado },
        nuevo: resumenParaAuditoria(fila, asignacion),
      },
      meta,
    );
    await registrarAvisoMaterial(tx, fila, asignacion, destinatarios);
    return fila;
  });
  return vistaDeMaterial(publicado);
}

/** Oculta un material publicado: deja de verse y de poder descargarse por los alumnos. */
export async function ocultarMaterial(
  auth: Autenticado,
  materialId: string,
  meta: MetaSolicitud,
): Promise<MaterialVista> {
  const { material, asignacion } = await materialDelDocente(auth, materialId);
  verificarOcultable(material.estado);
  const oculto = await prisma.$transaction(async (tx) => {
    await materiales.bloquearFila(tx, material.id);
    const actual = (await materiales.porId(material.id, tx))!;
    verificarOcultable(actual.estado);
    const fila = await materiales.cambiarEstado(tx, material.id, { estado: "OCULTO" });
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "material_estudio",
        entidadId: fila.id,
        accion: "OCULTAR_MATERIAL",
        anterior: { estado: actual.estado },
        nuevo: resumenParaAuditoria(fila, asignacion),
      },
      meta,
    );
    return fila;
  });
  return vistaDeMaterial(oculto);
}

/**
 * Elimina un material. El archivo se borra del almacén después de confirmar la transacción: si el almacén falla, el
 * material ya no existe y la clave queda en el log como huérfana.
 */
export async function eliminarMaterial(auth: Autenticado, materialId: string, meta: MetaSolicitud): Promise<void> {
  const { material, asignacion } = await materialDelDocente(auth, materialId);
  await prisma.$transaction(async (tx) => {
    await materiales.bloquearFila(tx, material.id);
    await materiales.eliminar(tx, material.id);
    await registrarAuditoria(
      tx,
      {
        usuarioId: auth.usuarioId,
        entidad: "material_estudio",
        entidadId: material.id,
        accion: "ELIMINAR_MATERIAL",
        anterior: resumenParaAuditoria(material, asignacion),
      },
      meta,
    );
  });
  if (material.archivoClave) await eliminarArchivo(material.archivoClave, meta.requestId);
}

// ---------- Descarga (US61 docente, US67 alumno) ----------

/**
 * Archivo de un material. El docente descarga los de sus cursos en cualquier estado; el alumno, solo los PUBLICADOS de
 * una unidad activa del curso de su sección, con matrícula vigente. A cualquier otro (material ajeno, en borrador u
 * oculto, o un material tipo enlace) se le responde 404: no se revela que existe.
 */
export async function archivoDeMaterial(auth: Autenticado, materialId: string) {
  const m = await materiales.porId(materialId);
  if (!m) throw E.materialNoEncontrado();
  if (auth.rol === "DOCENTE") {
    await asignacionDelRecurso(auth, m.asignacionDocenteId, E.materialNoEncontrado, { escritura: false });
  } else {
    const permitido =
      auth.rol === "ALUMNO" &&
      materialVisibleParaAlumno(m) &&
      (await alumnoYCursoDelMaterial(auth, m.asignacionDocenteId));
    if (!permitido) throw E.materialNoEncontrado();
  }
  if (!m.archivoClave || !m.mimeType || !m.nombreArchivo) throw E.materialNoEncontrado();
  return {
    flujo: await abrirArchivo(m.archivoClave),
    archivo: { mime: m.mimeType, nombre: m.nombreArchivo, tamanoBytes: m.tamanoBytes },
  };
}
