// Piezas comunes de las pantallas de asistencia de alumnos (DO-03 docente, AP-03 apoderado, AL-04 alumno y el módulo
// del administrador · US35, US36, US45, US52): nombres y colores de cada estado, la carga de datos con sus cuatro
// estados y el aviso de un periodo sin registros.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Alerta, Badge, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { mensajeError } from "./index";

/** Estado de un alumno en una clase, como lo guarda la API. */
export type EstadoAsistencia = "PRESENTE" | "TARDANZA" | "FALTA" | "FALTA_JUSTIFICADA";

export const ESTADOS_ASISTENCIA: EstadoAsistencia[] = ["PRESENTE", "TARDANZA", "FALTA", "FALTA_JUSTIFICADA"];

/** Nombres del Product Backlog (US35): la falta se muestra como «Ausente» y la justificada, como «Justificado». */
export const NOMBRE_ESTADO: Record<EstadoAsistencia, string> = {
  PRESENTE: "Presente",
  TARDANZA: "Tardanza",
  FALTA: "Ausente",
  FALTA_JUSTIFICADA: "Justificado",
};

/** Estado de un día completo (US45): «Ausente» solo si faltó a todas sus clases de ese día. */
export type EstadoDia = "PRESENTE" | "TARDANZA" | "AUSENTE" | "JUSTIFICADO";

export const NOMBRE_ESTADO_DIA: Record<EstadoDia, string> = {
  PRESENTE: "Presente",
  TARDANZA: "Tardanza",
  AUSENTE: "Ausente",
  JUSTIFICADO: "Justificado",
};

type Tono = "verde" | "ambar" | "rojo" | "celeste";

const TONO_DIA: Record<EstadoDia, Tono> = {
  PRESENTE: "verde",
  TARDANZA: "ambar",
  AUSENTE: "rojo",
  JUSTIFICADO: "celeste",
};

const DIA_DE_ESTADO: Record<EstadoAsistencia, EstadoDia> = {
  PRESENTE: "PRESENTE",
  TARDANZA: "TARDANZA",
  FALTA: "AUSENTE",
  FALTA_JUSTIFICADA: "JUSTIFICADO",
};

const PUNTO: Record<Tono, string> = {
  verde: "bg-verde",
  ambar: "bg-ambar",
  rojo: "bg-rojo",
  celeste: "bg-celeste",
};

/** Punto de color de un estado (leyendas y resúmenes). */
export function PuntoEstado({ estado }: { estado: EstadoDia }) {
  return <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${PUNTO[TONO_DIA[estado]]}`} />;
}

/** Insignia de un día: «Presente», «Tardanza», «Ausente» o «Justificado». `texto` cambia la palabra («Falta»). */
export function BadgeDia({ estado, texto }: { estado: EstadoDia; texto?: string }) {
  return (
    <Badge tono={TONO_DIA[estado]}>
      <PuntoEstado estado={estado} />
      {texto ?? NOMBRE_ESTADO_DIA[estado]}
    </Badge>
  );
}

/** Insignia del estado de un alumno en una clase. */
export function BadgeEstado({ estado }: { estado: EstadoAsistencia }) {
  return <BadgeDia estado={DIA_DE_ESTADO[estado]} />;
}

/** Algo que pasó en una clase o en un día completo: una inasistencia, una tardanza o una observación del docente. */
export interface Incidencia {
  fecha: string;
  alcance: "DIA" | "CLASE";
  estado: EstadoDia;
  clase: { curso: string; horaInicio: string; docente: string | null } | null;
  observacion: string | null;
}

/** Situación del año frente a los umbrales de inasistencia de la institución. */
export interface SituacionAnual {
  faltas: number;
  lectivos: number;
  porcentaje: number;
  nivel: "SIN_RIESGO" | "AVISO" | "RIESGO";
  porcentajeAviso: number;
  porcentajeRiesgo: number;
  faltasAntesDelRiesgo: number;
}

export interface AlertaDelMes {
  mensaje: string;
  faltas: number;
  fechas: string[];
}

/** «7,5 %»: porcentaje con coma decimal. */
export const enPorcentaje = (valor: number) => `${String(valor).replace(".", ",")} %`;

// ---------- Carga de datos ----------

export type Carga<T> = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; datos: T };

/**
 * Pide datos a la API y resuelve los estados de la pantalla (cargando, error con reintento y con datos). Al cambiar
 * la ruta vuelve a «cargando». `recargar` repite la consulta sin vaciar lo que ya se ve.
 */
export function useConsulta<T>(ruta: string): { carga: Carga<T>; reintentar: () => void; recargar: () => void } {
  const [estado, setEstado] = useState<{ ruta: string; carga: Carga<T> } | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    api<T>(ruta)
      .then((datos) => vigente && setEstado({ ruta, carga: { fase: "listo", datos } }))
      .catch((e) => vigente && setEstado({ ruta, carga: { fase: "error", mensaje: mensajeError(e) } }));
    return () => {
      vigente = false;
    };
  }, [ruta, intento]);

  return {
    carga: estado?.ruta === ruta ? estado.carga : { fase: "cargando" },
    reintentar: () => {
      setEstado(null);
      setIntento((n) => n + 1);
    },
    recargar: () => setIntento((n) => n + 1),
  };
}

export function CargandoAsistencia() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Cargando la asistencia">
      <Spinner claro={false} />
    </div>
  );
}

export function ErrorAsistencia({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <Alerta tipo="error" titulo="No pudimos cargar la asistencia">
      {mensaje}{" "}
      <button type="button" onClick={onReintentar} className="font-semibold text-kubo-azul underline">
        Reintentar
      </button>
    </Alerta>
  );
}

/** Estado vacío de una pantalla de asistencia: el mensaje del backlog y qué hacer. */
export function AsistenciaVacia({
  titulo,
  icono = "icon-calendar",
  children,
}: {
  titulo: string;
  icono?: string;
  children?: ReactNode;
}) {
  return (
    <Tarjeta className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-kubo-azul/10">
        <Icono nombre={icono} size={28} />
      </span>
      <p className="max-w-[420px] text-[18px] font-semibold leading-[1.3] text-texto">{titulo}</p>
      {children && <p className="max-w-[440px] text-[14px] leading-[1.5] text-texto-2">{children}</p>}
    </Tarjeta>
  );
}
