// AL-05 · Mis cursos › un curso · Alumno (US67): aula virtual de un curso de su sección. Enlaces de clase virtual
// visibles con su estado calculado por el servidor y, si uno está Activo, «Entrar a clase» (abre en otra pestaña con
// rel=noopener); materiales publicados agrupados por unidad, con descarga por la API con permiso. Los borradores, los
// ocultos y las unidades desactivadas no llegan. En pantallas anchas, la lista de cursos queda a la izquierda.
"use client";

import Link from "next/link";
import { use, useState } from "react";
import { EncabezadoPagina, mensajeError } from "@/components/portal";
import {
  abrirMaterial,
  BadgeEstadoEnlace,
  CargandoAula,
  ErrorAula,
  iconoDeFormato,
  IconoEnlace,
  NOMBRE_FORMATO,
  NOMBRE_TIPO_ENLACE,
  pesoDeMaterial,
  type EstadoEnlace,
  type TipoEnlace,
  type TipoFormato,
} from "@/components/portal/aulaVirtual";
import { AsistenciaVacia, useConsulta } from "@/components/portal/asistencia";
import { Alerta, Icono, Tarjeta } from "@/components/ui";
import { entradaFechaHora, fechaDia, rangoDeHoras } from "@/lib/formato";

interface MaterialDelAlumno {
  id: string;
  titulo: string;
  tipo: TipoFormato;
  publicadoEn: string | null;
  archivo: { nombre: string; tamanoBytes: number } | null;
  url: string | null;
}

interface EnlaceDelAlumno {
  id: string;
  tipo: TipoEnlace;
  titulo: string;
  inicio: string;
  fin: string;
  estado: EstadoEnlace;
  /** Solo con el enlace Activo. */
  url: string | null;
}

interface AulaDelCurso {
  curso: { id: string; codigo: string; nombre: string };
  seccionCorta: string;
  docente: { nombreCompleto: string } | null;
  unidades: { unidad: { id: string; numero: number; titulo: string }; materiales: MaterialDelAlumno[] }[];
  enlaces: EnlaceDelAlumno[];
}

interface CursoDeLista {
  cursoId: string;
  codigo: string;
  nombre: string;
  docente: { nombreCorto: string } | null;
}

/** Enlace externo seguro: otra pestaña, sin acceso a esta ventana ni envío del origen. */
const EXTERNO = { target: "_blank", rel: "noopener noreferrer" } as const;

const claseBotonVerde =
  "inline-flex items-center justify-center gap-2 rounded-md bg-verde-oscuro px-4 py-2.5 text-[16px] font-bold text-white hover:bg-verde-oscuro/90";

/** Lista de cursos de la izquierda (solo en pantallas anchas). */
function ListaDeCursos({ actual }: { actual: string }) {
  const { carga } = useConsulta<{ cursos: CursoDeLista[] }>("/matricula/alumno/cursos");
  if (carga.fase !== "listo") return null;
  return (
    <Tarjeta className="hidden h-fit flex-col gap-3 p-4 lg:flex">
      <h2 className="text-[18px] font-semibold text-texto">Mis cursos</h2>
      <ul className="flex flex-col gap-1">
        {carga.datos.cursos.map((c) => {
          const activo = c.cursoId === actual;
          return (
            <li key={c.cursoId}>
              <Link
                href={`/alumno/cursos/${c.cursoId}`}
                aria-current={activo ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 ${activo ? "bg-kubo-azul/10" : "hover:bg-fondo"}`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-fondo text-[11px] font-bold text-kubo-azul">
                  {c.codigo}
                </span>
                <span className="flex min-w-0 flex-col leading-[1.3]">
                  <span className="text-[14px] font-medium text-texto">{c.nombre}</span>
                  <span className="text-[12px] text-texto-3">{c.docente?.nombreCorto ?? "Docente por asignar"}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}

function Enlaces({ enlaces }: { enlaces: EnlaceDelAlumno[] }) {
  const activo = enlaces.find((e) => e.estado === "ACTIVO" && e.url);
  return (
    <Tarjeta className="flex flex-col gap-4 p-4 sm:p-6">
      <h2 className="text-[20px] font-semibold text-texto">Clases virtuales</h2>
      {activo && (
        <div className="flex flex-col gap-3 rounded-lg border-l-4 border-verde bg-verde/10 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-[15px] font-semibold text-texto">Tu clase virtual está disponible</p>
            <p className="text-[14px] text-texto-2">
              {activo.titulo} · {rangoDeHoras(activo.inicio, activo.fin)}
            </p>
          </div>
          <a href={activo.url!} {...EXTERNO} className={claseBotonVerde}>
            <Icono nombre="icon-video-blanco" size={20} />
            Entrar a clase
          </a>
        </div>
      )}
      {enlaces.length === 0 ? (
        <p className="rounded-lg bg-fondo px-4 py-3 text-[14px] text-texto-2">
          Tu docente aún no publica clases virtuales para este curso.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {enlaces.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-3 rounded-lg border border-borde p-3 sm:flex-row sm:items-center sm:p-4"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <IconoEnlace tipo={e.tipo} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[15px] font-semibold text-texto">{e.titulo}</p>
                  <p className="text-[13px] text-texto-3">
                    {NOMBRE_TIPO_ENLACE[e.tipo]} · {rangoDeHoras(e.inicio, e.fin)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <BadgeEstadoEnlace estado={e.estado} />
                {e.estado === "ACTIVO" && e.url && (
                  <a href={e.url} {...EXTERNO} aria-label={`Entrar a clase: ${e.titulo}`} className={claseBotonVerde}>
                    <Icono nombre="icon-video-blanco" size={20} />
                    Entrar a clase
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function FilaMaterial({ material, onError }: { material: MaterialDelAlumno; onError: (m: string) => void }) {
  const [abriendo, setAbriendo] = useState(false);
  async function descargarMaterial() {
    setAbriendo(true);
    try {
      await abrirMaterial(material);
    } catch (e) {
      onError(mensajeError(e));
    } finally {
      setAbriendo(false);
    }
  }
  const publicado = material.publicadoEn ? fechaDia(entradaFechaHora(material.publicadoEn).slice(0, 10)) : null;
  const detalle = [
    NOMBRE_FORMATO[material.tipo],
    material.archivo ? pesoDeMaterial(material.archivo.tamanoBytes) : null,
    publicado && `publicado el ${publicado}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const claseBoton =
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-[15px] font-bold text-texto ring-1 ring-borde ring-inset hover:bg-fondo disabled:text-texto-3";
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icono nombre={iconoDeFormato(material.tipo)} size={20} className="mt-0.5" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[15px] font-medium text-texto">{material.titulo}</p>
          <p className="text-[13px] text-texto-3">{detalle}</p>
        </div>
      </div>
      {material.tipo === "ENLACE" && material.url ? (
        <a href={material.url} {...EXTERNO} className={claseBoton} aria-label={`Abrir ${material.titulo}`}>
          <Icono nombre="icon-enlace" size={18} />
          Abrir
        </a>
      ) : (
        <button
          type="button"
          onClick={descargarMaterial}
          disabled={abriendo}
          className={claseBoton}
          aria-label={`Descargar ${material.titulo}`}
        >
          <Icono nombre="icon-descargar" size={18} />
          {abriendo ? "Descargando…" : "Descargar"}
        </button>
      )}
    </li>
  );
}

function Materiales({ aula }: { aula: AulaDelCurso }) {
  const [error, setError] = useState<string | null>(null);
  const total = aula.unidades.reduce((n, g) => n + g.materiales.length, 0);
  return (
    <Tarjeta className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[20px] font-semibold text-texto">Materiales de estudio</h2>
        <p className="text-[14px] text-texto-3">
          {total === 1 ? "1 material publicado" : `${total} materiales publicados`} por tu docente.
        </p>
      </div>
      {error && <Alerta tipo="error" titulo={error} />}
      {total === 0 ? (
        <p className="rounded-lg bg-fondo px-4 py-3 text-[14px] text-texto-2">
          Tu docente aún no publica materiales para este curso. Cuando lo haga, recibirás un aviso.
        </p>
      ) : (
        aula.unidades.map((g) => (
          <section key={g.unidad.id} aria-label={`Unidad ${g.unidad.numero}: ${g.unidad.titulo}`}>
            <h3 className="rounded-md bg-fondo px-3 py-2 text-[14px] font-semibold text-texto-2">
              Unidad {g.unidad.numero} · {g.unidad.titulo}
            </h3>
            <ul className="divide-y divide-borde px-1">
              {g.materiales.map((m) => (
                <FilaMaterial key={m.id} material={m} onError={setError} />
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="flex items-start gap-2 text-[13px] text-texto-3">
        <Icono nombre="icon-info" size={16} className="mt-0.5" />
        Solo ves los materiales publicados. Los que tu docente dejó en borrador o volvió a ocultar no aparecen.
      </p>
    </Tarjeta>
  );
}

export default function AulaDelCursoPage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = use(params);
  const { carga, reintentar } = useConsulta<AulaDelCurso>(`/aula-virtual/alumno/cursos/${cursoId}`);
  const aula = carga.fase === "listo" ? carga.datos : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/alumno/cursos" className="flex w-fit items-center gap-1 text-[14px] font-semibold text-kubo-azul">
        <Icono nombre="icon-back" size={16} />
        Mis cursos
      </Link>
      <EncabezadoPagina
        titulo={aula ? `${aula.curso.nombre} · ${aula.seccionCorta}` : "Mis cursos"}
        descripcion={
          aula
            ? aula.docente
              ? `Docente: ${aula.docente.nombreCompleto}. Ingresa a tus clases virtuales y descarga los materiales.`
              : "Este curso aún no tiene docente asignado."
            : "Ingresa a tus clases virtuales y descarga los materiales que publican tus profesores."
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <ListaDeCursos actual={cursoId} />
        <div className="flex min-w-0 flex-col gap-6">
          {carga.fase === "cargando" && <CargandoAula />}
          {carga.fase === "error" && <ErrorAula mensaje={carga.mensaje} onReintentar={reintentar} />}
          {aula && !aula.docente && (
            <AsistenciaVacia titulo="Este curso aún no tiene docente" icono="nav-book-azul">
              Cuando el colegio asigne a su docente, aquí verás sus clases virtuales y sus materiales.
            </AsistenciaVacia>
          )}
          {aula?.docente && (
            <>
              <Enlaces enlaces={aula.enlaces} />
              <Materiales aula={aula} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
