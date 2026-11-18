// AD-15 · Notas y rectificaciones · pestaña «Solicitudes de rectificación» (US41, criterios 2 y 3): bandeja del
// Administrador con las solicitudes pendientes (aprobar o rechazar con motivo obligatorio) y las ya resueltas. Una
// solicitud propia (usuario con perfil de Docente y de Administrador) no se puede resolver.
"use client";

import { useEffect, useState } from "react";
import { alertaError } from "@/components/admin/PortalAdmin";
import {
  BadgeEstadoSolicitud,
  CambioSolicitado,
  LARGO_MAXIMO_MOTIVO,
  type SolicitudRectificacion,
} from "@/components/docente/rectificaciones";
import { Alerta, Badge, Boton, Modal, Spinner, Tarjeta } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { diaYHora, fechaDia, hoyEnLima } from "@/lib/formato";

interface Bandeja {
  items: SolicitudRectificacion[];
  pendientes: number;
  paginacion: { pagina: number; tamano: number; total: number; paginas: number };
}

interface SolicitudResuelta {
  solicitud: SolicitudRectificacion;
  consolidado: { anterior: "AD" | "A" | "B" | "C" | null; nuevo: "AD" | "A" | "B" | "C" } | null;
  aviso: { destinatarios: number; enviados: number };
}

type Vista = "PENDIENTES" | "RESUELTAS";

const TAMANO_PAGINA = 10;

/** «JP» de «Juan Pérez Salazar». */
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

/** «12/09/2026» en la hora de Lima. */
const fechaCorta = (iso: string) => fechaDia(hoyEnLima(new Date(iso)));

function avisoAlDocente(r: SolicitudResuelta) {
  if (r.aviso.destinatarios === 0) return "El docente no tiene correo registrado: no se le pudo avisar.";
  return r.aviso.enviados > 0
    ? "Se avisó por correo al docente."
    : "No se pudo enviar el aviso por correo al docente; la decisión quedó registrada igualmente.";
}

/** Bandeja de solicitudes. `onCambio` avisa a la página que cambió el número de pendientes. */
export function BandejaRectificaciones({ onCambio }: { onCambio: () => void }) {
  const [vista, setVista] = useState<Vista>("PENDIENTES");
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<{ clave: string; datos?: Bandeja; error?: string } | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; titulo: string; detalle?: string } | null>(null);
  const [aprobando, setAprobando] = useState<SolicitudRectificacion | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  const clave = `${vista}-${pagina}-${intento}`;
  useEffect(() => {
    let vigente = true;
    api<Bandeja>(`/evaluacion/rectificaciones?estado=${vista}&pagina=${pagina}&tamano=${TAMANO_PAGINA}`)
      .then((datos) => vigente && setEstado({ clave, datos }))
      .catch((e) => vigente && setEstado({ clave, error: alertaError(e) }));
    return () => {
      vigente = false;
    };
  }, [vista, pagina, clave]);
  const actual = estado?.clave === clave ? estado : null;

  function recargar() {
    setIntento((n) => n + 1);
    onCambio();
  }

  function fallo(e: unknown) {
    setMensaje({ tipo: "error", titulo: alertaError(e) });
    // otro administrador la resolvió antes o la nota cambió: se vuelve a cargar la bandeja
    if (e instanceof ApiError && ["SOLICITUD_YA_RESUELTA", "NOTA_CAMBIO", "NO_ENCONTRADO"].includes(e.codigo)) {
      recargar();
    }
  }

  async function aprobar(s: SolicitudRectificacion) {
    setProcesando(s.id);
    try {
      const r = await api<SolicitudResuelta>(`/evaluacion/rectificaciones/${s.id}/aprobar`, { method: "POST" });
      const consolidado = r.consolidado
        ? ` Logro del curso: ${r.consolidado.anterior ?? "—"} → ${r.consolidado.nuevo}.`
        : "";
      setMensaje({
        tipo: "exito",
        titulo: "Rectificación aprobada.",
        detalle:
          `La nota de ${s.estudiante} en ${s.competencia.columna} cambió de ${s.valorAnterior} a ${s.valorSolicitado} y ` +
          `quedó en la bitácora de notas.${consolidado} ${avisoAlDocente(r)}`,
      });
      setAprobando(null);
      recargar();
    } catch (e) {
      setAprobando(null);
      fallo(e);
    } finally {
      setProcesando(null);
    }
  }

  async function rechazar(s: SolicitudRectificacion, motivo: string) {
    setProcesando(s.id);
    try {
      const r = await api<SolicitudResuelta>(`/evaluacion/rectificaciones/${s.id}/rechazar`, {
        method: "POST",
        body: { motivo },
      });
      setMensaje({
        tipo: "exito",
        titulo: "Solicitud rechazada.",
        detalle: `La nota de ${s.estudiante} en ${s.competencia.columna} no cambió. ${avisoAlDocente(r)}`,
      });
      recargar();
    } catch (e) {
      fallo(e);
    } finally {
      setProcesando(null);
    }
  }

  const datos = actual?.datos;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Estado de las solicitudes">
        {(
          [
            ["PENDIENTES", `Pendientes${datos ? ` (${datos.pendientes})` : ""}`],
            ["RESUELTAS", "Resueltas"],
          ] as const
        ).map(([v, texto]) => (
          <button
            key={v}
            type="button"
            aria-pressed={vista === v}
            onClick={() => {
              setVista(v);
              setPagina(1);
              setMensaje(null);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-[14px] ${vista === v ? "border-kubo-azul bg-celeste/15 font-semibold text-kubo-azul" : "border-borde bg-white text-texto hover:bg-fondo"}`}
          >
            {texto}
          </button>
        ))}
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
      {!actual && (
        <div className="flex items-center gap-3 text-[14px] text-texto-2" role="status">
          <Spinner claro={false} /> Cargando las solicitudes…
        </div>
      )}
      {actual?.error && (
        <Alerta tipo="error" titulo="No pudimos cargar las solicitudes de rectificación">
          {actual.error}{" "}
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="font-semibold text-kubo-azul underline"
          >
            Reintentar
          </button>
        </Alerta>
      )}
      {datos && datos.items.length === 0 && (
        <p className="rounded-lg border border-borde bg-fondo px-4 py-8 text-center text-[14px] text-texto-2">
          {vista === "PENDIENTES"
            ? "No hay solicitudes de rectificación pendientes. Aparecen aquí cuando un docente pide corregir una nota de un registro cerrado."
            : "Aún no hay solicitudes de rectificación resueltas."}
        </p>
      )}
      {datos && datos.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {datos.items.map((s) => (
            <TarjetaSolicitud
              key={s.id}
              solicitud={s}
              procesando={procesando === s.id}
              onAprobar={() => setAprobando(s)}
              onRechazar={(motivo) => void rechazar(s, motivo)}
            />
          ))}
        </div>
      )}
      {datos && datos.paginacion.paginas > 1 && (
        <div className="flex items-center justify-end gap-3 text-[13px] text-texto-2">
          <Boton variante="secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Boton>
          {`Página ${datos.paginacion.pagina} de ${datos.paginacion.paginas}`}
          <Boton
            variante="secundario"
            disabled={pagina >= datos.paginacion.paginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </Boton>
        </div>
      )}

      {aprobando && (
        <Modal
          abierto
          onCerrar={() => procesando === null && setAprobando(null)}
          icono="icon-check-verde"
          tonoIcono="azul"
          titulo="Aprobar rectificación"
          subtitulo={`${aprobando.curso.nombre} ${aprobando.seccion} · ${aprobando.bimestre.nombre} ${aprobando.anio}`}
          pie={
            <>
              <Boton variante="secundario" disabled={procesando !== null} onClick={() => setAprobando(null)}>
                Cancelar
              </Boton>
              <Boton
                variante="exito"
                icono="check-blanco"
                cargando={procesando === aprobando.id}
                onClick={() => void aprobar(aprobando)}
              >
                Aprobar
              </Boton>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-[14px] leading-[1.5] text-texto-2">
            <p className="text-texto">
              {aprobando.estudiante} · {aprobando.competencia.columna} · {aprobando.competencia.nombre}
            </p>
            <CambioSolicitado de={aprobando.valorAnterior} a={aprobando.valorSolicitado} />
            <p>
              La nota se actualiza al valor solicitado, se recalcula el logro del curso del estudiante con la regla
              usada al cerrar el registro y el cambio queda en la bitácora de notas como «Rectificación aprobada».
              {aprobando.estadoRegistro === "PUBLICADO" &&
                " El registro ya está publicado: el apoderado y el alumno verán el valor corregido."}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TarjetaSolicitud({
  solicitud: s,
  procesando,
  onAprobar,
  onRechazar,
}: {
  solicitud: SolicitudRectificacion;
  procesando: boolean;
  onAprobar: () => void;
  onRechazar: (motivo: string) => void;
}) {
  const [comentario, setComentario] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const borde = s.pendiente ? "border-ambar" : "border-borde";

  function rechazar() {
    if (!comentario.trim()) {
      setFaltaMotivo(true);
      return;
    }
    onRechazar(comentario.trim());
  }

  return (
    <Tarjeta className={`flex flex-col gap-4 border-2 p-5 ${borde}`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-kubo-azul text-[13px] font-semibold text-white"
        >
          {iniciales(s.docente.nombre)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[15px] font-semibold text-texto">{s.docente.nombre}</p>
          <p className="text-[13px] text-texto-3">
            {`${s.curso.nombre} ${s.seccion} · ${s.bimestre.nombre} · ${fechaCorta(s.solicitadoEn)}`}
          </p>
        </div>
        <BadgeEstadoSolicitud solicitud={s} />
      </div>

      <dl className="grid grid-cols-1 gap-3 text-[14px] sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-texto-3">Estudiante</dt>
          <dd className="font-medium text-texto">{s.estudiante}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-texto-3">Registro</dt>
          <dd>
            <Badge tono={s.estadoRegistro === "PUBLICADO" ? "verde" : "celeste"} punto>
              {s.estadoRegistro === "PUBLICADO" ? "Publicado" : "Cerrado"}
            </Badge>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[13px] text-texto-3">Competencia</dt>
          <dd className="text-texto">{`${s.competencia.columna} · ${s.competencia.nombre}`}</dd>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <dt className="text-[13px] text-texto-3">Cambio solicitado</dt>
          <dd>
            <CambioSolicitado de={s.valorAnterior} a={s.valorSolicitado} />
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[13px] text-texto-3">Motivo</dt>
          <dd className="break-words text-texto">{s.motivo}</dd>
        </div>
        {!s.pendiente && (
          <div className="sm:col-span-2">
            <dt className="text-[13px] text-texto-3">
              {s.estado === "RECHAZADA" ? "Motivo del rechazo" : "Resolución"}
            </dt>
            <dd className="break-words text-texto">
              {s.estado === "RECHAZADA" && s.motivoRechazo ? `${s.motivoRechazo} ` : ""}
              <span className="text-[13px] text-texto-3">
                {`${s.estado === "APROBADA" ? "Aprobó" : "Resolvió"} ${s.resueltoPor ?? "la administración"}${s.resueltoEn ? ` el ${diaYHora(s.resueltoEn)}` : ""}`}
              </span>
            </dd>
          </div>
        )}
      </dl>

      {s.pendiente && s.esPropia && (
        <Alerta tipo="aviso" titulo="Es tu propia solicitud">
          La pediste con tu perfil de Docente: otro administrador debe aprobarla o rechazarla.
        </Alerta>
      )}
      {s.pendiente && !s.esPropia && (
        <>
          <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
            Comentario (obligatorio si rechazas)
            <textarea
              value={comentario}
              onChange={(e) => {
                setComentario(e.target.value);
                setFaltaMotivo(false);
              }}
              maxLength={LARGO_MAXIMO_MOTIVO}
              rows={2}
              placeholder="Escribe el motivo…"
              aria-invalid={faltaMotivo}
              className={`w-full rounded-lg border bg-white px-4 py-3 text-[15px] font-normal leading-[1.5] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul ${faltaMotivo ? "border-rojo" : "border-borde"}`}
            />
            {faltaMotivo && (
              <span className="text-[13px] font-normal text-rojo-oscuro">Escribe el motivo del rechazo.</span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Boton
              variante="secundario"
              icono="act-ban"
              disabled={procesando}
              onClick={rechazar}
              className="text-rojo-oscuro! ring-rojo!"
            >
              Rechazar
            </Boton>
            <Boton variante="exito" icono="check-blanco" cargando={procesando} onClick={onAprobar}>
              Aprobar
            </Boton>
          </div>
          <p className="text-[12px] text-texto-3">
            Al aprobar, la nota se actualiza y se registra en la bitácora como «Rectificación aprobada».
          </p>
        </>
      )}
    </Tarjeta>
  );
}
