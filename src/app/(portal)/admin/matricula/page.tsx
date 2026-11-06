// AD-10 · Matrícula en sección (US18, RF14) con el cronograma de pagos (US21, RF16) y la anulación (M-19)
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Avatar, Buscador, type EstudianteListado } from "@/components/admin/apoderados";
import type { AnioAcademico } from "@/components/admin/anio";
import { Selector, separarErrores, type Grado, type Seccion } from "@/components/admin/grados";
import {
  BadgeEstado,
  BarraMontos,
  etiquetaSeccion,
  FiltrosMatriculas,
  MENSAJE_INCOMPLETA,
  MENSAJE_YA_MATRICULADO,
  ModalAnular,
  ModalDetalle,
  ModalMontos,
  soles,
  TablaCronograma,
  TarjetaSeccion,
  type DetalleMatricula,
  type MatriculaListada,
  type ModalidadPago,
  type MontosAnio,
  type SituacionEstudiante,
} from "@/components/admin/matricula";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fechaDia } from "@/lib/formato";

const TAMANO_PAGINA = 10;

/** Año para matricular: el que está «En matrícula» y, si no hay, el «En curso» (igual que el borrador de US17). */
const anioParaMatricular = (anios: AnioAcademico[]) =>
  anios.find((a) => a.estado === "EN_MATRICULA") ?? anios.find((a) => a.estado === "EN_CURSO") ?? anios[0];

interface Listado {
  items: MatriculaListada[];
  paginacion: { pagina: number; total: number; paginas: number };
}

function PaginaMatricula() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [anios, setAnios] = useState<AnioAcademico[] | null>(null);
  const [anioElegido, setAnioElegido] = useState<string | null>(null);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [delAnio, setDelAnio] = useState<{ anioId: string; montos: MontosAnio; secciones: Seccion[] } | null>(null);
  const [editandoMontos, setEditandoMontos] = useState(false);

  // formulario «Nueva matrícula»
  const [estudianteId, setEstudianteId] = useState<string | null>(parametros.get("estudiante"));
  const [situacion, setSituacion] = useState<SituacionEstudiante | null>(null);
  const [errorSituacion, setErrorSituacion] = useState<string | null>(null);
  const [gradoElegido, setGradoElegido] = useState<string | null>(null);
  const [seccionId, setSeccionId] = useState<string | null>(null);
  const [vinculoElegido, setVinculoElegido] = useState<string | null>(null);
  const [modalidad, setModalidad] = useState<ModalidadPago>("MENSUAL");
  const [general, setGeneral] = useState<{ titulo: string; detalle?: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmada, setConfirmada] = useState<DetalleMatricula | null>(null);

  // listado
  const [filtros, setFiltros] = useState({ estado: "", gradoId: "", seccionId: "", q: "", pagina: 1 });
  const [listado, setListado] = useState<Listado | null>(null);
  const [errorListado, setErrorListado] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [verDetalle, setVerDetalle] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<DetalleMatricula | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const anio = anios ? (anios.find((a) => a.id === anioElegido) ?? anioParaMatricular(anios)) : undefined;
  const datosAnio = delAnio && anio && delAnio.anioId === anio.id ? delAnio : null;

  useEffect(() => {
    async function cargar() {
      try {
        const [a, g] = await Promise.all([api<AnioAcademico[]>("/academico/anios"), api<Grado[]>("/academico/grados")]);
        setAnios(a);
        setGrados(g);
      } catch (e) {
        setErrorCarga(alertaError(e));
      }
    }
    void cargar();
  }, []);

  useEffect(() => {
    if (!anio) return;
    let vigente = true;
    async function cargar() {
      try {
        const [montos, secciones] = await Promise.all([
          api<MontosAnio>(`/academico/anios/${anio!.id}/montos`),
          api<Seccion[]>(`/academico/secciones?anioId=${anio!.id}`),
        ]);
        if (vigente) setDelAnio({ anioId: anio!.id, montos, secciones });
      } catch (e) {
        if (vigente) setErrorCarga(alertaError(e));
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [anio, recarga]);

  useEffect(() => {
    if (!anio || !estudianteId) return;
    let vigente = true;
    async function cargar() {
      try {
        const s = await api<SituacionEstudiante>(`/matricula/estudiantes/${estudianteId}?anioId=${anio!.id}`);
        if (!vigente) return;
        setSituacion(s);
        setErrorSituacion(null);
      } catch (e) {
        if (vigente) setErrorSituacion(alertaError(e));
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [anio, estudianteId, recarga]);

  useEffect(() => {
    if (!anio) return;
    let vigente = true;
    const t = setTimeout(async () => {
      const q = new URLSearchParams({ anioId: anio.id, pagina: String(filtros.pagina), tamano: String(TAMANO_PAGINA) });
      for (const clave of ["estado", "gradoId", "seccionId", "q"] as const) {
        if (filtros[clave].trim()) q.set(clave, filtros[clave].trim());
      }
      try {
        const r = await api<Listado>(`/matricula/matriculas?${q}`);
        if (vigente) {
          setListado(r);
          setErrorListado(null);
        }
      } catch (e) {
        if (vigente) setErrorListado(alertaError(e));
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [anio, filtros, recarga]);

  // valores derivados del estudiante elegido (sin duplicar estado)
  const sit = situacion && situacion.estudiante.estudianteId === estudianteId ? situacion : null;
  const yaMatriculado = sit?.matricula?.estado === "MATRICULADO";
  const gradoId = gradoElegido ?? sit?.estudiante.gradoIngresoId ?? "";
  const seccionesDelGrado = (datosAnio?.secciones ?? []).filter((s) => s.estado === "ACTIVA" && s.grado.id === gradoId);
  const seccion = datosAnio?.secciones.find((s) => s.id === (seccionId ?? sit?.matricula?.seccionId));
  const principal = sit?.estudiante.apoderados.find((a) => a.esPrincipal);
  const vinculoId = vinculoElegido ?? sit?.matricula?.vinculoResponsableId ?? principal?.vinculoId ?? "";
  const sinMontos = datosAnio ? !datosAnio.montos.configurados : false;
  const seccionActual = datosAnio?.secciones.find((s) => s.id === sit?.matricula?.seccionId);

  function elegirEstudiante(id: string | null) {
    setEstudianteId(id);
    setSituacion(null);
    setGradoElegido(null);
    setSeccionId(null);
    setVinculoElegido(null);
    setModalidad("MENSUAL");
    setGeneral(null);
    setConfirmada(null);
  }

  async function matricular() {
    setGeneral(null);
    if (!sit || !anio) return;
    if (!seccion || !vinculoId) {
      setGeneral({ titulo: MENSAJE_INCOMPLETA });
      return;
    }
    setEnviando(true);
    try {
      const d = await api<DetalleMatricula>("/matricula/matriculas", {
        method: "POST",
        body: {
          estudianteId: sit.estudiante.estudianteId,
          anioAcademicoId: anio.id,
          seccionId: seccion.id,
          vinculoResponsableId: vinculoId,
          modalidadPago: modalidad,
        },
      });
      setConfirmada(d);
      setRecarga((r) => r + 1);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === "SECCION_SIN_VACANTES") {
        const { matriculados, aforo } = err.detalles as { matriculados: number; aforo: number };
        setGeneral({
          titulo: `${err.message} (${matriculados}/${aforo})`,
          detalle: `${etiquetaSeccion(seccion)} alcanzó su aforo máximo y no admite nuevas matrículas.`,
        });
        setRecarga((r) => r + 1);
      } else if (err instanceof ApiError && err.codigo === "YA_MATRICULADO") {
        setGeneral({ titulo: err.message, detalle: String(err.detalles.sugerencia ?? "") });
      } else {
        setGeneral({ titulo: separarErrores(err).general ?? alertaError(err) });
      }
    } finally {
      setEnviando(false);
    }
  }

  if (errorCarga) {
    return (
      <Alerta tipo="error" titulo="No pudimos cargar la matrícula">
        {errorCarga}
      </Alerta>
    );
  }
  if (!anios || !anio) {
    return (
      <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
        {anios ? (
          "Aún no hay años académicos. Créalo en «Año y bimestres»."
        ) : (
          <>
            <Spinner claro={false} /> Cargando…
          </>
        )}
      </Tarjeta>
    );
  }

  const cronograma = confirmada?.cronograma ?? sit?.cronogramaPrevisto;
  const anioAbierto = anio.estado === "EN_MATRICULA" || anio.estado === "EN_CURSO";

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] text-texto-3">Comunidad / Matrícula</p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Matrícula {anio.anio}</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            Matricula a estudiantes registrados en una sección con vacantes. Al confirmar, el sistema genera
            automáticamente su cronograma de pensiones.
          </p>
        </div>
        {anios.length > 1 && (
          <div className="w-[200px]">
            <Selector
              etiqueta="Año académico"
              oculto
              valor={anio.id}
              onCambiar={(id) => {
                setAnioElegido(id);
                // se conserva el estudiante: solo cambian las secciones, los montos y su cronograma
                elegirEstudiante(confirmada ? null : estudianteId);
                setFiltros((f) => ({ ...f, gradoId: "", seccionId: "", pagina: 1 }));
              }}
            >
              {anios.map((a) => (
                <option key={a.id} value={a.id}>
                  {`Año ${a.anio}`}
                </option>
              ))}
            </Selector>
          </div>
        )}
        <Boton
          variante="secundario"
          icono="icon-userplus"
          onClick={() => router.push("/admin/usuarios/registrar-estudiante")}
        >
          Registrar estudiante
        </Boton>
      </div>

      {datosAnio && <BarraMontos montos={datosAnio.montos} onEditar={() => setEditandoMontos(true)} />}
      {!anioAbierto && (
        <Alerta tipo="info" titulo={`El año ${anio.anio} no está en matrícula ni en curso`}>
          Puedes revisar sus matrículas, pero solo se matricula en un año «En matrícula» o «En curso».
        </Alerta>
      )}
      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_300px]">
        <Tarjeta className="flex min-w-0 flex-col gap-5 p-6">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Nueva matrícula</h2>
            <p className="text-[14px] leading-[1.4] text-texto-3">
              {confirmada ? "Paso 3 de 3 · Cronograma de pagos" : "Paso 2 de 3 · Matrícula en sección"}
            </p>
          </div>

          {!sit && !confirmada && (
            <Buscador<EstudianteListado>
              ruta="/comunidad/estudiantes"
              etiqueta="Estudiante"
              placeholder="Buscar estudiante por DNI o nombre"
              idDe={(e) => e.estudianteId}
              elegidos={[]}
              onElegir={(e) => elegirEstudiante(e.estudianteId)}
              vacio={
                <>
                  No hay estudiantes con ese DNI o nombre.{" "}
                  <Link href="/admin/usuarios/registrar-estudiante" className="font-semibold text-kubo-azul">
                    Regístralo primero
                  </Link>
                  .
                </>
              }
              fila={(e) => (
                <div className="flex flex-col">
                  <span className="text-[14px] font-semibold text-texto">{e.nombreCompleto}</span>
                  <span className="text-[12px] text-texto-3">
                    {`DNI ${e.dni}${e.gradoIngreso ? ` · ${e.gradoIngreso}` : ""}`}
                  </span>
                </div>
              )}
            />
          )}
          {estudianteId && !sit && !errorSituacion && (
            <div className="flex items-center gap-3 text-[14px] text-texto-2">
              <Spinner claro={false} /> Cargando al estudiante…
            </div>
          )}
          {errorSituacion && <Alerta tipo="error" titulo={errorSituacion} />}

          {sit && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-fondo p-3">
                <Avatar nombre={sit.estudiante.nombreCompleto} />
                <div className="flex min-w-0 flex-1 flex-col text-[13px]">
                  <span className="text-[14px] font-semibold text-texto">{sit.estudiante.nombreCompleto}</span>
                  <span className="text-texto-3">
                    {`DNI ${sit.estudiante.dni} · Grado de ingreso: ${grados.find((g) => g.id === sit.estudiante.gradoIngresoId)?.nombre ?? "—"}${principal ? ` · Apoderado: ${principal.nombreCompleto}` : ""}`}
                  </span>
                </div>
                {confirmada || yaMatriculado ? (
                  <BadgeEstado estado="MATRICULADO" />
                ) : sit.matricula ? (
                  <BadgeEstado estado={sit.matricula.estado} />
                ) : (
                  <Badge tono="celeste" punto>{`Sin matrícula ${sit.anio.anio}`}</Badge>
                )}
                {!confirmada && (
                  <button
                    type="button"
                    onClick={() => elegirEstudiante(null)}
                    className="text-[14px] font-semibold text-kubo-azul hover:underline"
                  >
                    Cambiar
                  </button>
                )}
              </div>

              {confirmada ? (
                <Alerta
                  tipo="exito"
                  icono="icon-check-verde"
                  titulo={`${sit.estudiante.nombreCompleto} quedó matriculado en ${confirmada.seccion?.nombre}`}
                >
                  {`Se generó su cronograma de pagos: ${confirmada.cronograma.cuotas.length} cuotas por ${soles(confirmada.cronograma.total)}.`}
                </Alerta>
              ) : yaMatriculado ? (
                <Alerta tipo="aviso" icono="alerta-warn" titulo={MENSAJE_YA_MATRICULADO}>
                  {`${sit.estudiante.nombreCompleto} está en ${seccionActual ? etiquetaSeccion(seccionActual) : "una sección"}. Usa «Traslado de sección» para cambiarlo de sección (disponible en el siguiente bloque).`}
                </Alerta>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <p className="text-[14px] font-medium text-texto-2">
                        Sección de {grados.find((g) => g.id === gradoId)?.nombre ?? "su grado"}{" "}
                        <span className="text-rojo">*</span>
                      </p>
                      <div className="w-[200px]">
                        <Selector
                          etiqueta="Grado"
                          oculto
                          valor={gradoId}
                          onCambiar={(g) => {
                            setGradoElegido(g);
                            setSeccionId(null);
                          }}
                        >
                          {grados.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.nombre}
                            </option>
                          ))}
                        </Selector>
                      </div>
                    </div>
                    {seccionesDelGrado.length ? (
                      <div role="radiogroup" aria-label="Sección" className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {seccionesDelGrado.map((s) => (
                          <TarjetaSeccion
                            key={s.id}
                            seccion={s}
                            elegida={seccion?.id === s.id}
                            onElegir={() => {
                              setSeccionId(s.id);
                              setGeneral(null);
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-fondo px-4 py-3 text-[14px] text-texto-2">
                        {`No hay secciones activas de este grado en ${anio.anio}. Créalas en «Grados, secciones y aulas».`}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Selector
                        etiqueta="Apoderado responsable del pago"
                        obligatorio
                        valor={vinculoId}
                        onCambiar={setVinculoElegido}
                      >
                        <option value="">Elige al apoderado</option>
                        {sit.estudiante.apoderados.map((a) => (
                          <option key={a.vinculoId} value={a.vinculoId}>
                            {`${a.nombreCompleto} · ${a.parentesco}`}
                          </option>
                        ))}
                      </Selector>
                      <p className="text-[13px] text-texto-3">Solo entre los apoderados vinculados al estudiante.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Selector
                        etiqueta="Modalidad de pago"
                        obligatorio
                        valor={modalidad}
                        onCambiar={(m) => setModalidad(m as ModalidadPago)}
                      >
                        <option value="MENSUAL">Mensual</option>
                        <option value="ANUAL">Anual</option>
                      </Selector>
                      <p className="text-[13px] text-texto-3">
                        El cronograma tiene las mismas cuotas en ambas modalidades.
                      </p>
                    </div>
                  </div>
                  {seccion?.vacantes.completo && !general && (
                    <Alerta
                      tipo="error"
                      titulo={`Sección sin vacantes disponibles (${seccion.vacantes.matriculados}/${seccion.vacantes.aforo})`}
                    >
                      {`${etiquetaSeccion(seccion)} alcanzó su aforo máximo y no admite nuevas matrículas.`}
                    </Alerta>
                  )}
                  {general && (
                    <Alerta tipo="error" titulo={general.titulo}>
                      {general.detalle}
                    </Alerta>
                  )}
                  {sinMontos && (
                    <Alerta tipo="aviso" icono="alerta-warn" titulo="Configura los montos del año para matricular" />
                  )}
                  {sit.cronogramaPrevisto?.extemporanea && (
                    <Alerta tipo="info" titulo="Matrícula extemporánea">
                      {sit.cronogramaPrevisto.pensiones
                        ? `Como la matrícula se realiza después de iniciado el cobro, solo se generarán las pensiones de ${sit.cronogramaPrevisto.pensiones}.`
                        : "Ya no quedan pensiones por vencer este año: solo se generará la cuota de matrícula."}
                    </Alerta>
                  )}
                </>
              )}

              <div className="flex justify-end gap-3 border-t border-borde pt-5">
                {confirmada ? (
                  <Boton onClick={() => elegirEstudiante(null)} icono="icon-plus-blanco">
                    Nueva matrícula
                  </Boton>
                ) : (
                  <>
                    <Boton variante="secundario" onClick={() => elegirEstudiante(null)} disabled={enviando}>
                      Cancelar
                    </Boton>
                    <Boton
                      onClick={matricular}
                      cargando={enviando}
                      disabled={yaMatriculado || sinMontos || !anioAbierto}
                      icono="check-blanco"
                    >
                      Matricular
                    </Boton>
                  </>
                )}
              </div>
            </>
          )}
        </Tarjeta>

        <Tarjeta className="flex flex-col gap-4 p-6">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Resumen</h2>
          {sit ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-[14px]">
                <div className="col-span-2">
                  <dt className="text-texto-3">Estudiante</dt>
                  <dd className="font-semibold text-texto">{sit.estudiante.nombreCompleto}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-texto-3">Responsable del pago</dt>
                  <dd className="text-texto">
                    {sit.estudiante.apoderados.find((a) => a.vinculoId === vinculoId)?.nombreCompleto ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-texto-3">Año</dt>
                  <dd className="text-texto">{anio.anio}</dd>
                </div>
                <div>
                  <dt className="text-texto-3">Sección</dt>
                  <dd className="text-texto">
                    {confirmada?.seccion?.nombre ?? (seccion ? etiquetaSeccion(seccion) : "—")}
                  </dd>
                </div>
                <div>
                  <dt className="text-texto-3">Aula</dt>
                  <dd className="text-texto">{seccion?.aula?.nombre ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-texto-3">Fecha</dt>
                  <dd className="text-texto">
                    {fechaDia(
                      confirmada?.fechaMatricula ??
                        new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }),
                    )}
                  </dd>
                </div>
              </dl>
              {cronograma && (confirmada || !yaMatriculado) ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] font-semibold text-texto">
                    {confirmada ? "Cronograma generado" : "Cronograma que se generará"}
                  </p>
                  <TablaCronograma
                    cuotas={cronograma.cuotas}
                    total={cronograma.total}
                    conEstado={Boolean(confirmada)}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-[14px] text-texto-2">
              Elige un estudiante para ver su sección y el cronograma que se generará.
            </p>
          )}
        </Tarjeta>
      </div>

      <Tarjeta className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Matrículas</h2>
            <p className="text-[14px] text-texto-3">Año académico {anio.anio}</p>
          </div>
          <label className="flex w-full items-center gap-2 rounded-lg border border-borde bg-white px-4 py-2.5 sm:w-[280px]">
            <Icono nombre="icon-search" size={18} />
            <span className="sr-only">Buscar estudiante</span>
            <input
              type="search"
              value={filtros.q}
              maxLength={100}
              placeholder="Buscar estudiante"
              onChange={(e) => setFiltros((f) => ({ ...f, q: e.target.value, pagina: 1 }))}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-texto outline-none placeholder:text-texto-3"
            />
          </label>
        </div>
        <FiltrosMatriculas
          grados={grados}
          secciones={datosAnio?.secciones ?? []}
          estado={filtros.estado}
          gradoId={filtros.gradoId}
          seccionId={filtros.seccionId}
          onCambiar={(c) => setFiltros((f) => ({ ...f, ...c, pagina: 1 }))}
        />
        {errorListado && <Alerta tipo="error" titulo={errorListado} />}
        {!listado && !errorListado && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando…
          </div>
        )}
        {listado && listado.items.length === 0 && (
          <p className="rounded-lg bg-fondo px-4 py-6 text-center text-[14px] text-texto-2">
            No hay matrículas con estos filtros. Elige un estudiante arriba para matricularlo.
          </p>
        )}
        {listado && listado.items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-borde">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="bg-fondo text-[13px] text-texto-2">
                <tr>
                  <th className="px-4 py-3 font-medium">Estudiante</th>
                  <th className="px-4 py-3 font-medium">Sección</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {listado.items.map((m) => (
                  <tr key={m.matriculaId}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nombre={m.estudiante.nombreCompleto} />
                        <div className="flex flex-col">
                          <span className="font-semibold text-texto">{m.estudiante.nombreCompleto}</span>
                          <span className="text-[12px] text-texto-3">{`DNI ${m.estudiante.dni}`}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-texto">{m.seccion?.nombre ?? m.grado ?? "—"}</td>
                    <td className="px-4 py-3 text-texto">{fechaDia(m.fechaMatricula)}</td>
                    <td className="px-4 py-3">
                      <BadgeEstado estado={m.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {m.estado === "EN_PROCESO" && (
                          <button
                            type="button"
                            onClick={() => {
                              elegirEstudiante(m.estudianteId);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            aria-label={`Completar la matrícula de ${m.estudiante.nombreCompleto}`}
                            className="rounded-md p-1.5 hover:bg-fondo"
                          >
                            <Icono nombre="act-edit" size={18} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setVerDetalle(m.matriculaId)}
                          aria-label={`Ver la matrícula de ${m.estudiante.nombreCompleto}`}
                          className="rounded-md p-1.5 hover:bg-fondo"
                        >
                          <Icono nombre="act-eye" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {listado && listado.paginacion.paginas > 1 && (
          <div className="flex items-center justify-between text-[14px] text-texto-2">
            <span>{`${listado.paginacion.total} matrículas`}</span>
            <div className="flex gap-2">
              <Boton
                variante="secundario"
                disabled={filtros.pagina <= 1}
                onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina - 1 }))}
              >
                Anterior
              </Boton>
              <Boton
                variante="secundario"
                disabled={filtros.pagina >= listado.paginacion.paginas}
                onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina + 1 }))}
              >
                Siguiente
              </Boton>
            </div>
          </div>
        )}
        <p className="flex gap-2 text-[13px] leading-[1.4] text-texto-3">
          <Icono nombre="icon-info" size={16} />
          Estados: En proceso → Matriculado. Una matrícula En proceso o Matriculado sin pagos se puede anular desde su
          detalle; sus cuotas pendientes pasan a «Anulado».
        </p>
      </Tarjeta>

      {editandoMontos && datosAnio && (
        <ModalMontos
          montos={datosAnio.montos}
          onCerrar={() => setEditandoMontos(false)}
          onGuardado={(montos) => {
            setDelAnio((d) => d && { ...d, montos });
            setEditandoMontos(false);
            setAviso(`Se guardaron los montos del año ${montos.anio}.`);
            setRecarga((r) => r + 1);
          }}
        />
      )}
      {verDetalle && (
        <ModalDetalle
          matriculaId={verDetalle}
          onCerrar={() => setVerDetalle(null)}
          onAnular={(d) => {
            setVerDetalle(null);
            setAnulando(d);
          }}
        />
      )}
      {anulando && (
        <ModalAnular
          detalle={anulando}
          onCerrar={() => setAnulando(null)}
          onAnulada={() => {
            setAviso(`Se anuló la matrícula de ${anulando.estudiante?.nombreCompleto ?? "el estudiante"}.`);
            setAnulando(null);
            setRecarga((r) => r + 1);
            if (estudianteId === anulando.estudiante?.estudianteId) elegirEstudiante(null);
          }}
        />
      )}
    </>
  );
}

export default function MatriculaPage() {
  // useSearchParams (?estudiante= desde AD-09) necesita un límite de Suspense
  return (
    <Suspense
      fallback={
        <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando…
        </Tarjeta>
      }
    >
      <PaginaMatricula />
    </Suspense>
  );
}
