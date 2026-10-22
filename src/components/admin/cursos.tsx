// Piezas de AD-04 Cursos y competencias (US10, US11): tipos, ítem de la malla, detalle del curso, grados con horas,
// competencias por curso y grado, formulario «Registrar nuevo curso» y catálogo oficial (solo lectura).
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alerta, Badge, Boton, Campo, Casilla, Icono, Modal, Spinner, Tarjeta } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AnioAcademico } from "./anio";
import { Selector, separarErrores, type Grado } from "./grados";
import { alertaError } from "./PortalAdmin";

export interface Competencia {
  id: string;
  areaCurricularId: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface Area {
  id: string;
  codigo: string;
  nombre: string;
  competencias: Competencia[];
}

export interface PlanResumen {
  id: string;
  grado: Grado;
  horasSemanales: number;
  competencias: number;
  asignaciones: number;
}

export interface Curso {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  estado: "ACTIVO" | "INACTIVO";
  areaCurricular: { id: string; codigo: string; nombre: string };
  planes: PlanResumen[];
  competencias: number;
  uso: { docentes: number; seccionesConHorario: number };
}

interface CompetenciaPlan {
  id: string;
  orden: number;
  peso: number | null;
  notas: number;
  competencia: { id: string; codigo: string; nombre: string };
}

interface DetallePlan {
  plan: { id: string; grado: Grado; curso: { area: { nombre: string } } };
  competencias: CompetenciaPlan[];
  disponibles: Competencia[];
}

export const ID_CAMPO_CURSO = "curso-codigo";

/** «MAT-C1» → «C1»: en la pantalla el área ya está a la vista. */
const codigoCorto = (codigo: string) => codigo.split("-").pop() ?? codigo;

/** [1,2,3,4,5] → «1° a 5°»; [4,5] → «4° y 5°»; [1,3,5] → «1°, 3° y 5°». */
export function rangoGrados(numeros: number[]): string {
  const n = [...numeros].sort((a, b) => a - b);
  if (n.length === 0) return "";
  if (n.length === 1) return `${n[0]}°`;
  const seguidos = n.every((x, i) => i === 0 || x === n[i - 1] + 1);
  if (seguidos && n.length > 2) return `${n[0]}° a ${n[n.length - 1]}°`;
  return `${n
    .slice(0, -1)
    .map((x) => `${x}°`)
    .join(", ")} y ${n[n.length - 1]}°`;
}

/** «6» si todos los grados tienen las mismas horas; «5–6» si varían. */
function rangoHoras(planes: PlanResumen[]): string {
  const h = planes.map((p) => p.horasSemanales);
  const min = Math.min(...h);
  const max = Math.max(...h);
  return min === max ? `${min}` : `${min}–${max}`;
}

function ChipCodigo({ codigo, activo = true, grande }: { codigo: string; activo?: boolean; grande?: boolean }) {
  const tam = grande ? "size-14 text-[14px]" : "h-9 w-12 text-[11px]";
  const color = grande ? "bg-kubo-azul text-white" : activo ? "bg-fondo text-texto-2" : "bg-fondo text-texto-3";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md font-bold tracking-[0.4px] ${tam} ${color}`}>
      {codigo.slice(0, 5)}
    </span>
  );
}

// ---------- Malla curricular (lista de la izquierda) ----------

export function ItemCurso({ curso, elegido, onElegir }: { curso: Curso; elegido: boolean; onElegir: () => void }) {
  const activo = curso.estado === "ACTIVO";
  const grados = rangoGrados(curso.planes.map((p) => p.grado.numero));
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-current={elegido}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${
        elegido ? "bg-[rgba(27,77,137,0.06)] ring-[1.5px] ring-kubo-azul" : "hover:bg-fondo"
      }`}
    >
      {elegido ? (
        <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-kubo-azul text-[11px] font-bold text-white">
          {curso.codigo.slice(0, 5)}
        </span>
      ) : (
        <ChipCodigo codigo={curso.codigo} activo={activo} />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[14px] font-semibold leading-[1.4] ${activo ? "text-texto" : "text-texto-3"}`}>
          {curso.nombre}
        </span>
        <span className="text-[12px] leading-[1.5] text-texto-3">
          {curso.planes.length ? `${grados} · ${rangoHoras(curso.planes)} h/sem` : "Sin grados este año"}
        </span>
      </span>
      {activo ? (
        <span className="text-[12px] font-medium whitespace-nowrap text-texto-2">{curso.competencias} comp.</span>
      ) : (
        <Badge tono="gris" punto>
          Inactivo
        </Badge>
      )}
    </button>
  );
}

// ---------- Detalle del curso ----------

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] leading-[1.4] text-texto-3">{etiqueta}</span>
      <span className="text-[16px] font-medium leading-[1.5] text-texto">{valor}</span>
    </div>
  );
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function DetalleCurso({
  curso,
  onEditar,
  onCambiarEstado,
  onEliminar,
}: {
  curso: Curso;
  onEditar: () => void;
  onCambiarEstado: () => void;
  onEliminar: () => void;
}) {
  const activo = curso.estado === "ACTIVO";
  const enUso = curso.uso.docentes > 0 || curso.uso.seccionesConHorario > 0;
  const grados = rangoGrados(curso.planes.map((p) => p.grado.numero));
  return (
    <Tarjeta className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start gap-4">
        <ChipCodigo codigo={curso.codigo} grande />
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[24px] font-semibold leading-[1.3] text-texto">{curso.nombre}</h2>
            <Badge tono={activo ? "verde" : "gris"} punto>
              {activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="text-[14px] leading-[1.4] text-texto-3">
            Código {curso.codigo} · Área de {curso.areaCurricular.nombre}
          </p>
          {curso.descripcion && <p className="text-[14px] leading-[1.5] text-texto-2">{curso.descripcion}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <Boton variante="secundario" icono={activo ? "act-ban" : "act-refresh"} onClick={onCambiarEstado}>
            {activo ? "Desactivar" : "Activar"}
          </Boton>
          <Boton variante="secundario" icono="act-edit" onClick={onEditar}>
            Editar
          </Boton>
          {!enUso && (
            <Boton variante="secundario" icono="act-trash" onClick={onEliminar} aria-label="Eliminar curso">
              Eliminar
            </Boton>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Dato etiqueta="Grados" valor={grados ? `${grados} de secundaria` : "—"} />
        <Dato etiqueta="Horas semanales" valor={curso.planes.length ? `${rangoHoras(curso.planes)} horas` : "—"} />
        <Dato etiqueta="Docentes asignados" valor={plural(curso.uso.docentes, "docente", "docentes")} />
        <Dato etiqueta="Horarios publicados" valor={plural(curso.uso.seccionesConHorario, "sección", "secciones")} />
      </div>
      {enUso && (
        <Alerta tipo="aviso" icono="alerta-warn" titulo="Este curso no puede eliminarse">
          Está asignado a {plural(curso.uso.docentes, "docente", "docentes")} y a{" "}
          {plural(curso.uso.seccionesConHorario, "horario publicado", "horarios publicados")}. Puedes desactivarlo para
          que no se use en nuevas asignaciones.
        </Alerta>
      )}
    </Tarjeta>
  );
}

// ---------- Grados y horas del curso (plan de estudio del año) ----------

export function PanelGrados({
  curso,
  grados,
  anio,
  soloLectura,
  onGuardado,
}: {
  curso: Curso;
  grados: Grado[];
  anio: AnioAcademico;
  soloLectura: boolean;
  onGuardado: (mensaje: string) => void;
}) {
  const inicial = Object.fromEntries(curso.planes.map((p) => [p.grado.id, String(p.horasSemanales)]));
  const [horas, setHoras] = useState<Record<string, string>>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setError(null);
    const planes = Object.entries(horas).map(([gradoId, h]) => ({ gradoId, horasSemanales: Number(h) }));
    setEnviando(true);
    try {
      await api(`/academico/cursos/${curso.id}/planes?anioId=${anio.id}`, { method: "PUT", body: { planes } });
      onGuardado(`Se guardaron los grados de ${curso.nombre} para ${anio.anio}.`);
    } catch (e) {
      setError(separarErrores(e).general ?? "Revisa las horas: deben ser números enteros mayores a 0.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[20px] font-semibold leading-[1.3] text-texto">Grados y horas semanales</h3>
        <p className="text-[14px] leading-[1.4] text-texto-3">
          Plan de estudio {anio.anio}: grados en que se dicta y sus horas por semana
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {grados.map((g) => {
          const marcado = horas[g.id] !== undefined;
          return (
            <div
              key={g.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${marcado ? "border-kubo-azul" : "border-borde"}`}
            >
              <Casilla
                etiqueta={`${g.numero}°`}
                checked={marcado}
                onChange={(v) => {
                  if (soloLectura) return;
                  setHoras((h) => {
                    const { [g.id]: anterior, ...resto } = h;
                    return v ? { ...resto, [g.id]: anterior ?? "" } : resto;
                  });
                }}
              />
              <span className="flex-1" />
              {marcado && (
                <input
                  aria-label={`Horas semanales de ${g.nombre}`}
                  type="number"
                  min={1}
                  value={horas[g.id]}
                  disabled={soloLectura}
                  onChange={(e) => setHoras((h) => ({ ...h, [g.id]: e.target.value }))}
                  className="w-14 rounded-md border border-borde px-2 py-1 text-right text-[14px] outline-none focus:border-kubo-azul"
                />
              )}
            </div>
          );
        })}
      </div>
      {error && <Alerta tipo="error" titulo={error} />}
      {!soloLectura && (
        <div className="flex justify-end">
          <Boton onClick={guardar} cargando={enviando} icono="check-blanco">
            Guardar grados
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}

// ---------- Competencias del curso, por grado (US11) ----------

/** Fila «☑ C1 Resuelve problemas de cantidad · 318 notas» del catálogo del área. */
function FilaCompetencia({
  competencia,
  marcada,
  notas,
  onCambiar,
  deshabilitada,
}: {
  competencia: Competencia;
  marcada: boolean;
  notas?: number;
  onCambiar: (v: boolean) => void;
  deshabilitada?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 ${
        marcada ? "border-kubo-azul bg-[rgba(27,77,137,0.04)]" : "border-borde"
      } ${deshabilitada ? "cursor-not-allowed opacity-70" : ""}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={marcada}
        disabled={deshabilitada}
        onChange={(e) => onCambiar(e.target.checked)}
      />
      <span
        className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] peer-focus-visible:ring-2 peer-focus-visible:ring-kubo-azul/40 ${
          marcada ? "border-verde-oscuro bg-verde-oscuro" : "border-texto-3 bg-white"
        }`}
      >
        {marcada && <Icono nombre="check-blanco" size={14} />}
      </span>
      <span className="rounded bg-fondo px-2 py-0.5 text-[12px] font-bold text-texto-2">
        {codigoCorto(competencia.codigo)}
      </span>
      <span className="flex-1 text-[14px] leading-[1.4] text-texto">
        {competencia.nombre}
        {!competencia.activo && <span className="text-texto-3"> (desactivada en el catálogo)</span>}
      </span>
      {notas !== undefined &&
        (notas > 0 ? (
          <Badge tono="gris">{plural(notas, "nota", "notas")}</Badge>
        ) : (
          <span className="text-[12px] whitespace-nowrap text-texto-3">Sin notas</span>
        ))}
    </label>
  );
}

/** Edita las competencias de un plan ya cargado. Para descartar, el padre cambia su key (estándar 6.5). */
function EditorCompetencias({
  detalle,
  soloLectura,
  onDescartar,
  onGuardado,
}: {
  detalle: DetallePlan;
  soloLectura: boolean;
  onDescartar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const guardadas = new Map(detalle.competencias.map((c) => [c.competencia.id, c]));
  const [elegidas, setElegidas] = useState<string[]>(detalle.competencias.map((c) => c.competencia.id));
  const [bloqueo, setBloqueo] = useState<CompetenciaPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const visibles = detalle.disponibles.filter((c) => c.activo || guardadas.has(c.id));

  function cambiar(c: Competencia, marcar: boolean) {
    setError(null);
    const conNotas = guardadas.get(c.id);
    if (!marcar && conNotas && conNotas.notas > 0) {
      setBloqueo(conNotas);
      return;
    }
    setBloqueo(null);
    setElegidas((e) => (marcar ? [...e, c.id] : e.filter((id) => id !== c.id)));
  }

  async function guardar() {
    if (elegidas.length === 0) {
      setError("Debes seleccionar al menos una competencia");
      return;
    }
    // el orden sigue el catálogo (C1, C2…); el peso guardado se conserva
    const competencias = visibles
      .filter((c) => elegidas.includes(c.id))
      .map((c, i) => ({ competenciaId: c.id, orden: i + 1, peso: guardadas.get(c.id)?.peso ?? null }));
    setEnviando(true);
    try {
      await api(`/academico/planes/${detalle.plan.id}/competencias`, { method: "PUT", body: { competencias } });
      onGuardado(`Se guardaron las competencias de ${detalle.plan.grado.nombre}.`);
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="-mt-2 flex justify-end">
        <Badge tono="celeste" punto>
          {elegidas.length} de {visibles.length} seleccionadas
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        {visibles.map((c) => (
          <FilaCompetencia
            key={c.id}
            competencia={c}
            marcada={elegidas.includes(c.id)}
            notas={guardadas.get(c.id)?.notas ?? (elegidas.includes(c.id) ? 0 : undefined)}
            deshabilitada={soloLectura}
            onCambiar={(v) => cambiar(c, v)}
          />
        ))}
      </div>
      {bloqueo && (
        <Alerta tipo="error" titulo="No se puede desmarcar una competencia con notas registradas">
          “{bloqueo.competencia.nombre}” tiene {plural(bloqueo.notas, "nota registrada", "notas registradas")}.
        </Alerta>
      )}
      {error && <Alerta tipo="error" titulo={error} />}
      {!soloLectura && (
        <div className="flex justify-end gap-3">
          <Boton variante="secundario" onClick={onDescartar} disabled={enviando}>
            Descartar
          </Boton>
          <Boton onClick={guardar} cargando={enviando} icono="check-blanco">
            Guardar competencias
          </Boton>
        </div>
      )}
    </>
  );
}

export function PanelCompetencias({
  curso,
  soloLectura,
  onGuardado,
}: {
  curso: Curso;
  soloLectura: boolean;
  onGuardado: (mensaje: string) => void;
}) {
  const [planElegido, setPlanElegido] = useState<string | null>(null);
  const plan = curso.planes.find((p) => p.id === planElegido) ?? curso.planes[0];
  const [carga, setCarga] = useState<{ planId: string; detalle?: DetallePlan; error?: string } | null>(null);
  const [version, setVersion] = useState(0);
  const planId = plan?.id;

  useEffect(() => {
    if (!planId) return;
    let vigente = true;
    async function cargar() {
      try {
        const detalle = await api<DetallePlan>(`/academico/planes/${planId}/competencias`);
        if (vigente) setCarga({ planId: planId!, detalle });
      } catch (e) {
        if (vigente) setCarga({ planId: planId!, error: alertaError(e) });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [planId, version]);

  const actual = carga?.planId === planId ? carga : null;

  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-fondo">
          <Icono nombre="icon-award" size={20} />
        </span>
        <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
          <h3 className="text-[20px] font-semibold leading-[1.3] text-texto">Competencias del curso</h3>
          <p className="text-[14px] leading-[1.4] text-texto-3">
            Catálogo oficial del Currículo Nacional (CNEB) · área de {curso.areaCurricular.nombre}
          </p>
        </div>
      </div>

      {!plan ? (
        <Alerta tipo="info" titulo="Primero asocia el curso a un grado">
          Las competencias se eligen por grado. Marca al menos un grado con sus horas y guárdalo.
        </Alerta>
      ) : (
        <>
          <div role="tablist" aria-label="Grado" className="flex flex-wrap gap-2">
            {curso.planes.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={p.id === plan.id}
                onClick={() => setPlanElegido(p.id)}
                className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                  p.id === plan.id ? "bg-kubo-azul text-white" : "bg-fondo text-texto-2 hover:text-texto"
                }`}
              >
                {p.grado.numero}° · {p.competencias} comp.
              </button>
            ))}
          </div>
          <Alerta
            tipo="info"
            titulo="Las competencias vienen del catálogo oficial. Para agregar, editar o desactivar una, usa la pestaña «Catálogo oficial»."
          >
            Son fijas para todos los colegios, estatales y particulares. Aquí solo eliges cuáles evalúa este curso en{" "}
            {plan.grado.nombre}.
          </Alerta>
          {!actual && (
            <div className="flex items-center gap-3 text-[14px] text-texto-2">
              <Spinner claro={false} /> Cargando competencias…
            </div>
          )}
          {actual?.error && <Alerta tipo="error" titulo={actual.error} />}
          {actual?.detalle && (
            <EditorCompetencias
              key={`${plan.id}-${version}`}
              detalle={actual.detalle}
              soloLectura={soloLectura}
              onDescartar={() => setVersion((v) => v + 1)}
              onGuardado={(mensaje) => {
                setVersion((v) => v + 1);
                onGuardado(mensaje);
              }}
            />
          )}
        </>
      )}
    </Tarjeta>
  );
}

// ---------- Registrar nuevo curso / Editar curso ----------

interface DatosFormulario {
  codigo: string;
  nombre: string;
  descripcion: string;
  areaCurricularId: string;
  grados: string[];
  horas: string;
  competencias: string[];
}

const CAMPO_POR_CODIGO: Record<string, string> = {
  CURSO_DUPLICADO: "codigo",
  CODIGO_CURSO_INVALIDO: "codigo",
  AREA_REQUERIDA: "areaCurricularId",
  AREA_CON_COMPETENCIAS: "areaCurricularId",
  HORAS_INVALIDAS: "horas",
  COMPETENCIAS_REQUERIDAS: "competencias",
};

/**
 * Paso 1: datos del curso. Paso 2 (solo al registrar): grados del año, horas y competencias que evaluará.
 * Todo se guarda en una sola llamada. Al editar solo cambian los datos del curso.
 */
export function FormularioCurso({
  curso,
  areas,
  grados,
  anio,
  onCancelar,
  onGuardado,
}: {
  curso: Curso | null;
  areas: Area[];
  grados: Grado[];
  anio: AnioAcademico | undefined;
  onCancelar: () => void;
  onGuardado: (curso: Curso, mensaje: string) => void;
}) {
  const [d, setD] = useState<DatosFormulario>({
    codigo: curso?.codigo ?? "",
    nombre: curso?.nombre ?? "",
    descripcion: curso?.descripcion ?? "",
    areaCurricularId: curso?.areaCurricular.id ?? "",
    grados: [],
    horas: "",
    competencias: [],
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const area = areas.find((a) => a.id === d.areaCurricularId);
  const conPlan = !curso && Boolean(anio) && anio?.estado !== "CERRADO";
  const poner = (cambios: Partial<DatosFormulario>) => setD((x) => ({ ...x, ...cambios }));

  function validar(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!d.codigo.trim()) e.codigo = "Ingresa el código del curso";
    if (!d.nombre.trim()) e.nombre = "Ingresa el nombre del curso";
    if (!d.areaCurricularId) e.areaCurricularId = "Debe seleccionar el área curricular del curso";
    if (conPlan && d.grados.length > 0) {
      const h = Number(d.horas);
      if (!Number.isInteger(h) || h <= 0) e.horas = "Las horas semanales deben ser un número entero mayor a 0";
      if (d.competencias.length === 0) e.competencias = "Debes seleccionar al menos una competencia";
    }
    return e;
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setGeneral(null);
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) return;
    const datos = {
      codigo: d.codigo,
      nombre: d.nombre,
      descripcion: d.descripcion.trim() || null,
      areaCurricularId: d.areaCurricularId,
    };
    setEnviando(true);
    try {
      if (curso) {
        const c = await api<Curso>(`/academico/cursos/${curso.id}`, { method: "PATCH", body: datos });
        onGuardado(c, `Se actualizó el curso ${c.nombre}.`);
      } else {
        const plan =
          conPlan && d.grados.length
            ? {
                anioAcademicoId: anio!.id,
                grados: d.grados.map((gradoId) => ({ gradoId, horasSemanales: Number(d.horas) })),
                competencias: d.competencias,
              }
            : undefined;
        const c = await api<Curso>("/academico/cursos", { method: "POST", body: { ...datos, plan } });
        onGuardado(c, `Se registró el curso ${c.nombre}.`);
      }
    } catch (err) {
      const r = separarErrores(err, CAMPO_POR_CODIGO);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[20px] font-semibold leading-[1.3] text-texto">
          {curso ? `Editar ${curso.nombre}` : "Registrar nuevo curso"}
        </h3>
        <p className="text-[14px] leading-[1.4] text-texto-3">
          {curso
            ? "Datos del curso. Los grados y las competencias se cambian en sus propios bloques."
            : "Paso 1: datos del curso · Paso 2: competencias que evaluará"}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo
          id={ID_CAMPO_CURSO}
          etiqueta="Código"
          obligatorio
          value={d.codigo}
          maxLength={12}
          placeholder="ART-2"
          onChange={(e) => poner({ codigo: e.target.value })}
          error={errores.codigo}
        />
        <Campo
          etiqueta="Nombre del curso"
          obligatorio
          value={d.nombre}
          maxLength={100}
          placeholder="Arte y Cultura II"
          onChange={(e) => poner({ nombre: e.target.value })}
          error={errores.nombre}
        />
      </div>
      <div className={`grid grid-cols-1 gap-4 ${conPlan ? "md:grid-cols-[1fr_1.4fr_0.7fr]" : ""}`}>
        <Selector
          etiqueta="Área curricular"
          obligatorio
          valor={d.areaCurricularId}
          onCambiar={(v) => poner({ areaCurricularId: v, competencias: [] })}
          error={errores.areaCurricularId}
          ayuda="Determina las competencias disponibles."
        >
          <option value="">Elige el área</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </Selector>
        {conPlan && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 flex gap-1 text-[14px] font-medium leading-[1.4] text-texto-2">
              Grados <span className="text-rojo">*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {grados.map((g) => {
                const marcado = d.grados.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() =>
                      poner({ grados: marcado ? d.grados.filter((x) => x !== g.id) : [...d.grados, g.id] })
                    }
                    className={`rounded-lg border px-2.5 py-2.5 text-[14px] ${
                      marcado
                        ? "border-kubo-azul bg-[rgba(27,77,137,0.06)] font-semibold text-kubo-azul"
                        : "border-borde text-texto-2"
                    }`}
                  >
                    {g.numero}°
                  </button>
                );
              })}
            </div>
            <p className="text-[13px] leading-[1.4] text-texto-3">
              {d.grados.length
                ? `${rangoGrados(grados.filter((g) => d.grados.includes(g.id)).map((g) => g.numero))} de secundaria · ${anio!.anio}`
                : `Año ${anio!.anio}`}
            </p>
          </fieldset>
        )}
        {conPlan && (
          <Campo
            etiqueta="Horas semanales"
            obligatorio={d.grados.length > 0}
            type="number"
            min={1}
            value={d.horas}
            onChange={(e) => poner({ horas: e.target.value })}
            error={errores.horas}
          />
        )}
      </div>
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="curso-descripcion" className="text-[14px] font-medium leading-[1.4] text-texto-2">
          Descripción (opcional)
        </label>
        <textarea
          id="curso-descripcion"
          rows={2}
          maxLength={500}
          value={d.descripcion}
          onChange={(e) => poner({ descripcion: e.target.value })}
          className="w-full rounded-lg border border-borde bg-white px-4 py-3 text-[16px] leading-[1.4] text-texto outline-none focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul"
        />
      </div>

      {conPlan && area && (
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-medium leading-[1.4] text-texto-2">
            Competencias del área (selecciona al menos una)
          </p>
          {area.competencias
            .filter((c) => c.activo)
            .map((c) => (
              <FilaCompetencia
                key={c.id}
                competencia={c}
                marcada={d.competencias.includes(c.id)}
                onCambiar={(v) =>
                  poner({ competencias: v ? [...d.competencias, c.id] : d.competencias.filter((x) => x !== c.id) })
                }
              />
            ))}
          {d.grados.length > 0 && d.competencias.length === 0 && (
            <Alerta tipo="aviso" icono="alerta-warn" titulo="Debes seleccionar al menos una competencia">
              Sin competencias, el docente no podrá registrar notas y verá “Este curso no tiene competencias
              configuradas. Contacte al administrador.”
            </Alerta>
          )}
          {errores.competencias && d.competencias.length > 0 && <Alerta tipo="error" titulo={errores.competencias} />}
        </div>
      )}

      {general && <Alerta tipo="error" titulo={general} />}
      <div className="flex justify-end gap-3">
        <Boton type="button" variante="secundario" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={enviando} icono="check-blanco">
          {curso ? "Guardar cambios" : "Guardar curso"}
        </Boton>
      </div>
    </form>
  );
}

// ---------- Eliminar curso ----------

export function ModalEliminarCurso({
  curso,
  onCerrar,
  onListo,
  onError,
}: {
  curso: Curso | null;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
  onError: (curso: Curso, mensaje: string, codigo: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!curso) return;
    setEnviando(true);
    try {
      await api(`/academico/cursos/${curso.id}`, { method: "DELETE" });
      onListo(`Se eliminó el curso ${curso.nombre}.`);
    } catch (err) {
      onError(curso, alertaError(err), err instanceof ApiError ? err.codigo : "ERROR");
    } finally {
      setEnviando(false);
      onCerrar();
    }
  }

  return (
    <Modal
      abierto={Boolean(curso)}
      onCerrar={onCerrar}
      icono="kpi-ban"
      titulo={curso ? `Eliminar ${curso.nombre}` : ""}
      subtitulo="Solo se elimina un curso sin docentes asignados ni horarios publicados."
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="peligro" onClick={confirmar} cargando={enviando}>
            Eliminar curso
          </Boton>
        </>
      }
    >
      <p className="text-[14px] leading-[1.5] text-texto-2">
        Se borran también sus grados y competencias de todos los años. Si el curso ya se usó, conviene desactivarlo.
      </p>
    </Modal>
  );
}

// ---------- Catálogo oficial (solo lectura) ----------

export function CatalogoOficial({ areas }: { areas: Area[] }) {
  return (
    <div className="flex flex-col gap-4">
      <Alerta tipo="info" titulo="Competencias del Currículo Nacional de la Educación Básica (CNEB)">
        Son las mismas para todos los colegios. Cada curso evalúa solo competencias de su área curricular (RF09).
      </Alerta>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {areas.map((a) => (
          <Tarjeta key={a.id} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <ChipCodigo codigo={a.codigo} />
              <h3 className="flex-1 text-[16px] font-semibold text-texto">{a.nombre}</h3>
              <span className="text-[12px] text-texto-3">{a.competencias.length} comp.</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {a.competencias.map((c) => (
                <li key={c.id} className="flex gap-2 text-[14px] leading-[1.4] text-texto-2">
                  <span className="w-8 shrink-0 font-bold text-texto-3">{codigoCorto(c.codigo)}</span>
                  <span className={c.activo ? "" : "text-texto-3 line-through"}>{c.nombre}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
