// evaluacion/domain: reglas puras de los reportes del coordinador académico (bloque M2): «Reporte de logro de
// competencias» (cantidad y porcentaje de AD, A, B y C por competencia, con el detalle por alumno, y su CSV) y
// «Notas por alumno» (estado de cada curso en la libreta completa del año). Solo cuentan los registros CERRADOS o
// PUBLICADOS: los abiertos aún son del docente; esa selección la hace el caso de uso.
import { LOGROS_NOTA, type EstadoRegistro, type LogroNota } from "./notas";

/** Los porcentajes se muestran con un decimal («33,3 %»). */
const DECIMALES_PORCENTAJE = 1;
const CIEN = 100;

export interface Distribucion {
  conteo: Record<LogroNota, number>;
  total: number;
  /** Porcentaje de cada logro sobre el total, con un decimal; 0 si no hay notas. */
  porcentajes: Record<LogroNota, number>;
}

/** Cuántos AD, A, B y C hay y qué porcentaje es cada uno (los null no cuentan). */
export function distribucion(logros: (LogroNota | null)[]): Distribucion {
  const conteo = Object.fromEntries(LOGROS_NOTA.map((l) => [l, 0])) as Record<LogroNota, number>;
  for (const l of logros) if (l) conteo[l] += 1;
  const total = LOGROS_NOTA.reduce((s, l) => s + conteo[l], 0);
  const factor = 10 ** DECIMALES_PORCENTAJE;
  const porcentajes = Object.fromEntries(
    LOGROS_NOTA.map((l) => [l, total ? Math.round((conteo[l] * CIEN * factor) / total) / factor : 0]),
  ) as Record<LogroNota, number>;
  return { conteo, total, porcentajes };
}

// ---------- Reporte de logro de competencias ----------

export interface RegistroDelReporte {
  cierreId: string;
  curso: { id: string; codigo: string; nombre: string };
  /** «3° B». */
  seccion: string;
  /** Competencias del plan del curso en el grado; el código es el del catálogo (igual en todos los grados). */
  competencias: { competenciaPlanId: string; codigo: string; nombre: string; orden: number }[];
}

export interface CompetenciaDelReporte extends Distribucion {
  codigo: string;
  nombre: string;
  /** «C1», «C2»…: orden de la competencia en el plan. */
  columna: string;
}

export interface AlumnoDelReporte {
  matriculaId: string;
  nombre: string;
  seccion: string;
  /** Logro por código de competencia; null si no lo tiene. */
  logros: Record<string, LogroNota | null>;
  consolidado: LogroNota | null;
}

export interface CursoDelReporte {
  cursoId: string;
  codigo: string;
  nombre: string;
  secciones: string[];
  competencias: CompetenciaDelReporte[];
  /** Logro consolidado del curso de los mismos alumnos. */
  consolidado: Distribucion;
  alumnos: AlumnoDelReporte[];
}

/**
 * Agrupa los registros por curso: por competencia (código del catálogo) cuenta los logros de los alumnos consolidados
 * en cada registro y arma la fila de cada alumno. Los cursos van por nombre y los alumnos por sección y nombre.
 */
export function armarReporte(datos: {
  registros: RegistroDelReporte[];
  notas: { cierreId: string; matriculaId: string; competenciaPlanId: string; logro: LogroNota }[];
  resultados: { cierreId: string; matriculaId: string; logroConsolidado: LogroNota | null }[];
  nombres: Map<string, string>;
}): CursoDelReporte[] {
  const porCurso = new Map<string, RegistroDelReporte[]>();
  for (const r of datos.registros) porCurso.set(r.curso.id, [...(porCurso.get(r.curso.id) ?? []), r]);
  return [...porCurso.values()]
    .map((registros): CursoDelReporte => {
      const competencias = new Map<string, { codigo: string; nombre: string; orden: number }>();
      for (const r of registros) {
        for (const c of r.competencias) {
          const actual = competencias.get(c.codigo);
          if (!actual || c.orden < actual.orden) competencias.set(c.codigo, c);
        }
      }
      const ordenadas = [...competencias.values()].sort(
        (a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo),
      );
      const alumnos = registros.flatMap((r) => {
        const codigoDe = new Map(r.competencias.map((c) => [c.competenciaPlanId, c.codigo]));
        return datos.resultados
          .filter((x) => x.cierreId === r.cierreId)
          .map((x): AlumnoDelReporte => {
            const logros: Record<string, LogroNota | null> = Object.fromEntries(ordenadas.map((c) => [c.codigo, null]));
            for (const n of datos.notas) {
              if (n.cierreId !== r.cierreId || n.matriculaId !== x.matriculaId) continue;
              const codigo = codigoDe.get(n.competenciaPlanId);
              if (codigo) logros[codigo] = n.logro;
            }
            return {
              matriculaId: x.matriculaId,
              nombre: datos.nombres.get(x.matriculaId) ?? "—",
              seccion: r.seccion,
              logros,
              consolidado: x.logroConsolidado,
            };
          });
      });
      alumnos.sort((a, b) => a.seccion.localeCompare(b.seccion, "es") || a.nombre.localeCompare(b.nombre, "es"));
      return {
        cursoId: registros[0].curso.id,
        codigo: registros[0].curso.codigo,
        nombre: registros[0].curso.nombre,
        secciones: [...new Set(registros.map((r) => r.seccion))].sort((a, b) => a.localeCompare(b, "es")),
        competencias: ordenadas.map((c, i) => ({
          codigo: c.codigo,
          nombre: c.nombre,
          columna: `C${i + 1}`,
          ...distribucion(alumnos.map((a) => a.logros[c.codigo])),
        })),
        consolidado: distribucion(alumnos.map((a) => a.consolidado)),
        alumnos,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Un campo del CSV: entre comillas si lleva coma, comillas o salto de línea (RFC 4180). */
export function campoCsv(valor: string | number | null): string {
  const texto = valor == null ? "" : String(valor);
  // una fórmula (=, +, -, @) al inicio se neutraliza para que la hoja de cálculo no la ejecute
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return /[",\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/**
 * CSV del reporte: una fila por alumno y competencia, más el logro del curso. Con BOM para que la hoja de cálculo lea
 * las tildes. Ejemplo de fila: «2026,Bimestre I,Matemática,3° B,"Álvarez Prueba, Ana",C1,Resuelve problemas…,AD».
 */
export function csvDelReporte(contexto: { anio: number; bimestre: string }, cursos: CursoDelReporte[]): string {
  const filas: (string | number | null)[][] = [
    ["Año", "Bimestre", "Curso", "Sección", "Estudiante", "Columna", "Competencia", "Logro"],
  ];
  for (const c of cursos) {
    for (const a of c.alumnos) {
      for (const k of c.competencias) {
        filas.push([
          contexto.anio,
          contexto.bimestre,
          c.nombre,
          a.seccion,
          a.nombre,
          k.columna,
          k.nombre,
          a.logros[k.codigo],
        ]);
      }
      filas.push([
        contexto.anio,
        contexto.bimestre,
        c.nombre,
        a.seccion,
        a.nombre,
        "",
        "Logro del curso",
        a.consolidado,
      ]);
    }
  }
  return `\uFEFF${filas.map((f) => f.map(campoCsv).join(",")).join("\r\n")}\r\n`;
}

/** «Reporte_logro_BimestreI_2026.csv»: sin tildes ni espacios ni datos personales. */
export function nombreArchivoReporte(d: { anio: number; bimestre: string }, extension: "csv" | "pdf") {
  const bimestre = d.bimestre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "");
  return `Reporte_logro_${bimestre}_${d.anio}.${extension}`;
}

// ---------- Notas por alumno ----------

/** Estado de un curso en la libreta del coordinador: el de su registro o SIN_REGISTRO si aún no tiene. */
export type EstadoCursoAlumno = EstadoRegistro | "SIN_REGISTRO";

/** «Publicado», «Sin publicar · cerrado», «Sin publicar · en registro» o «Sin publicar · sin notas». */
export const ETIQUETA_ESTADO_CURSO: Record<EstadoCursoAlumno, string> = {
  PUBLICADO: "Publicado",
  CERRADO: "Sin publicar · cerrado",
  ABIERTO: "Sin publicar · en registro",
  SIN_REGISTRO: "Sin publicar · sin notas",
};
