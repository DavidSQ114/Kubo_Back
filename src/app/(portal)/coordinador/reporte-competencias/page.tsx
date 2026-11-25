// Reporte de logro de competencias · Coordinador académico (bloque M2; el Figma no tiene frame propio): filtros de año,
// bimestre, grado, sección y curso; por competencia, la cantidad y el porcentaje de AD, A, B y C, y debajo el detalle
// por alumno. Solo cuenta registros cerrados o publicados, y la pantalla lo dice. Descarga en CSV y en PDF.
"use client";

import { useEffect, useState } from "react";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { BadgeLogro, LOGROS, NOMBRE_LOGRO, type Logro } from "@/components/docente/notas";
import { Alerta, Boton, Spinner, Tarjeta } from "@/components/ui";
import { api, descargar } from "@/lib/api";
import { cantidad } from "@/lib/formato";

interface Distribucion {
  conteo: Record<Logro, number>;
  total: number;
  porcentajes: Record<Logro, number>;
}

interface CursoDelReporte {
  cursoId: string;
  codigo: string;
  nombre: string;
  secciones: string[];
  competencias: (Distribucion & { codigo: string; nombre: string; columna: string })[];
  consolidado: Distribucion;
  alumnos: {
    matriculaId: string;
    nombre: string;
    seccion: string;
    logros: Record<string, Logro | null>;
    consolidado: Logro | null;
  }[];
}

interface ReporteLogro {
  anios: { id: string; anio: number; estado: string }[];
  anio: { id: string; anio: number } | null;
  bimestres: { id: string; nombre: string }[];
  bimestre: { id: string; nombre: string } | null;
  grados: { id: string; nombre: string }[];
  secciones: { id: string; etiqueta: string; gradoId: string }[];
  cursos: { id: string; nombre: string }[];
  registros: number;
  resultados: CursoDelReporte[];
}

interface Filtros {
  anioId: string;
  periodoId: string;
  gradoId: string;
  seccionId: string;
  cursoId: string;
}

const VACIOS: Filtros = { anioId: "", periodoId: "", gradoId: "", seccionId: "", cursoId: "" };

const consulta = (f: Filtros) =>
  new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

const enPorcentaje = (n: number) => `${String(n).replace(".", ",")} %`;

const BARRA: Record<Logro, string> = { AD: "bg-verde", A: "bg-celeste", B: "bg-ambar", C: "bg-rojo" };

/** Barra apilada con la proporción de cada logro (sus números están en la tabla). */
function BarraLogros({ d }: { d: Distribucion }) {
  if (!d.total) return null;
  return (
    <div className="flex h-2 w-full min-w-[120px] overflow-hidden rounded-full bg-borde" aria-hidden>
      {LOGROS.map((l) =>
        d.conteo[l] ? (
          <div key={l} className={BARRA[l]} style={{ width: `${(d.conteo[l] * 100) / d.total}%` }} />
        ) : null,
      )}
    </div>
  );
}

function CeldaConteo({ d, logro }: { d: Distribucion; logro: Logro }) {
  return (
    <td className="px-3 py-2.5 text-right text-[14px] whitespace-nowrap text-texto">
      <span className="font-semibold">{d.conteo[logro]}</span>{" "}
      <span className="text-[12px] text-texto-3">({enPorcentaje(d.porcentajes[logro])})</span>
    </td>
  );
}

function TarjetaCurso({ curso }: { curso: CursoDelReporte }) {
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[20px] font-semibold text-texto">{curso.nombre}</h2>
        <p className="text-[13px] text-texto-3">
          {curso.secciones.join(", ")} · {cantidad(curso.alumnos.length, "estudiante", "estudiantes")}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">Logros por competencia de {curso.nombre}</caption>
          <thead className="bg-fondo text-[13px] font-semibold text-texto-2">
            <tr>
              <th scope="col" className="px-3 py-2.5">
                Competencia
              </th>
              {LOGROS.map((l) => (
                <th key={l} scope="col" className="px-3 py-2.5 text-right" title={NOMBRE_LOGRO[l]}>
                  {l}
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 text-right">
                Total
              </th>
              <th scope="col" className="px-3 py-2.5">
                <span className="sr-only">Proporción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              ...curso.competencias.map((c) => ({ clave: c.codigo, titulo: `${c.columna} · ${c.nombre}`, d: c })),
              { clave: "curso", titulo: "Logro consolidado del curso", d: curso.consolidado },
            ].map((f) => (
              <tr key={f.clave} className={`border-t border-borde ${f.clave === "curso" ? "bg-fondo/60" : ""}`}>
                <th scope="row" className="max-w-[320px] px-3 py-2.5 text-[14px] font-medium text-texto">
                  {f.titulo}
                </th>
                {LOGROS.map((l) => (
                  <CeldaConteo key={l} d={f.d} logro={l} />
                ))}
                <td className="px-3 py-2.5 text-right text-[14px] font-semibold text-texto">{f.d.total}</td>
                <td className="px-3 py-2.5">
                  <BarraLogros d={f.d} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="group">
        <summary className="cursor-pointer text-[14px] font-semibold text-kubo-azul">Detalle por alumno</summary>
        <div className="mt-3 overflow-x-auto rounded-lg border border-borde">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Logro de cada alumno en {curso.nombre}</caption>
            <thead className="bg-fondo text-[13px] font-semibold text-texto-2">
              <tr>
                <th scope="col" className="sticky left-0 bg-fondo px-3 py-2.5">
                  Estudiante
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Sección
                </th>
                {curso.competencias.map((c) => (
                  <th key={c.codigo} scope="col" title={c.nombre} className="px-2 py-2.5 text-center">
                    {c.columna}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2.5 text-center">
                  Curso
                </th>
              </tr>
            </thead>
            <tbody>
              {curso.alumnos.map((a) => (
                <tr key={a.matriculaId} className="border-t border-borde">
                  <th
                    scope="row"
                    className="sticky left-0 bg-white px-3 py-2 text-[14px] font-medium whitespace-nowrap text-texto"
                  >
                    {a.nombre}
                  </th>
                  <td className="px-3 py-2 text-[13px] text-texto-2">{a.seccion}</td>
                  {curso.competencias.map((c) => (
                    <td key={c.codigo} className="px-2 py-2 text-center">
                      {a.logros[c.codigo] ? (
                        <BadgeLogro logro={a.logros[c.codigo]!} />
                      ) : (
                        <span className="text-texto-3">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    {a.consolidado ? <BadgeLogro logro={a.consolidado} /> : <span className="text-texto-3">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Tarjeta>
  );
}

export default function ReporteCompetenciasPage() {
  const [filtros, setFiltros] = useState<Filtros>(VACIOS);
  const [datos, setDatos] = useState<ReporteLogro | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [descargando, setDescargando] = useState<"csv" | "pdf" | null>(null);

  useEffect(() => {
    let vigente = true;
    api<ReporteLogro>(`/evaluacion/reportes/logro-competencias?${consulta(filtros)}`)
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        setError(null);
      })
      .catch((e) => vigente && setError(alertaError(e)));
    return () => {
      vigente = false;
    };
  }, [filtros, intento]);

  // al cambiar un filtro, los que dependen de él vuelven a «Todos»
  const cambiar = (c: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...c }));
  const efectivos: Filtros = {
    ...filtros,
    anioId: filtros.anioId || datos?.anio?.id || "",
    periodoId: filtros.periodoId || datos?.bimestre?.id || "",
  };

  async function bajar(tipo: "csv" | "pdf") {
    setDescargando(tipo);
    try {
      await descargar(
        `/evaluacion/reportes/logro-competencias/${tipo}?${consulta(efectivos)}`,
        `reporte-logro.${tipo}`,
      );
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-texto-3">Académico / Reporte de logro de competencias</p>
        <h1 className="text-[28px] font-semibold text-texto">Reporte de logro de competencias</h1>
        <p className="text-[15px] text-texto-2">
          Cuántos estudiantes alcanzan cada logro en cada competencia, con el detalle por alumno.
        </p>
      </div>

      <Alerta tipo="info" titulo="Solo se incluyen registros cerrados por el docente o publicados">
        Los registros que siguen abiertos aún pueden cambiar y no entran al reporte.
      </Alerta>

      <Tarjeta className="flex flex-col gap-4 p-4 lg:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Selector etiqueta="Año" valor={efectivos.anioId} onCambiar={(v) => cambiar({ ...VACIOS, anioId: v })}>
            {(datos?.anios ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.anio}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Bimestre" valor={efectivos.periodoId} onCambiar={(v) => cambiar({ periodoId: v })}>
            {(datos?.bimestres ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta="Grado"
            valor={filtros.gradoId}
            onCambiar={(v) => cambiar({ gradoId: v, seccionId: "", cursoId: "" })}
          >
            <option value="">Todos</option>
            {(datos?.grados ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta="Sección"
            valor={filtros.seccionId}
            onCambiar={(v) => cambiar({ seccionId: v, cursoId: "" })}
          >
            <option value="">Todas</option>
            {(datos?.secciones ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.etiqueta}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Curso" valor={filtros.cursoId} onCambiar={(v) => cambiar({ cursoId: v })}>
            <option value="">Todos</option>
            {(datos?.cursos ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-texto-2">
            {datos ? cantidad(datos.registros, "registro incluido", "registros incluidos") : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              icono="icon-descargar"
              cargando={descargando === "csv"}
              disabled={!datos?.registros}
              onClick={() => bajar("csv")}
            >
              Descargar CSV
            </Boton>
            <Boton
              variante="secundario"
              icono="icon-pdf"
              cargando={descargando === "pdf"}
              disabled={!datos?.registros}
              onClick={() => bajar("pdf")}
            >
              Descargar PDF
            </Boton>
          </div>
        </div>
      </Tarjeta>

      {error && (
        <Alerta tipo="error" titulo={error}>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="font-semibold text-kubo-azul underline"
          >
            Reintentar
          </button>
        </Alerta>
      )}
      {!datos && !error && (
        <div className="flex items-center gap-3 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando reporte…
        </div>
      )}
      {datos && datos.resultados.length === 0 && (
        <Tarjeta className="flex flex-col items-center gap-2 p-10 text-center">
          <p className="text-[16px] font-semibold text-texto">
            No hay registros cerrados o publicados con estos filtros.
          </p>
          <p className="text-[14px] text-texto-2">
            Cuando los docentes cierren sus registros del bimestre, sus logros aparecerán aquí.
          </p>
        </Tarjeta>
      )}
      {datos?.resultados.map((c) => (
        <TarjetaCurso key={c.cursoId} curso={c} />
      ))}
    </div>
  );
}
