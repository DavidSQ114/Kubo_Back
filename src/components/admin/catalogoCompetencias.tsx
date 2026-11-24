// AD-04 · Cursos y competencias, pestaña «Catálogo oficial» (US56): competencias del CNEB por área, con su uso en
// planes de estudios y calificaciones. Registrar una nueva, editar nombre o descripción, desactivar o activar y
// eliminar la que no se usa; cada cambio queda en la bitácora de auditoría.
"use client";

import { useEffect, useState } from "react";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Campo, Icono, Modal, Spinner, Tarjeta } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface CompetenciaDelCatalogo {
  id: string;
  areaCurricularId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  uso: { planes: number; notas: number };
  eliminable: boolean;
}

interface AreaDelCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  competencias: CompetenciaDelCatalogo[];
}

type Carga = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "lista"; areas: AreaDelCatalogo[] };

const LARGO_MAXIMO_DESCRIPCION = 1000;
const CLASE_TEXTO =
  "w-full rounded-lg border border-borde bg-white px-4 py-3 text-[15px] font-normal leading-[1.5] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul";

const usoLegible = (c: CompetenciaDelCatalogo) =>
  c.uso.planes === 0
    ? "Sin planes de estudios"
    : `${c.uso.planes} ${c.uso.planes === 1 ? "plan" : "planes"} · ${c.uso.notas ? `${c.uso.notas} notas` : "sin notas"}`;

/** Formulario «Nueva competencia» (US56, criterio 1): área, código único, nombre y descripción. */
function FormularioCompetencia({ areas, onGuardada }: { areas: AreaDelCatalogo[]; onGuardada: (m: string) => void }) {
  const [datos, setDatos] = useState({ areaCurricularId: "", codigo: "", nombre: "", descripcion: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completo = datos.areaCurricularId && datos.codigo.trim() && datos.nombre.trim();

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const c = await api<CompetenciaDelCatalogo>("/academico/competencias", {
        method: "POST",
        body: { ...datos, descripcion: datos.descripcion.trim() || null },
      });
      setDatos({ areaCurricularId: datos.areaCurricularId, codigo: "", nombre: "", descripcion: "" });
      onGuardada(`Competencia ${c.codigo} registrada: ya se puede asociar a los cursos de su área.`);
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Registrar nueva competencia</h2>
        <p className="text-[14px] leading-[1.4] text-texto-3">
          Cuando el Ministerio publica una competencia nueva, regístrala en su área curricular.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.8fr] xl:grid-cols-1">
        <Selector
          etiqueta="Área curricular"
          obligatorio
          valor={datos.areaCurricularId}
          onCambiar={(areaCurricularId) => setDatos((d) => ({ ...d, areaCurricularId }))}
        >
          <option value="">Selecciona el área</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </Selector>
        <Campo
          etiqueta="Código"
          obligatorio
          placeholder="MAT-C5"
          maxLength={15}
          value={datos.codigo}
          onChange={(e) => setDatos((d) => ({ ...d, codigo: e.target.value }))}
        />
      </div>
      <Campo
        etiqueta="Nombre de la competencia"
        obligatorio
        maxLength={200}
        value={datos.nombre}
        onChange={(e) => setDatos((d) => ({ ...d, nombre: e.target.value }))}
      />
      <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
        Descripción
        <textarea
          rows={3}
          maxLength={LARGO_MAXIMO_DESCRIPCION}
          value={datos.descripcion}
          onChange={(e) => setDatos((d) => ({ ...d, descripcion: e.target.value }))}
          className={CLASE_TEXTO}
        />
      </label>
      {error && <Alerta tipo="error" titulo={error} />}
      <div className="flex justify-end">
        <Boton icono="check-blanco" onClick={guardar} cargando={guardando} disabled={!completo}>
          Guardar
        </Boton>
      </div>
    </Tarjeta>
  );
}

/** Editar nombre y descripción (US56, criterio 3: el valor anterior y el nuevo quedan en la bitácora). */
function ModalEditar({
  competencia,
  onCerrar,
  onGuardada,
}: {
  competencia: CompetenciaDelCatalogo;
  onCerrar: () => void;
  onGuardada: (m: string) => void;
}) {
  const [nombre, setNombre] = useState(competencia.nombre);
  const [descripcion, setDescripcion] = useState(competencia.descripcion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await api(`/academico/competencias/${competencia.id}`, {
        method: "PATCH",
        body: { nombre: nombre.trim(), descripcion: descripcion.trim() || null },
      });
      onGuardada(`Competencia ${competencia.codigo} actualizada. El cambio quedó en la bitácora.`);
    } catch (e) {
      setError(alertaError(e));
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="act-edit"
      tonoIcono="azul"
      titulo={`Editar ${competencia.codigo}`}
      subtitulo="El código y el área no cambian: las notas registradas siguen asociadas a esta competencia."
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton icono="check-blanco" onClick={guardar} cargando={guardando} disabled={!nombre.trim()}>
            Guardar cambios
          </Boton>
        </>
      }
    >
      <Campo etiqueta="Nombre" obligatorio maxLength={200} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
        Descripción
        <textarea
          rows={4}
          maxLength={LARGO_MAXIMO_DESCRIPCION}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className={CLASE_TEXTO}
        />
      </label>
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}

/** Confirmar la eliminación. Si la competencia está en uso, el servidor lo impide y se ofrece desactivarla. */
function ModalEliminar({
  competencia,
  onCerrar,
  onListo,
  onDesactivar,
}: {
  competencia: CompetenciaDelCatalogo;
  onCerrar: () => void;
  onListo: (m: string) => void;
  onDesactivar: () => void;
}) {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; enUso: boolean } | null>(null);

  async function eliminar() {
    setEliminando(true);
    setError(null);
    try {
      await api(`/academico/competencias/${competencia.id}`, { method: "DELETE" });
      onListo(`Competencia ${competencia.codigo} eliminada del catálogo.`);
    } catch (e) {
      const enUso =
        e instanceof ApiError && (e.codigo === "COMPETENCIA_CON_CALIFICACIONES" || e.codigo === "COMPETENCIA_EN_PLAN");
      setError({ mensaje: alertaError(e), enUso });
      setEliminando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="act-trash"
      titulo={`Eliminar ${competencia.codigo}`}
      subtitulo={competencia.nombre}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={eliminando}>
            Cancelar
          </Boton>
          {error?.enUso ? (
            competencia.activo && (
              <Boton icono="icon-ban-blanco" onClick={onDesactivar}>
                Desactivar en su lugar
              </Boton>
            )
          ) : (
            <Boton variante="peligro" onClick={eliminar} cargando={eliminando}>
              Eliminar
            </Boton>
          )}
        </>
      }
    >
      <p className="text-[15px] leading-[1.5] text-texto-2">
        Solo se elimina una competencia que no está en ningún plan de estudios ni tiene calificaciones. Uso actual:{" "}
        {usoLegible(competencia)}.
      </p>
      {error && <Alerta tipo="error" titulo={error.mensaje} />}
    </Modal>
  );
}

function FilaCompetencia({
  competencia: c,
  ocupada,
  onEditar,
  onCambiarEstado,
  onEliminar,
}: {
  competencia: CompetenciaDelCatalogo;
  ocupada: boolean;
  onEditar: () => void;
  onCambiarEstado: () => void;
  onEliminar: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 border-b border-borde py-3 last:border-b-0">
      <div className="flex flex-wrap items-start gap-2">
        <span className="w-[72px] shrink-0 text-[13px] font-bold text-texto-3">{c.codigo}</span>
        <span className={`min-w-0 flex-1 text-[14px] leading-[1.4] ${c.activo ? "text-texto" : "text-texto-3"}`}>
          {c.nombre}
        </span>
        {!c.activo && <Badge tono="gris">Desactivada</Badge>}
      </div>
      {c.descripcion && <p className="pl-[80px] text-[13px] leading-[1.5] text-texto-2">{c.descripcion}</p>}
      <div className="flex flex-wrap items-center gap-2 pl-[80px]">
        <span className="flex-1 text-[12px] text-texto-3">{usoLegible(c)}</span>
        <button
          type="button"
          onClick={onEditar}
          className="rounded-md px-2 py-1 text-[13px] font-semibold text-kubo-azul hover:bg-fondo"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onCambiarEstado}
          disabled={ocupada}
          className="rounded-md px-2 py-1 text-[13px] font-semibold text-kubo-azul hover:bg-fondo disabled:text-texto-3"
        >
          {c.activo ? "Desactivar" : "Activar"}
        </button>
        <button
          type="button"
          onClick={onEliminar}
          className="rounded-md px-2 py-1 text-[13px] font-semibold text-rojo hover:bg-fondo"
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}

/** Pestaña «Catálogo oficial». `onCambio` avisa a la página para que recargue las áreas de la malla. */
export function CatalogoOficial({ onCambio }: { onCambio: () => void }) {
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [aEditar, setAEditar] = useState<CompetenciaDelCatalogo | null>(null);
  const [aEliminar, setAEliminar] = useState<CompetenciaDelCatalogo | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let vigente = true;
    api<AreaDelCatalogo[]>("/academico/competencias")
      .then((areas) => vigente && setCarga({ fase: "lista", areas }))
      .catch((e) => vigente && setCarga({ fase: "error", mensaje: alertaError(e) }));
    return () => {
      vigente = false;
    };
  }, [recarga]);

  function listo(mensaje: string) {
    setAviso(mensaje);
    setAlerta(null);
    setAEditar(null);
    setAEliminar(null);
    setRecarga((n) => n + 1);
    onCambio();
  }

  async function cambiarEstado(c: CompetenciaDelCatalogo) {
    setOcupada(c.id);
    setAviso(null);
    setAlerta(null);
    try {
      await api(`/academico/competencias/${c.id}`, { method: "PATCH", body: { activo: !c.activo } });
      listo(
        c.activo
          ? `${c.codigo} quedó desactivada: ya no se asocia a cursos nuevos; los planes que la tienen la conservan.`
          : `${c.codigo} quedó activa.`,
      );
    } catch (e) {
      setAlerta(alertaError(e));
    } finally {
      setOcupada(null);
    }
  }

  if (carga.fase === "cargando") {
    return (
      <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
        <Spinner claro={false} /> Cargando el catálogo…
      </Tarjeta>
    );
  }
  if (carga.fase === "error") {
    return (
      <Alerta tipo="error" titulo="No pudimos cargar el catálogo">
        {carga.mensaje}
      </Alerta>
    );
  }

  const texto = busqueda.trim().toLowerCase();
  const coincide = (c: CompetenciaDelCatalogo) =>
    !texto || c.nombre.toLowerCase().includes(texto) || c.codigo.toLowerCase().includes(texto);

  return (
    <div className="flex flex-col gap-4">
      <Alerta tipo="info" titulo="Competencias del Currículo Nacional de la Educación Básica (CNEB)">
        Son las mismas para todos los colegios. Cada curso evalúa solo competencias de su área curricular (RF09). Una
        competencia en uso no se elimina: se desactiva, y los planes que ya la tienen la conservan.
      </Alerta>
      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      {alerta && <Alerta tipo="error" titulo={alerta} />}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 rounded-lg border border-borde bg-white px-4 py-3 focus-within:border-kubo-azul">
            <Icono nombre="icon-search" size={18} />
            <input
              aria-label="Buscar competencia o código"
              placeholder="Buscar competencia o código"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-texto-3"
            />
          </label>
          {carga.areas.map((a) => {
            const visibles = a.competencias.filter(coincide);
            if (texto && !visibles.length) return null;
            return (
              <Tarjeta key={a.id} className="flex flex-col gap-2 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-fondo text-[11px] font-bold tracking-[0.4px] text-texto-2">
                    {a.codigo.slice(0, 5)}
                  </span>
                  <h3 className="flex-1 text-[16px] font-semibold text-texto">{a.nombre}</h3>
                  <span className="text-[12px] text-texto-3">{a.competencias.length} comp.</span>
                </div>
                {visibles.length === 0 ? (
                  <p className="py-2 text-[14px] text-texto-3">Esta área aún no tiene competencias.</p>
                ) : (
                  <ul className="flex flex-col">
                    {visibles.map((c) => (
                      <FilaCompetencia
                        key={c.id}
                        competencia={c}
                        ocupada={ocupada === c.id}
                        onEditar={() => setAEditar(c)}
                        onCambiarEstado={() => cambiarEstado(c)}
                        onEliminar={() => setAEliminar(c)}
                      />
                    ))}
                  </ul>
                )}
              </Tarjeta>
            );
          })}
        </div>
        <FormularioCompetencia areas={carga.areas} onGuardada={listo} />
      </div>

      {aEditar && (
        <ModalEditar key={aEditar.id} competencia={aEditar} onCerrar={() => setAEditar(null)} onGuardada={listo} />
      )}
      {aEliminar && (
        <ModalEliminar
          key={aEliminar.id}
          competencia={aEliminar}
          onCerrar={() => setAEliminar(null)}
          onListo={listo}
          onDesactivar={() => {
            const c = aEliminar;
            setAEliminar(null);
            void cambiarEstado(c);
          }}
        />
      )}
    </div>
  );
}
