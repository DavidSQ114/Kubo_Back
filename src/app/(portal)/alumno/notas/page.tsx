// AL-03 · Mis notas · Alumno (US51): logros del alumno por curso y competencia en el bimestre elegido en el filtro
// «Periodo» (los anteriores siguen disponibles), con el logro del bimestre de cada curso; los cursos sin publicar se
// listan como «Aún no publicado», sin notas parciales. «Descargar libreta» (US66). El alumno sale de la sesión y el
// servidor solo envía notas de registros publicados. Una calificación con evidencia del docente se presiona para
// verla (US47, M-09); sin evidencia, la celda no es clicable.
"use client";

import { useState } from "react";
import { columnaDe, BadgeLogro, LeyendaLogros, NOMBRE_LOGRO } from "@/components/docente/notas";
import { EncabezadoPagina, mensajeError } from "@/components/portal";
import { useConsulta } from "@/components/portal/asistencia";
import { ModalEvidenciaDocente, type EvidenciaElegida } from "@/components/portal/evidencias";
import {
  CargandoLibreta,
  ErrorLibreta,
  LibretaVacia,
  type BimestreDeLibreta,
  type CompetenciaDeLibreta,
  type CursoDeLibreta,
  type Libreta,
  TarjetaConducta,
} from "@/components/portal/libreta";
import { Alerta, Badge, Boton, Icono, Tarjeta } from "@/components/ui";
import { ApiError, descargar } from "@/lib/api";
import { fechaDia, hoyEnLima } from "@/lib/formato";

const AUN_NO_PUBLICADO = "Aún no publicado";

/** «finalizado», «en curso» o «próximo» según las fechas del bimestre. */
function etapa(b: BimestreDeLibreta, hoy: string) {
  if (b.fechaFin < hoy) return "finalizado";
  return b.fechaInicio <= hoy ? "en curso" : "próximo";
}

export default function MisNotasPage() {
  const { carga, reintentar } = useConsulta<Libreta>("/evaluacion/alumno/libreta");
  const [elegido, setElegido] = useState<string | null>(null);
  const [descarga, setDescarga] = useState<{ cargando: boolean; error: string | null }>({
    cargando: false,
    error: null,
  });
  const libreta = carga.fase === "listo" ? carga.datos : null;
  const bimestre = libreta?.bimestres.find((b) => b.id === (elegido ?? libreta.bimestrePorDefectoId)) ?? null;
  const descargable = !!bimestre?.cursos.some((c) => c.publicado);

  async function descargarLibreta() {
    if (!bimestre) return;
    setDescarga({ cargando: true, error: null });
    try {
      await descargar(`/evaluacion/alumno/libreta/pdf?periodoId=${bimestre.id}`, "Libreta.pdf");
      setDescarga({ cargando: false, error: null });
    } catch (e) {
      setDescarga({ cargando: false, error: e instanceof ApiError ? e.message : mensajeError(e) });
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Mis notas"
        descripcion="Tus logros por curso y competencia. Solo se muestran bimestres cerrados y publicados."
      >
        <Boton
          variante="secundario"
          icono="icon-pdf"
          onClick={descargarLibreta}
          cargando={descarga.cargando}
          disabled={!descargable}
          title={descargable ? undefined : "Disponible cuando haya cursos publicados en el bimestre"}
        >
          Descargar libreta
        </Boton>
      </EncabezadoPagina>
      {descarga.error && <Alerta tipo="error" titulo={descarga.error} />}
      {carga.fase === "cargando" && <CargandoLibreta />}
      {carga.fase === "error" && <ErrorLibreta mensaje={carga.mensaje} onReintentar={reintentar} />}
      {libreta && !bimestre && (
        <LibretaVacia titulo="El año escolar aún no tiene bimestres">
          Tus notas aparecerán cuando el colegio configure los bimestres del año {libreta.anio.anio}.
        </LibretaVacia>
      )}
      {libreta && bimestre && <Bimestre libreta={libreta} bimestre={bimestre} onElegir={setElegido} />}
    </>
  );
}

function Bimestre({
  libreta,
  bimestre,
  onElegir,
}: {
  libreta: Libreta;
  bimestre: BimestreDeLibreta;
  onElegir: (id: string) => void;
}) {
  const hoy = hoyEnLima();
  const [evidencia, setEvidencia] = useState<EvidenciaElegida | null>(null);
  const publicados = bimestre.cursos.filter((c) => c.publicado);
  const pendientes = bimestre.cursos.filter((c) => !c.publicado);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="flex w-full max-w-[300px] flex-col gap-1.5">
          <span className="text-[14px] font-medium text-texto-2">Periodo</span>
          <select
            value={bimestre.id}
            onChange={(e) => onElegir(e.target.value)}
            className="h-12 rounded-lg border border-borde bg-white px-3 text-[16px] text-texto outline-none focus:border-kubo-azul"
          >
            {libreta.bimestres.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre} · {etapa(b, hoy)}
              </option>
            ))}
          </select>
        </label>
        <LeyendaLogros />
      </div>

      {publicados.length > 0 && (
        <TablaMisNotas
          cursos={publicados}
          onVerEvidencia={(curso, k) =>
            setEvidencia({
              curso: curso.nombre,
              docente: curso.docente,
              competencia: k.nombre,
              logro: k.logro,
              evidencias: k.evidencias,
            })
          }
        />
      )}
      {evidencia && <ModalEvidenciaDocente elegida={evidencia} onCerrar={() => setEvidencia(null)} />}

      <TarjetaConducta bimestre={bimestre} />

      {pendientes.length > 0 && (
        <Tarjeta className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">
                {bimestre.nombre} · {etapa(bimestre, hoy)}
              </h2>
              <p className="text-[14px] text-texto-3">
                {bimestre.fechaFin < hoy ? "Cerró" : "Cierra"} el {fechaDia(bimestre.fechaFin)}
              </p>
            </div>
            <Badge tono="gris" punto>
              {publicados.length ? `${pendientes.length} por publicar` : AUN_NO_PUBLICADO}
            </Badge>
          </div>
          <ul className="flex flex-wrap gap-2">
            {pendientes.map((c) => (
              <li
                key={c.cursoId}
                className="flex items-center gap-2 rounded-lg border border-borde bg-fondo px-3 py-2 text-[14px] text-texto"
              >
                {c.nombre}
                <Badge tono="gris">{AUN_NO_PUBLICADO}</Badge>
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-[1.5] text-texto-3">
            Tus calificaciones no se muestran hasta que el docente cierre el registro y la administración lo publique.
          </p>
        </Tarjeta>
      )}

      {bimestre.cursos.length === 0 && (
        <LibretaVacia titulo="Aún no hay cursos en este bimestre">
          Los cursos aparecen cuando el colegio arma el plan de estudios de tu sección.
        </LibretaVacia>
      )}
    </>
  );
}

/**
 * Logro de una competencia. Con evidencia del docente es un botón con un clip que abre M-09 (US47); sin evidencia, solo
 * la insignia (la celda no es clicable).
 */
function LogroDeCompetencia({
  curso,
  competencia: k,
  onVerEvidencia,
}: {
  curso: CursoDeLibreta;
  competencia: CompetenciaDeLibreta;
  onVerEvidencia: (curso: CursoDeLibreta, k: CompetenciaDeLibreta) => void;
}) {
  if (!k.logro) return <span className="text-texto-3">—</span>;
  const insignia = <BadgeLogro logro={k.logro} titulo={`${k.nombre}: ${NOMBRE_LOGRO[k.logro]}`} />;
  if (!k.evidencias?.length) return insignia;
  return (
    <button
      type="button"
      onClick={() => onVerEvidencia(curso, k)}
      aria-label={`${k.nombre}: ${NOMBRE_LOGRO[k.logro]}. Ver la evidencia del docente`}
      className="relative inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-kubo-azul/50 hover:opacity-90"
    >
      {insignia}
      <span className="absolute -top-1.5 -right-2 rounded-full bg-white p-0.5 shadow-tarjeta">
        <Icono nombre="icon-clip" size={12} />
      </span>
    </button>
  );
}

/** Desde 1024 px, una fila por curso con una columna por competencia (C1, C2…); en el celular, una tarjeta por curso. */
function TablaMisNotas({
  cursos,
  onVerEvidencia,
}: {
  cursos: CursoDeLibreta[];
  onVerEvidencia: (curso: CursoDeLibreta, k: CompetenciaDeLibreta) => void;
}) {
  const columnas = Math.max(...cursos.map((c) => c.competencias.length));
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-borde bg-white lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Logros por curso y competencia</caption>
          <thead>
            <tr className="border-b border-borde bg-fondo text-[13px] font-semibold text-texto-2">
              <th scope="col" className="px-4 py-3">
                Curso
              </th>
              {Array.from({ length: columnas }, (_, i) => (
                <th key={columnaDe(i)} scope="col" className="px-3 py-3 text-center">
                  Competencia {i + 1}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-center">
                Logro del bimestre
              </th>
            </tr>
          </thead>
          <tbody>
            {cursos.map((c) => (
              <tr key={c.cursoId} className="border-b border-borde last:border-b-0">
                <th scope="row" className="px-4 py-3 font-normal">
                  <span className="block text-[15px] font-semibold text-texto">{c.nombre}</span>
                  <span className="block text-[12px] text-texto-3">{c.docente ?? "Docente por asignar"}</span>
                </th>
                {Array.from({ length: columnas }, (_, i) => {
                  const k = c.competencias[i];
                  return (
                    <td key={columnaDe(i)} className="px-3 py-3 text-center">
                      {k ? (
                        <LogroDeCompetencia curso={c} competencia={k} onVerEvidencia={onVerEvidencia} />
                      ) : (
                        <span className="text-texto-3">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  {c.consolidado ? <BadgeLogro logro={c.consolidado} /> : <span className="text-texto-3">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 lg:hidden">
        {cursos.map((c) => (
          <li key={c.cursoId}>
            <Tarjeta className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[16px] font-semibold text-texto">{c.nombre}</span>
                  <span className="text-[12px] text-texto-3">{c.docente ?? "Docente por asignar"}</span>
                </div>
                {c.consolidado && (
                  <span className="flex flex-col items-end gap-1 text-[11px] text-texto-3">
                    <BadgeLogro logro={c.consolidado} />
                    Logro del bimestre
                  </span>
                )}
              </div>
              <ul className="flex flex-col divide-y divide-borde border-t border-borde">
                {c.competencias.map((k) => (
                  <li key={k.competenciaPlanId} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-[14px] leading-[1.4] text-texto-2">{k.nombre}</span>
                    <LogroDeCompetencia curso={c} competencia={k} onVerEvidencia={onVerEvidencia} />
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </li>
        ))}
      </ul>
    </>
  );
}
