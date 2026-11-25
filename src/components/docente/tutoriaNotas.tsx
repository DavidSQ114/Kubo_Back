// Mi tutoría · Notas (bloque M3). (a) Notas por alumno: el tutor elige un alumno de su sección y ve su libreta completa
// del año, todos los cursos (lo no publicado, «Sin publicar») con la conducta de cada bimestre. (b) Consolidado: matriz
// de alumnos por cursos con el logro consolidado del bimestre elegido y la conducta, el resumen de AD, A, B y C por
// curso y la descarga en CSV.
"use client";

import { useState } from "react";
import { BadgeLogro, type Logro } from "@/components/docente/notas";
import { mensajeError } from "@/components/portal";
import { CargandoAsistencia, ErrorAsistencia, useConsulta } from "@/components/portal/asistencia";
import { LibretaCompleta } from "@/components/portal/notasDelAlumno";
import { Alerta, Badge, Boton, Tarjeta } from "@/components/ui";
import { descargar } from "@/lib/api";
import { useTutoria } from "./tutoria";

const LOGROS: Logro[] = ["AD", "A", "B", "C"];

// ---------- (a) Notas por alumno ----------

export function NotasPorAlumnoTutoria() {
  const t = useTutoria();
  const { carga, reintentar } = useConsulta<{ alumnos: { matriculaId: string; nombre: string }[] }>(
    `/evaluacion/tutoria/${t.seccion.id}/alumnos`,
  );
  const [elegido, setElegido] = useState<string | null>(null);

  if (carga.fase === "cargando") return <CargandoAsistencia />;
  if (carga.fase === "error") return <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />;
  const { alumnos } = carga.datos;
  if (!alumnos.length) return <Alerta tipo="info" titulo="La sección no tiene alumnos con matrícula vigente." />;
  const actual = elegido ?? alumnos[0].matriculaId;
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="flex flex-wrap items-end gap-4 p-4 lg:p-5">
        <div className="flex min-w-[240px] flex-col gap-1.5">
          <label htmlFor="alumno-notas" className="text-[14px] font-semibold text-texto">
            Alumno
          </label>
          <select
            id="alumno-notas"
            value={actual}
            onChange={(e) => setElegido(e.target.value)}
            className="h-10 rounded-md border border-borde bg-white px-3 text-[14px] text-texto outline-none focus:border-kubo-azul"
          >
            {alumnos.map((a) => (
              <option key={a.matriculaId} value={a.matriculaId}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <p className="min-w-[200px] flex-1 text-[13px] leading-[1.5] text-texto-3">
          Ves todos los cursos del alumno, también los que aún no se publican para la familia.
        </p>
      </Tarjeta>
      <LibretaCompleta key={actual} ruta={`/evaluacion/tutoria/${t.seccion.id}/alumnos/${actual}/notas`} />
    </div>
  );
}

// ---------- (b) Consolidado de la sección ----------

interface Consolidado {
  periodos: { id: string; nombre: string; estado: string }[];
  periodo: { id: string; nombre: string };
  cursos: {
    cursoId: string;
    codigo: string;
    nombre: string;
    etiquetaEstado: string;
    publicado: boolean;
    resumen: Record<Logro | "SIN_NOTA", number>;
  }[];
  alumnos: { matriculaId: string; nombre: string; logros: Record<string, Logro | null>; conducta: Logro | null }[];
  resumenConducta: Record<Logro | "SIN_NOTA", number>;
}

function Celda({ logro }: { logro: Logro | null }) {
  return logro ? <BadgeLogro logro={logro} /> : <span className="text-texto-3">—</span>;
}

export function ConsolidadoTutoria() {
  const t = useTutoria();
  const [periodoId, setPeriodoId] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const sufijo = periodoId ? `?periodoId=${periodoId}` : "";
  const base = `/evaluacion/tutoria/${t.seccion.id}/consolidado`;
  const { carga, reintentar } = useConsulta<Consolidado>(`${base}${sufijo}`);

  async function bajar() {
    setDescargando(true);
    setErrorDescarga(null);
    try {
      await descargar(`${base}/csv${sufijo}`, "consolidado.csv");
    } catch (e) {
      setErrorDescarga(mensajeError(e));
    }
    setDescargando(false);
  }

  if (carga.fase === "cargando") return <CargandoAsistencia />;
  if (carga.fase === "error") return <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />;
  const c = carga.datos;
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="flex flex-wrap items-end gap-4 p-4 lg:p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bimestre-consolidado" className="text-[14px] font-semibold text-texto">
            Bimestre
          </label>
          <select
            id="bimestre-consolidado"
            value={c.periodo.id}
            onChange={(e) => setPeriodoId(e.target.value)}
            className="h-10 rounded-md border border-borde bg-white px-3 text-[14px] text-texto outline-none focus:border-kubo-azul"
          >
            {c.periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <p className="min-w-[200px] flex-1 text-[13px] leading-[1.5] text-texto-3">
          Logro consolidado de cada curso: existe desde que el docente cierra su registro. Los cursos «Sin publicar»
          todavía no los ve la familia.
        </p>
        <Boton variante="secundario" icono="icon-descargar" cargando={descargando} onClick={bajar}>
          CSV
        </Boton>
      </Tarjeta>
      {errorDescarga && <Alerta tipo="error" titulo={errorDescarga} />}

      {c.alumnos.length === 0 ? (
        <Alerta tipo="info" titulo="La sección no tiene alumnos en este bimestre." />
      ) : c.cursos.length === 0 ? (
        <Alerta tipo="info" titulo="El plan de estudios de la sección aún no tiene cursos." />
      ) : (
        <Tarjeta className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <caption className="sr-only">Consolidado del {c.periodo.nombre} por alumno y curso</caption>
            <thead className="border-b border-borde bg-fondo text-[13px] text-texto-2">
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-[180px] bg-fondo px-4 py-3 font-semibold">
                  Estudiante
                </th>
                {c.cursos.map((k) => (
                  <th key={k.cursoId} scope="col" className="px-3 py-3 text-center align-top font-semibold">
                    <span className="block" title={k.nombre}>
                      {k.codigo}
                    </span>
                    {!k.publicado && (
                      <span className="mt-1 inline-block">
                        <Badge tono="ambar">Sin publicar</Badge>
                      </span>
                    )}
                  </th>
                ))}
                <th scope="col" className="px-3 py-3 text-center font-semibold">
                  Conducta
                </th>
              </tr>
            </thead>
            <tbody>
              {c.alumnos.map((a) => (
                <tr key={a.matriculaId} className="border-b border-borde">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium text-texto">
                    {a.nombre}
                  </th>
                  {c.cursos.map((k) => (
                    <td key={k.cursoId} className="px-3 py-2.5 text-center">
                      <Celda logro={a.logros[k.cursoId]} />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center">
                    <Celda logro={a.conducta} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-borde bg-fondo text-[13px]">
              {LOGROS.map((l) => (
                <tr key={l}>
                  <th scope="row" className="sticky left-0 z-10 bg-fondo px-4 py-1.5 font-semibold text-texto">
                    Alumnos con <BadgeLogro logro={l} />
                  </th>
                  {c.cursos.map((k) => (
                    <td key={k.cursoId} className="px-3 py-1.5 text-center tabular-nums text-texto-2">
                      {k.resumen[l]}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-center tabular-nums text-texto-2">{c.resumenConducta[l]}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-fondo px-4 py-1.5 font-semibold text-texto-3">
                  Sin consolidado
                </th>
                {c.cursos.map((k) => (
                  <td key={k.cursoId} className="px-3 py-1.5 text-center tabular-nums text-texto-3">
                    {k.resumen.SIN_NOTA}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-center tabular-nums text-texto-3">{c.resumenConducta.SIN_NOTA}</td>
              </tr>
            </tfoot>
          </table>
        </Tarjeta>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-texto-3" aria-label="Cursos">
        {c.cursos.map((k) => (
          <li key={k.cursoId}>
            <span className="font-semibold">{k.codigo}</span>: {k.nombre} · {k.etiquetaEstado}
          </li>
        ))}
      </ul>
    </div>
  );
}
