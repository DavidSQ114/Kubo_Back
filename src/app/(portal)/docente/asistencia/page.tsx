// DO-03 · Toma de asistencia · Docente (US35, US36): clases de hoy según el horario publicado; al elegir una se abre
// su sesión y se registra la lista. Debajo, los registros de los últimos días: se corrigen dentro del plazo y luego
// quedan en solo lectura. Sin clases hoy (o en fin de semana) se explica por qué.
"use client";

import { useEffect, useState } from "react";
import {
  etiquetaClase,
  ListaAsistencia,
  RegistrosAnteriores,
  type ClasesDeHoy,
  type SesionDetalle,
  type SesionGuardada,
  type SesionVista,
} from "@/components/docente/asistencia";
import { EncabezadoPagina, mensajeError } from "@/components/portal";
import {
  AsistenciaVacia,
  CargandoAsistencia,
  ErrorAsistencia,
  useConsulta,
  type Carga,
} from "@/components/portal/asistencia";
import { Alerta, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { cantidad, fechaDia, fechaLarga } from "@/lib/formato";

/** Lo que se está viendo: una clase de hoy (se abre su sesión) o una sesión de días anteriores. */
type Eleccion = { tipo: "clase"; id: string } | { tipo: "sesion"; id: string };

/** Sesión elegida con su lista. El padre cambia la `key` al elegir otra: el estado de esta no se arrastra. */
function SesionDeClase({ eleccion, onCambio }: { eleccion: Eleccion; onCambio: () => void }) {
  const [carga, setCarga] = useState<Carga<SesionDetalle>>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const { tipo, id } = eleccion;

  useEffect(() => {
    let vigente = true;
    const pedido =
      tipo === "clase"
        ? api<SesionDetalle>("/horarios/asistencia/sesiones", { method: "POST", body: { claseId: id } })
        : api<SesionDetalle>(`/horarios/asistencia/sesiones/${id}`);
    pedido
      .then((datos) => vigente && setCarga({ fase: "listo", datos }))
      .catch((e) => vigente && setCarga({ fase: "error", mensaje: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, [tipo, id, intento]);

  function guardada(nueva: SesionGuardada) {
    const { avisos } = nueva.avisos;
    setCarga({ fase: "listo", datos: nueva });
    setVersion((v) => v + 1);
    setAviso(
      "Asistencia guardada." + (avisos > 0 ? " Se envió el aviso por inasistencias al alumno y a su apoderado." : ""),
    );
    onCambio();
  }

  if (carga.fase === "cargando") return <CargandoAsistencia />;
  if (carga.fase === "error") {
    return (
      <ErrorAsistencia
        mensaje={carga.mensaje}
        onReintentar={() => {
          setCarga({ fase: "cargando" });
          setIntento((n) => n + 1);
        }}
      />
    );
  }
  const s = carga.datos;
  return (
    <section className="flex flex-col gap-4" aria-label={`Asistencia de ${s.curso.nombre} ${s.seccion.etiqueta}`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-bold leading-[1.25] text-texto">
          Asistencia · {s.curso.nombre} {s.seccion.etiqueta}
        </h2>
        <p className="text-[14px] leading-[1.5] text-texto-2">
          {fechaLarga(s.fecha)} · {s.bloque.horaInicio} – {s.bloque.horaFin} · {s.aula.nombre} ·{" "}
          {cantidad(s.alumnos.length, "estudiante", "estudiantes")}
        </p>
      </div>
      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      <ListaAsistencia key={`${s.id}-${version}`} sesion={s} onGuardada={guardada} />
    </section>
  );
}

export default function AsistenciaDocentePage() {
  const hoy = useConsulta<ClasesDeHoy>("/horarios/asistencia/clases-de-hoy");
  const anteriores = useConsulta<{ sesiones: SesionVista[] }>("/horarios/asistencia/sesiones");
  const [elegida, setElegida] = useState<Eleccion | null>(null);

  const clases = hoy.carga.fase === "listo" ? hoy.carga.datos.clases : [];
  // por defecto, la primera clase de hoy que aún no tiene asistencia registrada
  const primera = clases.find((c) => !c.sesion?.registrada) ?? clases[0];
  const eleccion: Eleccion | null = elegida ?? (primera ? { tipo: "clase", id: primera.claseId } : null);
  const sesionesPrevias = anteriores.carga.fase === "listo" ? anteriores.carga.datos.sesiones : [];

  function alCambiar() {
    // se fija lo que se está viendo: al refrescar las clases de hoy, la elección por defecto pasaría a la siguiente
    setElegida(eleccion);
    hoy.recargar();
    anteriores.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Asistencia"
        descripcion={
          hoy.carga.fase === "listo"
            ? `Hoy es ${fechaLarga(hoy.carga.datos.fecha)}. Registra la asistencia de tus clases del día.`
            : "Registra la asistencia de tus clases del día."
        }
      />

      {hoy.carga.fase === "cargando" && <CargandoAsistencia />}
      {hoy.carga.fase === "error" && <ErrorAsistencia mensaje={hoy.carga.mensaje} onReintentar={hoy.reintentar} />}
      {hoy.carga.fase === "listo" && hoy.carga.datos.sinClases && (
        <AsistenciaVacia titulo={hoy.carga.datos.sinClases.mensaje}>
          La asistencia se registra el mismo día de la clase, según el horario publicado por la institución.
        </AsistenciaVacia>
      )}
      {hoy.carga.fase === "listo" && clases.length > 0 && (
        <Tarjeta className="flex flex-wrap items-end gap-4 p-4 lg:p-5">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1.5 text-[14px] font-medium text-texto-2">
            Clase de hoy
            <select
              value={eleccion?.tipo === "clase" ? eleccion.id : ""}
              onChange={(e) => e.target.value && setElegida({ tipo: "clase", id: e.target.value })}
              className="h-11 w-full rounded-lg border border-borde bg-white px-3 text-[16px] font-normal text-texto outline-none focus:border-kubo-azul"
            >
              {eleccion?.tipo !== "clase" && <option value="">Elige una clase de hoy</option>}
              {clases.map((c) => (
                <option key={c.claseId} value={c.claseId}>
                  {etiquetaClase(c)}
                  {c.sesion?.registrada ? " · registrada" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-[170px] flex-col gap-1.5 text-[14px] font-medium text-texto-2">
            Fecha
            <input
              readOnly
              disabled
              value={fechaDia(hoy.carga.datos.fecha)}
              title="Solo se registra la asistencia del día actual"
              className="h-11 w-full rounded-lg border border-borde bg-fondo px-3 text-[16px] font-normal text-texto-3"
            />
          </label>
        </Tarjeta>
      )}

      {eleccion && <SesionDeClase key={`${eleccion.tipo}-${eleccion.id}`} eleccion={eleccion} onCambio={alCambiar} />}

      {anteriores.carga.fase === "error" && (
        <ErrorAsistencia mensaje={anteriores.carga.mensaje} onReintentar={anteriores.reintentar} />
      )}
      {anteriores.carga.fase === "listo" && (
        <RegistrosAnteriores
          sesiones={sesionesPrevias}
          elegida={eleccion?.tipo === "sesion" ? eleccion.id : null}
          onElegir={(id) => {
            setElegida({ tipo: "sesion", id });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </>
  );
}
