// Mi tutoría (bloque M3): inicio de la tutoría y asistencia de la sección. El inicio muestra la cantidad de alumnos,
// las clases y las faltas de hoy y los alumnos con aviso por umbral (solo faltas sin justificar). En «Asistencia» el
// tutor elige una fecha del bimestre en curso, ve las clases de su sección ese día (del horario publicado), abre
// cualquiera y registra, modifica (con motivo) o justifica la asistencia.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AsistenciaVacia,
  BadgeEstado,
  CargandoAsistencia,
  enPorcentaje,
  ErrorAsistencia,
  NOMBRE_ESTADO,
  useConsulta,
  type EstadoAsistencia,
} from "@/components/portal/asistencia";
import { mensajeError } from "@/components/portal";
import { Alerta, Badge, Boton, Modal, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { cantidad, diaYHora, fechaDia, fechaLarga } from "@/lib/formato";
import { Indicador, useTutoria } from "./tutoria";
import { ListaAsistencia, type AlumnoDeSesion, type SesionDetalle, type SesionGuardada } from "./asistencia";

interface Bimestre {
  id: string;
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

interface InicioDeTutoria {
  hoy: string;
  tutor: string | null;
  cotutor: string | null;
  bimestre: Bimestre | null;
  totalAlumnos: number;
  clasesDeHoy: { programadas: number; registradas: number };
  faltasDeHoy: {
    matriculaId: string;
    nombre: string;
    faltas: { registroId: string; curso: string; horaInicio: string; estado: EstadoAsistencia }[];
  }[];
  alumnosConAviso: {
    matriculaId: string;
    nombre: string;
    faltasDelMes: number;
    faltasDelAnio: number;
    porcentaje: number;
    nivel: "SIN_RIESGO" | "AVISO" | "RIESGO";
    alertaDelMes: boolean;
  }[];
  umbrales: { faltasMes: number; porcentajeAviso: number; porcentajeRiesgo: number };
  justificacionesPendientes: number;
}

// ---------- Inicio ----------

export function InicioTutoria() {
  const t = useTutoria();
  const { carga, reintentar } = useConsulta<InicioDeTutoria>(`/horarios/tutoria/${t.seccion.id}/inicio`);
  if (carga.fase === "cargando") return <CargandoAsistencia />;
  if (carga.fase === "error") return <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />;
  const d = carga.datos;
  const faltasHoy = d.faltasDeHoy.filter((a) => a.faltas.some((f) => f.estado === "FALTA")).length;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[14px] leading-[1.5] text-texto-2">
        {fechaLarga(d.hoy)} · {d.bimestre ? `${d.bimestre.nombre} en curso` : "Sin bimestre en curso"}
        {d.tutor && ` · Tutor: ${d.tutor}`}
        {d.cotutor && ` · Cotutor: ${d.cotutor}`}
      </p>
      {d.justificacionesPendientes > 0 && (
        <Alerta
          tipo="info"
          titulo={`Tienes ${cantidad(d.justificacionesPendientes, "justificación", "justificaciones")} de apoderados por revisar.`}
        >
          <Link href="/docente/tutoria/justificaciones" className="font-semibold text-kubo-azul underline">
            Revisar justificaciones
          </Link>
        </Alerta>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador valor={d.totalAlumnos} texto="Alumnos" detalle="Con matrícula vigente" />
        <Indicador
          valor={`${d.clasesDeHoy.registradas}/${d.clasesDeHoy.programadas}`}
          texto="Clases de hoy registradas"
          detalle="Del horario publicado"
        />
        <Indicador
          valor={faltasHoy}
          texto="Con faltas hoy"
          detalle="Sin justificar"
          tono={faltasHoy ? "text-rojo-oscuro" : "text-texto"}
        />
        <Indicador
          valor={d.alumnosConAviso.length}
          texto="Con aviso por umbral"
          detalle="Faltas sin justificar"
          tono={d.alumnosConAviso.length ? "text-ambar-oscuro" : "text-texto"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta className="flex flex-col gap-3 p-4 lg:p-5">
          <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Faltas de hoy</h2>
          {d.faltasDeHoy.length === 0 ? (
            <p className="text-[14px] leading-[1.5] text-texto-2">
              Nadie tiene faltas registradas hoy. Las faltas aparecen cuando se registra la asistencia de cada clase.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {d.faltasDeHoy.map((a) => (
                <li key={a.matriculaId} className="flex flex-col gap-1.5 py-2.5">
                  <span className="text-[14px] font-semibold text-texto">{a.nombre}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {a.faltas.map((f) => (
                      <span key={f.registroId} className="inline-flex items-center gap-1.5 text-[12px] text-texto-2">
                        {f.curso} · {f.horaInicio}
                        <BadgeEstado estado={f.estado} />
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta className="flex flex-col gap-3 p-4 lg:p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Alumnos con aviso por umbral</h2>
            <p className="text-[12px] leading-[1.4] text-texto-3">
              {d.umbrales.faltasMes} o más días de falta en el mes, o {enPorcentaje(d.umbrales.porcentajeAviso)} (aviso)
              y {enPorcentaje(d.umbrales.porcentajeRiesgo)} (riesgo) del año. Solo cuentan las faltas sin justificar.
            </p>
          </div>
          {d.alumnosConAviso.length === 0 ? (
            <p className="text-[14px] leading-[1.5] text-texto-2">Ningún alumno alcanza un umbral de inasistencias.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {d.alumnosConAviso.map((a) => (
                <li key={a.matriculaId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="min-w-0 flex-1 text-[14px] font-semibold text-texto">{a.nombre}</span>
                  <span className="text-[12px] text-texto-2">
                    {cantidad(a.faltasDelMes, "falta", "faltas")} este mes · {enPorcentaje(a.porcentaje)} del año
                  </span>
                  {a.nivel === "RIESGO" ? (
                    <Badge tono="rojo">Riesgo</Badge>
                  ) : a.nivel === "AVISO" ? (
                    <Badge tono="ambar">Aviso</Badge>
                  ) : (
                    <Badge tono="ambar">Alerta del mes</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}

// ---------- Asistencia ----------

interface ClaseDelDia {
  claseId: string;
  curso: { id: string; codigo: string; nombre: string };
  docente: { id: string; nombreCompleto: string; nombreCorto: string };
  aula: { id: string; nombre: string };
  bloque: { id: string; horaInicio: string; horaFin: string; etiqueta: string };
  sesion: {
    id: string;
    registrada: boolean;
    registradaEn: string | null;
    resumen: { presentes: number; tardanzas: number; ausentes: number; justificados: number } | null;
  } | null;
}

interface ClasesDelDia {
  fecha: string;
  hoy: string;
  bimestre: Bimestre | null;
  mensaje: string | null;
  clases: ClaseDelDia[];
}

type SesionDeTutoria = SesionDetalle & { tutoria?: unknown };

/** Justificar una falta o una tardanza guardada: el motivo es obligatorio y queda en la auditoría. */
function ModalJustificar({
  seccionId,
  alumno,
  onCerrar,
  onJustificado,
}: {
  seccionId: string;
  alumno: AlumnoDeSesion;
  onCerrar: () => void;
  onJustificado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const que = alumno.estado === "FALTA" ? "falta" : "tardanza";

  async function justificar() {
    setEnviando(true);
    setError(null);
    try {
      await api(`/horarios/tutoria/${seccionId}/registros/${alumno.registroId}/justificar`, {
        method: "POST",
        body: { motivo: motivo.trim() },
      });
      onJustificado();
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-info"
      tonoIcono="azul"
      titulo={`Justificar ${que}`}
      subtitulo={alumno.nombre}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton onClick={justificar} cargando={enviando} disabled={motivo.trim().length < 5}>
            Justificar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[14px] leading-[1.5] text-texto-2">
          Quedará como «{NOMBRE_ESTADO[alumno.estado === "FALTA" ? "FALTA_JUSTIFICADA" : "TARDANZA_JUSTIFICADA"]}».
          {alumno.estado === "FALTA" && " Una falta justificada no cuenta para los avisos por inasistencias."}
        </p>
        <label htmlFor="motivo-justificacion" className="text-[14px] font-semibold text-texto">
          Motivo <span className="text-rojo">*</span>
        </label>
        <textarea
          id="motivo-justificacion"
          rows={3}
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: Presentó constancia de cita médica."
          className="w-full rounded-md border border-borde bg-white px-3 py-2 text-[14px] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul"
        />
        {error && <Alerta tipo="error" titulo={error} />}
      </div>
    </Modal>
  );
}

/** La sesión abierta de una clase, con la lista editable por el tutor. */
function SesionDelTutor({
  seccionId,
  claseId,
  fecha,
  onCambio,
}: {
  seccionId: string;
  claseId: string;
  fecha: string;
  onCambio: () => void;
}) {
  const [carga, setCarga] = useState<
    { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; sesion: SesionDeTutoria }
  >({ fase: "cargando" });
  const [aviso, setAviso] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [justificando, setJustificando] = useState<AlumnoDeSesion | null>(null);
  const [intento, setIntento] = useState(0);

  // abre (o reutiliza) la sesión de la clase en la fecha; el padre cambia la key al elegir otra clase o fecha
  useEffect(() => {
    let vigente = true;
    api<SesionDeTutoria>(`/horarios/tutoria/${seccionId}/sesiones`, { method: "POST", body: { claseId, fecha } })
      .then((sesion) => vigente && setCarga({ fase: "listo", sesion }))
      .catch((e) => vigente && setCarga({ fase: "error", mensaje: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, [seccionId, claseId, fecha, intento]);

  async function recargar(mensaje: string) {
    if (carga.fase !== "listo") return;
    const sesion = await api<SesionDeTutoria>(`/horarios/tutoria/${seccionId}/sesiones/${carga.sesion.id}`);
    setCarga({ fase: "listo", sesion });
    setVersion((n) => n + 1);
    setAviso(mensaje);
    onCambio();
  }

  function guardada(s: SesionGuardada) {
    setCarga({ fase: "listo", sesion: s as SesionDeTutoria });
    setVersion((n) => n + 1);
    setAviso(
      s.avisos.avisos
        ? `Asistencia guardada. Se avisó por correo a ${cantidad(s.avisos.correos, "destinatario", "destinatarios")} por inasistencias.`
        : "Asistencia guardada.",
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
  const s = carga.sesion;
  return (
    <section className="flex flex-col gap-4" aria-label={`Asistencia de ${s.curso.nombre}`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-bold leading-[1.25] text-texto">Asistencia · {s.curso.nombre}</h2>
        <p className="text-[14px] leading-[1.5] text-texto-2">
          {fechaLarga(s.fecha)} · {s.bloque.horaInicio} – {s.bloque.horaFin} · {s.aula.nombre} · Docente:{" "}
          {s.docente.nombreCompleto}
        </p>
      </div>
      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      <ListaAsistencia
        key={`${s.id}-${version}`}
        sesion={s}
        onGuardada={guardada}
        tutoria={{ seccionId, onJustificar: setJustificando }}
      />
      {justificando && (
        <ModalJustificar
          seccionId={seccionId}
          alumno={justificando}
          onCerrar={() => setJustificando(null)}
          onJustificado={() => {
            const nombre = justificando.nombre;
            setJustificando(null);
            void recargar(`Se justificó el registro de ${nombre}.`);
          }}
        />
      )}
    </section>
  );
}

export function AsistenciaTutoria() {
  const t = useTutoria();
  const [fecha, setFecha] = useState<string | null>(null);
  const ruta = `/horarios/tutoria/${t.seccion.id}/clases${fecha ? `?fecha=${fecha}` : ""}`;
  const { carga, reintentar, recargar } = useConsulta<ClasesDelDia>(ruta);
  const [elegida, setElegida] = useState<string | null>(null);

  const datos = carga.fase === "listo" ? carga.datos : null;
  const fechaVista = datos?.fecha ?? fecha;
  const elegidaVigente = datos?.clases.some((c) => c.claseId === elegida) ? elegida : null;

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta className="flex flex-col gap-4 p-4 lg:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fecha-tutoria" className="text-[14px] font-semibold text-texto">
              Fecha
            </label>
            <input
              id="fecha-tutoria"
              type="date"
              value={fechaVista ?? ""}
              min={datos?.bimestre?.fechaInicio}
              max={
                datos
                  ? datos.bimestre && datos.bimestre.fechaFin < datos.hoy
                    ? datos.bimestre.fechaFin
                    : datos.hoy
                  : undefined
              }
              onChange={(e) => {
                setElegida(null);
                setFecha(e.target.value || null);
              }}
              className="h-10 rounded-md border border-borde bg-white px-3 text-[14px] text-texto outline-none focus:border-kubo-azul"
            />
          </div>
          <p className="min-w-[220px] flex-1 text-[13px] leading-[1.5] text-texto-3">
            {datos?.bimestre
              ? `Puedes elegir un día del ${datos.bimestre.nombre} (${fechaDia(datos.bimestre.fechaInicio)} al ${fechaDia(datos.bimestre.fechaFin)}) hasta hoy. Registras y modificas la asistencia de cualquier clase de tu sección; la sesión sigue a nombre del docente de la clase.`
              : "La asistencia de la tutoría se maneja dentro del bimestre en curso."}
          </p>
        </div>

        {carga.fase === "cargando" && <CargandoAsistencia />}
        {carga.fase === "error" && (
          <ErrorAsistencia
            mensaje={carga.mensaje}
            onReintentar={() => {
              setFecha(null);
              reintentar();
            }}
          />
        )}
        {datos && datos.mensaje && <AsistenciaVacia titulo={datos.mensaje} />}
        {datos && datos.clases.length > 0 && (
          <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
            {datos.clases.map((c) => (
              <li key={c.claseId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="flex min-w-[200px] flex-1 flex-col">
                  <span className="text-[14px] font-semibold leading-[1.4] text-texto">
                    {c.bloque.horaInicio} – {c.bloque.horaFin} · {c.curso.nombre}
                  </span>
                  <span className="text-[12px] leading-[1.4] text-texto-3">
                    {c.docente.nombreCompleto} · {c.aula.nombre}
                    {c.sesion?.registradaEn ? ` · registrada el ${diaYHora(c.sesion.registradaEn)}` : ""}
                  </span>
                </div>
                {c.sesion?.registrada && c.sesion.resumen ? (
                  <span className="text-[12px] text-texto-2">
                    {c.sesion.resumen.presentes} P · {c.sesion.resumen.tardanzas} T · {c.sesion.resumen.ausentes} A ·{" "}
                    {c.sesion.resumen.justificados} J
                  </span>
                ) : (
                  <Badge tono="gris">Sin registrar</Badge>
                )}
                <Boton
                  variante={elegidaVigente === c.claseId ? "primario" : "secundario"}
                  className="!px-3 !py-1.5 !text-[14px]"
                  aria-pressed={elegidaVigente === c.claseId}
                  onClick={() => setElegida(c.claseId)}
                >
                  {c.sesion?.registrada ? "Abrir" : "Registrar"}
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {datos && elegidaVigente && (
        <SesionDelTutor
          key={`${elegidaVigente}-${datos.fecha}`}
          seccionId={t.seccion.id}
          claseId={elegidaVigente}
          fecha={datos.fecha}
          onCambio={recargar}
        />
      )}
    </div>
  );
}
