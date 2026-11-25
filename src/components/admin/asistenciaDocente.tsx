// AD-14 · Asistencia del personal docente (US32): pestañas de asistencia, contadores del día, insignia de estado,
// acciones de cada docente («Asistió», salida, justificar) y el modal para justificar una inasistencia.
"use client";

import { useState } from "react";
import { Avatar } from "@/components/admin/apoderados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Icono, Modal, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia } from "@/lib/formato";

export type EstadoAsistenciaDocente = "PUNTUAL" | "TARDANZA" | "FALTA" | "FALTA_JUSTIFICADA";

export interface RegistroDelDia {
  id: string;
  estado: EstadoAsistenciaDocente;
  horaIngreso: string | null;
  horaSalida: string | null;
  justificacion: string | null;
  automatica: boolean;
}

export interface DocenteDelDia {
  docenteId: string;
  nombreCompleto: string;
  especialidad: string | null;
  inactivo: boolean;
  primeraClase: string | null;
  registro: RegistroDelDia | null;
}

export interface AsistenciaDocenteDelDia {
  fecha: string;
  hoy: string;
  horaActual: string;
  horaInicioJornada: string;
  horaLimite: string;
  minutosParaLimite: number;
  diaNoLectivo: string | null;
  resumen: {
    total: number;
    puntuales: number;
    tardanzas: number;
    faltas: number;
    justificadas: number;
    sinMarcar: number;
  };
  docentes: DocenteDelDia[];
}

/** Filtro «Estado» de la tabla: los estados guardados y «Sin marcar». */
export type FiltroEstado = "" | EstadoAsistenciaDocente | "SIN_MARCAR";

export const OPCIONES_ESTADO: [FiltroEstado, string][] = [
  ["", "Estado: todos"],
  ["PUNTUAL", "Puntual"],
  ["TARDANZA", "Tardanza"],
  ["SIN_MARCAR", "Sin marcar"],
  ["FALTA", "Inasistencia"],
  ["FALTA_JUSTIFICADA", "Falta justificada"],
];

const LARGO_MINIMO_MOTIVO = 5;
const LARGO_MAXIMO_MOTIVO = 300;

export function BadgeEstadoDocente({ estado }: { estado: EstadoAsistenciaDocente | null }) {
  if (estado === "PUNTUAL")
    return (
      <Badge tono="verde" punto>
        Puntual
      </Badge>
    );
  if (estado === "TARDANZA")
    return (
      <Badge tono="celeste" punto>
        Tardanza
      </Badge>
    );
  if (estado === "FALTA")
    return (
      <Badge tono="rojo" punto>
        Inasistencia
      </Badge>
    );
  if (estado === "FALTA_JUSTIFICADA")
    return (
      <Badge tono="gris" punto>
        Falta justificada
      </Badge>
    );
  return (
    <Badge tono="ambar" punto>
      Sin marcar
    </Badge>
  );
}

function Indicador({
  icono,
  fondo,
  titulo,
  valor,
  detalle,
}: {
  icono: string;
  fondo: string;
  titulo: string;
  valor: string;
  detalle: string;
}) {
  return (
    <Tarjeta className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className={`flex size-10 items-center justify-center rounded-lg ${fondo}`}>
          <Icono nombre={icono} size={20} />
        </span>
        <span className="text-[14px] text-texto-2">{titulo}</span>
      </div>
      <span className="text-[32px] font-bold leading-none text-texto">{valor}</span>
      <span className="text-[13px] leading-[1.4] text-texto-3">{detalle}</span>
    </Tarjeta>
  );
}

const porcentaje = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : 0);

/** Los cuatro contadores de AD-14: puntuales, sin marcar, faltas y hora actual. */
export function IndicadoresDelDia({ datos }: { datos: AsistenciaDocenteDelDia }) {
  const { resumen } = datos;
  const esHoy = datos.fecha === datos.hoy;
  const antesDelLimite = esHoy && datos.minutosParaLimite > 0;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Indicador
        icono="nav-usercheck-azul"
        fondo="bg-verde/12"
        titulo="Puntuales"
        valor={`${resumen.puntuales} / ${resumen.total}`}
        detalle={`${porcentaje(resumen.puntuales, resumen.total)} % del personal · ${resumen.tardanzas} con tardanza`}
      />
      <Indicador
        icono="icon-clock-rojo"
        fondo="bg-ambar/16"
        titulo="Sin marcar"
        valor={String(resumen.sinMarcar)}
        detalle={
          antesDelLimite
            ? `Se marcarán como inasistencia a las ${datos.horaLimite}`
            : esHoy
              ? "Pasada la hora límite, la verificación automática los marca con inasistencia"
              : "Sin registro en esa fecha"
        }
      />
      <Indicador
        icono="kpi-ban"
        fondo="bg-rojo/12"
        titulo="Faltas"
        valor={String(resumen.faltas)}
        detalle={`${resumen.justificadas} con justificación`}
      />
      <Indicador
        icono="icon-calendar"
        fondo="bg-kubo-azul/10"
        titulo={esHoy ? "Hora actual" : "Fecha consultada"}
        valor={esHoy ? datos.horaActual : fechaDia(datos.fecha)}
        detalle={
          antesDelLimite
            ? `Faltan ${datos.minutosParaLimite} minutos para la hora límite`
            : esHoy
              ? `La hora límite (${datos.horaLimite}) ya pasó`
              : "Solo se consulta: el registro es del día actual"
        }
      />
    </div>
  );
}

/** Datos del docente en la primera columna: iniciales, nombre y especialidad. */
export function DocenteDeLaFila({ docente }: { docente: DocenteDelDia }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar nombre={docente.nombreCompleto} />
      <div className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold leading-[1.4] text-texto">{docente.nombreCompleto}</span>
        <span className="text-[13px] leading-[1.4] text-texto-3">
          {docente.especialidad ?? "Sin especialidad"}
          {docente.inactivo ? " · Inactivo" : ""}
        </span>
      </div>
    </div>
  );
}

/** Modal «Justificar inasistencia»: motivo obligatorio; queda en la bitácora de auditoría. */
export function ModalJustificar({
  docente,
  fecha,
  onCerrar,
  onJustificada,
}: {
  docente: DocenteDelDia;
  fecha: string;
  onCerrar: () => void;
  onJustificada: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motivoValido = motivo.trim().length >= LARGO_MINIMO_MOTIVO;

  async function guardar() {
    if (!docente.registro || !motivoValido) return;
    setGuardando(true);
    setError(null);
    try {
      await api(`/horarios/asistencia-docente/${docente.registro.id}/justificar`, {
        method: "POST",
        body: { motivo: motivo.trim() },
      });
      onJustificada();
    } catch (e) {
      setError(alertaError(e));
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-documento"
      tonoIcono="azul"
      titulo="Justificar inasistencia"
      subtitulo={`${docente.nombreCompleto} · ${fechaDia(fecha)}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton icono="check-blanco" onClick={guardar} cargando={guardando} disabled={!motivoValido}>
            Guardar justificación
          </Boton>
        </>
      }
    >
      <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
        <span className="flex gap-1">
          Motivo <span className="text-rojo">*</span>
        </span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={LARGO_MAXIMO_MOTIVO}
          rows={3}
          placeholder="Por ejemplo: presentó descanso médico por dos días."
          className="w-full rounded-lg border border-borde bg-white px-4 py-3 text-[15px] font-normal leading-[1.5] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul"
        />
        <span className="text-[13px] font-normal text-texto-3">
          Obligatorio (mínimo {LARGO_MINIMO_MOTIVO} caracteres). La inasistencia quedará como «Falta justificada».
        </span>
      </label>
      <Alerta tipo="aviso" icono="alerta-warn" titulo="Este cambio quedará registrado en la bitácora de auditoría">
        Se guardará tu usuario, la fecha y hora, el estado anterior, el nuevo y el motivo.
      </Alerta>
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}
