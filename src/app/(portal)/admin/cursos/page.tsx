// AD-04 · Cursos y competencias (US10, US11)
"use client";

import { useCallback, useEffect, useState } from "react";
import { anioPorDefecto, type AnioAcademico } from "@/components/admin/anio";
import {
  CatalogoOficial,
  DetalleCurso,
  FormularioCurso,
  ID_CAMPO_CURSO,
  ItemCurso,
  ModalEliminarCurso,
  PanelCompetencias,
  PanelGrados,
  type Area,
  type Curso,
} from "@/components/admin/cursos";
import { Selector, type Grado } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

type Pestana = "malla" | "catalogo";
type Carga =
  { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "lista"; anioId: string; cursos: Curso[] };
interface Catalogos {
  anios: AnioAcademico[];
  areas: Area[];
  grados: Grado[];
}

export default function CursosCompetenciasPage() {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null);
  const [anioElegido, setAnioElegido] = useState<string | null>(null);
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [recarga, setRecarga] = useState(0);
  const [pestana, setPestana] = useState<Pestana>("malla");
  const [cursoElegido, setCursoElegido] = useState<string | null>(null);
  const [filtros, setFiltros] = useState({ q: "", areaId: "", estado: "" });
  const [formulario, setFormulario] = useState<{ curso: Curso | null; version: number }>({ curso: null, version: 0 });
  const [aEliminar, setAEliminar] = useState<Curso | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const [anios, areas, grados] = await Promise.all([
          api<AnioAcademico[]>("/academico/anios"),
          api<Area[]>("/academico/areas"),
          api<Grado[]>("/academico/grados"),
        ]);
        setCatalogos({ anios, areas, grados });
      } catch (e) {
        setErrorCatalogos(alertaError(e));
      }
    }
    void cargar();
  }, []);

  const anio = catalogos
    ? (catalogos.anios.find((a) => a.id === anioElegido) ?? anioPorDefecto(catalogos.anios))
    : undefined;
  const anioId = anio?.id;

  useEffect(() => {
    if (!catalogos) return;
    let vigente = true;
    async function cargar() {
      try {
        const cursos = await api<Curso[]>(`/academico/cursos${anioId ? `?anioId=${anioId}` : ""}`);
        if (vigente) setCarga({ fase: "lista", anioId: anioId ?? "", cursos });
      } catch (e) {
        if (vigente) setCarga({ fase: "error", mensaje: alertaError(e) });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [catalogos, anioId, recarga]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const recargar = useCallback((mensaje?: string) => {
    if (mensaje) setAviso(mensaje);
    setAlerta(null);
    setRecarga((n) => n + 1);
  }, []);

  const lista = carga.fase === "lista" && carga.anioId === (anioId ?? "") ? carga.cursos : null;
  const cursos = lista ?? [];
  const texto = filtros.q.trim().toLowerCase();
  const visibles = cursos.filter(
    (c) =>
      (!filtros.areaId || c.areaCurricular.id === filtros.areaId) &&
      (!filtros.estado || c.estado === filtros.estado) &&
      (!texto || c.nombre.toLowerCase().includes(texto) || c.codigo.toLowerCase().includes(texto)),
  );
  const curso = cursos.find((c) => c.id === cursoElegido) ?? visibles[0] ?? null;
  const cerrado = anio?.estado === "CERRADO";

  function abrirFormulario(c: Curso | null) {
    setFormulario((f) => ({ curso: c, version: f.version + 1 }));
    setTimeout(() => {
      const campo = document.getElementById(ID_CAMPO_CURSO);
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus();
    }, 0);
  }

  async function cambiarEstado(c: Curso) {
    setAlerta(null);
    const estado = c.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    try {
      await api(`/academico/cursos/${c.id}/estado`, { method: "POST", body: { estado } });
      recargar(`${c.nombre} quedó ${estado === "ACTIVO" ? "activo" : "desactivado"}.`);
    } catch (e) {
      setAlerta(alertaError(e));
    }
  }

  if (errorCatalogos) {
    return (
      <Alerta tipo="error" titulo="No pudimos cargar el currículo">
        {errorCatalogos}
      </Alerta>
    );
  }
  if (!catalogos) {
    return (
      <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
        <Spinner claro={false} /> Cargando…
      </Tarjeta>
    );
  }

  const activos = cursos.filter((c) => c.estado === "ACTIVO").length;

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] whitespace-pre text-texto-3">Configuración / Cursos y competencias</p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Cursos y competencias</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            Registra la malla curricular y asocia a cada curso las competencias del Currículo Nacional que se evaluarán
            con la escala AD, A, B y C.
          </p>
        </div>
        <Boton icono="icon-plus-blanco" onClick={() => abrirFormulario(null)}>
          Nuevo curso
        </Boton>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-b border-borde">
        <div role="tablist" className="flex gap-6">
          {(
            [
              ["malla", "Malla curricular"],
              ["catalogo", "Catálogo oficial"],
            ] as const
          ).map(([clave, texto]) => (
            <button
              key={clave}
              role="tab"
              aria-selected={pestana === clave}
              onClick={() => setPestana(clave)}
              className={`-mb-px border-b-2 px-0.5 py-2.5 text-[14px] leading-[1.4] whitespace-nowrap ${
                pestana === clave
                  ? "border-kubo-azul font-semibold text-kubo-azul"
                  : "border-transparent font-medium text-texto-2 hover:text-texto"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {anio && pestana === "malla" && (
          <div className="mb-2 w-[170px]">
            <Selector etiqueta="Año académico" oculto valor={anio.id} onCambiar={setAnioElegido}>
              {catalogos.anios.map((a) => (
                <option key={a.id} value={a.id}>
                  Año {a.anio}
                </option>
              ))}
            </Selector>
          </div>
        )}
      </div>

      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      {alerta && <Alerta tipo="error" titulo={alerta} />}
      {carga.fase === "error" && (
        <Alerta tipo="error" titulo="No pudimos cargar los cursos">
          {carga.mensaje}
        </Alerta>
      )}

      {pestana === "catalogo" && <CatalogoOficial areas={catalogos.areas} />}

      {pestana === "malla" && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[380px_1fr]">
          <Tarjeta className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Malla curricular</h2>
              <p className="text-[14px] leading-[1.4] text-texto-3">
                {cursos.length} cursos · {activos} activos
              </p>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-borde px-4 py-3 focus-within:border-kubo-azul">
              <Icono nombre="icon-search" size={18} />
              <input
                aria-label="Buscar curso o código"
                placeholder="Buscar curso o código"
                value={filtros.q}
                onChange={(e) => setFiltros((f) => ({ ...f, q: e.target.value }))}
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-texto-3"
              />
            </label>
            <div className="grid grid-cols-[1.3fr_1fr] gap-3">
              <Selector
                etiqueta="Área"
                oculto
                valor={filtros.areaId}
                onCambiar={(areaId) => setFiltros((f) => ({ ...f, areaId }))}
              >
                <option value="">Todas las áreas</option>
                {catalogos.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </Selector>
              <Selector
                etiqueta="Estado"
                oculto
                valor={filtros.estado}
                onCambiar={(estado) => setFiltros((f) => ({ ...f, estado }))}
              >
                <option value="">Todos</option>
                <option value="ACTIVO">Activos</option>
                <option value="INACTIVO">Inactivos</option>
              </Selector>
            </div>
            {!lista && carga.fase !== "error" && (
              <div className="flex items-center gap-3 py-6 text-[14px] text-texto-2">
                <Spinner claro={false} /> Cargando cursos…
              </div>
            )}
            {lista && visibles.length === 0 && (
              <p className="py-6 text-center text-[14px] text-texto-3">
                {cursos.length ? "Ningún curso coincide con los filtros." : "Aún no hay cursos. Registra el primero."}
              </p>
            )}
            <div className="flex flex-col gap-1">
              {visibles.map((c) => (
                <ItemCurso key={c.id} curso={c} elegido={c.id === curso?.id} onElegir={() => setCursoElegido(c.id)} />
              ))}
            </div>
          </Tarjeta>

          <div className="flex min-w-0 flex-col gap-6">
            {!anio && (
              <Alerta tipo="info" titulo="Primero crea el año académico">
                Los grados y las competencias de cada curso se definen por año. Créalo en «Año y bimestres».
              </Alerta>
            )}
            {curso && (
              <>
                <DetalleCurso
                  curso={curso}
                  onEditar={() => abrirFormulario(curso)}
                  onCambiarEstado={() => cambiarEstado(curso)}
                  onEliminar={() => setAEliminar(curso)}
                />
                {anio && (
                  <PanelGrados
                    key={`${curso.id}-${anio.id}-${recarga}`}
                    curso={curso}
                    grados={catalogos.grados}
                    anio={anio}
                    soloLectura={cerrado}
                    onGuardado={recargar}
                  />
                )}
                {anio && (
                  <PanelCompetencias
                    key={`${curso.id}-${anio.id}`}
                    curso={curso}
                    soloLectura={cerrado}
                    onGuardado={recargar}
                  />
                )}
              </>
            )}
            <Tarjeta className="p-6">
              <FormularioCurso
                key={`${formulario.curso?.id ?? "nuevo"}-${formulario.version}`}
                curso={formulario.curso}
                areas={catalogos.areas}
                grados={catalogos.grados}
                anio={anio}
                onCancelar={() => setFormulario((f) => ({ curso: null, version: f.version + 1 }))}
                onGuardado={(c, mensaje) => {
                  setCursoElegido(c.id);
                  setFiltros({ q: "", areaId: "", estado: "" });
                  setFormulario((f) => ({ curso: null, version: f.version + 1 }));
                  recargar(mensaje);
                }}
              />
            </Tarjeta>
          </div>
        </div>
      )}

      <ModalEliminarCurso
        curso={aEliminar}
        onCerrar={() => setAEliminar(null)}
        onListo={(mensaje) => {
          setCursoElegido(null);
          recargar(mensaje);
        }}
        onError={(_, mensaje) => setAlerta(mensaje)}
      />
    </>
  );
}
