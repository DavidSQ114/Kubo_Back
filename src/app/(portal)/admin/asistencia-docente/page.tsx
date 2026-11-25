// AD-14 · Asistencia del personal docente · Administrador (US32): listado del día con «Marcar "Asistió"» (hora exacta
// e insignia Puntual o Tardanza), salida, justificación de inasistencias y la falta automática de la hora límite.
// Solo se registra el día actual: con otra fecha, el servidor responde «Solo se puede registrar la asistencia del día
// actual». Diferencias con el Figma en docs/frontend-administracion.md.
"use client";

import { useState } from "react";
import {
  BadgeEstadoDocente,
  DocenteDeLaFila,
  IndicadoresDelDia,
  ModalJustificar,
  OPCIONES_ESTADO,
  type AsistenciaDocenteDelDia,
  type DocenteDelDia,
  type FiltroEstado,
} from "@/components/admin/asistenciaDocente";
import { alertaError } from "@/components/admin/PortalAdmin";
import { CargandoAsistencia, ErrorAsistencia, useConsulta } from "@/components/portal/asistencia";
import { Alerta, Boton, Icono, Tarjeta } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fechaDia, fechaLarga, hoyEnLima } from "@/lib/formato";

type Accion = "ingreso" | "salida";

interface Rechazo {
  titulo: string;
  detalle: string | null;
}

/** Acción de la fila según el registro: «Asistió», la salida, o «Justificar» una inasistencia. */
function AccionesDeFila({
  docente,
  ocupado,
  onMarcar,
  onJustificar,
}: {
  docente: DocenteDelDia;
  ocupado: string | null;
  onMarcar: (accion: Accion) => void;
  onJustificar: () => void;
}) {
  const r = docente.registro;
  const cargando = (accion: Accion) => ocupado === `${docente.docenteId}:${accion}`;
  const marcar = (
    <Boton
      variante="exito"
      icono="check-blanco"
      className="!px-3 !py-2 !text-[14px]"
      cargando={cargando("ingreso")}
      disabled={!!ocupado}
      onClick={() => onMarcar("ingreso")}
    >
      Marcar «Asistió»
    </Boton>
  );
  if (!r) return marcar;
  if (r.estado === "FALTA") {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {marcar}
        <Boton
          variante="secundario"
          icono="icon-documento"
          className="!px-3 !py-2 !text-[14px]"
          disabled={!!ocupado}
          onClick={onJustificar}
        >
          Justificar
        </Boton>
      </div>
    );
  }
  if (r.estado === "FALTA_JUSTIFICADA") {
    return <span className="text-[13px] text-texto-3">Justificada</span>;
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-verde-oscuro">
        <Icono nombre="icon-check-verde" size={16} />
        Registrado {r.horaIngreso}
      </span>
      {!r.horaSalida && (
        <Boton
          variante="secundario"
          icono="nav-logout-gris"
          className="!px-3 !py-1.5 !text-[13px]"
          cargando={cargando("salida")}
          disabled={!!ocupado}
          onClick={() => onMarcar("salida")}
        >
          Salida
        </Boton>
      )}
    </div>
  );
}

const coincideEstado = (d: DocenteDelDia, filtro: FiltroEstado) =>
  !filtro || (filtro === "SIN_MARCAR" ? !d.registro : d.registro?.estado === filtro);

export default function AsistenciaDocentePage() {
  const hoy = hoyEnLima();
  const [fecha, setFecha] = useState(hoy);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroEstado>("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState<Rechazo | null>(null);
  const [aJustificar, setAJustificar] = useState<DocenteDelDia | null>(null);
  const { carga, reintentar, recargar } = useConsulta<AsistenciaDocenteDelDia>(
    `/horarios/asistencia-docente?fecha=${fecha}`,
  );

  async function marcar(docente: DocenteDelDia, accion: Accion) {
    setOcupado(`${docente.docenteId}:${accion}`);
    setAviso(null);
    setRechazo(null);
    try {
      const r = await api<{ horaIngreso: string | null; horaSalida: string | null; estado: string }>(
        `/horarios/asistencia-docente/${accion}`,
        { method: "POST", body: { docenteId: docente.docenteId, fecha } },
      );
      setAviso(
        accion === "ingreso"
          ? `Ingreso de ${docente.nombreCompleto} registrado a las ${r.horaIngreso?.slice(0, 5)} (${r.estado === "PUNTUAL" ? "Puntual" : "Tardanza"}).`
          : `Salida de ${docente.nombreCompleto} registrada a las ${r.horaSalida?.slice(0, 5)}.`,
      );
      recargar();
    } catch (e) {
      const esOtroDia = e instanceof ApiError && e.codigo === "SOLO_DIA_ACTUAL";
      setRechazo({
        titulo: alertaError(e),
        detalle: esOtroDia
          ? `Se intentó registrar el ${fechaDia(fecha)}. Las correcciones de días anteriores las realiza la administración y quedan en la bitácora de auditoría.`
          : null,
      });
    } finally {
      setOcupado(null);
    }
  }

  const datos = carga.fase === "listo" ? carga.datos : null;
  const texto = busqueda.trim().toLowerCase();
  const visibles = (datos?.docentes ?? []).filter(
    (d) => coincideEstado(d, filtro) && (!texto || d.nombreCompleto.toLowerCase().includes(texto)),
  );

  return (
    <>
      <div className="flex min-w-[280px] flex-col gap-1.5">
        <p className="text-[14px] leading-[1.4] whitespace-pre text-texto-3">Académico / Asistencia docente</p>
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Asistencia del personal docente</h1>
        <p className="max-w-[820px] text-[16px] leading-[1.5] text-texto-2">
          Registra el ingreso diario de los docentes. A la hora límite
          {datos ? ` (${datos.horaLimite})` : ""}, quienes no fueron marcados quedan con «Inasistencia», salvo
          justificación posterior.
        </p>
      </div>

      {carga.fase === "cargando" && <CargandoAsistencia />}
      {carga.fase === "error" && <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />}
      {datos && <IndicadoresDelDia datos={datos} />}

      <Tarjeta className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-borde bg-fondo px-3 focus-within:border-kubo-azul">
            <Icono nombre="icon-calendar-gris" size={18} />
            <span className="sr-only">Fecha</span>
            <input
              type="date"
              value={fecha}
              max={hoy}
              onChange={(e) => {
                if (!e.target.value) return;
                setFecha(e.target.value);
                setAviso(null);
                setRechazo(null);
              }}
              className="h-11 bg-transparent text-[16px] text-texto outline-none"
            />
          </label>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-kubo-azul/10 px-3 py-1 text-[12px] font-semibold text-kubo-azul">
            <Icono nombre="icon-lock" size={14} />
            Solo se registra el día actual
          </span>
          <div className="flex-1" />
          <label className="flex min-w-[220px] items-center gap-2 rounded-lg border border-borde px-3 focus-within:border-kubo-azul">
            <Icono nombre="icon-search" size={18} />
            <input
              aria-label="Buscar docente"
              placeholder="Buscar docente"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-texto-3"
            />
          </label>
          <select
            aria-label="Estado"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as FiltroEstado)}
            className="h-11 rounded-lg border border-borde bg-white px-3 text-[16px] text-texto outline-none focus:border-kubo-azul"
          >
            {OPCIONES_ESTADO.map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>

        {datos?.diaNoLectivo && <Alerta tipo="info" titulo={datos.diaNoLectivo} />}
        {rechazo && (
          <Alerta tipo="error" titulo={rechazo.titulo}>
            {rechazo.detalle}
          </Alerta>
        )}
        {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}

        {datos && datos.docentes.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Icono nombre="nav-usercheck-gris" size={28} />
            <p className="text-[16px] font-semibold text-texto">No hay docentes activos</p>
            <p className="max-w-[440px] text-[14px] leading-[1.4] text-texto-2">
              Registra a los docentes en «Usuarios» para controlar su asistencia diaria.
            </p>
          </div>
        )}
        {datos && datos.docentes.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-borde">
            <table className="w-full min-w-[900px] border-collapse text-left text-[14px]">
              <caption className="sr-only">Asistencia docente del {fechaLarga(datos.fecha)}</caption>
              <thead>
                <tr className="border-b border-borde bg-fondo text-[13px] font-semibold text-texto-2">
                  {["Docente", "Primera clase", "Hora de ingreso", "Hora de salida", "Estado"].map((c) => (
                    <th key={c} scope="col" className="px-4 py-3">
                      {c}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((d) => (
                  <tr
                    key={d.docenteId}
                    className={`border-b border-borde last:border-b-0 ${d.registro?.estado === "FALTA" ? "bg-rojo/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <DocenteDeLaFila docente={d} />
                    </td>
                    <td className="px-4 py-3 text-texto">{d.primeraClase ?? "—"}</td>
                    <td className="px-4 py-3 text-texto">{d.registro?.horaIngreso ?? "—"}</td>
                    <td className="px-4 py-3 text-texto">{d.registro?.horaSalida ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <BadgeEstadoDocente estado={d.registro?.estado ?? null} />
                        {d.registro?.automatica && (
                          <span className="text-[12px] text-texto-3">Verificación automática</span>
                        )}
                        {d.registro?.justificacion && (
                          <span className="max-w-[220px] text-[12px] leading-[1.4] text-texto-3">
                            {d.registro.justificacion}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AccionesDeFila
                        docente={d}
                        ocupado={ocupado}
                        onMarcar={(accion) => marcar(d, accion)}
                        onJustificar={() => {
                          setAviso(null);
                          setRechazo(null);
                          setAJustificar(d);
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[14px] text-texto-3">
                      Ningún docente coincide con la búsqueda o el estado elegido.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {datos && (
          <p className="text-[13px] text-texto-3">
            Mostrando {visibles.length} de {datos.docentes.length} docentes · Puntual hasta las{" "}
            {datos.horaInicioJornada}; después, Tardanza.
          </p>
        )}
      </Tarjeta>

      {aJustificar && (
        <ModalJustificar
          key={aJustificar.docenteId}
          docente={aJustificar}
          fecha={fecha}
          onCerrar={() => setAJustificar(null)}
          onJustificada={() => {
            setAviso(`Inasistencia de ${aJustificar.nombreCompleto} justificada. El cambio quedó en la bitácora.`);
            setAJustificar(null);
            recargar();
          }}
        />
      )}
    </>
  );
}
