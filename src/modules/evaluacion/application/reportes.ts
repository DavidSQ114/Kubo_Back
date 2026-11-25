// evaluacion/application: reportes del coordinador académico (bloque M2). «Reporte de logro de competencias»: por año,
// bimestre, grado, sección y curso, cuántos AD, A, B y C hay en cada competencia y el detalle por alumno, solo de
// registros CERRADOS o PUBLICADOS, con su descarga en CSV y en PDF. «Notas por alumno»: la libreta completa del año de
// una matrícula, con todos los cursos y bimestres; lo que no está publicado sale marcado «Sin publicar».
import { generarPdf, type BloquePdf } from "@/platform/pdf";
import {
  asignacionesParaNotas,
  competenciasDelPlan,
  listarSecciones,
  obtenerAnio,
  planDeSeccion,
  type CompetenciaDelPlan,
} from "@/modules/academico";
import { docentesProviderComunidad, resumenEstudiantes } from "@/modules/comunidad";
import { datosDeMatriculas } from "@/modules/matricula";
import { erroresEvaluacion as E } from "../domain/errores";
import { NOMBRE_LOGRO } from "../domain/libreta";
import { LOGROS_NOTA, type LogroNota } from "../domain/notas";
import {
  armarReporte,
  csvDelReporte,
  ETIQUETA_ESTADO_CURSO,
  nombreArchivoReporte,
  type CursoDelReporte,
  type Distribucion,
  type EstadoCursoAlumno,
} from "../domain/reportes";
import {
  calificacionesItem,
  cierres,
  estadoDeRegistro,
  itemsEvaluacion,
  notas,
  resultados,
} from "../infrastructure/repositorio";
import { registrosParaPublicar, type FiltroPublicacion } from "./publicacion";
import { etiquetaDe, nombreDeLista } from "./registroNotas";

/** Competencias de varios planes, una consulta por plan distinto. */
async function competenciasDePlanes(planIds: string[]) {
  const unicos = [...new Set(planIds)];
  const listas = await Promise.all(unicos.map(async (id) => [id, await competenciasDelPlan(id)] as const));
  return new Map<string, CompetenciaDelPlan[]>(listas);
}

/** «Castillo Ramos, Bruno» por matrícula. */
async function nombresDeMatriculas(matriculaIds: string[]) {
  const datos = await datosDeMatriculas(matriculaIds);
  const estudiantes = await resumenEstudiantes([...new Set(Object.values(datos).map((d) => d.estudianteId))]);
  return new Map(
    Object.values(datos).flatMap((d) => {
      const e = estudiantes[d.estudianteId];
      return e ? [[d.matriculaId, nombreDeLista(e)] as const] : [];
    }),
  );
}

// ---------- Reporte de logro de competencias ----------

export interface ReporteLogro {
  anios: { id: string; anio: number; estado: string }[];
  anio: { id: string; anio: number; estado: string } | null;
  bimestres: { id: string; numero: number; nombre: string }[];
  /** Bimestre del reporte: el pedido o, si no se pidió, el último con registros cerrados. */
  bimestre: { id: string; numero: number; nombre: string } | null;
  grados: { id: string; numero: number; nombre: string }[];
  /** Secciones y cursos con registros cerrados o publicados en el año, el bimestre y el grado elegidos. */
  secciones: { id: string; etiqueta: string; gradoId: string }[];
  cursos: { id: string; nombre: string }[];
  /** Registros que entran al reporte (cerrados o publicados). */
  registros: number;
  resultados: CursoDelReporte[];
}

/** Por defecto, el último bimestre con algún registro cerrado o publicado. */
function bimestreDelReporte(
  bimestres: ReporteLogro["bimestres"],
  conRegistros: Set<string>,
  pedido: string | undefined,
): ReporteLogro["bimestre"] {
  if (pedido) {
    const b = bimestres.find((x) => x.id === pedido);
    if (!b) throw E.bimestreDeLibretaAjeno();
    return b;
  }
  return [...bimestres].reverse().find((b) => conRegistros.has(b.id)) ?? bimestres[0] ?? null;
}

/**
 * Reporte de logro de competencias (bloque M2): por curso, cada competencia con su cantidad y porcentaje de AD, A, B y
 * C, y debajo cada alumno con su logro. Solo registros CERRADOS o PUBLICADOS: los abiertos aún son del docente.
 */
export async function reporteLogroCompetencias(filtro: FiltroPublicacion): Promise<ReporteLogro> {
  const base = await registrosParaPublicar({ anioId: filtro.anioId });
  const todos = [...base.porPublicar, ...base.publicados];
  const bimestres = base.bimestres.map(({ id, numero, nombre }) => ({ id, numero, nombre }));
  const bimestre = bimestreDelReporte(bimestres, new Set(todos.map((r) => r.bimestre.id)), filtro.periodoId);
  const delBimestre = todos.filter((r) => r.bimestre.id === bimestre?.id);
  const delGrado = delBimestre.filter((r) => !filtro.gradoId || r.grado.id === filtro.gradoId);
  const deSeccion = delGrado.filter((r) => !filtro.seccionId || r.seccion.id === filtro.seccionId);
  const elegidos = deSeccion.filter((r) => !filtro.cursoId || r.curso.id === filtro.cursoId);

  const cierreIds = elegidos.map((r) => r.cierreId);
  const [asignaciones, notasDe, resultadosDe] = await Promise.all([
    asignacionesParaNotas(elegidos.map((r) => r.asignacionId)),
    notas.deCierres(cierreIds),
    resultados.deCierres(cierreIds),
  ]);
  const [competencias, nombres] = await Promise.all([
    competenciasDePlanes(asignaciones.map((a) => a.planEstudioId)),
    nombresDeMatriculas(resultadosDe.map((r) => r.matriculaId)),
  ]);
  const unicos = <T extends { id: string }>(lista: T[]) => [...new Map(lista.map((x) => [x.id, x])).values()];
  return {
    anios: base.anios,
    anio: base.anio,
    bimestres,
    bimestre,
    grados: base.grados,
    secciones: unicos(
      delGrado.map((r) => ({ id: r.seccion.id, etiqueta: r.seccion.etiqueta, gradoId: r.grado.id })),
    ).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
    cursos: unicos(deSeccion.map((r) => ({ id: r.curso.id, nombre: r.curso.nombre }))).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    ),
    registros: elegidos.length,
    resultados: armarReporte({
      registros: elegidos.map((r) => ({
        cierreId: r.cierreId,
        curso: r.curso,
        seccion: r.seccion.etiqueta,
        competencias: competencias.get(asignaciones.find((a) => a.id === r.asignacionId)?.planEstudioId ?? "") ?? [],
      })),
      notas: notasDe,
      resultados: resultadosDe,
      nombres,
    }),
  };
}

function contextoDelReporte(r: ReporteLogro) {
  if (!r.anio || !r.bimestre) throw E.registroNoEncontrado();
  return { anio: r.anio.anio, bimestre: r.bimestre.nombre };
}

/** CSV del reporte: una fila por alumno y competencia (bloque M2). */
export async function reporteLogroCsv(filtro: FiltroPublicacion) {
  const r = await reporteLogroCompetencias(filtro);
  const contexto = contextoDelReporte(r);
  return { texto: csvDelReporte(contexto, r.resultados), nombreArchivo: nombreArchivoReporte(contexto, "csv") };
}

const conPorcentaje = (d: Distribucion, l: LogroNota) =>
  `${d.conteo[l]} (${String(d.porcentajes[l]).replace(".", ",")} %)`;

/** PDF del reporte: por curso, el resumen por competencia y el detalle por alumno (con platform/pdf). */
export async function reporteLogroPdf(filtro: FiltroPublicacion) {
  const r = await reporteLogroCompetencias(filtro);
  const contexto = contextoDelReporte(r);
  const filtros = [
    r.grados.find((g) => g.id === filtro.gradoId)?.nombre,
    r.secciones.find((s) => s.id === filtro.seccionId)?.etiqueta,
    r.cursos.find((c) => c.id === filtro.cursoId)?.nombre,
  ].filter(Boolean);
  const bloques: BloquePdf[] = [
    {
      tipo: "datos",
      titulo: "Filtros",
      filas: [
        ["Año y bimestre", `${contexto.anio} · ${contexto.bimestre}`],
        ["Grado, sección y curso", filtros.length ? filtros.join(" · ") : "Todos"],
        ["Registros incluidos", `${r.registros} (solo cerrados o publicados)`],
      ],
    },
  ];
  const resumenAncho = 0.36;
  const logroAncho = (1 - resumenAncho - 0.12) / LOGROS_NOTA.length;
  for (const c of r.resultados) {
    bloques.push({
      tipo: "tabla",
      titulo: `${c.nombre} · ${c.secciones.join(", ")} · logro por competencia`,
      columnas: [
        { titulo: "Competencia", ancho: resumenAncho },
        ...LOGROS_NOTA.map((l) => ({ titulo: l, ancho: logroAncho, alinear: "derecha" as const })),
        { titulo: "Total", ancho: 0.12, alinear: "derecha" },
      ],
      filas: [
        ...c.competencias.map((k) => [
          `${k.columna} ${k.nombre}`,
          ...LOGROS_NOTA.map((l) => conPorcentaje(k, l)),
          String(k.total),
        ]),
        ["Logro del curso", ...LOGROS_NOTA.map((l) => conPorcentaje(c.consolidado, l)), String(c.consolidado.total)],
      ],
    });
    const anchoAlumno = 0.34;
    const anchoSeccion = 0.1;
    const anchoLogro = (1 - anchoAlumno - anchoSeccion) / (c.competencias.length + 1);
    bloques.push({
      tipo: "tabla",
      titulo: `${c.nombre} · detalle por alumno`,
      columnas: [
        { titulo: "Estudiante", ancho: anchoAlumno },
        { titulo: "Sección", ancho: anchoSeccion },
        ...c.competencias.map((k) => ({ titulo: k.columna, ancho: anchoLogro })),
        { titulo: "Curso", ancho: anchoLogro },
      ],
      filas: c.alumnos.map((a) => [
        a.nombre,
        a.seccion,
        ...c.competencias.map((k) => a.logros[k.codigo] ?? "—"),
        a.consolidado ?? "—",
      ]),
      vacio: "Sin alumnos consolidados.",
    });
  }
  if (!r.resultados.length) {
    bloques.push({ tipo: "texto", texto: "No hay registros cerrados o publicados con estos filtros." });
  }
  bloques.push({
    tipo: "texto",
    texto: `Escala: ${LOGROS_NOTA.map((l) => `${l} ${NOMBRE_LOGRO[l]}`).join(", ")}. Solo se incluyen registros cerrados por el docente o publicados.`,
  });
  const bytes = await generarPdf({
    nombre: "reporte-logro-competencias",
    institucion: "Kubo · Institución educativa",
    titulo: "Reporte de logro de competencias",
    subtitulo: `${contexto.bimestre} · Año ${contexto.anio}`,
    bloques,
  });
  return { bytes, nombreArchivo: nombreArchivoReporte(contexto, "pdf") };
}

// ---------- Notas por alumno ----------

export interface CompetenciaDelAlumno {
  codigo: string;
  nombre: string;
  columna: string;
  logro: LogroNota | null;
  items: { nombre: string; peso: number; logro: LogroNota | null }[];
}

export interface CursoDelAlumno {
  cursoId: string;
  codigo: string;
  nombre: string;
  docente: string | null;
  estado: EstadoCursoAlumno;
  /** «Publicado» o «Sin publicar · …». */
  etiquetaEstado: string;
  publicado: boolean;
  consolidado: LogroNota | null;
  competencias: CompetenciaDelAlumno[];
}

export interface NotasDelAlumno {
  matriculaId: string;
  estudiante: { nombreCompleto: string; dni: string };
  anio: { id: string; anio: number };
  /** «3° B» de la matrícula; null si no tiene sección. */
  seccion: string | null;
  estadoMatricula: string;
  bimestres: { id: string; numero: number; nombre: string; cursos: CursoDelAlumno[] }[];
}

/**
 * Libreta completa del año de una matrícula para el coordinador (bloque M2): todos los cursos y bimestres, con sus
 * notas (también las no publicadas, marcadas «Sin publicar»), el consolidado y el detalle de los ítems. Los cursos del
 * plan de su sección que aún no tienen registro salen «Sin publicar · sin notas».
 */
export async function notasDelAlumno(matriculaId: string): Promise<NotasDelAlumno> {
  const m = (await datosDeMatriculas([matriculaId]))[matriculaId];
  if (!m) throw E.registroNoEncontrado();
  const [anio, estudiantes, registros, secciones, notasDelAlumno] = await Promise.all([
    obtenerAnio(m.anioAcademicoId),
    resumenEstudiantes([m.estudianteId]),
    cierres.deMatricula(matriculaId),
    listarSecciones(m.anioAcademicoId),
    notas.deMatricula(matriculaId),
  ]);
  const cierreIds = registros.map((c) => c.id);
  const seccion = secciones.find((s) => s.id === m.seccionId);
  const [asignaciones, resultadosDe, items, calificaciones, plan] = await Promise.all([
    asignacionesParaNotas(registros.map((c) => c.asignacionDocenteId)),
    resultados.deCierres(cierreIds),
    itemsEvaluacion.deCierres(cierreIds),
    calificacionesItem.deCierres(cierreIds),
    seccion
      ? planDeSeccion({ id: seccion.id, grado: { id: seccion.grado.id }, anio: { id: anio.id } })
      : Promise.resolve([]),
  ]);
  const competencias = await competenciasDePlanes(asignaciones.map((a) => a.planEstudioId));
  const docentes = await docentesProviderComunidad.docentesPorId([
    ...new Set([
      ...asignaciones.map((a) => a.docenteId),
      ...plan.flatMap((p) => (p.asignacion ? [p.asignacion.docenteId] : [])),
    ]),
  ]);
  const nombreDocente = (id: string | undefined) => docentes.find((d) => d.id === id)?.nombreCompleto ?? null;
  const estudiante = estudiantes[m.estudianteId];

  const bimestres = [...anio.periodos]
    .sort((a, b) => a.numero - b.numero)
    .map((p) => {
      const conRegistro = registros
        .filter((c) => c.periodoEvaluacionId === p.id)
        .flatMap((c): CursoDelAlumno[] => {
          const a = asignaciones.find((x) => x.id === c.asignacionDocenteId);
          if (!a) return [];
          const estado = estadoDeRegistro(c);
          const lista = [...(competencias.get(a.planEstudioId) ?? [])].sort((x, y) => x.orden - y.orden);
          return [
            {
              cursoId: a.curso.id,
              codigo: a.curso.codigo,
              nombre: a.curso.nombre,
              docente: nombreDocente(a.docenteId),
              estado,
              etiquetaEstado: ETIQUETA_ESTADO_CURSO[estado],
              publicado: estado === "PUBLICADO",
              consolidado:
                resultadosDe.find((r) => r.cierreId === c.id && r.matriculaId === matriculaId)?.logroConsolidado ??
                null,
              competencias: lista.map((k, i) => ({
                codigo: k.codigo,
                nombre: k.nombre,
                columna: `C${i + 1}`,
                logro:
                  notasDelAlumno.find((n) => n.cierreId === c.id && n.competenciaPlanId === k.competenciaPlanId)
                    ?.logro ?? null,
                items: items
                  .filter((it) => it.cierreId === c.id && it.competenciaPlanId === k.competenciaPlanId)
                  .map((it) => ({
                    nombre: it.nombre,
                    peso: it.peso,
                    logro:
                      calificaciones.find((x) => x.itemId === it.id && x.matriculaId === matriculaId)?.valor ?? null,
                  })),
              })),
            },
          ];
        });
      const yaEstan = new Set(conRegistro.map((c) => c.cursoId));
      const sinRegistro = plan
        .filter((x) => !yaEstan.has(x.curso.id))
        .map((x): CursoDelAlumno => ({
          cursoId: x.curso.id,
          codigo: x.curso.codigo,
          nombre: x.curso.nombre,
          docente: nombreDocente(x.asignacion?.docenteId),
          estado: "SIN_REGISTRO",
          etiquetaEstado: ETIQUETA_ESTADO_CURSO.SIN_REGISTRO,
          publicado: false,
          consolidado: null,
          competencias: [],
        }));
      return {
        id: p.id,
        numero: p.numero,
        nombre: p.nombre,
        cursos: [...conRegistro, ...sinRegistro].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      };
    });

  return {
    matriculaId,
    estudiante: { nombreCompleto: estudiante?.nombreCompleto ?? "—", dni: estudiante?.dni ?? "" },
    anio: { id: anio.id, anio: anio.anio },
    seccion: seccion ? etiquetaDe(seccion) : null,
    estadoMatricula: m.estado,
    bimestres,
  };
}
