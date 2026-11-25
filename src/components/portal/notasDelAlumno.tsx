// Libreta completa del año de un alumno con todos sus cursos y bimestres (bloque M2, «Notas por alumno» del coordinador;
// bloque M3, «Notas por alumno» del tutor con la conducta). Lo que aún no está publicado para el apoderado y el alumno
// sale marcado «Sin publicar» (cerrado, en registro o sin notas). Las competencias con ítems muestran cada ítem.
"use client";

import { useEffect, useState } from "react";
import { BadgeLogro, NOMBRE_LOGRO, type Logro } from "@/components/docente/notas";
import { Alerta, Badge, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { mensajeError } from "./index";

export interface CursoDelAlumno {
  cursoId: string;
  codigo: string;
  nombre: string;
  docente: string | null;
  estado: "ABIERTO" | "CERRADO" | "PUBLICADO" | "SIN_REGISTRO";
  etiquetaEstado: string;
  publicado: boolean;
  consolidado: Logro | null;
  competencias: {
    codigo: string;
    nombre: string;
    columna: string;
    logro: Logro | null;
    items: { nombre: string; peso: number; logro: Logro | null }[];
  }[];
}

export interface NotasDelAlumno {
  matriculaId: string;
  estudiante: { nombreCompleto: string; dni: string };
  anio: { id: string; anio: number };
  seccion: string | null;
  estadoMatricula: string;
  bimestres: {
    id: string;
    numero: number;
    nombre: string;
    cursos: CursoDelAlumno[];
    /** Solo en la vista del tutor (bloque M3). */
    conducta?: { valor: Logro; comentario: string | null } | null;
  }[];
}

const NUMERAL = ["I", "II", "III", "IV"];
const enPorcentaje = (n: number) => `${String(n).replace(".", ",")} %`;

function Logro({ logro }: { logro: Logro | null }) {
  return logro ? <BadgeLogro logro={logro} /> : <span className="text-texto-3">—</span>;
}

function TablaCurso({ curso }: { curso: CursoDelAlumno }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-borde">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <caption className="sr-only">Notas de {curso.nombre}</caption>
        <thead>
          <tr className="border-b border-borde bg-fondo">
            <th scope="col" className="px-4 py-3 align-top font-normal">
              <span className="block text-[15px] font-semibold text-texto">{curso.nombre}</span>
              <span className="block text-[12px] text-texto-3">Docente: {curso.docente ?? "por asignar"}</span>
            </th>
            <th scope="col" className="w-[150px] px-4 py-3 text-center">
              <Badge tono={curso.publicado ? "verde" : "ambar"} punto>
                {curso.etiquetaEstado}
              </Badge>
            </th>
          </tr>
        </thead>
        <tbody>
          {curso.competencias.flatMap((c) => [
            <tr key={c.codigo} className="border-b border-borde">
              <th scope="row" className="py-2.5 pr-4 pl-6 text-[14px] font-normal leading-[1.4] text-texto">
                <span className="font-semibold">{c.columna}</span> · {c.nombre}
              </th>
              <td className="px-4 py-2.5 text-center">
                <Logro logro={c.logro} />
              </td>
            </tr>,
            ...c.items.map((it) => (
              <tr key={`${c.codigo}-${it.nombre}`} className="border-b border-borde">
                <td className="py-1.5 pr-4 pl-12 text-[13px] text-texto-2">
                  {it.nombre} <span className="text-texto-3">· peso {enPorcentaje(it.peso)}</span>
                </td>
                <td className="px-4 py-1.5 text-center text-[13px] font-semibold text-texto-2">
                  <span title={it.logro ? NOMBRE_LOGRO[it.logro] : "Sin calificar"}>{it.logro ?? "—"}</span>
                </td>
              </tr>
            )),
          ])}
          {curso.competencias.length === 0 && (
            <tr>
              <td colSpan={2} className="px-4 py-3 text-[13px] text-texto-3">
                El docente aún no registra notas de este curso en el bimestre.
              </td>
            </tr>
          )}
          {curso.consolidado && (
            <tr className="bg-fondo/60">
              <th scope="row" className="px-4 py-2.5 text-[14px] font-semibold text-texto">
                Logro consolidado del curso
              </th>
              <td className="px-4 py-2.5 text-center">
                <Logro logro={curso.consolidado} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Libreta completa del año de una matrícula con pestañas por bimestre: la pide a `ruta` (la del coordinador o la del
 * tutor). Con la conducta del tutor (bloque M3) si la respuesta la trae en cada bimestre.
 */
export function LibretaCompleta({
  ruta,
  mensajeDeError = mensajeError,
}: {
  ruta: string;
  mensajeDeError?: (e: unknown) => string;
}) {
  const [datos, setDatos] = useState<NotasDelAlumno | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [elegido, setElegido] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api<NotasDelAlumno>(ruta)
      .then((d) => vigente && setDatos(d))
      .catch((e) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [ruta, intento, mensajeDeError]);

  if (error)
    return (
      <Alerta tipo="error" titulo={error}>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIntento((n) => n + 1);
          }}
          className="font-semibold text-kubo-azul underline"
        >
          Reintentar
        </button>
      </Alerta>
    );
  if (!datos)
    return (
      <div className="flex items-center gap-3 text-[14px] text-texto-2">
        <Spinner claro={false} /> Cargando notas…
      </div>
    );
  const bimestre = datos.bimestres.find((b) => b.id === elegido) ?? datos.bimestres[0];
  const sinPublicar = bimestre?.cursos.filter((c) => !c.publicado).length ?? 0;
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[20px] font-semibold text-texto">{datos.estudiante.nombreCompleto}</h2>
          <p className="text-[13px] text-texto-3">
            DNI {datos.estudiante.dni} · Año {datos.anio.anio}
            {datos.seccion ? ` · ${datos.seccion}` : ""}
          </p>
        </div>
        {sinPublicar > 0 && (
          <Badge tono="ambar" punto>
            {sinPublicar} {sinPublicar === 1 ? "curso sin publicar" : "cursos sin publicar"}
          </Badge>
        )}
      </div>
      <div
        role="tablist"
        aria-label="Bimestres"
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-borde px-1"
      >
        {datos.bimestres.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={b.id === bimestre?.id}
            onClick={() => setElegido(b.id)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-[14px] whitespace-nowrap ${
              b.id === bimestre?.id
                ? "border-kubo-azul font-semibold text-kubo-azul"
                : "border-transparent text-texto-2 hover:text-texto"
            }`}
          >
            <span className="sm:hidden">Bim. {NUMERAL[b.numero - 1]}</span>
            <span className="hidden sm:inline">{b.nombre}</span>
          </button>
        ))}
      </div>
      {bimestre?.conducta !== undefined && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-fondo px-4 py-3">
          <span className="text-[14px] font-semibold text-texto">Conducta del bimestre</span>
          {bimestre.conducta ? (
            <>
              <BadgeLogro logro={bimestre.conducta.valor} />
              <span className="text-[13px] text-texto-2">{bimestre.conducta.comentario ?? "Sin comentario"}</span>
            </>
          ) : (
            <span className="text-[13px] text-texto-3">Sin nota de conducta</span>
          )}
        </div>
      )}
      {bimestre && bimestre.cursos.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-texto-2">
          El alumno no tiene cursos con notas en este bimestre ni una sección con plan de estudios.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {bimestre?.cursos.map((c) => (
            <TablaCurso key={c.cursoId} curso={c} />
          ))}
        </div>
      )}
      <p className="text-[12px] text-texto-3">
        «Sin publicar»: el apoderado y el alumno aún no ven esas notas. «En registro»: el docente aún puede cambiarlas.
      </p>
    </Tarjeta>
  );
}
