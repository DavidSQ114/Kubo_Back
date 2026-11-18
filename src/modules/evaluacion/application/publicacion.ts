// evaluacion/application: publicación de notas del Administrador (US39 criterio 4, AD-15 «Notas y rectificaciones»).
// Lista los registros CERRADOS por los docentes (por publicar) y los PUBLICADOS, por año, bimestre, grado, sección y
// curso; publicar pasa el registro de CERRADO a PUBLICADO con auditoría PUBLICAR_NOTAS y, en la misma transacción,
// notifica a los apoderados vinculados y a los alumnos con cuenta (US55); el correo a los apoderados sale después de
// confirmar. Un registro publicado sigue bloqueado por tg_nota_registro_cerrado (US40).
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { logger } from "@/platform/logger";
import { despacharCorreos, registrarAvisos, type AvisoInterno, type CorreoSaliente } from "@/platform/notificaciones";
import { anioPorDefecto, asignacionesParaNotas, listarAnios, listarGrados, type AnioVista } from "@/modules/academico";
import { apoderadosDeEstudiantes, docentesProviderComunidad, nombresDeUsuarios } from "@/modules/comunidad";
import { usuariosDePersonas, type Autenticado } from "@/modules/identidad";
import { datosDeMatriculas } from "@/modules/matricula";
import { erroresEvaluacion as E } from "../domain/errores";
import { verificarPublicable } from "../domain/libreta";
import { cierres, estadoDeRegistro, resultados, type CierreFila } from "../infrastructure/repositorio";

export interface FiltroPublicacion {
  anioId?: string;
  periodoId?: string;
  gradoId?: string;
  seccionId?: string;
  cursoId?: string;
}

export interface RegistroPublicable {
  cierreId: string;
  asignacionId: string;
  bimestre: { id: string; numero: number; nombre: string };
  curso: { id: string; codigo: string; nombre: string };
  grado: { id: string; numero: number; nombre: string };
  seccion: { id: string; nombre: string; etiqueta: string };
  /** «J. Pérez»; null si ya no se conoce al docente. */
  docente: string | null;
  estado: "CERRADO" | "PUBLICADO";
  cerradoEn: string | null;
  cerradoPor: string | null;
  publicadoEn: string | null;
  publicadoPor: string | null;
  /** Estudiantes con logro consolidado en el registro. */
  estudiantes: number;
}

export interface Publicaciones {
  anios: { id: string; anio: number; estado: string }[];
  anio: { id: string; anio: number; estado: string } | null;
  bimestres: { id: string; numero: number; nombre: string; fechaInicio: string; fechaFin: string }[];
  grados: { id: string; numero: number; nombre: string }[];
  /** Registros CERRADOS que esperan publicación. */
  porPublicar: RegistroPublicable[];
  publicados: RegistroPublicable[];
}

const etiquetaDe = (s: { nombre: string; grado: { numero: number } }) => `${s.grado.numero}° ${s.nombre}`;

/** Curso, sección, docente y responsables de cada registro, en pocas consultas (sin N+1). */
async function vistasDeRegistros(filas: CierreFila[], anio: AnioVista): Promise<RegistroPublicable[]> {
  const [asignaciones, conteo] = await Promise.all([
    asignacionesParaNotas(filas.map((c) => c.asignacionDocenteId)),
    resultados.conteoPorCierre(filas.map((c) => c.id)),
  ]);
  const [docentes, usuarios] = await Promise.all([
    docentesProviderComunidad.docentesPorId([...new Set(asignaciones.map((a) => a.docenteId))]),
    nombresDeUsuarios(filas.flatMap((c) => [c.cerradoPorId, c.publicadoPorId].filter((x): x is string => !!x))),
  ]);
  return filas.flatMap((c): RegistroPublicable[] => {
    const a = asignaciones.find((x) => x.id === c.asignacionDocenteId);
    const bimestre = anio.periodos.find((p) => p.id === c.periodoEvaluacionId);
    if (!a || !bimestre) return [];
    return [
      {
        cierreId: c.id,
        asignacionId: a.id,
        bimestre: { id: bimestre.id, numero: bimestre.numero, nombre: bimestre.nombre },
        curso: a.curso,
        grado: a.seccion.grado,
        seccion: { id: a.seccion.id, nombre: a.seccion.nombre, etiqueta: etiquetaDe(a.seccion) },
        docente: docentes.find((d) => d.id === a.docenteId)?.nombreCorto ?? null,
        estado: estadoDeRegistro(c) === "PUBLICADO" ? "PUBLICADO" : "CERRADO",
        cerradoEn: c.cerradoEn?.toISOString() ?? null,
        cerradoPor: c.cerradoPorId ? (usuarios[c.cerradoPorId]?.nombreCorto ?? null) : null,
        publicadoEn: c.publicadoEn?.toISOString() ?? null,
        publicadoPor: c.publicadoPorId ? (usuarios[c.publicadoPorId]?.nombreCorto ?? null) : null,
        estudiantes: conteo[c.id] ?? 0,
      },
    ];
  });
}

const ordenRegistros = (a: RegistroPublicable, b: RegistroPublicable) =>
  a.bimestre.numero - b.bimestre.numero ||
  a.grado.numero - b.grado.numero ||
  a.seccion.nombre.localeCompare(b.seccion.nombre, "es") ||
  a.curso.nombre.localeCompare(b.curso.nombre, "es");

/**
 * Registros por publicar y publicados del año (por defecto, el que está en curso), filtrados por bimestre, grado,
 * sección y curso (AD-15). Los registros abiertos no aparecen: sus notas aún son del docente.
 */
export async function registrosParaPublicar(filtro: FiltroPublicacion): Promise<Publicaciones> {
  const [anios, grados] = await Promise.all([listarAnios(), listarGrados()]);
  const ordenados = [...anios].sort((a, b) => b.anio - a.anio);
  const anio = filtro.anioId ? ordenados.find((a) => a.id === filtro.anioId) : anioPorDefecto(ordenados);
  const resumenAnios = ordenados.map((a) => ({ id: a.id, anio: a.anio, estado: a.estado }));
  if (!anio) {
    if (filtro.anioId) throw E.registroNoEncontrado();
    return { anios: resumenAnios, anio: null, bimestres: [], grados: [], porPublicar: [], publicados: [] };
  }
  const vistas = (await vistasDeRegistros(await cierres.cerradosDelAnio(anio.id), anio))
    .filter(
      (r) =>
        (!filtro.periodoId || r.bimestre.id === filtro.periodoId) &&
        (!filtro.gradoId || r.grado.id === filtro.gradoId) &&
        (!filtro.seccionId || r.seccion.id === filtro.seccionId) &&
        (!filtro.cursoId || r.curso.id === filtro.cursoId),
    )
    .sort(ordenRegistros);
  return {
    anios: resumenAnios,
    anio: { id: anio.id, anio: anio.anio, estado: anio.estado },
    bimestres: [...anio.periodos]
      .sort((a, b) => a.numero - b.numero)
      .map((p) => ({ id: p.id, numero: p.numero, nombre: p.nombre, fechaInicio: p.fechaInicio, fechaFin: p.fechaFin })),
    grados: grados.map((g) => ({ id: g.id, numero: g.numero, nombre: g.nombre })),
    porPublicar: vistas.filter((r) => r.estado === "CERRADO"),
    publicados: vistas.filter((r) => r.estado === "PUBLICADO"),
  };
}

export interface AvisoPublicacion {
  /** Apoderados vinculados con correo a quienes se escribió. */
  apoderados: number;
  /** Correos enviados (un fallo del correo no revierte la publicación). */
  enviados: number;
}

export interface NotasPublicadas {
  publicados: RegistroPublicable[];
  aviso: AvisoPublicacion;
}

interface AvisoParaApoderado {
  personaId: string;
  email: string | null;
  nombres: string;
  /** Por hijo («Valeria»), los cursos publicados («Matemática · Bimestre II»). */
  porHijo: Map<string, Set<string>>;
}

interface AvisosDePublicacion {
  /** Apoderados con correo a quienes se escribe. */
  apoderadosConCorreo: number;
  notificaciones: AvisoInterno[];
  correos: CorreoSaliente[];
}

const SIN_AVISOS: AvisosDePublicacion = { apoderadosConCorreo: 0, notificaciones: [], correos: [] };

/**
 * A quién se avisa de la publicación (US39, US55): por apoderado vinculado, todos los cursos publicados de sus hijos
 * (una notificación y un correo); por alumno con cuenta del portal, sus cursos (solo notificación).
 */
async function avisosDePublicacion(registros: RegistroPublicable[]): Promise<AvisosDePublicacion> {
  const matriculas = await resultados.matriculasDeCierres(registros.map((r) => r.cierreId));
  const datos = await datosDeMatriculas(matriculas.map((m) => m.matriculaId));
  const estudiantes = await apoderadosDeEstudiantes(Object.values(datos).map((d) => d.estudianteId));
  const apoderados = new Map<string, AvisoParaApoderado>();
  const alumnos = new Map<string, Set<string>>();
  for (const m of matriculas) {
    const r = registros.find((x) => x.cierreId === m.cierreId)!;
    const e = estudiantes[datos[m.matriculaId]?.estudianteId ?? ""];
    if (!e) continue;
    const curso = `${r.curso.nombre} · ${r.bimestre.nombre}`;
    alumnos.set(e.personaId, (alumnos.get(e.personaId) ?? new Set()).add(curso));
    for (const a of e.apoderados) {
      const aviso = apoderados.get(a.personaId) ?? { ...a, porHijo: new Map() };
      const hijo = e.nombres.split(" ")[0];
      aviso.porHijo.set(hijo, (aviso.porHijo.get(hijo) ?? new Set()).add(curso));
      apoderados.set(a.personaId, aviso);
    }
  }
  const usuarios = await usuariosDePersonas([...apoderados.keys(), ...alumnos.keys()]);
  const notificaciones: AvisoInterno[] = [];
  const correos: CorreoSaliente[] = [];
  for (const a of apoderados.values()) {
    const lineas = [...a.porHijo.entries()].map(([hijo, cursos]) => `${hijo}: ${[...cursos].join(", ")}`);
    const usuarioId = usuarios[a.personaId];
    if (usuarioId) {
      notificaciones.push({
        usuarioId,
        tipo: "NOTAS",
        titulo: "Notas publicadas",
        mensaje: lineas.join(" · "),
        enlace: "/apoderado/notas",
      });
    }
    if (a.email) {
      correos.push({
        para: a.email,
        asunto: "Kubo · Notas publicadas",
        texto:
          `Hola, ${a.nombres.split(" ")[0]}:\n\n` +
          `Se publicaron las notas de estos cursos:\n${lineas.map((l) => `- ${l}`).join("\n")}\n\n` +
          "Ingresa a Kubo, en «Notas», para ver la libreta con el logro de cada competencia.\n\n" +
          "Este es un mensaje automático: no lo respondas.",
      });
    }
  }
  for (const [personaId, cursos] of alumnos) {
    const usuarioId = usuarios[personaId];
    if (!usuarioId) continue;
    notificaciones.push({
      usuarioId,
      tipo: "NOTAS",
      titulo: "Notas publicadas",
      mensaje: `Ya puedes ver tus logros de ${[...cursos].join(", ")}.`,
      enlace: "/alumno/notas",
    });
  }
  return { apoderadosConCorreo: correos.length, notificaciones, correos };
}

/** Los avisos se calculan antes de publicar; si fallan, la publicación sigue sin avisos (nunca se bloquea). */
async function avisosSeguros(registros: RegistroPublicable[], meta: MetaSolicitud): Promise<AvisosDePublicacion> {
  try {
    return await avisosDePublicacion(registros);
  } catch (e) {
    logger.warn("No se pudo preparar el aviso de la publicación de notas", {
      requestId: meta.requestId,
      error: (e as Error).message,
    });
    return SIN_AVISOS;
  }
}

/**
 * Publica uno o varios registros cerrados (US39, criterio 4; «Publicar» y «Publicar seleccionados» de AD-15). En una
 * transacción bloquea cada registro, exige que siga CERRADO, lo pasa a PUBLICADO y registra PUBLICAR_NOTAS: si uno no
 * se puede publicar, no se publica ninguno. En la misma transacción notifica a apoderados y alumnos (US55); luego
 * intenta el correo a los apoderados: si falla, queda en la bandeja de salida y no revierte la publicación.
 */
export async function publicarNotas(
  admin: Autenticado,
  cierreIds: string[],
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<NotasPublicadas> {
  const ids = [...new Set(cierreIds)];
  const filas = await cierres.porIds(ids);
  if (filas.length !== ids.length) throw E.registroNoEncontrado();
  const anios = await listarAnios();
  const anio = anios.find((a) => a.periodos.some((p) => p.id === filas[0].periodoEvaluacionId));
  const vistas = anio ? await vistasDeRegistros(filas, anio) : [];
  // todos deben ser del mismo año (la pantalla publica dentro de un año)
  if (vistas.length !== ids.length) throw E.registroNoEncontrado();
  const avisos = await avisosSeguros(vistas, meta);

  const correoIds = await prisma.$transaction(async (tx) => {
    for (const r of vistas) {
      await cierres.bloquearFila(tx, r.cierreId);
      // otra pestaña pudo publicarlo (o el estado cambiar) mientras se esperaba el bloqueo
      const actual = (await cierres.porId(r.cierreId, tx))!;
      verificarPublicable(estadoDeRegistro(actual));
      await cierres.publicar(tx, r.cierreId, { publicadoPorId: admin.usuarioId, publicadoEn: ahora });
      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "cierre_calificacion",
          entidadId: r.cierreId,
          accion: "PUBLICAR_NOTAS",
          anterior: { estado: "CERRADO" },
          nuevo: {
            estado: "PUBLICADO",
            anio: anio!.anio,
            curso: r.curso.codigo,
            seccion: r.seccion.etiqueta,
            bimestre: r.bimestre.numero,
            estudiantes: r.estudiantes,
          },
        },
        meta,
      );
    }
    return registrarAvisos(tx, {
      notificaciones: avisos.notificaciones,
      correos: avisos.correos,
      origen: { entidad: "cierre_calificacion", id: vistas[0].cierreId },
    });
  });
  const aviso = { apoderados: avisos.apoderadosConCorreo, enviados: await despacharCorreos(correoIds, meta.requestId) };
  const publicados = await vistasDeRegistros(await cierres.porIds(ids), anio!);
  return { publicados: publicados.sort(ordenRegistros), aviso };
}
