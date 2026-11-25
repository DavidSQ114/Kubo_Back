// Mi tutoría · Reporte de faltas y tardanzas por bimestre (bloque M3): por alumno de la sección, clases registradas,
// asistencias, tardanzas (y justificadas), faltas (y justificadas) y porcentaje de asistencia. Se ordena al pulsar el
// encabezado de una columna; la fila de totales queda al final. Descarga en CSV y en PDF.
"use client";

import { useState } from "react";
import { CargandoAsistencia, enPorcentaje, ErrorAsistencia, useConsulta } from "@/components/portal/asistencia";
import { mensajeError } from "@/components/portal";
import { Alerta, Boton, Tarjeta } from "@/components/ui";
import { descargar } from "@/lib/api";
import { fechaDia } from "@/lib/formato";
import { useTutoria } from "./tutoria";

type Orden =
  | "nombre"
  | "clases"
  | "asistencias"
  | "tardanzas"
  | "tardanzasJustificadas"
  | "faltas"
  | "faltasJustificadas"
  | "porcentajeAsistencia";

interface Conteo {
  clases: number;
  asistencias: number;
  tardanzas: number;
  tardanzasJustificadas: number;
  faltas: number;
  faltasJustificadas: number;
  porcentajeAsistencia: number | null;
}

interface Reporte {
  bimestres: { id: string; nombre: string; fechaInicio: string; fechaFin: string }[];
  bimestre: { id: string; nombre: string; fechaInicio: string; fechaFin: string };
  orden: Orden;
  ascendente: boolean;
  filas: (Conteo & { matriculaId: string; nombre: string; fueraDeLaSeccion: boolean })[];
  total: Conteo;
}

const COLUMNAS: { campo: Orden; titulo: string; corto: string }[] = [
  { campo: "clases", titulo: "Clases registradas", corto: "Clases" },
  { campo: "asistencias", titulo: "Asistencias", corto: "Asist." },
  { campo: "tardanzas", titulo: "Tardanzas", corto: "Tard." },
  { campo: "tardanzasJustificadas", titulo: "Tardanzas justificadas", corto: "Tard. J." },
  { campo: "faltas", titulo: "Faltas", corto: "Faltas" },
  { campo: "faltasJustificadas", titulo: "Faltas justificadas", corto: "Faltas J." },
  { campo: "porcentajeAsistencia", titulo: "% de asistencia", corto: "%" },
];

const valor = (c: Conteo, campo: Orden) =>
  campo === "porcentajeAsistencia"
    ? c.porcentajeAsistencia === null
      ? "—"
      : enPorcentaje(c.porcentajeAsistencia)
    : String(c[campo as keyof Conteo]);

export function ReporteTutoria() {
  const t = useTutoria();
  const [filtro, setFiltro] = useState<{ periodoId?: string; orden?: Orden; ascendente?: boolean }>({});
  const [descargando, setDescargando] = useState<"csv" | "pdf" | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const consulta = new URLSearchParams();
  if (filtro.periodoId) consulta.set("periodoId", filtro.periodoId);
  if (filtro.orden) consulta.set("orden", filtro.orden);
  if (filtro.ascendente !== undefined) consulta.set("ascendente", String(filtro.ascendente));
  const base = `/horarios/tutoria/${t.seccion.id}/reporte`;
  const sufijo = consulta.size ? `?${consulta}` : "";
  const { carga, reintentar } = useConsulta<Reporte>(`${base}${sufijo}`);

  function ordenar(campo: Orden) {
    if (carga.fase !== "listo") return;
    const actual = carga.datos;
    // la misma columna invierte el sentido; otra empieza de mayor a menor (o de la A a la Z en el nombre)
    const ascendente = actual.orden === campo ? !actual.ascendente : campo === "nombre";
    setFiltro((f) => ({ ...f, orden: campo, ascendente }));
  }

  async function bajar(tipo: "csv" | "pdf") {
    setDescargando(tipo);
    setErrorDescarga(null);
    try {
      await descargar(`${base}/${tipo}${sufijo}`, `reporte-asistencia.${tipo}`);
    } catch (e) {
      setErrorDescarga(mensajeError(e));
    }
    setDescargando(null);
  }

  if (carga.fase === "cargando") return <CargandoAsistencia />;
  if (carga.fase === "error") return <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />;
  const r = carga.datos;
  const flecha = (campo: Orden) => (r.orden === campo ? (r.ascendente ? " ↑" : " ↓") : "");
  const sentido = (campo: Orden) =>
    r.orden === campo ? (r.ascendente ? ("ascending" as const) : ("descending" as const)) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="flex flex-wrap items-end gap-4 p-4 lg:p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bimestre-reporte" className="text-[14px] font-semibold text-texto">
            Bimestre
          </label>
          <select
            id="bimestre-reporte"
            value={r.bimestre.id}
            onChange={(e) => setFiltro((f) => ({ ...f, periodoId: e.target.value }))}
            className="h-10 rounded-md border border-borde bg-white px-3 text-[14px] text-texto outline-none focus:border-kubo-azul"
          >
            {r.bimestres.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>
        <p className="min-w-[200px] flex-1 text-[13px] leading-[1.5] text-texto-3">
          Del {fechaDia(r.bimestre.fechaInicio)} al {fechaDia(r.bimestre.fechaFin)}. Cada columna cuenta clases con
          asistencia registrada; el porcentaje suma asistencias, tardanzas y tardanzas justificadas.
        </p>
        <div className="flex flex-wrap gap-2">
          <Boton
            variante="secundario"
            icono="icon-descargar"
            cargando={descargando === "csv"}
            disabled={descargando !== null}
            onClick={() => bajar("csv")}
          >
            CSV
          </Boton>
          <Boton
            variante="secundario"
            icono="icon-descargar"
            cargando={descargando === "pdf"}
            disabled={descargando !== null}
            onClick={() => bajar("pdf")}
          >
            PDF
          </Boton>
        </div>
      </Tarjeta>
      {errorDescarga && <Alerta tipo="error" titulo={errorDescarga} />}

      {r.filas.length === 0 ? (
        <Alerta tipo="info" titulo="La sección no tiene alumnos en este bimestre." />
      ) : (
        <Tarjeta className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <caption className="sr-only">
              Faltas y tardanzas por alumno del {r.bimestre.nombre}. Pulsa un encabezado para ordenar.
            </caption>
            <thead className="border-b border-borde bg-fondo text-[13px] text-texto-2">
              <tr>
                <th scope="col" aria-sort={sentido("nombre")} className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => ordenar("nombre")} className="font-semibold hover:text-texto">
                    Estudiante{flecha("nombre")}
                  </button>
                </th>
                {COLUMNAS.map((c) => (
                  <th
                    key={c.campo}
                    scope="col"
                    aria-sort={sentido(c.campo)}
                    className="px-3 py-3 text-right font-semibold"
                  >
                    <button
                      type="button"
                      title={c.titulo}
                      onClick={() => ordenar(c.campo)}
                      className="font-semibold hover:text-texto"
                    >
                      {c.corto}
                      {flecha(c.campo)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.filas.map((f) => (
                <tr key={f.matriculaId} className="border-b border-borde last:border-b-0">
                  <th scope="row" className="px-4 py-2.5 font-medium text-texto">
                    {f.nombre}
                    {f.fueraDeLaSeccion && (
                      <span className="block text-[12px] font-normal text-texto-3">Ya no está en la sección</span>
                    )}
                  </th>
                  {COLUMNAS.map((c) => (
                    <td
                      key={c.campo}
                      className={`px-3 py-2.5 text-right tabular-nums ${
                        c.campo === "faltas" && f.faltas > 0 ? "font-semibold text-rojo-oscuro" : "text-texto-2"
                      }`}
                    >
                      {valor(f, c.campo)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-borde bg-fondo">
              <tr>
                <th scope="row" className="px-4 py-3 font-semibold text-texto">
                  Total de la sección
                </th>
                {COLUMNAS.map((c) => (
                  <td key={c.campo} className="px-3 py-3 text-right font-semibold tabular-nums text-texto">
                    {valor(r.total, c.campo)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </Tarjeta>
      )}
    </div>
  );
}
