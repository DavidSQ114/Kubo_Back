// AP-03 · Asistencia · Apoderado (US45): resumen mensual del hijo elegido por día de clases (Presente, Ausente,
// Tardanza o Justificado; un día es «Ausente» si faltó a todas sus clases), sus inasistencias y tardanzas con las
// observaciones del docente y la alerta al llegar a UMBRAL_FALTAS_MES. Sin registros: «No hay registros de asistencia
// disponibles para este periodo». El servidor valida el vínculo: un estudiante que no es su hijo responde 403.
"use client";

import { useState } from "react";
import { useHijo } from "@/components/apoderado/PortalApoderado";
import { EncabezadoPagina } from "@/components/portal";
import {
  AsistenciaVacia,
  BadgeDia,
  CargandoAsistencia,
  enPorcentaje,
  ErrorAsistencia,
  NOMBRE_ESTADO_DIA,
  PuntoEstado,
  useConsulta,
  type AlertaDelMes,
  type EstadoDia,
  type Incidencia,
  type SituacionAnual,
} from "@/components/portal/asistencia";
import { Alerta, Badge, Icono, Tarjeta } from "@/components/ui";
import { cantidad, mesLargo, nombreMes, sumarMeses } from "@/lib/formato";

type EstadoCalendario = EstadoDia | "SIN_REGISTRO" | "VACACIONES" | "FUERA_DEL_ANIO";
type Dia = "LUNES" | "MARTES" | "MIERCOLES" | "JUEVES" | "VIERNES";

interface AsistenciaDelMes {
  estudiante: { estudianteId: string; nombres: string; nombreCompleto: string };
  anio: number;
  mes: string;
  primerMes: string;
  ultimoMes: string;
  calendario: { fecha: string; dia: Dia; estado: EstadoCalendario }[];
  resumen: {
    presentes: number;
    tardanzas: number;
    ausentes: number;
    justificados: number;
    diasConClases: number;
    porcentajeAsistencia: number | null;
  };
  incidencias: Incidencia[];
  alerta: AlertaDelMes | null;
  anual: SituacionAnual;
  umbralFaltasMes: number;
}

const DIAS: Dia[] = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];
const NOMBRE_DIA: Record<Dia, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
};

const diaDelMes = (fecha: string) => Number(fecha.slice(8, 10));
const MESES_CORTOS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "set.", "oct.", "nov.", "dic."];
const mesCorto = (fecha: string) => MESES_CORTOS[Number(fecha.slice(5, 7)) - 1];

/** Celda del calendario: el día y su estado (o «Vacaciones»). */
function CeldaDia({ dia }: { dia: AsistenciaDelMes["calendario"][number] }) {
  const ausente = dia.estado === "AUSENTE";
  let contenido = null;
  if (dia.estado === "VACACIONES") contenido = <Badge tono="gris">Vacaciones</Badge>;
  else if (dia.estado !== "SIN_REGISTRO" && dia.estado !== "FUERA_DEL_ANIO")
    contenido = <BadgeDia estado={dia.estado} />;
  return (
    <div className={`flex min-h-[84px] flex-col gap-2 p-3 ${ausente ? "bg-rojo/5" : ""}`}>
      <span className={`text-[14px] font-semibold ${dia.estado === "VACACIONES" ? "text-texto-3" : "text-texto"}`}>
        {diaDelMes(dia.fecha)}
      </span>
      {contenido}
    </div>
  );
}

/** Calendario de lunes a viernes (escritorio); en el celular, la lista de días con clases. */
function Calendario({ datos }: { datos: AsistenciaDelMes }) {
  const primero = datos.calendario[0];
  const huecos = primero ? DIAS.indexOf(primero.dia) : 0;
  const celdas: (AsistenciaDelMes["calendario"][number] | null)[] = [...Array(huecos).fill(null), ...datos.calendario];
  while (celdas.length % DIAS.length) celdas.push(null);
  const conEstado = datos.calendario.filter((d) => d.estado in NOMBRE_ESTADO_DIA);
  return (
    <>
      <Tarjeta className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-5 border-b border-borde bg-fondo text-[13px] font-semibold text-texto-2">
          {DIAS.map((d) => (
            <span key={d} className="border-l border-borde px-3 py-2.5 first:border-l-0">
              {NOMBRE_DIA[d]}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-5">
          {celdas.map((dia, i) => (
            <div
              key={dia?.fecha ?? `vacio-${i}`}
              className="border-b border-l border-borde [&:nth-child(5n+1)]:border-l-0"
            >
              {dia && <CeldaDia dia={dia} />}
            </div>
          ))}
        </div>
      </Tarjeta>
      <Tarjeta className="md:hidden">
        {conEstado.length === 0 ? (
          <p className="px-4 py-6 text-center text-[14px] text-texto-2">Aún no hay días con asistencia este mes.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {conEstado.map((d) => (
              <li
                key={d.fecha}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${d.estado === "AUSENTE" ? "bg-rojo/5" : ""}`}
              >
                <span className="text-[14px] text-texto">
                  {NOMBRE_DIA[d.dia]} {diaDelMes(d.fecha)}
                </span>
                <BadgeDia estado={d.estado as EstadoDia} />
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </>
  );
}

function ResumenDelMes({ datos }: { datos: AsistenciaDelMes }) {
  const filas: [EstadoDia, number][] = [
    ["PRESENTE", datos.resumen.presentes],
    ["TARDANZA", datos.resumen.tardanzas],
    ["AUSENTE", datos.resumen.ausentes],
    ["JUSTIFICADO", datos.resumen.justificados],
  ];
  const porcentaje = datos.resumen.porcentajeAsistencia;
  return (
    <Tarjeta className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Resumen de {nombreMes(datos.mes)}</h2>
        {porcentaje !== null && (
          <Badge tono={porcentaje >= 90 ? "verde" : "ambar"} punto>
            {porcentaje} % de asistencia
          </Badge>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-borde">
        {filas.map(([estado, cantidad]) => (
          <li key={estado} className="flex items-center gap-3 py-2.5 text-[15px]">
            <PuntoEstado estado={estado} />
            <span className="flex-1 text-texto-2">{NOMBRE_ESTADO_DIA[estado]}</span>
            <span className="font-bold text-texto">{cantidad}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] leading-[1.4] text-texto-3">
        Días con clases registradas: {datos.resumen.diasConClases}
      </p>
    </Tarjeta>
  );
}

function descripcion(i: Incidencia): { titulo: string; detalle: string } {
  if (i.alcance === "DIA") {
    return {
      titulo: i.estado === "JUSTIFICADO" ? "Inasistencia justificada todo el día" : "Ausente todo el día",
      detalle: i.observacion ?? (i.estado === "JUSTIFICADO" ? "Justificada" : "Sin justificación"),
    };
  }
  const clase = i.clase!;
  const docente = clase.docente ? ` · ${clase.docente}` : "";
  return {
    titulo: `${clase.curso} · ${clase.horaInicio}`,
    detalle: i.observacion ? `${i.observacion}${docente}` : `${NOMBRE_ESTADO_DIA[i.estado]}${docente}`,
  };
}

function ListaIncidencias({ incidencias }: { incidencias: Incidencia[] }) {
  return (
    <Tarjeta className="flex flex-col gap-3 p-5">
      <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Inasistencias y tardanzas</h2>
      {incidencias.length === 0 ? (
        <p className="text-[14px] leading-[1.5] text-texto-2">Ninguna en este mes.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {incidencias.map((i) => {
            const { titulo, detalle } = descripcion(i);
            return (
              <li key={`${i.fecha}-${i.clase?.horaInicio ?? "dia"}`} className="flex items-start gap-3 py-3">
                <span className="flex w-10 shrink-0 flex-col leading-[1.3]">
                  <span className="text-[15px] font-semibold text-texto">{diaDelMes(i.fecha)}</span>
                  <span className="text-[12px] text-texto-3">{mesCorto(i.fecha)}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-[1.4]">
                  <span className="text-[14px] font-medium text-texto">{titulo}</span>
                  <span className="text-[12px] text-texto-3">{detalle}</span>
                </span>
                <BadgeDia estado={i.estado} />
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

const fechasCortas = (fechas: string[]) => {
  const dias = fechas.map(diaDelMes);
  const formato = new Intl.ListFormat("es", { style: "long", type: "conjunction" });
  return `${formato.format(dias.map(String))} de ${nombreMes(fechas[0].slice(0, 7))}`;
};

export default function AsistenciaApoderadoPage() {
  const { hijo } = useHijo();
  const [mes, setMes] = useState<string | null>(null);
  const consulta = mes ? `?mes=${mes}` : "";
  const { carga, reintentar } = useConsulta<AsistenciaDelMes>(
    `/horarios/apoderado/hijos/${hijo.estudianteId}/asistencia${consulta}`,
  );
  const nombre = hijo.nombres.split(" ")[0];

  return (
    <>
      <EncabezadoPagina
        titulo="Asistencia"
        descripcion={`Resumen mensual de la asistencia de ${nombre} por día de clases.`}
      />
      {carga.fase === "cargando" && <CargandoAsistencia />}
      {carga.fase === "error" && <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />}
      {carga.fase === "listo" && <PantallaDelMes datos={carga.datos} nombre={nombre} onMes={setMes} />}
    </>
  );
}

function PantallaDelMes({
  datos,
  nombre,
  onMes,
}: {
  datos: AsistenciaDelMes;
  nombre: string;
  onMes: (mes: string) => void;
}) {
  const sinRegistros = datos.resumen.diasConClases === 0;
  const meses: string[] = [];
  for (let m = datos.primerMes; m <= datos.ultimoMes; m = sumarMeses(m, 1)) meses.push(m);
  const { anual } = datos;
  return (
    <>
      {anual.nivel !== "SIN_RIESGO" && (
        <Alerta
          tipo={anual.nivel === "RIESGO" ? "error" : "aviso"}
          icono="alerta-warn"
          titulo={
            anual.nivel === "RIESGO"
              ? `${nombre} superó el límite de inasistencias del año`
              : `${nombre} se acerca al límite de inasistencias del año`
          }
        >
          En el año lleva {enPorcentaje(anual.porcentaje)} de inasistencias injustificadas (
          {cantidad(anual.faltas, "falta", "faltas")} de {cantidad(anual.lectivos, "día de clase", "días de clase")}
          {anual.desdeMatricula ? " desde su matrícula" : " del año"}). El colegio avisa al llegar al{" "}
          {enPorcentaje(anual.porcentajeAviso)} y el límite institucional es {enPorcentaje(anual.porcentajeRiesgo)}.
        </Alerta>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-label="Mes anterior"
          disabled={datos.mes <= datos.primerMes}
          onClick={() => onMes(sumarMeses(datos.mes, -1))}
          className="flex size-11 items-center justify-center rounded-lg border border-borde bg-white hover:bg-fondo disabled:opacity-40"
        >
          <Icono nombre="pag-chevl" size={18} />
        </button>
        <label className="flex h-11 items-center gap-2 rounded-lg border border-borde bg-white px-3">
          <Icono nombre="icon-calendar-gris" size={18} />
          <span className="sr-only">Mes</span>
          <select
            value={datos.mes}
            onChange={(e) => onMes(e.target.value)}
            className="bg-transparent pr-1 text-[16px] text-texto capitalize outline-none"
          >
            {!meses.includes(datos.mes) && <option value={datos.mes}>{mesLargo(datos.mes)}</option>}
            {meses.map((m) => (
              <option key={m} value={m}>
                {mesLargo(m)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={datos.mes >= datos.ultimoMes}
          onClick={() => onMes(sumarMeses(datos.mes, 1))}
          className="flex size-11 items-center justify-center rounded-lg border border-borde bg-white hover:bg-fondo disabled:opacity-40"
        >
          <Icono nombre="pag-chevr" size={18} />
        </button>
        <span className="ml-auto text-[13px] text-texto-3">Días con clases: {datos.resumen.diasConClases}</span>
      </div>

      {datos.alerta && (
        <Alerta tipo="aviso" icono="alerta-warn" titulo={datos.alerta.mensaje}>
          {nombre} faltó {datos.alerta.fechas.length === 1 ? "el" : "los días"} {fechasCortas(datos.alerta.fechas)} sin
          justificación. Si tienes {datos.alerta.fechas.length === 1 ? "una constancia" : "constancias"}, preséntala
          {datos.alerta.fechas.length === 1 ? "" : "s"} al tutor de la sección.
        </Alerta>
      )}

      {sinRegistros ? (
        <AsistenciaVacia titulo="No hay registros de asistencia disponibles para este periodo">
          Elige otro mes con las flechas o el selector. La asistencia aparece cuando los docentes la registran en cada
          clase.
        </AsistenciaVacia>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-2">
            <Calendario datos={datos} />
            <p className="flex items-start gap-2 text-[12px] leading-[1.5] text-texto-3">
              <span className="mt-0.5 shrink-0">
                <Icono nombre="icon-info" size={14} />
              </span>
              La asistencia se registra por clase; aquí se muestra el estado del día. Un día cuenta como «Ausente» solo
              si
              {` ${nombre}`} faltó a todas sus clases de ese día; si faltó a algunas, se listan esas clases.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            <ResumenDelMes datos={datos} />
            <ListaIncidencias incidencias={datos.incidencias} />
          </div>
        </div>
      )}
    </>
  );
}
