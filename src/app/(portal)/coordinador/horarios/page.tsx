// AD-13 · Matriz de horarios (US27, US28, US29, US30, US31; RF22, RF23, RF24)
"use client";

import { useEffect, useState } from "react";
import { anioPorDefecto, type AnioAcademico } from "@/components/admin/anio";
import { Selector, type Aula, type Seccion } from "@/components/admin/grados";
import {
  AlertaPendientes,
  AvanceBloques,
  BadgeVersion,
  CuadriculaHorario,
  ModalClase,
  ModalPublicar,
  PanelCursos,
  PanelValidaciones,
  type Celda,
  type Cuadricula,
  type CuadriculaPublicada,
} from "@/components/admin/horarios";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api, type ApiError } from "@/lib/api";
import type { DetallesRechazo } from "@/lib/horarios";

type Carga<T> = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "lista"; datos: T };

interface DatosAnio {
  secciones: Seccion[];
  aulas: Aula[];
}

const SEGUNDOS_AVISO = 6;

export default function HorariosPage() {
  const [anios, setAnios] = useState<Carga<AnioAcademico[]>>({ fase: "cargando" });
  const [anioElegido, setAnioElegido] = useState<string | null>(null);
  const [delAnio, setDelAnio] = useState<{ anioId: string; carga: Carga<DatosAnio> } | null>(null);
  const [gradoElegido, setGradoElegido] = useState<string | null>(null);
  const [seccionElegida, setSeccionElegida] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const lista = await api<AnioAcademico[]>("/academico/anios");
        if (vigente) setAnios({ fase: "lista", datos: lista });
      } catch (e) {
        if (vigente) setAnios({ fase: "error", mensaje: alertaError(e) });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, []);

  const lista = anios.fase === "lista" ? anios.datos : [];
  const anio = lista.find((a) => a.id === anioElegido) ?? anioPorDefecto(lista);
  const anioId = anio?.id;

  useEffect(() => {
    if (!anioId) return;
    let vigente = true;
    async function cargar() {
      try {
        const [secciones, aulas] = await Promise.all([
          api<Seccion[]>(`/academico/secciones?anioId=${anioId}`),
          api<Aula[]>(`/academico/aulas?anioId=${anioId}`),
        ]);
        if (vigente) setDelAnio({ anioId: anioId!, carga: { fase: "lista", datos: { secciones, aulas } } });
      } catch (e) {
        if (vigente) setDelAnio({ anioId: anioId!, carga: { fase: "error", mensaje: alertaError(e) } });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [anioId, recarga]);

  const carga: Carga<DatosAnio> = delAnio?.anioId === anioId && delAnio ? delAnio.carga : { fase: "cargando" };
  const secciones = carga.fase === "lista" ? carga.datos.secciones : [];
  const grados = secciones.map((s) => s.grado).filter((g, i, todos) => todos.findIndex((x) => x.id === g.id) === i);
  const grado = grados.find((g) => g.id === gradoElegido) ?? grados[0];
  const delGrado = secciones.filter((s) => s.grado.id === grado?.id);
  const seccion = delGrado.find((s) => s.id === seccionElegida) ?? delGrado[0];

  return (
    <>
      <div className="flex min-w-[280px] flex-col gap-1.5">
        <p className="text-[14px] leading-[1.4] whitespace-pre text-texto-3">Académico / Horarios</p>
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Matriz de horarios</h1>
        <p className="max-w-[760px] text-[16px] leading-[1.5] text-texto-2">
          Construye manualmente el horario semanal de cada sección. El sistema valida al guardar los cruces de docentes
          y de aulas.
        </p>
      </div>

      {anios.fase === "error" && (
        <Alerta tipo="error" titulo="No pudimos cargar los años académicos">
          {anios.mensaje}
        </Alerta>
      )}
      {anios.fase === "lista" && lista.length === 0 && (
        <Vacio titulo="Aún no hay años académicos">
          Registra el año en «Año y bimestres» y sus secciones en «Grados, secciones y aulas».
        </Vacio>
      )}

      {anio && (
        <Tarjeta className="flex flex-wrap items-end gap-4 p-5">
          <div className="w-[150px]">
            <Selector etiqueta="Año académico" valor={anio.id} onCambiar={setAnioElegido}>
              {lista.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.anio}
                </option>
              ))}
            </Selector>
          </div>
          <div className="w-[190px]">
            <Selector
              etiqueta="Grado"
              valor={grado?.id ?? ""}
              onCambiar={setGradoElegido}
              deshabilitado={grados.length === 0}
            >
              {grados.length === 0 && <option value="">Sin grados</option>}
              {grados.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Selector>
          </div>
          <div className="w-[190px]">
            <Selector
              etiqueta="Sección"
              valor={seccion?.id ?? ""}
              onCambiar={setSeccionElegida}
              deshabilitado={delGrado.length === 0}
            >
              {delGrado.length === 0 && <option value="">Sin secciones</option>}
              {delGrado.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.grado.numero}° {s.nombre}
                  {s.estado === "INACTIVA" ? " (inactiva)" : ""}
                </option>
              ))}
            </Selector>
          </div>
        </Tarjeta>
      )}

      {(anios.fase === "cargando" || (anioId && carga.fase === "cargando")) && (
        <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando las secciones…
        </Tarjeta>
      )}
      {carga.fase === "error" && (
        <Alerta tipo="error" titulo="No pudimos cargar las secciones del año">
          {carga.mensaje}{" "}
          <button
            type="button"
            onClick={() => setRecarga((n) => n + 1)}
            className="font-semibold text-kubo-azul hover:underline"
          >
            Reintentar
          </button>
        </Alerta>
      )}
      {carga.fase === "lista" && secciones.length === 0 && (
        <Vacio titulo={`El año ${anio?.anio} aún no tiene secciones`}>
          Crea las secciones en «Grados, secciones y aulas» para armar sus horarios.
        </Vacio>
      )}
      {carga.fase === "lista" && seccion && (
        <EditorHorario key={seccion.id} seccionId={seccion.id} aulas={carga.datos.aulas} />
      )}
    </>
  );
}

function Vacio({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Tarjeta className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Icono nombre="nav-grid-gris" size={28} />
      <p className="text-[16px] font-semibold text-texto">{titulo}</p>
      <p className="max-w-[420px] text-[14px] leading-[1.4] text-texto-2">{children}</p>
    </Tarjeta>
  );
}

interface Rechazo {
  mensaje: string;
  detalles: DetallesRechazo;
}

/** Cuadrícula de una sección con su versión, sus avisos y sus modales. Al cambiar de sección, el padre cambia la key. */
function EditorHorario({ seccionId, aulas }: { seccionId: string; aulas: Aula[] }) {
  const [version, setVersion] = useState<number | null>(null);
  const [estado, setEstado] = useState<{ clave: string; carga: Carga<Cuadricula> } | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [celda, setCelda] = useState<Celda | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState<Rechazo | null>(null);
  const clave = `${version ?? "vigente"}-${recarga}`;

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const consulta = version === null ? "" : `?version=${version}`;
        const datos = await api<Cuadricula>(`/horarios/secciones/${seccionId}${consulta}`);
        if (vigente) setEstado({ clave, carga: { fase: "lista", datos } });
      } catch (e) {
        if (vigente) setEstado({ clave, carga: { fase: "error", mensaje: alertaError(e) } });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [seccionId, version, clave]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), SEGUNDOS_AVISO * 1000);
    return () => clearTimeout(t);
  }, [aviso]);

  /** Muestra la cuadrícula que devolvió una operación (queda en la versión vigente). */
  function mostrar(nueva: Cuadricula, mensaje: string) {
    setVersion(null);
    setEstado({ clave: `vigente-${recarga}`, carga: { fase: "lista", datos: nueva } });
    setCelda(null);
    setPublicando(false);
    setRechazo(null);
    setError(null);
    setAviso(mensaje);
  }

  async function abrirBorrador() {
    setAbriendo(true);
    setError(null);
    try {
      const nueva = await api<Cuadricula>(`/horarios/secciones/${seccionId}/borrador`, { method: "POST" });
      mostrar(nueva, `Se abrió el borrador (versión ${nueva.horario?.version}) a partir del horario publicado.`);
    } catch (e) {
      setError(alertaError(e));
    }
    setAbriendo(false);
  }

  function publicado(nueva: CuadriculaPublicada) {
    const { docentes, enviados } = nueva.aviso;
    const correos = docentes === 0 ? "" : ` Se avisó por correo a ${enviados} de ${docentes} docentes.`;
    mostrar(nueva, `Horario publicado (versión ${nueva.horario?.version}).${correos}`);
  }

  function rechazado(e: ApiError) {
    setPublicando(false);
    setRechazo({ mensaje: e.message, detalles: e.detalles as DetallesRechazo });
  }

  const carga: Carga<Cuadricula> = estado?.clave === clave ? estado.carga : { fase: "cargando" };
  if (carga.fase === "cargando") {
    return (
      <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
        <Spinner claro={false} /> Cargando el horario…
      </Tarjeta>
    );
  }
  if (carga.fase === "error") {
    return (
      <Alerta tipo="error" titulo="No pudimos cargar el horario de la sección">
        {carga.mensaje}{" "}
        <button
          type="button"
          onClick={() => setRecarga((n) => n + 1)}
          className="font-semibold text-kubo-azul hover:underline"
        >
          Reintentar
        </button>
      </Alerta>
    );
  }

  const c = carga.datos;
  const estadoHorario = c.horario?.estado ?? null;
  const publicada = c.versiones.find((v) => v.estado === "PUBLICADO");
  const enEdicion = c.editable && (estadoHorario === null || estadoHorario === "BORRADOR");
  const puedeAbrirBorrador = c.editable && estadoHorario === "PUBLICADO" && !c.hayBorrador;

  return (
    <>
      <Tarjeta className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5">
        <BadgeVersion horario={c.horario} />
        <AvanceBloques avance={c.avance} />
        <div className="flex-1" />
        {c.versiones.length > 1 && (
          <div className="w-[240px]">
            <Selector
              etiqueta="Versión"
              oculto
              valor={version === null ? "" : String(version)}
              onCambiar={(v) => setVersion(v ? Number(v) : null)}
            >
              <option value="">Versión vigente</option>
              {c.versiones.map((v) => (
                <option key={v.id} value={v.version}>
                  Versión {v.version} · {v.estado.charAt(0) + v.estado.slice(1).toLowerCase()}
                </option>
              ))}
            </Selector>
          </div>
        )}
        {puedeAbrirBorrador && (
          <Boton variante="secundario" icono="act-edit" onClick={abrirBorrador} cargando={abriendo}>
            Editar horario
          </Boton>
        )}
        {c.editable && estadoHorario === "BORRADOR" && (
          <Boton icono="icon-send" onClick={() => setPublicando(true)}>
            {publicada ? "Publicar nueva versión" : "Publicar"}
          </Boton>
        )}
      </Tarjeta>

      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      {error && <Alerta tipo="error" titulo={error} />}
      {rechazo && <AlertaPendientes mensaje={rechazo.mensaje} detalles={rechazo.detalles} />}
      {c.motivoSoloLectura && (
        <Alerta tipo="aviso" titulo={c.motivoSoloLectura}>
          El horario se muestra solo para consulta.
        </Alerta>
      )}
      {c.editable && estadoHorario === "ARCHIVADO" && (
        <Alerta tipo="info" titulo={`Versión ${c.horario?.version} archivada: solo lectura`}>
          <button
            type="button"
            onClick={() => setVersion(null)}
            className="font-semibold text-kubo-azul hover:underline"
          >
            Volver a la versión vigente
          </button>
        </Alerta>
      )}
      {c.editable && estadoHorario === "PUBLICADO" && c.hayBorrador && (
        <Alerta tipo="info" titulo="Esta es la versión publicada. Hay un borrador en edición.">
          <button
            type="button"
            onClick={() => setVersion(null)}
            className="font-semibold text-kubo-azul hover:underline"
          >
            Ir al borrador
          </button>
        </Alerta>
      )}
      {puedeAbrirBorrador && (
        <Alerta tipo="info" titulo="Este horario está publicado">
          Para cambiarlo pulsa «Editar horario»: se crea un borrador con las mismas clases, que no se ve en los portales
          hasta que lo publiques.
        </Alerta>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_300px]">
        <CuadriculaHorario cuadricula={c} onElegir={enEdicion ? setCelda : undefined} />
        <div className="flex flex-col gap-6">
          <PanelValidaciones cuadricula={c} />
          <PanelCursos cuadricula={c} />
          {enEdicion && (
            <p className="flex items-start gap-2 text-[13px] leading-[1.4] text-texto-3">
              <span className="mt-0.5 shrink-0">
                <Icono nombre="icon-info" size={14} />
              </span>
              Haz clic en un bloque para asignar curso, docente y aula. Los cambios quedan en el borrador hasta que
              publiques el horario.
            </p>
          )}
        </div>
      </div>

      {celda && (
        <ModalClase
          key={`${celda.dia}-${celda.bloque.id}`}
          cuadricula={c}
          celda={celda}
          aulas={aulas}
          onCerrar={() => setCelda(null)}
          onGuardado={mostrar}
        />
      )}
      {publicando && (
        <ModalPublicar
          cuadricula={c}
          onCerrar={() => setPublicando(false)}
          onPublicado={publicado}
          onRechazado={rechazado}
        />
      )}
    </>
  );
}
