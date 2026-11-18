// Libreta de notas en los portales: tipos de la API (/api/v1/evaluacion/…/libreta), pestañas por bimestre, tabla por
// curso y competencia (AP-04), escala y resumen del bimestre, y estados de carga y error. La usan la libreta del
// apoderado (US46) y «Mis notas» del alumno (US51). Las notas que llegan son solo de registros publicados: los cursos
// sin publicar vienen sin calificación y se muestran como pendientes.
"use client";

import type { ReactNode } from "react";
import { BadgeLogro, LOGROS, NOMBRE_LOGRO, type Logro } from "@/components/docente/notas";
import { Alerta, Badge, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { cantidad, diaMes, fechaDia } from "@/lib/formato";

// ---------- Tipos de la API ----------

export interface CompetenciaDeLibreta {
  competenciaPlanId: string;
  codigo: string;
  nombre: string;
  logro: Logro | null;
}

export interface CursoDeLibreta {
  cursoId: string;
  codigo: string;
  nombre: string;
  docente: string | null;
  publicado: boolean;
  publicadoEn: string | null;
  consolidado: Logro | null;
  competencias: CompetenciaDeLibreta[];
}

export type EstadoBimestreLibreta = "PUBLICADO" | "PARCIAL" | "PENDIENTE" | "NO_INICIADO";

export interface BimestreDeLibreta {
  id: string;
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoBimestreLibreta;
  publicadoEn: string | null;
  cursos: CursoDeLibreta[];
  resumen: Record<Logro, number>;
}

export interface Libreta {
  estudiante: { estudianteId: string; nombres: string; apellidos: string; nombreCompleto: string };
  anio: { id: string; anio: number };
  grado: string | null;
  seccion: string | null;
  seccionCorta: string | null;
  tutor: string | null;
  bimestres: BimestreDeLibreta[];
  bimestrePorDefectoId: string | null;
}

export interface PensionVencida {
  cuotaId: string;
  concepto: string;
  fechaVencimiento: string;
  monto: string;
}

export type LibretaDelHijo =
  | { restringido: false; libreta: Libreta }
  | {
      restringido: true;
      mensaje: string;
      estudiante: Libreta["estudiante"];
      anio: { id: string; anio: number };
      bimestres: { id: string; numero: number; nombre: string }[];
      deuda: { pensiones: PensionVencida[]; total: string };
    };

/** «Bimestre III · pendiente»: el estado que acompaña a cada pestaña. */
export const SUFIJO_ESTADO: Record<EstadoBimestreLibreta, string> = {
  PUBLICADO: "",
  PARCIAL: " · parcial",
  PENDIENTE: " · pendiente",
  NO_INICIADO: "",
};

/** «Bimestre II» → «Bim. II» para las pestañas del celular. */
const nombreCorto = (nombre: string) => nombre.replace("Bimestre", "Bim.");

// ---------- Pestañas ----------

export function PestanasBimestre({
  bimestres,
  seleccionado,
  onElegir,
}: {
  bimestres: { id: string; nombre: string; estado?: EstadoBimestreLibreta }[];
  seleccionado: string | null;
  onElegir: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Bimestres" className="flex gap-1 overflow-x-auto border-b border-borde">
      {bimestres.map((b) => {
        const activo = b.id === seleccionado;
        const sufijo = b.estado ? SUFIJO_ESTADO[b.estado] : "";
        return (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onElegir(b.id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] leading-[1.4] ${activo ? "border-kubo-azul font-semibold text-kubo-azul" : "border-transparent text-texto-2 hover:text-texto"}`}
          >
            <span className="hidden sm:inline">{b.nombre}</span>
            <span className="sm:hidden">{nombreCorto(b.nombre)}</span>
            {sufijo}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Escala y resumen (AP-04, columna derecha) ----------

export function TarjetaEscala() {
  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Escala de calificación</h2>
      <ul className="flex flex-col gap-3">
        {LOGROS.map((l) => (
          <li key={l} className="flex items-center gap-3">
            <BadgeLogro logro={l} />
            <span className="text-[14px] font-medium text-texto">{NOMBRE_LOGRO[l]}</span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export function ResumenDelBimestre({ bimestre }: { bimestre: BimestreDeLibreta }) {
  const conLogro = LOGROS.filter((l) => bimestre.resumen[l] > 0);
  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Resumen del bimestre</h2>
      {conLogro.length === 0 ? (
        <p className="text-[14px] leading-[1.5] text-texto-2">Aún no hay cursos publicados en este bimestre.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {conLogro.map((l) => (
            <li key={l} className="flex flex-col items-center gap-2 rounded-lg bg-fondo p-3">
              <BadgeLogro logro={l} />
              <span className="text-[13px] text-texto-2">{cantidad(bimestre.resumen[l], "curso", "cursos")}</span>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

// ---------- Tabla por curso y competencia (AP-04) ----------

function FilaCurso({ curso, pendiente }: { curso: CursoDeLibreta; pendiente: string }) {
  return (
    <>
      <tr className="border-b border-borde bg-fondo">
        <th scope="row" className="px-4 py-3 text-left align-top font-normal">
          <span className="block text-[15px] font-semibold text-texto">{curso.nombre}</span>
          <span className="block text-[12px] text-texto-3">Docente: {curso.docente ?? "por asignar"}</span>
        </th>
        <td className="px-4 py-3 text-center align-middle">
          {curso.publicado && curso.consolidado ? (
            <BadgeLogro logro={curso.consolidado} titulo={`Logro consolidado: ${NOMBRE_LOGRO[curso.consolidado]}`} />
          ) : (
            <Badge tono="gris" punto>
              {pendiente}
            </Badge>
          )}
        </td>
        <td className="hidden px-4 py-3 text-[12px] text-texto-3 sm:table-cell">
          {curso.publicado ? "Logro consolidado" : "El registro aún no se publica"}
        </td>
      </tr>
      {curso.competencias.map((c) => (
        <tr key={c.competenciaPlanId} className="border-b border-borde">
          <td className="py-2.5 pl-8 pr-4 text-[14px] leading-[1.4] text-texto">
            <span className="flex items-start gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-texto-3" />
              {c.nombre}
            </span>
          </td>
          <td className="px-4 py-2.5 text-center">
            {c.logro ? <BadgeLogro logro={c.logro} /> : <span className="text-texto-3">—</span>}
          </td>
          <td className="hidden px-4 py-2.5 text-[12px] text-texto-3 sm:table-cell">{c.codigo}</td>
        </tr>
      ))}
    </>
  );
}

/** Cursos del bimestre con el logro de cada competencia y el consolidado; los no publicados, sin notas. */
export function TablaLibreta({ bimestre, pendiente }: { bimestre: BimestreDeLibreta; pendiente: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-borde bg-white">
      <table className="w-full min-w-[340px] border-collapse text-left">
        <caption className="sr-only">Logros de {bimestre.nombre} por curso y competencia</caption>
        <thead>
          <tr className="border-b border-borde text-[13px] font-semibold text-texto-2">
            <th scope="col" className="px-4 py-3">
              Curso y competencia
            </th>
            <th scope="col" className="w-[140px] px-4 py-3 text-center">
              Logro
            </th>
            <th scope="col" className="hidden w-[180px] px-4 py-3 sm:table-cell">
              Detalle
            </th>
          </tr>
        </thead>
        <tbody>
          {bimestre.cursos.map((c) => (
            <FilaCurso key={c.cursoId} curso={c} pendiente={pendiente} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** «Publicado el 27/07/2026» o «Pendiente de publicación» bajo los datos del estudiante. */
export function EstadoDelBimestre({ bimestre }: { bimestre: BimestreDeLibreta }) {
  if (bimestre.estado === "NO_INICIADO") return <Badge tono="gris">Empieza el {diaMes(bimestre.fechaInicio)}</Badge>;
  if (!bimestre.publicadoEn)
    return (
      <Badge tono="gris" punto>
        Pendiente de publicación
      </Badge>
    );
  return (
    <Badge tono={bimestre.estado === "PUBLICADO" ? "verde" : "ambar"} punto>
      {bimestre.estado === "PUBLICADO" ? "Publicado" : "Publicado en parte"} el{" "}
      {fechaDia(bimestre.publicadoEn.slice(0, 10))}
    </Badge>
  );
}

// ---------- Estados de la pantalla ----------

export function CargandoLibreta() {
  return (
    <Tarjeta className="flex items-center justify-center gap-3 p-10 text-[15px] text-texto-2">
      <Spinner claro={false} /> Cargando las notas…
    </Tarjeta>
  );
}

export function ErrorLibreta({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <Alerta tipo="error" titulo="No se pudieron cargar las notas">
      <span className="flex flex-col items-start gap-3">
        {mensaje}
        <Boton variante="secundario" onClick={onReintentar}>
          Reintentar
        </Boton>
      </span>
    </Alerta>
  );
}

/** Sin cursos en el bimestre: ni publicados ni en el plan de la sección. */
export function LibretaVacia({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Tarjeta className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Icono nombre="icon-award" size={32} />
      <h2 className="text-[18px] font-semibold text-texto">{titulo}</h2>
      <p className="max-w-[520px] text-[14px] leading-[1.5] text-texto-2">{children}</p>
    </Tarjeta>
  );
}
