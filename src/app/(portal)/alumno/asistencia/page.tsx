// AL-04 · Mi asistencia · Alumno (US52): faltas y tardanzas acumuladas en el bimestre y en el año, el nivel de riesgo
// frente a los umbrales de la institución (aviso y riesgo), la alerta por faltas injustificadas del mes y el detalle
// del bimestre. Sin faltas ni tardanzas: «¡Felicidades! No registras inasistencias este periodo». El alumno sale de la
// sesión: no puede consultar la asistencia de otro.
"use client";

import { EncabezadoPagina } from "@/components/portal";
import {
  AsistenciaVacia,
  BadgeDia,
  CargandoAsistencia,
  enPorcentaje,
  ErrorAsistencia,
  useConsulta,
  type AlertaDelMes,
  type Incidencia,
  type SituacionAnual,
} from "@/components/portal/asistencia";
import { Alerta, Badge, Icono, Tarjeta } from "@/components/ui";
import { fechaDia } from "@/lib/formato";

interface Acumulado {
  faltas: number;
  tardanzas: number;
  justificadas: number;
}

interface AsistenciaDelAlumno {
  estudiante: { estudianteId: string; nombres: string; nombreCompleto: string };
  anio: number;
  bimestre: (Acumulado & { numero: number; nombre: string }) | null;
  delAnio: Acumulado & { desde: string };
  riesgo: SituacionAnual;
  alertaDelMes: AlertaDelMes | null;
  detalle: Incidencia[];
  sinInasistencias: boolean;
}

function Kpi({
  titulo,
  valor,
  pie,
  icono,
  tono,
}: {
  titulo: string;
  valor: number;
  pie: string;
  icono: string;
  tono: "rojo" | "ambar";
}) {
  return (
    <Tarjeta className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tono === "rojo" ? "bg-rojo/12" : "bg-ambar/16"}`}
        >
          <Icono nombre={icono} size={20} />
        </span>
        <span className="text-[14px] leading-[1.4] text-texto-2">{titulo}</span>
      </div>
      <span className="text-[32px] font-bold leading-none text-texto">{valor}</span>
      <span className="text-[13px] leading-[1.4] text-texto-3">{pie}</span>
    </Tarjeta>
  );
}

const NIVEL = {
  SIN_RIESGO: { texto: "Sin riesgo", tono: "verde", barra: "bg-verde" },
  AVISO: { texto: "En aviso", tono: "ambar", barra: "bg-ambar" },
  RIESGO: { texto: "En riesgo", tono: "rojo", barra: "bg-rojo" },
} as const;

function NivelDeRiesgo({ riesgo }: { riesgo: SituacionAnual }) {
  const nivel = NIVEL[riesgo.nivel];
  // la barra llega hasta un poco más que el umbral de riesgo, para que la marca quede dentro
  const escala = Math.max(riesgo.porcentajeRiesgo * 1.25, riesgo.porcentaje);
  const ancho = escala > 0 ? Math.min(100, (riesgo.porcentaje / escala) * 100) : 0;
  const marca = escala > 0 ? (riesgo.porcentajeRiesgo / escala) * 100 : 0;
  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Nivel de riesgo</h2>
        <Badge tono={nivel.tono} punto>
          {nivel.texto}
        </Badge>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
        <span className="font-semibold text-texto">{enPorcentaje(riesgo.porcentaje)} de inasistencias en el año</span>
        <span className="text-rojo-oscuro">Umbral institucional: {enPorcentaje(riesgo.porcentajeRiesgo)}</span>
      </div>
      <div
        className="relative h-2.5 w-full rounded-full bg-borde"
        role="meter"
        aria-label="Porcentaje de inasistencias en el año"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={riesgo.porcentaje}
      >
        {/* el ancho de la barra y la marca del umbral dependen de los datos: estilos calculados en tiempo de ejecución */}
        <span className={`absolute inset-y-0 left-0 rounded-full ${nivel.barra}`} style={{ width: `${ancho}%` }} />
        <span aria-hidden className="absolute -top-1.5 h-5 w-0.5 bg-rojo" style={{ left: `${marca}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-[12px] text-texto-3">
        <span>
          {riesgo.faltas} faltas de {riesgo.lectivos} días de clase
        </span>
        <span>
          {riesgo.nivel === "RIESGO"
            ? "Superaste el umbral institucional"
            : `Te quedan ${riesgo.faltasAntesDelRiesgo} faltas antes del umbral`}
        </span>
      </div>
    </Tarjeta>
  );
}

function DetalleDelPeriodo({ titulo, detalle }: { titulo: string; detalle: Incidencia[] }) {
  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">{titulo}</h2>
      {detalle.length === 0 ? (
        <p className="text-[14px] leading-[1.5] text-texto-2">No registras faltas ni tardanzas en este periodo.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde">
          <table className="w-full min-w-[480px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-borde bg-fondo text-[13px] font-semibold text-texto-2">
                <th scope="col" className="px-4 py-2.5">
                  Fecha
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Clase
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Tipo
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody>
              {detalle.map((i) => (
                <tr
                  key={`${i.fecha}-${i.clase?.horaInicio ?? "dia"}`}
                  className="border-b border-borde last:border-b-0"
                >
                  <td className="px-4 py-3 text-texto">{fechaDia(i.fecha)}</td>
                  <td className="px-4 py-3 text-texto">
                    {i.clase ? `${i.clase.curso} · ${i.clase.horaInicio}` : "Día completo"}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeDia estado={i.estado} texto={i.estado === "AUSENTE" ? "Falta" : undefined} />
                  </td>
                  <td className="px-4 py-3 text-texto-2">
                    {i.observacion ??
                      (i.estado === "AUSENTE" ? "Sin justificar" : i.estado === "JUSTIFICADO" ? "Justificada" : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

export default function MiAsistenciaPage() {
  const { carga, reintentar } = useConsulta<AsistenciaDelAlumno>("/horarios/alumno/asistencia");

  return (
    <>
      <EncabezadoPagina titulo="Mi asistencia" descripcion="Conteo acumulado de tus faltas y tardanzas registradas." />
      {carga.fase === "cargando" && <CargandoAsistencia />}
      {carga.fase === "error" && <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />}
      {carga.fase === "listo" && <Contenido datos={carga.datos} />}
    </>
  );
}

function Contenido({ datos }: { datos: AsistenciaDelAlumno }) {
  const { bimestre, delAnio, riesgo } = datos;
  const nombreBimestre = bimestre?.nombre ?? "Bimestre";
  const desde = `Desde el ${fechaDia(delAnio.desde)}`;
  return (
    <>
      {riesgo.nivel !== "SIN_RIESGO" && (
        <Alerta
          tipo={riesgo.nivel === "RIESGO" ? "error" : "aviso"}
          icono="alerta-warn"
          titulo={
            riesgo.nivel === "RIESGO" ? "Estás en riesgo por inasistencias" : "Te acercas al límite de inasistencias"
          }
        >
          Acumulas el {enPorcentaje(riesgo.porcentaje)} de inasistencias en el año. Conversa con tu tutor para evitar
          consecuencias académicas.
        </Alerta>
      )}
      {datos.alertaDelMes && (
        <Alerta tipo="aviso" icono="alerta-warn" titulo={datos.alertaDelMes.mensaje}>
          Si alguna de esas faltas tiene una constancia, pide a tu apoderado que la presente al tutor de tu sección.
        </Alerta>
      )}

      {datos.sinInasistencias ? (
        <AsistenciaVacia titulo="¡Felicidades! No registras inasistencias este periodo" icono="icon-check-verde">
          Sigue así: no tienes faltas ni tardanzas registradas en el año {datos.anio}.
        </AsistenciaVacia>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              titulo={`Faltas en el ${bimestre ? "bimestre" : "año"}`}
              valor={bimestre?.faltas ?? delAnio.faltas}
              pie={bimestre ? nombreBimestre : desde}
              icono="kpi-ban"
              tono="rojo"
            />
            <Kpi
              titulo={`Tardanzas en el ${bimestre ? "bimestre" : "año"}`}
              valor={bimestre?.tardanzas ?? delAnio.tardanzas}
              pie={bimestre ? nombreBimestre : desde}
              icono="icon-clock-rojo"
              tono="ambar"
            />
            <Kpi titulo="Faltas en el año" valor={delAnio.faltas} pie={desde} icono="kpi-ban" tono="rojo" />
            <Kpi
              titulo="Tardanzas en el año"
              valor={delAnio.tardanzas}
              pie={desde}
              icono="icon-clock-rojo"
              tono="ambar"
            />
          </div>
          {delAnio.justificadas > 0 && (
            <p className="text-[13px] leading-[1.5] text-texto-3">
              Además tienes {delAnio.justificadas}{" "}
              {delAnio.justificadas === 1 ? "día justificado" : "días justificados"} en el año:{" "}
              {delAnio.justificadas === 1 ? "no cuenta" : "no cuentan"} para el límite de inasistencias.
            </p>
          )}
          <NivelDeRiesgo riesgo={riesgo} />
          <DetalleDelPeriodo
            titulo={
              bimestre
                ? `Detalle del bimestre ${nombreBimestre.replace("Bimestre ", "")}`
                : `Detalle del año ${datos.anio}`
            }
            detalle={datos.detalle}
          />
        </>
      )}
    </>
  );
}
