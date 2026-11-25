// horarios/application: reporte de faltas y tardanzas por bimestre de la tutoría (bloque M3). Por alumno de la
// sección: clases registradas, asistencias, tardanzas, tardanzas justificadas, faltas, faltas justificadas y el
// porcentaje de asistencia, ordenable y con totales; descarga en CSV y en PDF (platform/pdf). Incluye a quienes
// tienen registros en la sección ese bimestre aunque después se hayan trasladado o retirado.
import { nombreArchivoSeguro, textoCsv } from "@/platform/http/csv";
import { errores } from "@/platform/http/errores";
import { generarPdf, type BloquePdf } from "@/platform/pdf";
import { fechaEnLima, obtenerAnio, tutoriaDelDocente } from "@/modules/academico";
import { resumenEstudiantes } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import { datosDeMatriculas } from "@/modules/matricula";
import { bimestreDeReferencia, nombreDeLista, type EstadoAsistencia } from "../domain/asistencia";
import {
  conteoDeAsistencia,
  ordenarReporte,
  totalDeAsistencia,
  type ConteoDeAsistencia,
  type OrdenReporte,
} from "../domain/tutoria";
import { asistencias } from "../infrastructure/asistencia";
import { alumnosDeLaSeccion, type BimestreDeTutoria } from "./asistenciaTutoria";

export interface FilaDelReporte extends ConteoDeAsistencia {
  matriculaId: string;
  nombre: string;
  /** La matrícula ya no está vigente en la sección (traslado, retiro o anulación). */
  fueraDeLaSeccion: boolean;
}

export interface ReporteDeAsistencia {
  seccion: { id: string; etiqueta: string };
  anio: { id: string; anio: number };
  bimestres: BimestreDeTutoria[];
  bimestre: BimestreDeTutoria;
  orden: OrdenReporte;
  ascendente: boolean;
  filas: FilaDelReporte[];
  total: ConteoDeAsistencia;
}

export interface FiltroReporte {
  periodoId?: string;
  orden?: OrdenReporte;
  ascendente?: boolean;
}

/**
 * Reporte de la sección en un bimestre (por defecto, el bimestre en curso o, en vacaciones, el último que empezó).
 * Por defecto se ordena por faltas, de más a menos.
 */
export async function reporteDeAsistencia(
  auth: Autenticado,
  seccionId: string,
  filtro: FiltroReporte,
  ahora: Date = new Date(),
): Promise<ReporteDeAsistencia> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const hoy = fechaEnLima(ahora);
  const anio = await obtenerAnio(t.anio.id);
  const bimestres: BimestreDeTutoria[] = anio.periodos.map(({ id, numero, nombre, fechaInicio, fechaFin }) => ({
    id,
    numero,
    nombre,
    fechaInicio,
    fechaFin,
  }));
  const bimestre = filtro.periodoId
    ? bimestres.find((b) => b.id === filtro.periodoId)
    : (bimestreDeReferencia(bimestres, hoy) ?? bimestres[0]);
  if (!bimestre) throw errores.noEncontrado("El bimestre");

  const registros = await asistencias.deSeccion(seccionId, bimestre);
  // los alumnos vigentes al cierre del bimestre (o hoy, si aún no termina) aparecen aunque no tengan registros
  const corte = hoy < bimestre.fechaFin ? hoy : bimestre.fechaFin;
  const vigentes = corte >= bimestre.fechaInicio ? await alumnosDeLaSeccion(seccionId, corte) : [];
  const vigentesIds = new Set(vigentes.map((a) => a.matriculaId));
  const ids = [...new Set([...vigentes.map((a) => a.matriculaId), ...registros.map((r) => r.matriculaId)])];
  const matriculas = await datosDeMatriculas(ids);
  const estudiantes = await resumenEstudiantes(Object.values(matriculas).map((m) => m.estudianteId));

  const porMatricula = new Map<string, EstadoAsistencia[]>();
  for (const r of registros) porMatricula.set(r.matriculaId, [...(porMatricula.get(r.matriculaId) ?? []), r.estado]);
  const filas = ids.flatMap((id): FilaDelReporte[] => {
    const e = estudiantes[matriculas[id]?.estudianteId];
    if (!e) return [];
    return [
      {
        matriculaId: id,
        nombre: nombreDeLista(e),
        fueraDeLaSeccion: !vigentesIds.has(id),
        ...conteoDeAsistencia(porMatricula.get(id) ?? []),
      },
    ];
  });
  const orden = filtro.orden ?? "faltas";
  const ascendente = filtro.ascendente ?? orden === "nombre";
  return {
    seccion: { id: t.seccion.id, etiqueta: t.seccion.etiqueta },
    anio: t.anio,
    bimestres,
    bimestre,
    orden,
    ascendente,
    filas: ordenarReporte(filas, orden, ascendente),
    total: totalDeAsistencia(filas),
  };
}

const enPorcentaje = (valor: number | null) => (valor === null ? "—" : `${String(valor).replace(".", ",")} %`);

const COLUMNAS: [titulo: string, campo: keyof ConteoDeAsistencia][] = [
  ["Clases", "clases"],
  ["Asistencias", "asistencias"],
  ["Tardanzas", "tardanzas"],
  ["Tardanzas justificadas", "tardanzasJustificadas"],
  ["Faltas", "faltas"],
  ["Faltas justificadas", "faltasJustificadas"],
];

const nombreArchivo = (r: ReporteDeAsistencia, extension: "csv" | "pdf") =>
  nombreArchivoSeguro(["Asistencia", r.seccion.etiqueta, r.bimestre.nombre, r.anio.anio], extension);

/** CSV del reporte: una fila por alumno y la fila de totales. */
export async function reporteDeAsistenciaCsv(auth: Autenticado, seccionId: string, filtro: FiltroReporte) {
  const r = await reporteDeAsistencia(auth, seccionId, filtro);
  const fila = (nombre: string, c: ConteoDeAsistencia, nota = "") => [
    r.anio.anio,
    r.bimestre.nombre,
    r.seccion.etiqueta,
    nombre,
    ...COLUMNAS.map(([, campo]) => c[campo] as number),
    c.porcentajeAsistencia === null ? "" : c.porcentajeAsistencia,
    nota,
  ];
  const texto = textoCsv([
    ["Año", "Bimestre", "Sección", "Estudiante", ...COLUMNAS.map(([t]) => t), "% de asistencia", "Observación"],
    ...r.filas.map((f) => fila(f.nombre, f, f.fueraDeLaSeccion ? "Ya no está en la sección" : "")),
    fila("Total de la sección", r.total),
  ]);
  return { texto, nombreArchivo: nombreArchivo(r, "csv") };
}

/** «2026-10-19» → «19/10/2026», como en las pantallas. */
const diaMesAnio = (fecha: string) => fecha.split("-").reverse().join("/");

/** PDF del reporte con platform/pdf: la tabla por alumno, los totales y cómo se calcula el porcentaje. */
export async function reporteDeAsistenciaPdf(auth: Autenticado, seccionId: string, filtro: FiltroReporte) {
  const r = await reporteDeAsistencia(auth, seccionId, filtro);
  const numero = (c: ConteoDeAsistencia) => COLUMNAS.map(([, campo]) => String(c[campo]));
  const anchoNumero = 0.085;
  const bloques: BloquePdf[] = [
    {
      tipo: "datos",
      titulo: "Datos del reporte",
      filas: [
        ["Sección", r.seccion.etiqueta],
        [
          "Bimestre",
          `${r.bimestre.nombre} (${diaMesAnio(r.bimestre.fechaInicio)} al ${diaMesAnio(r.bimestre.fechaFin)})`,
        ],
        ["Alumnos", String(r.filas.length)],
      ],
    },
    {
      tipo: "tabla",
      titulo: "Faltas y tardanzas por alumno",
      columnas: [
        { titulo: "Estudiante", ancho: 1 - anchoNumero * 6 - 0.1 },
        { titulo: "Clases", ancho: anchoNumero, alinear: "derecha" },
        { titulo: "Asist.", ancho: anchoNumero, alinear: "derecha" },
        { titulo: "Tard.", ancho: anchoNumero, alinear: "derecha" },
        { titulo: "Tard. J.", ancho: anchoNumero, alinear: "derecha" },
        { titulo: "Faltas", ancho: anchoNumero, alinear: "derecha" },
        { titulo: "Faltas J.", ancho: anchoNumero, alinear: "derecha" },
        { titulo: "% asist.", ancho: 0.1, alinear: "derecha" },
      ],
      filas: [
        ...r.filas.map((f) => [
          f.fueraDeLaSeccion ? `${f.nombre} (ya no está)` : f.nombre,
          ...numero(f),
          enPorcentaje(f.porcentajeAsistencia),
        ]),
        ["Total de la sección", ...numero(r.total), enPorcentaje(r.total.porcentajeAsistencia)],
      ],
      vacio: "La sección no tiene alumnos en este bimestre.",
    },
    {
      tipo: "texto",
      texto:
        "Cada columna cuenta clases con asistencia registrada. El porcentaje de asistencia suma asistencias, tardanzas " +
        "y tardanzas justificadas sobre las clases registradas. «J.» indica justificadas por el tutor.",
    },
  ];
  const bytes = await generarPdf({
    nombre: "reporte-asistencia-tutoria",
    institucion: "Kubo · Institución educativa",
    titulo: "Reporte de faltas y tardanzas",
    subtitulo: `${r.seccion.etiqueta} · ${r.bimestre.nombre} · Año ${r.anio.anio}`,
    bloques,
  });
  return { bytes, nombreArchivo: nombreArchivo(r, "pdf") };
}
