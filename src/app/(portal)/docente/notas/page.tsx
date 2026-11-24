// DO-04 · Registro de notas · Docente (US37, US39, US40, US41): el docente elige uno de sus cursos y secciones y un
// bimestre; en el bimestre activo califica cada competencia con AD, A, B o C (puede guardar una parte y volver luego) y
// cierra el registro (M-10). Un bimestre no activo o un registro cerrado se muestran en solo lectura con su mensaje; en
// uno cerrado o publicado, «Solicitar rectificación» (M-08) y sus solicitudes con su estado. Cada calificación
// guardada admite evidencias (US38, M-07): se agregan y eliminan con el registro abierto y luego quedan en solo lectura.
"use client";

import { useState } from "react";
import {
  AvanceRegistro,
  claveCelda,
  columnaDe,
  esLogro,
  GrillaNotas,
  LeyendaLogros,
  MENSAJE_VALOR_NO_PERMITIDO,
  ModalCerrarRegistro,
  type Bimestre,
  type CursoDelDocente,
  type Logro,
  type MisRegistros,
  type NotasGuardadas,
  type Pendiente,
  type RegistroCerrado,
  type RegistroDeNotas,
} from "@/components/docente/notas";
import { ModalEvidencias, type CeldaElegida } from "@/components/docente/evidencias";
import {
  claveNota,
  ModalSolicitarRectificacion,
  SolicitudesDelRegistro,
  type SolicitudCreada,
  type SolicitudRectificacion,
} from "@/components/docente/rectificaciones";
import { EncabezadoPagina, mensajeError } from "@/components/portal";
import {
  AsistenciaVacia,
  ErrorAsistencia,
  CargandoAsistencia,
  useConsulta,
  type Carga,
} from "@/components/portal/asistencia";
import { Alerta, Badge, Boton, Tarjeta } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { diaMes, diaYHora, fechaDia, hoyEnLima } from "@/lib/formato";

const NUMERAL = ["I", "II", "III", "IV"];

/** «Bimestre III (10/08 – 09/10/2026)». */
const rangoBimestre = (b: Bimestre) => `${b.nombre} (${diaMes(b.fechaInicio)} – ${fechaDia(b.fechaFin)})`;

function estadoDePestana(curso: CursoDelDocente | undefined, b: Bimestre) {
  const estado = curso?.estados[b.id];
  if (estado === "CERRADO" || estado === "PUBLICADO") return "cerrado";
  return b.activo ? "activo" : "no activo";
}

/** Bimestre por defecto: el activo; si no hay, el último que ya empezó o, si ninguno, el primero. */
function bimestrePorDefecto(datos: MisRegistros): string | null {
  const hoy = hoyEnLima();
  const iniciados = datos.bimestres.filter((b) => b.fechaInicio <= hoy);
  return datos.bimestreActivoId ?? iniciados[iniciados.length - 1]?.id ?? datos.bimestres[0]?.id ?? null;
}

interface Mensaje {
  tipo: "exito" | "error";
  titulo: string;
  detalle?: string;
}

/** Celdas con un valor fuera de la escala y el texto «Se rechazó el valor “15” ingresado para … en C2». */
function celdasInvalidas(registro: RegistroDeNotas, ediciones: Record<string, string>) {
  const invalidas = new Set<string>();
  const textos: string[] = [];
  for (const a of registro.alumnos) {
    registro.competencias.forEach((c, i) => {
      const clave = claveCelda(a.matriculaId, c.competenciaPlanId);
      const valor = ediciones[clave];
      if (clave in ediciones && valor !== "" && !esLogro(valor)) {
        invalidas.add(clave);
        textos.push(`Se rechazó el valor «${valor}» ingresado para ${a.nombre} en ${columnaDe(i)}.`);
      }
    });
  }
  return { invalidas, textos };
}

/** Registro de un curso y sección en un bimestre. El padre cambia la `key` al elegir otro: no se arrastra estado. */
function RegistroDelBimestre({
  asignacionId,
  bimestreId,
  onCambio,
}: {
  asignacionId: string;
  bimestreId: string;
  onCambio: () => void;
}) {
  const consulta = useConsulta<RegistroDeNotas>(`/evaluacion/registros/${asignacionId}/bimestres/${bimestreId}`);
  const mias = useConsulta<SolicitudRectificacion[]>("/evaluacion/docente/rectificaciones");
  const [rectificando, setRectificando] = useState(false);
  const [evidencias, setEvidencias] = useState<CeldaElegida | null>(null);
  const [propio, setPropio] = useState<RegistroDeNotas | null>(null);
  const [ediciones, setEdiciones] = useState<Record<string, string>>({});
  const [invalidas, setInvalidas] = useState<Set<string>>(new Set());
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [modal, setModal] = useState<{ pendientes: Pendiente[] | null; error: string | null } | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const carga: Carga<RegistroDeNotas> = propio ? { fase: "listo", datos: propio } : consulta.carga;
  if (carga.fase === "cargando") return <CargandoAsistencia />;
  if (carga.fase === "error") return <ErrorAsistencia mensaje={carga.mensaje} onReintentar={consulta.reintentar} />;
  const r = carga.datos;

  // cambios reales: celdas tocadas cuyo valor difiere del guardado
  const cambios = Object.entries(ediciones).filter(([clave, valor]) => {
    const [matriculaId, competenciaPlanId] = clave.split("|");
    const guardado = r.alumnos.find((a) => a.matriculaId === matriculaId)?.notas[competenciaPlanId]?.logro ?? "";
    return valor !== guardado && valor !== "";
  });

  function cambiar(clave: string, valor: string) {
    setEdiciones((e) => ({ ...e, [clave]: valor }));
    if (invalidas.has(clave)) setInvalidas((s) => new Set([...s].filter((x) => x !== clave)));
  }

  /** Tras guardar o eliminar una evidencia: el registro nuevo, sin perder las notas aún sin guardar. */
  function conEvidencias(nuevo: RegistroDeNotas, aviso: string) {
    setPropio(nuevo);
    setMensaje({ tipo: "exito", titulo: aviso });
  }

  function actualizar(nuevo: RegistroDeNotas) {
    setPropio(nuevo);
    setEdiciones({});
    setInvalidas(new Set());
    onCambio();
  }

  async function guardar() {
    setMensaje(null);
    const { invalidas: malas, textos } = celdasInvalidas(r, ediciones);
    if (malas.size) {
      setInvalidas(malas);
      setMensaje({
        tipo: "error",
        titulo: MENSAJE_VALOR_NO_PERMITIDO,
        detalle: `${textos.join(" ")} El registro no se guardó.`,
      });
      return;
    }
    const notas = cambios.map(([clave, logro]) => {
      const [matriculaId, competenciaPlanId] = clave.split("|");
      return { matriculaId, competenciaPlanId, logro: logro as Logro };
    });
    if (!notas.length) return;
    setGuardando(true);
    try {
      const nuevo = await api<NotasGuardadas>(`/evaluacion/registros/${asignacionId}/bimestres/${bimestreId}/notas`, {
        method: "PUT",
        body: { notas },
      });
      actualizar(nuevo);
      const { nuevas, modificadas } = nuevo.guardado;
      setMensaje({
        tipo: "exito",
        titulo: "Notas guardadas.",
        detalle: `${nuevas} ${nuevas === 1 ? "nota nueva" : "notas nuevas"} y ${modificadas} ${modificadas === 1 ? "cambio" : "cambios"}. Puedes volver luego para completar el registro.`,
      });
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "VALOR_NO_PERMITIDO") {
        const celdas = (e.detalles.celdas ?? []) as { matriculaId: string; competenciaPlanId: string }[];
        setInvalidas(new Set(celdas.map((c) => claveCelda(c.matriculaId, c.competenciaPlanId))));
      }
      if (e instanceof ApiError && (e.codigo === "REGISTRO_CERRADO" || e.codigo === "PERIODO_NO_ACTIVO")) {
        // el registro cambió de estado (otra pestaña o el fin del bimestre): se vuelve a cargar en solo lectura
        setPropio(null);
        consulta.recargar();
        onCambio();
      }
      setMensaje({ tipo: "error", titulo: mensajeError(e), detalle: "El registro no se guardó." });
    } finally {
      setGuardando(false);
    }
  }

  async function cerrar() {
    setCerrando(true);
    try {
      const nuevo = await api<RegistroCerrado>(`/evaluacion/registros/${asignacionId}/bimestres/${bimestreId}/cerrar`, {
        method: "POST",
      });
      actualizar(nuevo);
      setModal(null);
      const { administradores, enviados } = nuevo.aviso;
      setMensaje({
        tipo: "exito",
        titulo: "Registro cerrado.",
        detalle:
          `Se calculó el logro consolidado de ${nuevo.alumnos.length} estudiantes con la regla vigente. ` +
          (enviados > 0
            ? `Se avisó por correo a ${enviados} de ${administradores} ${administradores === 1 ? "administrador" : "administradores"}.`
            : "No se pudo enviar el aviso por correo a la administración; el registro quedó cerrado igualmente."),
      });
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "NOTAS_INCOMPLETAS") {
        setModal({ pendientes: (e.detalles.pendientes ?? []) as Pendiente[], error: null });
      } else {
        setModal({ pendientes: null, error: mensajeError(e) });
        if (e instanceof ApiError && e.codigo === "REGISTRO_CERRADO") {
          setPropio(null);
          consulta.recargar();
          onCambio();
        }
      }
    } finally {
      setCerrando(false);
    }
  }

  function solicitudEnviada({ solicitud, aviso }: SolicitudCreada) {
    setRectificando(false);
    mias.recargar();
    setMensaje({
      tipo: "exito",
      titulo: "Solicitud de rectificación enviada.",
      detalle:
        `La nota de ${solicitud.estudiante} en ${solicitud.competencia.columna} quedó «${solicitud.nombreEstado}». ` +
        (aviso.enviados > 0
          ? `Se avisó por correo a ${aviso.enviados} de ${aviso.destinatarios} ${aviso.destinatarios === 1 ? "administrador" : "administradores"}.`
          : "No se pudo enviar el aviso por correo; la solicitud quedó registrada igualmente."),
    });
  }

  const cerrado = r.estado !== "ABIERTO";
  const regla = r.regla ? `${r.regla.nombre} · versión ${r.regla.version}` : null;
  const solicitudes =
    mias.carga.fase === "listo"
      ? mias.carga.datos.filter((s) => s.asignacionId === asignacionId && s.periodoId === bimestreId)
      : [];
  const pendientes = new Set(
    solicitudes.filter((s) => s.pendiente).map((s) => claveNota(s.matriculaId, s.competencia.competenciaPlanId)),
  );
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[22px] font-bold leading-[1.25] text-texto">
            {r.curso.nombre} {r.seccion.etiqueta}
          </h2>
          <p className="text-[14px] leading-[1.5] text-texto-2">
            {rangoBimestre(r.bimestre)} · Califica cada competencia solo con la escala AD, A, B o C.
          </p>
          {regla && (
            <p className="text-[13px] leading-[1.5] text-texto-3">
              {cerrado ? "Consolidado con" : "Regla de consolidación del bimestre"}: {regla}
            </p>
          )}
        </div>
        {r.editable && r.alumnos.length > 0 && (
          <Boton variante="secundario" icono="icon-lock" onClick={() => setModal({ pendientes: null, error: null })}>
            Cerrar registro del bimestre
          </Boton>
        )}
        {cerrado && <Badge tono="gris">{r.estado === "PUBLICADO" ? "Publicado" : "Cerrado"}</Badge>}
      </div>

      {mensaje && (
        <Alerta
          tipo={mensaje.tipo}
          titulo={mensaje.titulo}
          icono={mensaje.tipo === "exito" ? "icon-check-verde" : undefined}
        >
          {mensaje.detalle}
        </Alerta>
      )}
      {r.motivoSoloLectura === "REGISTRO_CERRADO" && (
        <Alerta tipo="info" titulo={r.mensaje ?? undefined}>
          {r.cerradoEn && `Registro cerrado el ${diaYHora(r.cerradoEn)}${r.cerradoPor ? ` por ${r.cerradoPor}` : ""}. `}
          {r.correccion}
          {r.alumnos.length > 0 && (
            <div className="mt-3">
              <Boton variante="secundario" icono="icon-comentario" onClick={() => setRectificando(true)}>
                Solicitar rectificación
              </Boton>
            </div>
          )}
        </Alerta>
      )}
      {r.motivoSoloLectura === "PERIODO_NO_ACTIVO" && (
        <Alerta tipo="aviso" titulo={r.mensaje ?? undefined}>
          El registro se muestra en solo lectura. Solo se califica dentro de las fechas del bimestre en curso.
        </Alerta>
      )}

      <Tarjeta className="flex flex-col gap-5 p-4 lg:p-6">
        <LeyendaLogros />
        {r.alumnos.length === 0 ? (
          <AsistenciaVacia titulo="No hay estudiantes con matrícula vigente en esta sección." icono="nav-award-azul">
            Cuando la sección tenga estudiantes matriculados aparecerán aquí para calificarlos.
          </AsistenciaVacia>
        ) : (
          <GrillaNotas
            registro={r}
            ediciones={ediciones}
            invalidas={invalidas}
            onCambiar={cambiar}
            onEvidencias={setEvidencias}
          />
        )}
        {r.alumnos.length > 0 && (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <AvanceRegistro avance={r.avance} />
            {r.editable && (
              <Boton icono="check-blanco" cargando={guardando} disabled={cambios.length === 0} onClick={guardar}>
                Guardar cambios
              </Boton>
            )}
          </div>
        )}
        {mias.carga.fase === "error" && (
          <Alerta tipo="error" titulo="No pudimos cargar tus solicitudes de rectificación">
            {mias.carga.mensaje}{" "}
            <button type="button" onClick={mias.reintentar} className="font-semibold text-kubo-azul underline">
              Reintentar
            </button>
          </Alerta>
        )}
        <SolicitudesDelRegistro solicitudes={solicitudes} />
      </Tarjeta>

      {evidencias && (
        <ModalEvidencias
          key={`${evidencias.matriculaId}-${evidencias.competenciaPlanId ?? "alumno"}`}
          registro={r}
          celda={evidencias}
          onCerrar={() => setEvidencias(null)}
          onCambio={conEvidencias}
        />
      )}
      {rectificando && (
        <ModalSolicitarRectificacion
          registro={r}
          pendientes={pendientes}
          onCerrar={() => setRectificando(false)}
          onEnviada={solicitudEnviada}
        />
      )}
      {modal && (
        <ModalCerrarRegistro
          registro={r}
          pendientes={modal.pendientes ?? r.pendientes}
          cambiosSinGuardar={cambios.length > 0}
          cerrando={cerrando}
          error={modal.error}
          onConfirmar={cerrar}
          onCerrar={() => setModal(null)}
        />
      )}
    </>
  );
}

export default function RegistroDeNotasPage() {
  const mis = useConsulta<MisRegistros>("/evaluacion/registros");
  const [cursoElegido, setCursoElegido] = useState<string | null>(null);
  const [bimestreElegido, setBimestreElegido] = useState<string | null>(null);

  const datos = mis.carga.fase === "listo" ? mis.carga.datos : null;
  const curso = datos?.cursos.find((c) => c.asignacionId === cursoElegido) ?? datos?.cursos[0];
  const bimestreId = bimestreElegido ?? (datos ? bimestrePorDefecto(datos) : null);
  const activo = datos?.bimestres.find((b) => b.id === datos.bimestreActivoId);

  return (
    <>
      <EncabezadoPagina
        titulo="Registro de notas"
        descripcion={
          datos?.anio
            ? `Año ${datos.anio.anio}${activo ? ` · ${activo.nombre} en curso` : " · ningún bimestre en curso hoy"}`
            : "Califica a tus estudiantes por competencias con la escala AD, A, B o C."
        }
      />

      {mis.carga.fase === "cargando" && <CargandoAsistencia />}
      {mis.carga.fase === "error" && <ErrorAsistencia mensaje={mis.carga.mensaje} onReintentar={mis.reintentar} />}
      {datos && (!datos.anio || datos.cursos.length === 0) && (
        <AsistenciaVacia titulo="Aún no tienes cursos asignados." icono="nav-award-azul">
          Cuando la administración te asigne cursos y secciones podrás registrar sus notas aquí.
        </AsistenciaVacia>
      )}

      {datos && curso && bimestreId && (
        <>
          <Tarjeta className="flex flex-col gap-4 p-4 lg:p-5">
            <label className="flex max-w-[360px] flex-col gap-1.5 text-[14px] font-medium text-texto-2">
              Curso y sección
              <select
                value={curso.asignacionId}
                onChange={(e) => setCursoElegido(e.target.value)}
                className="h-11 w-full rounded-lg border border-borde bg-white px-3 text-[16px] font-normal text-texto outline-none focus:border-kubo-azul"
              >
                {datos.cursos.map((c) => (
                  <option key={c.asignacionId} value={c.asignacionId}>
                    {c.curso.nombre} · {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <div
              role="tablist"
              aria-label="Bimestres"
              className="-mx-1 flex gap-1 overflow-x-auto border-b border-borde px-1"
            >
              {datos.bimestres.map((b) => {
                const elegido = b.id === bimestreId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="tab"
                    aria-selected={elegido}
                    onClick={() => setBimestreElegido(b.id)}
                    className={`shrink-0 border-b-2 px-3 py-2.5 text-[14px] whitespace-nowrap ${
                      elegido
                        ? "border-kubo-azul font-semibold text-kubo-azul"
                        : "border-transparent text-texto-2 hover:text-texto"
                    }`}
                  >
                    <span className="sm:hidden">Bim. {NUMERAL[b.numero - 1]}</span>
                    <span className="hidden sm:inline">{b.nombre}</span> · {estadoDePestana(curso, b)}
                  </button>
                );
              })}
            </div>
          </Tarjeta>

          <section
            className="flex flex-col gap-4"
            aria-label={`Registro de notas de ${curso.curso.nombre} ${curso.etiqueta}`}
          >
            <RegistroDelBimestre
              key={`${curso.asignacionId}-${bimestreId}`}
              asignacionId={curso.asignacionId}
              bimestreId={bimestreId}
              onCambio={mis.recargar}
            />
          </section>
        </>
      )}
    </>
  );
}
