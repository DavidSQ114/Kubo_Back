// evaluacion/application: libreta de notas del apoderado (US46, AP-04) y «Mis notas» del alumno (US51, AL-03) con las
// evidencias del docente (US47), su PDF (US66) y la restricción por deuda del apoderado (US26, AP-06). Regla central: solo se leen notas de registros
// PUBLICADOS (la consulta lo filtra); los cursos sin publicar salen sin calificación. El estudiante nunca llega del
// navegador sin verificar: el alumno sale de la sesión y el hijo, del vínculo con el apoderado (403 si no es su hijo).
import { generarPdf, type BloquePdf } from "@/platform/pdf";
import {
  asignacionesParaNotas,
  competenciasDelPlan,
  fechaEnLima,
  listarSecciones,
  obtenerAnio,
  planDeSeccion,
  type CompetenciaDelPlan,
} from "@/modules/academico";
import { docentesProviderComunidad } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { matriculaDelHijo, matriculaVigenteDelAlumno, restriccionPorDeuda } from "@/modules/matricula";
import { erroresEvaluacion as E } from "../domain/errores";
import {
  bimestrePorDefecto,
  cursosDelBimestre,
  estadoDelBimestre,
  NOMBRE_LOGRO,
  nombreArchivoLibreta,
  resumenDeLogros,
  verificarLibretaDescargable,
  type CursoDelPlanEntrada,
  type CursoDeLibreta,
  type CursoPublicadoEntrada,
  type EstadoBimestreLibreta,
  type ResumenDeLogros,
} from "../domain/libreta";
import type { EvidenciaVista } from "../domain/evidencias";
import { LOGROS_NOTA, type LogroNota } from "../domain/notas";
import { publicados } from "../infrastructure/repositorio";
import { vistaDeEvidencia } from "./vistaEvidencias";

export interface BimestreDeLibreta {
  id: string;
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoBimestreLibreta;
  /** Última publicación de un curso del bimestre; null si no hay ninguno publicado. */
  publicadoEn: string | null;
  cursos: CursoDeLibreta[];
  resumen: ResumenDeLogros;
}

export interface Libreta {
  estudiante: { estudianteId: string; nombres: string; apellidos: string; nombreCompleto: string };
  anio: { id: string; anio: number };
  /** «3° de secundaria», «B», «3° B» y el tutor de la sección; null si la matrícula no tiene sección. */
  grado: string | null;
  seccion: string | null;
  seccionCorta: string | null;
  tutor: string | null;
  bimestres: BimestreDeLibreta[];
  bimestrePorDefectoId: string | null;
}

/** Libreta del apoderado: con restricción por deuda no lleva ninguna calificación (US26, criterio 2). */
export type LibretaDelHijo =
  | { restringido: false; libreta: Libreta }
  | {
      restringido: true;
      mensaje: string;
      estudiante: Libreta["estudiante"];
      anio: { id: string; anio: number };
      /** Solo los nombres de los bimestres (las pestañas): ni notas ni estado de publicación. */
      bimestres: { id: string; numero: number; nombre: string }[];
      deuda: {
        pensiones: { cuotaId: string; concepto: string; fechaVencimiento: string; monto: string }[];
        total: string;
      };
    };

interface MatriculaDeLibreta {
  estudianteId: string;
  nombres: string;
  apellidos: string;
  matriculaId: string;
  anioAcademicoId: string;
  seccionId: string | null;
}

/** Cursos del plan de la sección del alumno, con su docente: son los que aparecen «Pendiente de publicación». */
async function planDeLaSeccion(seccion: { id: string; grado: { id: string } } | undefined, anioId: string) {
  if (!seccion) return [];
  return planDeSeccion({ id: seccion.id, grado: { id: seccion.grado.id }, anio: { id: anioId } });
}

/** Arma la libreta de una matrícula con lo publicado y lo que falta publicar de su sección actual. */
async function armarLibreta(m: MatriculaDeLibreta, ahora: Date): Promise<Libreta> {
  const hoy = fechaEnLima(ahora);
  const [anio, resultados, notas, evidencias, secciones] = await Promise.all([
    obtenerAnio(m.anioAcademicoId),
    publicados.resultadosDeMatricula(m.matriculaId),
    publicados.notasDeMatricula(m.matriculaId),
    publicados.evidenciasDeMatricula(m.matriculaId),
    listarSecciones(m.anioAcademicoId),
  ]);
  const evidenciasDelCierre = (cierreId: string) => {
    const porCompetencia: Record<string, EvidenciaVista[]> = {};
    for (const e of evidencias.filter((x) => x.cierreId === cierreId)) {
      (porCompetencia[e.competenciaPlanId] ??= []).push(vistaDeEvidencia(e));
    }
    return porCompetencia;
  };
  const seccion = secciones.find((s) => s.id === m.seccionId);
  const [asignaciones, plan] = await Promise.all([
    asignacionesParaNotas(resultados.map((r) => r.asignacionDocenteId)),
    planDeLaSeccion(seccion, anio.id),
  ]);
  const docenteIds = [
    ...asignaciones.map((a) => a.docenteId),
    ...plan.flatMap((p) => (p.asignacion ? [p.asignacion.docenteId] : [])),
  ];
  const planesIds = [...new Set(asignaciones.map((a) => a.planEstudioId))];
  const [docentes, competencias] = await Promise.all([
    docentesProviderComunidad.docentesPorId([...new Set(docenteIds)]),
    Promise.all(
      planesIds.map(async (id): Promise<[string, CompetenciaDelPlan[]]> => [id, await competenciasDelPlan(id)]),
    ),
  ]);
  const nombreDocente = (id: string | undefined) => docentes.find((d) => d.id === id)?.nombreCompleto ?? null;
  const competenciasDe = new Map(competencias);

  const entradasPlan: CursoDelPlanEntrada[] = plan.map((p) => ({
    cursoId: p.curso.id,
    codigo: p.curso.codigo,
    nombre: p.curso.nombre,
    docente: nombreDocente(p.asignacion?.docenteId),
  }));

  const bimestres = [...anio.periodos]
    .sort((a, b) => a.numero - b.numero)
    .map((p): BimestreDeLibreta => {
      const delBimestre = resultados.filter((r) => r.periodoEvaluacionId === p.id);
      const entradas = delBimestre.flatMap((r): CursoPublicadoEntrada[] => {
        const a = asignaciones.find((x) => x.id === r.asignacionDocenteId);
        if (!a) return [];
        const delCierre = notas.filter((n) => n.cierreId === r.cierreId);
        return [
          {
            cursoId: a.curso.id,
            codigo: a.curso.codigo,
            nombre: a.curso.nombre,
            docente: nombreDocente(a.docenteId),
            publicadoEn: r.publicadoEn,
            consolidado: r.logroConsolidado,
            competencias: competenciasDe.get(a.planEstudioId) ?? [],
            notas: Object.fromEntries(delCierre.map((n) => [n.competenciaPlanId, n.logro])),
            evidencias: evidenciasDelCierre(r.cierreId),
          },
        ];
      });
      const cursos = cursosDelBimestre(entradas, entradasPlan);
      const ultima = delBimestre.map((r) => r.publicadoEn.getTime()).sort((a, b) => b - a)[0];
      return {
        id: p.id,
        numero: p.numero,
        nombre: p.nombre,
        fechaInicio: p.fechaInicio,
        fechaFin: p.fechaFin,
        estado: estadoDelBimestre(p, cursos, hoy),
        publicadoEn: ultima ? new Date(ultima).toISOString() : null,
        cursos,
        resumen: resumenDeLogros(cursos),
      };
    });

  return {
    estudiante: {
      estudianteId: m.estudianteId,
      nombres: m.nombres,
      apellidos: m.apellidos,
      nombreCompleto: `${m.nombres} ${m.apellidos}`,
    },
    anio: { id: anio.id, anio: anio.anio },
    grado: seccion?.grado.nombre ?? null,
    seccion: seccion?.nombre ?? null,
    seccionCorta: seccion ? `${seccion.grado.numero}° ${seccion.nombre}` : null,
    tutor: seccion?.tutor?.nombreCompleto ?? null,
    bimestres,
    bimestrePorDefectoId: bimestrePorDefecto(bimestres, hoy)?.id ?? null,
  };
}

// ---------- US46 · Libreta del apoderado (AP-04, AP-06) ----------

/**
 * Libreta del hijo del apoderado en sesión (US46). 403 ESTUDIANTE_NO_VINCULADO si no es su hijo. Con 2 o más pensiones
 * vencidas (US26) responde la restricción con la deuda y sin cargar ninguna nota; se calcula en cada consulta.
 */
export async function libretaDelHijo(
  auth: Autenticado,
  estudianteId: string,
  ahora: Date = new Date(),
): Promise<LibretaDelHijo> {
  const m = await matriculaDelHijo(auth, estudianteId);
  const restriccion = await restriccionPorDeuda(m.matriculaId, m.anioAcademicoId);
  if (restriccion.restringido) {
    const anio = await obtenerAnio(m.anioAcademicoId);
    return {
      restringido: true,
      mensaje: restriccion.mensaje!,
      estudiante: {
        estudianteId,
        nombres: m.nombres,
        apellidos: m.apellidos,
        nombreCompleto: `${m.nombres} ${m.apellidos}`,
      },
      anio: { id: anio.id, anio: anio.anio },
      bimestres: [...anio.periodos]
        .sort((a, b) => a.numero - b.numero)
        .map((p) => ({ id: p.id, numero: p.numero, nombre: p.nombre })),
      deuda: { pensiones: restriccion.pensiones, total: restriccion.total },
    };
  }
  return { restringido: false, libreta: await armarLibreta(m, ahora) };
}

// ---------- US51 · Mis notas del alumno (AL-03) ----------

/**
 * «Mis notas» del alumno en sesión (US51): su libreta del año de su matrícula vigente, con todos los bimestres para
 * el filtro. La restricción por deuda (US26) no se aplica al alumno: el backlog la define para el apoderado.
 */
export async function libretaDelAlumno(auth: Autenticado, ahora: Date = new Date()): Promise<Libreta> {
  return armarLibreta(await matriculaVigenteDelAlumno(auth), ahora);
}

// ---------- US66 · Libreta en PDF ----------

const fechaCorta = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** «18/11/2026 10:24» en la hora de Lima. */
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

const conNombre = (logro: LogroNota | null) => (logro ? `${logro} · ${NOMBRE_LOGRO[logro]}` : "—");

/** Bloques del PDF: datos del estudiante, una tabla por curso publicado y los cursos pendientes (US66, criterio 1). */
function bloquesDeLibreta(libreta: Libreta, bimestre: BimestreDeLibreta): BloquePdf[] {
  const publicadosDelBimestre = bimestre.cursos.filter((c) => c.publicado);
  const pendientes = bimestre.cursos.filter((c) => !c.publicado);
  const bloques: BloquePdf[] = [
    {
      tipo: "datos",
      titulo: "Estudiante",
      filas: [
        ["Estudiante", libreta.estudiante.nombreCompleto],
        ["Grado y sección", libreta.grado ? `${libreta.grado} · ${libreta.seccion}` : "—"],
        ["Tutor", libreta.tutor ?? "—"],
        [
          "Periodo",
          `${bimestre.nombre} ${libreta.anio.anio} (${fechaCorta(bimestre.fechaInicio)} – ${fechaCorta(bimestre.fechaFin)})`,
        ],
      ],
    },
    ...publicadosDelBimestre.map((c): BloquePdf => ({
      tipo: "tabla",
      titulo: `${c.nombre}${c.docente ? ` · Docente: ${c.docente}` : ""}`,
      columnas: [
        { titulo: "Competencia", ancho: 0.7 },
        { titulo: "Logro", ancho: 0.3 },
      ],
      filas: [
        ...c.competencias.map((k) => [k.nombre, conNombre(k.logro)]),
        ["Logro consolidado del curso", conNombre(c.consolidado)],
      ],
    })),
  ];
  if (pendientes.length) {
    bloques.push({
      tipo: "tabla",
      titulo: "Cursos pendientes de publicación",
      columnas: [
        { titulo: "Curso", ancho: 0.6 },
        { titulo: "Estado", ancho: 0.4 },
      ],
      filas: pendientes.map((c) => [c.nombre, "Pendiente de publicación"]),
    });
  }
  bloques.push({
    tipo: "texto",
    texto:
      `Escala de calificación: ${LOGROS_NOTA.map((l) => `${l} ${NOMBRE_LOGRO[l]}`).join(", ")}. ` +
      "Solo se incluyen los cursos cerrados por el docente y publicados por la administración.",
  });
  return bloques;
}

async function pdfDeLibreta(libreta: Libreta, periodoId: string) {
  const bimestre = libreta.bimestres.find((b) => b.id === periodoId);
  if (!bimestre) throw E.bimestreDeLibretaAjeno();
  verificarLibretaDescargable(bimestre.cursos);
  const bytes = await generarPdf({
    nombre: "libreta-de-notas",
    institucion: "Kubo · Institución educativa",
    titulo: "Libreta de notas",
    subtitulo: `${bimestre.nombre} · Año ${libreta.anio.anio}`,
    bloques: bloquesDeLibreta(libreta, bimestre),
    pie: `Generado el ${fechaHoraLima(new Date())}`,
  });
  return {
    bytes,
    nombreArchivo: nombreArchivoLibreta({
      bimestre: bimestre.nombre,
      anio: libreta.anio.anio,
      nombres: libreta.estudiante.nombres,
      apellidos: libreta.estudiante.apellidos,
    }),
  };
}

/**
 * «Descargar libreta (PDF)» del apoderado (US66): logros por competencia y consolidado de cada curso publicado del
 * bimestre. Con restricción por deuda no se genera: 403 LIBRETA_RESTRINGIDA con el mensaje de US26 (criterio 3).
 */
export async function libretaPdfDelHijo(auth: Autenticado, estudianteId: string, periodoId: string) {
  const r = await libretaDelHijo(auth, estudianteId);
  if (r.restringido) throw E.libretaRestringida(r.mensaje);
  return pdfDeLibreta(r.libreta, periodoId);
}

/** «Descargar libreta» del alumno (AL-03): el mismo PDF, de su matrícula vigente. */
export async function libretaPdfDelAlumno(auth: Autenticado, periodoId: string) {
  return pdfDeLibreta(await libretaDelAlumno(auth), periodoId);
}
