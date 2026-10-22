// AD-03 · Grados, secciones y aulas (US08, US09)
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AnioAcademico } from "@/components/admin/anio";
import {
  BadgeEstadoSeccion,
  BarraOcupacion,
  FormularioAula,
  ID_CAMPO_AULA,
  ID_CAMPO_SECCION,
  ModalEliminarSeccion,
  nombreSeccion,
  PanelSeccion,
  Selector,
  type Aula,
  type Docente,
  type Grado,
  type Seccion,
} from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

const POR_PAGINA = 8;
const AULAS_EN_RESUMEN = 3;

type Pestana = "secciones" | "aulas";
interface Datos {
  secciones: Seccion[];
  aulas: Aula[];
}
type Carga = { fase: "cargando" } | { fase: "error"; mensaje: string } | ({ fase: "lista"; anioId: string } & Datos);
interface Catalogos {
  anios: AnioAcademico[];
  grados: Grado[];
  docentes: Docente[];
}

/** Año activo por defecto: el que está en curso, si no el que está en matrícula, si no el más reciente abierto. */
function anioPorDefecto(anios: AnioAcademico[]): AnioAcademico | undefined {
  return (
    anios.find((a) => a.estado === "EN_CURSO") ??
    anios.find((a) => a.estado === "EN_MATRICULA") ??
    anios.find((a) => a.estado !== "CERRADO") ??
    anios[0]
  );
}

export default function GradosSeccionesPage() {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null);
  const [anioElegido, setAnioElegido] = useState<string | null>(null);
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [recarga, setRecarga] = useState(0);
  const [pestana, setPestana] = useState<Pestana>("secciones");
  const [editando, setEditando] = useState<Seccion | null>(null);
  const [versionPanel, setVersionPanel] = useState(0);
  const [aulaEditando, setAulaEditando] = useState<Aula | null>(null);
  const [aEliminar, setAEliminar] = useState<Seccion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [alerta, setAlerta] = useState<{ titulo: string; texto?: string; inactivar?: Seccion } | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const [anios, grados, docentes] = await Promise.all([
          api<AnioAcademico[]>("/academico/anios"),
          api<Grado[]>("/academico/grados"),
          api<Docente[]>("/comunidad/docentes"),
        ]);
        setCatalogos({ anios, grados, docentes });
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
    if (!anioId) return;
    let vigente = true;
    async function cargar() {
      try {
        const [secciones, aulas] = await Promise.all([
          api<Seccion[]>(`/academico/secciones?anioId=${anioId}`),
          api<Aula[]>(`/academico/aulas?anioId=${anioId}`),
        ]);
        if (vigente) setCarga({ fase: "lista", anioId: anioId!, secciones, aulas });
      } catch (e) {
        if (vigente) setCarga({ fase: "error", mensaje: alertaError(e) });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [anioId, recarga]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const recargar = useCallback((mensaje?: string) => {
    if (mensaje) setAviso(mensaje);
    setRecarga((n) => n + 1);
  }, []);

  const datos: Datos = carga.fase === "lista" && carga.anioId === anioId ? carga : { secciones: [], aulas: [] };
  const cargando = Boolean(anioId) && !(carga.fase === "lista" && carga.anioId === anioId) && carga.fase !== "error";
  const cerrado = anio?.estado === "CERRADO";

  function nuevaSeccion() {
    setPestana("secciones");
    setEditando(null);
    setVersionPanel((v) => v + 1);
    setTimeout(() => document.getElementById(ID_CAMPO_SECCION)?.focus(), 0);
  }

  function nuevaAula() {
    setAulaEditando(null);
    setTimeout(() => {
      const campo = document.getElementById(ID_CAMPO_AULA);
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus();
    }, 0);
  }

  async function cambiarEstadoSeccion(s: Seccion, estado: "ACTIVA" | "INACTIVA") {
    setAlerta(null);
    try {
      await api(`/academico/secciones/${s.id}/estado`, { method: "POST", body: { estado } });
      recargar(`La sección ${nombreSeccion(s)} quedó ${estado === "ACTIVA" ? "activa" : "inactiva"}.`);
    } catch (e) {
      setAlerta({ titulo: alertaError(e) });
    }
  }

  async function cambiarEstadoAula(a: Aula, activo: boolean) {
    setAlerta(null);
    try {
      await api(`/academico/aulas/${a.id}/estado`, { method: "POST", body: { activo } });
      recargar(`${a.nombre} quedó ${activo ? "activa" : "desactivada"}.`);
    } catch (e) {
      setAlerta({ titulo: alertaError(e) });
    }
  }

  if (errorCatalogos) {
    return (
      <Alerta tipo="error" titulo="No pudimos cargar la estructura del colegio">
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

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] whitespace-pre text-texto-3">
            Configuración / Grados, secciones y aulas
          </p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Grados, secciones y aulas</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            {anio
              ? `Estructura el año ${anio.anio} (1° a 5° de secundaria) y controla el aforo de cada sección para evitar la sobrepoblación.`
              : "Controla el aforo de cada sección para evitar la sobrepoblación."}
          </p>
        </div>
        <Boton variante="secundario" icono="icon-puerta" onClick={nuevaAula}>
          Nueva aula
        </Boton>
        <Boton icono="icon-plus-blanco" onClick={nuevaSeccion} disabled={!anio || cerrado}>
          Nueva sección
        </Boton>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-b border-borde">
        <div role="tablist" className="flex gap-6">
          {(
            [
              ["secciones", `Secciones (${datos.secciones.length})`],
              ["aulas", `Aulas físicas (${datos.aulas.length})`],
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
        {anio && (
          <div className="mb-2 w-[170px]">
            <Selector
              etiqueta="Año académico"
              oculto
              valor={anio.id}
              onCambiar={(id) => {
                setAnioElegido(id);
                setEditando(null);
                setVersionPanel((v) => v + 1);
              }}
            >
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
      {alerta && (
        <div className="flex items-start gap-4 rounded-lg border-l-4 border-rojo bg-rojo/8 px-4 py-3">
          <Icono nombre="alerta-err" size={20} />
          <div className="flex-1 text-[14px] leading-[1.4]">
            <p className="font-semibold text-texto">{alerta.titulo}</p>
            {alerta.texto && <p className="text-texto-2">{alerta.texto}</p>}
          </div>
          {alerta.inactivar && (
            <Boton variante="secundario" onClick={() => cambiarEstadoSeccion(alerta.inactivar!, "INACTIVA")}>
              Inactivar sección
            </Boton>
          )}
        </div>
      )}
      {carga.fase === "error" && (
        <Alerta tipo="error" titulo="No pudimos cargar las secciones">
          {carga.mensaje}
        </Alerta>
      )}

      {!anio && (
        <Alerta tipo="info" titulo="Primero crea el año académico">
          Las secciones pertenecen a un año. Créalo en «Año y bimestres» y vuelve aquí.
        </Alerta>
      )}

      {anio && pestana === "secciones" && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_380px]">
          <TablaSecciones
            key={anio.id}
            grados={catalogos.grados}
            secciones={datos.secciones}
            cargando={cargando}
            cerrado={cerrado}
            onEditar={(s) => {
              setEditando(s);
              setVersionPanel((v) => v + 1);
            }}
            onCambiarEstado={cambiarEstadoSeccion}
            onEliminar={setAEliminar}
          />
          <Tarjeta className="p-6">
            <PanelSeccion
              key={`${anio.id}-${editando?.id ?? "nueva"}-${versionPanel}`}
              anio={anio}
              seccion={editando}
              grados={catalogos.grados}
              aulas={datos.aulas}
              docentes={catalogos.docentes}
              soloLectura={cerrado}
              onCancelar={() => {
                setEditando(null);
                setVersionPanel((v) => v + 1);
              }}
              onGuardado={(mensaje) => {
                setEditando(null);
                setVersionPanel((v) => v + 1);
                setAlerta(null);
                recargar(mensaje);
              }}
            />
          </Tarjeta>
        </div>
      )}

      {anio && (
        <BloqueAulas
          aulas={pestana === "aulas" ? datos.aulas : datos.aulas.slice(0, AULAS_EN_RESUMEN)}
          total={datos.aulas.length}
          resumen={pestana === "secciones"}
          editando={aulaEditando}
          onVerTodas={() => setPestana("aulas")}
          onEditar={setAulaEditando}
          onCancelar={() => setAulaEditando(null)}
          onCambiarEstado={cambiarEstadoAula}
          onGuardado={(mensaje) => {
            setAulaEditando(null);
            setAlerta(null);
            recargar(mensaje);
          }}
        />
      )}

      <ModalEliminarSeccion
        seccion={aEliminar}
        onCerrar={() => setAEliminar(null)}
        onListo={(mensaje) => {
          setAlerta(null);
          recargar(mensaje);
        }}
        onError={(s, codigo, mensaje) => {
          const conAlumnos = codigo === "SECCION_CON_MATRICULADOS";
          setAlerta({
            titulo: conAlumnos ? "No se puede eliminar una sección con alumnos matriculados" : mensaje,
            texto: conAlumnos
              ? `${nombreSeccion(s)} tiene ${s.vacantes.matriculados} estudiantes matriculados. Puedes inactivarla para que no reciba nuevas matrículas.`
              : undefined,
            inactivar: s.estado === "ACTIVA" ? s : undefined,
          });
        }}
      />
    </>
  );
}

function TablaSecciones({
  grados,
  secciones,
  cargando,
  cerrado,
  onEditar,
  onCambiarEstado,
  onEliminar,
}: {
  grados: Grado[];
  secciones: Seccion[];
  cargando: boolean;
  cerrado: boolean;
  onEditar: (s: Seccion) => void;
  onCambiarEstado: (s: Seccion, estado: "ACTIVA" | "INACTIVA") => void;
  onEliminar: (s: Seccion) => void;
}) {
  const [grado, setGradoFiltro] = useState("");
  const [estado, setEstadoFiltro] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtradas = useMemo(() => {
    const texto = q.trim().toUpperCase().replace(/[°\s]/g, "");
    return secciones.filter((s) => {
      if (grado && s.grado.id !== grado) return false;
      if (estado === "COMPLETO" && !(s.estado === "ACTIVA" && s.vacantes.completo)) return false;
      if ((estado === "ACTIVA" || estado === "INACTIVA") && s.estado !== estado) return false;
      const etiqueta = `${s.grado.numero}${s.nombre}${s.aula?.nombre ?? ""}${s.tutor?.nombreCompleto ?? ""}`;
      return !texto || etiqueta.toUpperCase().replace(/\s/g, "").includes(texto);
    });
  }, [secciones, grado, estado, q]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const visibles = filtradas.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);
  const filtrar = (cambio: () => void) => {
    cambio();
    setPagina(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="flex flex-col gap-4 p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr]">
          <Selector etiqueta="Grado" oculto valor={grado} onCambiar={(v) => filtrar(() => setGradoFiltro(v))}>
            <option value="">Grado: todos</option>
            {grados.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Estado" oculto valor={estado} onCambiar={(v) => filtrar(() => setEstadoFiltro(v))}>
            <option value="">Estado: todos</option>
            <option value="ACTIVA">Activas</option>
            <option value="COMPLETO">Aforo completo</option>
            <option value="INACTIVA">Inactivas</option>
          </Selector>
          <label className="flex items-center gap-2 rounded-lg border border-borde bg-white px-4 py-3 focus-within:border-kubo-azul focus-within:ring-1 focus-within:ring-kubo-azul">
            <Icono nombre="icon-search" size={18} />
            <input
              value={q}
              onChange={(e) => filtrar(() => setQ(e.target.value))}
              placeholder="Buscar sección"
              aria-label="Buscar sección"
              className="min-w-0 flex-1 bg-transparent text-[16px] leading-[1.4] text-texto outline-none placeholder:text-texto-3"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-borde">
          <table className="w-full min-w-[640px] border-collapse bg-white text-left">
            <thead>
              <tr className="border-b border-borde bg-fondo text-[13px] font-semibold leading-[1.4] text-texto-2">
                <th className="w-[72px] px-4 py-3 font-semibold">Sección</th>
                <th className="px-4 py-3 font-semibold">Aula</th>
                <th className="px-4 py-3 font-semibold">Tutor</th>
                <th className="w-[120px] px-4 py-3 font-semibold">Vacantes</th>
                <th className="w-[140px] px-4 py-3 font-semibold">Estado</th>
                <th className="w-[96px] px-2 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[14px] text-texto-2">
                    <span className="inline-flex items-center gap-3">
                      <Spinner claro={false} /> Cargando secciones…
                    </span>
                  </td>
                </tr>
              )}
              {!cargando && visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[14px] text-texto-3">
                    {secciones.length === 0
                      ? "Este año aún no tiene secciones. Crea la primera con el panel «Nueva sección»."
                      : "No hay secciones con esos filtros."}
                  </td>
                </tr>
              )}
              {!cargando &&
                visibles.map((s) => {
                  const lleno = s.estado === "ACTIVA" && s.vacantes.completo;
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-borde text-[14px] leading-[1.4] text-texto last:border-b-0 ${
                        lleno ? "bg-rojo/7" : ""
                      } ${s.estado === "INACTIVA" ? "text-texto-3" : ""}`}
                    >
                      <td className="px-4 py-4 font-semibold whitespace-nowrap">{nombreSeccion(s)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {s.aula?.nombre ?? <span className="text-texto-3">Sin aula</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {s.tutor ? (
                          <span title={s.tutor.nombreCompleto}>{s.tutor.nombreCorto}</span>
                        ) : (
                          <span className="text-texto-3">Sin tutor</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <BarraOcupacion ocupados={s.vacantes.matriculados} total={s.vacantes.aforo} />
                      </td>
                      <td className="px-4 py-4">
                        <BadgeEstadoSeccion seccion={s} />
                      </td>
                      <td className="px-2 py-4">
                        {!cerrado && (
                          <div className="flex justify-end gap-0.5">
                            <Accion icono="act-edit" texto={`Editar ${nombreSeccion(s)}`} onClick={() => onEditar(s)} />
                            {s.estado === "ACTIVA" ? (
                              <Accion
                                icono="act-ban"
                                texto={`Inactivar ${nombreSeccion(s)}`}
                                onClick={() => onCambiarEstado(s, "INACTIVA")}
                              />
                            ) : (
                              <Accion
                                icono="act-refresh"
                                texto={`Activar ${nombreSeccion(s)}`}
                                onClick={() => onCambiarEstado(s, "ACTIVA")}
                              />
                            )}
                            <Accion
                              icono="act-trash"
                              texto={`Eliminar ${nombreSeccion(s)}`}
                              onClick={() => onEliminar(s)}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {filtradas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] leading-[1.4] text-texto-3">
            Mostrando {visibles.length} de {filtradas.length} secciones
          </p>
          <div className="flex-1" />
          {paginas > 1 && (
            <>
              <BotonPagina etiqueta="Página anterior" disabled={actual <= 1} onClick={() => setPagina(actual - 1)}>
                <Icono nombre="pag-chevl" size={20} />
              </BotonPagina>
              {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
                <BotonPagina key={n} activo={n === actual} onClick={() => setPagina(n)}>
                  {n}
                </BotonPagina>
              ))}
              <BotonPagina
                etiqueta="Página siguiente"
                disabled={actual >= paginas}
                onClick={() => setPagina(actual + 1)}
              >
                <Icono nombre="pag-chevr" size={20} />
              </BotonPagina>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BloqueAulas({
  aulas,
  total,
  resumen,
  editando,
  onVerTodas,
  onEditar,
  onCancelar,
  onCambiarEstado,
  onGuardado,
}: {
  aulas: Aula[];
  total: number;
  resumen: boolean;
  editando: Aula | null;
  onVerTodas: () => void;
  onEditar: (a: Aula) => void;
  onCancelar: () => void;
  onCambiarEstado: (a: Aula, activo: boolean) => void;
  onGuardado: (mensaje: string) => void;
}) {
  return (
    <Tarjeta className="flex flex-col gap-5 p-6">
      <div className="flex items-start gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Aulas físicas</h2>
          <p className="text-[14px] leading-[1.4] text-texto-3">Registra cada ambiente con su capacidad máxima</p>
        </div>
        {resumen && total > AULAS_EN_RESUMEN && (
          <button
            type="button"
            onClick={onVerTodas}
            className="flex items-center gap-1 text-[16px] font-semibold text-kubo-azul hover:underline"
          >
            Ver todas <Icono nombre="pag-chevr" size={20} />
          </button>
        )}
      </div>

      <FormularioAula key={editando?.id ?? "nueva"} aula={editando} onCancelar={onCancelar} onGuardado={onGuardado} />

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full min-w-[720px] border-collapse bg-white text-left">
          <thead>
            <tr className="border-b border-borde bg-fondo text-[13px] font-semibold leading-[1.4] text-texto-2">
              <th className="px-4 py-3 font-semibold">Aula</th>
              <th className="px-4 py-3 font-semibold">Ubicación</th>
              <th className="w-[80px] px-4 py-3 text-right font-semibold">Aforo</th>
              <th className="px-4 py-3 font-semibold">Sección asignada</th>
              <th className="w-[150px] px-4 py-3 font-semibold">Ocupación</th>
              <th className="w-[80px] px-2 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {aulas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[14px] text-texto-3">
                  Aún no hay aulas registradas.
                </td>
              </tr>
            )}
            {aulas.map((a) => {
              const ocupados = a.secciones.reduce((n, s) => n + s.matriculados, 0);
              return (
                <tr
                  key={a.id}
                  className={`border-b border-borde text-[14px] leading-[1.4] last:border-b-0 ${a.activo ? "text-texto" : "text-texto-3"}`}
                >
                  <td className="px-4 py-4 font-semibold whitespace-nowrap">
                    {a.nombre}
                    {!a.activo && <span className="ml-2 text-[12px] font-normal">(desactivada)</span>}
                  </td>
                  <td className="px-4 py-4">{a.ubicacion ?? "—"}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{a.aforo}</td>
                  <td className="px-4 py-4">
                    {a.secciones.length ? a.secciones.map((s) => nombreSeccion(s)).join(", ") : "Sin sección"}
                  </td>
                  <td className="px-4 py-4">
                    {a.secciones.length ? (
                      <BarraOcupacion ocupados={ocupados} total={a.aforo} />
                    ) : (
                      <span className="text-[13px] text-texto-3">—</span>
                    )}
                  </td>
                  <td className="px-2 py-4">
                    <div className="flex justify-end gap-0.5">
                      <Accion icono="act-edit" texto={`Editar ${a.nombre}`} onClick={() => onEditar(a)} />
                      {a.activo ? (
                        <Accion
                          icono="act-ban"
                          texto={`Desactivar ${a.nombre}`}
                          onClick={() => onCambiarEstado(a, false)}
                        />
                      ) : (
                        <Accion
                          icono="act-refresh"
                          texto={`Activar ${a.nombre}`}
                          onClick={() => onCambiarEstado(a, true)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}

function Accion({ icono, texto, onClick }: { icono: string; texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={texto}
      aria-label={texto}
      className="rounded-md p-[7px] hover:bg-fondo"
    >
      <Icono nombre={icono} size={18} />
    </button>
  );
}

function BotonPagina({
  children,
  onClick,
  activo,
  disabled,
  etiqueta,
}: {
  children: ReactNode;
  onClick: () => void;
  activo?: boolean;
  disabled?: boolean;
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      aria-current={activo ? "page" : undefined}
      className={`flex min-w-[44px] items-center justify-center rounded-md border px-3 py-2.5 text-[16px] font-bold leading-[1.5] disabled:opacity-40 ${
        activo ? "border-kubo-azul bg-kubo-azul text-white" : "border-borde bg-white text-texto hover:bg-fondo"
      }`}
    >
      {children}
    </button>
  );
}
