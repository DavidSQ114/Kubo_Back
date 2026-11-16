// Horario semanal de solo lectura de los portales (DO-02 docente, AP-05 apoderado, AL-02 alumno · US34, US48, US50).
// En pantallas medianas y grandes es la cuadrícula de 5 días por bloques; en el celular muestra un día a la vez, con
// pestañas por día, para que se lea sin desplazarse a los lados (US50, criterio 3).
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Alerta, Badge, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia } from "@/lib/formato";
import { mensajeError } from "./index";

export type Dia = "LUNES" | "MARTES" | "MIERCOLES" | "JUEVES" | "VIERNES";

export const NOMBRE_DIA: Record<Dia, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
};

const DIA_ABREVIADO: Record<Dia, string> = {
  LUNES: "Lun",
  MARTES: "Mar",
  MIERCOLES: "Mié",
  JUEVES: "Jue",
  VIERNES: "Vie",
};

export interface Bloque {
  id: string;
  orden: number;
  horaInicio: string;
  horaFin: string;
  tipo: "CLASE" | "RECREO";
  etiqueta: string;
}

export interface ClaseHorario {
  id: string;
  dia: Dia;
  bloqueId: string;
  curso: { id: string; codigo: string; nombre: string };
  docente: { id: string; nombreCompleto: string; nombreCorto: string };
  aula: { id: string; nombre: string };
  seccion: { id: string; etiqueta: string };
}

export interface VersionPublicada {
  id: string;
  version: number;
  /** Instante de la publicación en ISO 8601 (UTC). */
  publicadoEn: string | null;
}

/** Horario de un estudiante: respuesta de /horarios/alumno/horario y de /horarios/apoderado/hijos/{id}/horario. */
export interface HorarioDeEstudiante {
  estudiante: { estudianteId: string; nombres: string; nombreCompleto: string };
  seccion: { id: string; etiqueta: string; grado: { nombre: string }; nombre: string } | null;
  dias: Dia[];
  bloques: Bloque[];
  horario: VersionPublicada | null;
  clases: ClaseHorario[];
}

const ZONA = "America/Lima";
const DIA_POR_NOMBRE: Record<string, Dia> = {
  Monday: "LUNES",
  Tuesday: "MARTES",
  Wednesday: "MIERCOLES",
  Thursday: "JUEVES",
  Friday: "VIERNES",
};

/** Día de hoy en Lima, o null si es sábado o domingo. */
export function diaDeHoy(ahora: Date = new Date()): Dia | null {
  const nombre = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, weekday: "long" }).format(ahora);
  return DIA_POR_NOMBRE[nombre] ?? null;
}

/** «14/09/2026»: fecha de Lima en que se publicó la versión. */
export function fechaDePublicacion(publicadoEn: string): string {
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(publicadoEn));
  return fechaDia(fecha);
}

// ---------- Carga de datos ----------

export type Carga<T> =
  { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; datos: T; hoy: Dia | null };

/**
 * Pide un horario a la API y lo vuelve a pedir cuando la pestaña recupera el foco: si la administración publicó una
 * versión nueva mientras tanto, se ve sin hacer nada más (US34, US48 y US50, criterio 3).
 */
export function useHorario<T>(ruta: string): { carga: Carga<T>; reintentar: () => void } {
  const [carga, setCarga] = useState<Carga<T>>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    const pedir = (silencioso: boolean) =>
      api<T>(ruta)
        .then((datos) => vigente && setCarga({ fase: "listo", datos, hoy: diaDeHoy() }))
        .catch((e) => {
          // al refrescar en segundo plano se conserva lo que ya se ve; solo se atienden los errores de sesión
          const mensaje = mensajeError(e);
          if (vigente && !silencioso) setCarga({ fase: "error", mensaje });
        });
    void pedir(false);
    const alVolver = () => {
      if (document.visibilityState === "visible") void pedir(true);
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vigente = false;
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [ruta, intento]);

  return {
    carga,
    reintentar: () => {
      setCarga({ fase: "cargando" });
      setIntento((n) => n + 1);
    },
  };
}

export function CargandoHorario() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Cargando el horario">
      <Spinner claro={false} />
    </div>
  );
}

export function ErrorHorario({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <Alerta tipo="error" titulo="No pudimos cargar el horario">
      {mensaje}{" "}
      <button type="button" onClick={onReintentar} className="font-semibold text-kubo-azul underline">
        Reintentar
      </button>
    </Alerta>
  );
}

/** Estado vacío de un horario: el mensaje del backlog y qué va a pasar. */
export function HorarioVacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <Tarjeta className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-kubo-azul/10">
        <Icono nombre="nav-grid-azul" size={32} />
      </span>
      <p className="text-[18px] font-semibold leading-[1.3] text-texto">{titulo}</p>
      {children && <p className="max-w-[420px] text-[14px] leading-[1.5] text-texto-2">{children}</p>}
    </Tarjeta>
  );
}

/** «Publicado · Actualizado el 14/09/2026»: la versión publicada que se está viendo. */
export function EstadoPublicacion({ horario }: { horario: VersionPublicada }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge tono="verde" punto>
        Publicado
      </Badge>
      {horario.publicadoEn && (
        <span className="text-[13px] leading-[1.4] text-texto-3">
          Actualizado el {fechaDePublicacion(horario.publicadoEn)} · siempre verás la versión más reciente.
        </span>
      )}
    </div>
  );
}

// ---------- Cuadrícula ----------

/** Qué se lee en cada clase: el docente ve la sección; el estudiante y su apoderado, al docente. */
export type VistaHorario = "docente" | "estudiante";

const tituloDe = (c: ClaseHorario, vista: VistaHorario) =>
  vista === "docente" ? `${c.curso.nombre} · ${c.seccion.etiqueta}` : c.curso.nombre;

const detalleDe = (c: ClaseHorario, vista: VistaHorario) =>
  vista === "docente" ? c.aula.nombre : `${c.docente.nombreCorto} · ${c.aula.nombre}`;

function TarjetaClase({ clase, vista }: { clase: ClaseHorario; vista: VistaHorario }) {
  return (
    <div className="flex h-full min-h-[62px] w-full flex-col justify-center gap-0.5 rounded-md border-l-[3px] border-kubo-azul bg-fondo px-2.5 py-1.5">
      <span className="text-[13px] font-semibold leading-[1.35] text-texto">{tituloDe(clase, vista)}</span>
      <span className="text-[12px] leading-[1.35] text-texto-2">{detalleDe(clase, vista)}</span>
    </div>
  );
}

interface PropsHorario {
  dias: Dia[];
  bloques: Bloque[];
  clases: ClaseHorario[];
  vista: VistaHorario;
  /** Día de hoy, para resaltarlo y abrir en él la vista del celular. */
  hoy: Dia | null;
}

function TablaSemanal({ dias, bloques, clases, vista, hoy }: PropsHorario) {
  const claseDe = (dia: Dia, bloqueId: string) => clases.find((c) => c.dia === dia && c.bloqueId === bloqueId);
  return (
    <Tarjeta className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] table-fixed border-collapse">
        <caption className="sr-only">Horario semanal de clases</caption>
        <thead>
          <tr className="border-b border-borde text-left text-[13px] font-semibold text-texto-2">
            <th scope="col" className="w-[72px] px-3 py-3">
              Hora
            </th>
            {dias.map((dia) => (
              <th
                key={dia}
                scope="col"
                aria-current={dia === hoy ? "date" : undefined}
                className={`border-l border-borde px-3 py-3 ${dia === hoy ? "bg-kubo-azul/10 text-kubo-azul" : ""}`}
              >
                {NOMBRE_DIA[dia]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloques.map((b) =>
            b.tipo === "RECREO" ? (
              <tr key={b.id} className="border-b border-borde bg-fondo">
                <td
                  colSpan={dias.length + 1}
                  className="px-3 py-1.5 text-center text-[11px] font-semibold tracking-[1px] text-texto-3"
                >
                  {b.etiqueta.toUpperCase()} · {b.horaInicio} – {b.horaFin}
                </td>
              </tr>
            ) : (
              <tr key={b.id} className="border-b border-borde last:border-b-0">
                <th scope="row" className="px-3 py-2 text-left align-middle">
                  <span className="block text-[13px] font-semibold leading-[1.4] text-texto">{b.horaInicio}</span>
                  <span className="block text-[12px] font-normal leading-[1.4] text-texto-3">{b.horaFin}</span>
                </th>
                {dias.map((dia) => {
                  const clase = claseDe(dia, b.id);
                  return (
                    <td key={dia} className="h-[74px] border-l border-borde p-1.5 align-top">
                      {clase && <TarjetaClase clase={clase} vista={vista} />}
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </Tarjeta>
  );
}

function VistaPorDia({ dias, bloques, clases, vista, hoy }: PropsHorario) {
  const [elegido, setElegido] = useState<Dia>(hoy ?? dias[0]);
  const dia = dias.includes(elegido) ? elegido : dias[0];
  const delDia = clases.filter((c) => c.dia === dia);
  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div
        role="tablist"
        aria-label="Día de la semana"
        className="grid grid-cols-5 gap-1 rounded-lg bg-white p-1 ring-1 ring-borde"
      >
        {dias.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            id={`pestana-${d}`}
            aria-selected={d === dia}
            aria-controls="clases-del-dia"
            aria-label={d === hoy ? `${NOMBRE_DIA[d]} (hoy)` : NOMBRE_DIA[d]}
            onClick={() => setElegido(d)}
            className={`flex flex-col items-center rounded-md px-1 py-2 text-[14px] leading-[1.3] ${d === dia ? "bg-kubo-azul font-semibold text-white" : "font-medium text-texto-2"}`}
          >
            {DIA_ABREVIADO[d]}
            <span className={`text-[10px] font-semibold ${d === dia ? "text-white/80" : "text-kubo-azul"}`}>
              {d === hoy ? "Hoy" : " "}
            </span>
          </button>
        ))}
      </div>
      <Tarjeta>
        <ul id="clases-del-dia" role="tabpanel" aria-labelledby={`pestana-${dia}`} className="flex flex-col">
          {bloques.map((b) => {
            if (b.tipo === "RECREO") {
              return (
                <li
                  key={b.id}
                  className="border-b border-borde bg-fondo px-3 py-1.5 text-center text-[11px] font-semibold tracking-[1px] text-texto-3 last:border-b-0"
                >
                  {b.etiqueta.toUpperCase()} · {b.horaInicio} – {b.horaFin}
                </li>
              );
            }
            const clase = delDia.find((c) => c.bloqueId === b.id);
            return (
              <li key={b.id} className="flex items-stretch gap-3 border-b border-borde p-2.5 last:border-b-0">
                <div className="flex w-[52px] shrink-0 flex-col justify-center">
                  <span className="text-[14px] font-semibold leading-[1.4] text-texto">{b.horaInicio}</span>
                  <span className="text-[12px] leading-[1.4] text-texto-3">{b.horaFin}</span>
                </div>
                <div className="min-w-0 flex-1">
                  {clase ? (
                    <TarjetaClase clase={clase} vista={vista} />
                  ) : (
                    <div className="flex h-full min-h-[62px] items-center rounded-md border border-dashed border-borde px-2.5 text-[13px] text-texto-3">
                      Sin clase
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Tarjeta>
    </div>
  );
}

/** Cuadrícula semanal con el horario publicado; en el celular, un día a la vez con pestañas. */
export function HorarioSemanal(props: PropsHorario) {
  return (
    <>
      <TablaSemanal {...props} />
      <VistaPorDia {...props} />
    </>
  );
}
