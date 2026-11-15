// AD-13 · Matriz de horarios y M-06 · Asignar clase (US27, US28, US29, US30, US31): tipos de la API de horarios,
// cuadrícula semanal, modal para asignar o vaciar un bloque y paneles de validaciones y de cursos de la sección.
"use client";

import { useEffect, useState } from "react";
import { Selector, type Aula } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Icono, Modal, Tarjeta } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

export type Dia = "LUNES" | "MARTES" | "MIERCOLES" | "JUEVES" | "VIERNES";
export type EstadoHorario = "BORRADOR" | "PUBLICADO" | "ARCHIVADO";

export const NOMBRE_DIA: Record<Dia, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
};

export interface Bloque {
  id: string;
  orden: number;
  horaInicio: string;
  horaFin: string;
  tipo: "CLASE" | "RECREO";
  etiqueta: string;
}

interface DocenteClase {
  id: string;
  nombreCompleto: string;
  nombreCorto: string;
}

export interface Clase {
  id: string;
  dia: Dia;
  bloqueId: string;
  curso: { id: string; codigo: string; nombre: string };
  docente: DocenteClase;
  aula: { id: string; nombre: string };
  asignacionActiva: boolean;
}

export interface Version {
  id: string;
  version: number;
  estado: EstadoHorario;
  publicadoEn: string | null;
}

export interface CursoPlan {
  cursoId: string;
  codigo: string;
  nombre: string;
  horasSemanales: number;
  asignados: number;
  faltan: number;
  sobran: number;
  docente: DocenteClase | null;
}

export interface BloqueLibre {
  dia: Dia;
  bloqueId: string;
  horaInicio: string;
  horaFin: string;
}

export interface Pendientes {
  cursos: { cursoId: string; nombre: string; horasSemanales: number; asignados: number; faltan: number }[];
  bloquesLibres: BloqueLibre[];
}

export interface Cuadricula {
  seccion: {
    id: string;
    nombre: string;
    etiqueta: string;
    aula: { id: string; nombre: string } | null;
    anio: { id: string; anio: number; estado: string };
  };
  editable: boolean;
  motivoSoloLectura: string | null;
  dias: Dia[];
  bloques: Bloque[];
  horario: Version | null;
  hayBorrador: boolean;
  versiones: Version[];
  clases: Clase[];
  plan: CursoPlan[];
  avance: { asignados: number; requeridos: number };
  pendientes: Pendientes;
}

export interface CuadriculaPublicada extends Cuadricula {
  aviso: { docentes: number; enviados: number };
}

interface Ocupacion {
  docentes: { docenteId: string; seccion: string }[];
  aulas: { aulaId: string; seccion: string }[];
}

export interface Celda {
  dia: Dia;
  bloque: Bloque;
}

const NOMBRE_ESTADO: Record<EstadoHorario, string> = {
  BORRADOR: "Borrador",
  PUBLICADO: "Publicado",
  ARCHIVADO: "Archivado",
};
const TONO_ESTADO = { BORRADOR: "ambar", PUBLICADO: "verde", ARCHIVADO: "gris" } as const;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «Martes 12:35 – 13:20». */
export const textoBloque = (b: { dia: Dia; horaInicio: string; horaFin: string }) =>
  `${NOMBRE_DIA[b.dia]} ${b.horaInicio} – ${b.horaFin}`;

/** «Borrador · versión 3», «Publicado · versión 2» o «Sin horario». */
export function BadgeVersion({ horario }: { horario: Version | null }) {
  if (!horario) return <Badge tono="gris">Sin horario</Badge>;
  return (
    <Badge tono={TONO_ESTADO[horario.estado]} punto>
      {NOMBRE_ESTADO[horario.estado]} · versión {horario.version}
    </Badge>
  );
}

/** «32 / 35 bloques» con su barra: clases asignadas frente a las horas semanales del plan de estudios. */
export function AvanceBloques({ avance }: { avance: Cuadricula["avance"] }) {
  const porcentaje = avance.requeridos ? Math.min((avance.asignados / avance.requeridos) * 100, 100) : 0;
  return (
    <div className="flex w-[130px] flex-col gap-1.5">
      <p className="text-[13px] font-semibold leading-[1.4] text-texto">
        {avance.asignados} / {avance.requeridos} bloques
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={avance.requeridos}
        aria-valuenow={avance.asignados}
        aria-label="Bloques asignados"
        className="h-1 w-full overflow-hidden rounded-full bg-borde"
      >
        {/* ancho calculado en tiempo de ejecución */}
        <div className="h-full rounded-full bg-kubo-azul" style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}

// ---------- Cuadrícula ----------

function TarjetaClase({ clase, onEditar }: { clase: Clase; onEditar?: () => void }) {
  const contenido = (
    <>
      <span className="truncate text-[13px] font-semibold leading-[1.35] text-texto">{clase.curso.nombre}</span>
      <span className="truncate text-[12px] leading-[1.35] text-texto-2">{clase.docente.nombreCorto}</span>
      <span className={`truncate text-[12px] leading-[1.35] ${clase.asignacionActiva ? "text-texto-3" : "text-rojo"}`}>
        {clase.asignacionActiva ? clase.aula.nombre : "Docente sin el curso"}
      </span>
    </>
  );
  const caja = `flex h-full min-h-[66px] w-full flex-col justify-center rounded-md border-l-[3px] px-2.5 py-1.5 text-left ${
    clase.asignacionActiva ? "border-kubo-azul bg-fondo" : "border-rojo bg-[rgba(214,69,69,0.08)]"
  }`;
  if (!onEditar) return <div className={caja}>{contenido}</div>;
  return (
    <button
      type="button"
      onClick={onEditar}
      aria-label={`Editar ${clase.curso.nombre}`}
      className={`${caja} hover:ring-1 hover:ring-kubo-azul focus-visible:ring-2 focus-visible:ring-kubo-azul`}
    >
      {contenido}
    </button>
  );
}

function CeldaVacia({ etiqueta, onAsignar }: { etiqueta: string; onAsignar?: () => void }) {
  if (!onAsignar) {
    return <div className="h-full min-h-[66px] rounded-md border border-dashed border-borde" aria-label="Sin clase" />;
  }
  return (
    <button
      type="button"
      onClick={onAsignar}
      aria-label={`Asignar clase: ${etiqueta}`}
      className="flex h-full min-h-[66px] w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-borde text-[13px] text-texto-2 hover:border-kubo-azul hover:text-kubo-azul focus-visible:ring-2 focus-visible:ring-kubo-azul"
    >
      <Icono nombre="icon-plus-gris" size={14} /> Asignar
    </button>
  );
}

/**
 * Cuadrícula semanal: los 5 días en columnas y los bloques del año en filas; el recreo queda sin asignar (US27).
 * Con `onElegir`, cada bloque abre el modal para asignar o editar su clase.
 */
export function CuadriculaHorario({
  cuadricula,
  onElegir,
}: {
  cuadricula: Cuadricula;
  onElegir?: (celda: Celda) => void;
}) {
  const claseDe = (dia: Dia, bloqueId: string) =>
    cuadricula.clases.find((c) => c.dia === dia && c.bloqueId === bloqueId);
  return (
    <Tarjeta className="overflow-x-auto">
      <table className="w-full min-w-[640px] table-fixed border-collapse">
        <thead>
          <tr className="border-b border-borde text-left text-[13px] font-semibold text-texto-2">
            <th scope="col" className="w-[72px] px-3 py-3">
              Hora
            </th>
            {cuadricula.dias.map((dia) => (
              <th key={dia} scope="col" className="border-l border-borde px-3 py-3">
                {NOMBRE_DIA[dia]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cuadricula.bloques.map((b) =>
            b.tipo === "RECREO" ? (
              <tr key={b.id} className="border-b border-borde bg-fondo">
                <td
                  colSpan={cuadricula.dias.length + 1}
                  className="px-3 py-1.5 text-center text-[11px] font-semibold tracking-[1px] text-texto-3"
                >
                  {b.etiqueta.toUpperCase()} · {b.horaInicio} – {b.horaFin}
                </td>
              </tr>
            ) : (
              <tr key={b.id} className="border-b border-borde last:border-b-0">
                <th scope="row" className="px-3 py-2 text-left align-middle">
                  <span className="block text-[13px] font-semibold leading-[1.4] text-texto">{b.horaInicio}</span>
                  <span className="block text-[12px] font-normal leading-[1.4] text-texto-3">{b.horaFin}</span>
                </th>
                {cuadricula.dias.map((dia) => {
                  const clase = claseDe(dia, b.id);
                  const elegir = onElegir ? () => onElegir({ dia, bloque: b }) : undefined;
                  return (
                    <td key={dia} className="h-[78px] border-l border-borde p-1.5 align-top">
                      {clase ? (
                        <TarjetaClase clase={clase} onEditar={elegir} />
                      ) : (
                        <CeldaVacia etiqueta={textoBloque({ dia, ...b })} onAsignar={elegir} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </Tarjeta>
  );
}

// ---------- Paneles laterales ----------

function Validacion({ tono, titulo, detalle }: { tono: "ok" | "aviso" | "error"; titulo: string; detalle: string }) {
  const icono = { ok: "icon-check-verde", aviso: "alerta-warn", error: "alerta-err" }[tono];
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">
        <Icono nombre={icono} size={18} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold leading-[1.4] text-texto">{titulo}</span>
        <span className="text-[13px] leading-[1.4] text-texto-2">{detalle}</span>
      </span>
    </li>
  );
}

/** «Validaciones»: lo que el sistema ya garantiza al guardar y lo que falta para publicar (US29, US30, US31). */
export function PanelValidaciones({ cuadricula }: { cuadricula: Cuadricula }) {
  const faltan = cuadricula.pendientes.cursos.reduce((total, c) => total + c.faltan, 0);
  const excedidos = cuadricula.plan.filter((c) => c.sobran > 0);
  const sinDocente = cuadricula.clases.filter((c) => !c.asignacionActiva).length;
  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Validaciones</h2>
      <ul className="flex flex-col gap-4">
        <Validacion
          tono="ok"
          titulo="Sin cruces de docente"
          detalle="Ningún docente tiene dos clases en el mismo bloque: el sistema lo impide al guardar."
        />
        <Validacion
          tono="ok"
          titulo="Sin cruces de aula"
          detalle="Ningún aula tiene dos secciones en el mismo bloque: el sistema lo impide al guardar."
        />
        {sinDocente > 0 ? (
          <Validacion
            tono="error"
            titulo={`${plural(sinDocente, "clase", "clases")} con un docente que ya no tiene el curso`}
            detalle="Vuelve a asignarlas antes de publicar."
          />
        ) : (
          <Validacion
            tono="ok"
            titulo="Curso y docente coinciden"
            detalle="Cada bloque usa un docente con el curso asignado."
          />
        )}
        {faltan > 0 && (
          <Validacion
            tono="aviso"
            titulo={`${plural(faltan, "bloque", "bloques")} sin asignar`}
            detalle="Complétalos antes de publicar."
          />
        )}
        {excedidos.length > 0 && (
          <Validacion
            tono="aviso"
            titulo="Cursos con bloques de más"
            detalle={excedidos.map((c) => `${c.nombre} (${c.asignados} de ${c.horasSemanales})`).join(" · ")}
          />
        )}
        {faltan === 0 && excedidos.length === 0 && cuadricula.plan.length > 0 && (
          <Validacion
            tono="ok"
            titulo="Horario completo"
            detalle="Cada curso tiene tantos bloques como horas semanales."
          />
        )}
      </ul>
    </Tarjeta>
  );
}

const iniciales = (nombre: string) =>
  nombre
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

/** «Cursos de 5° A»: cada curso del plan con su docente y sus bloques asignados frente a las horas semanales. */
export function PanelCursos({ cuadricula }: { cuadricula: Cuadricula }) {
  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Cursos de {cuadricula.seccion.etiqueta}</h2>
      {cuadricula.plan.length === 0 ? (
        <p className="text-[14px] leading-[1.4] text-texto-2">
          El grado aún no tiene cursos en su plan de estudios. Agrégalos en «Cursos y competencias».
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cuadricula.plan.map((c) => (
            <li key={c.cursoId} className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-kubo-azul text-[11px] font-semibold text-white"
              >
                {c.docente ? iniciales(c.docente.nombreCorto) : "—"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold leading-[1.4] text-texto">{c.nombre}</span>
                <span className={`truncate text-[12px] leading-[1.4] ${c.docente ? "text-texto-3" : "text-rojo"}`}>
                  {c.docente?.nombreCompleto ?? "Sin docente asignado"}
                </span>
              </span>
              <span
                className={`shrink-0 text-[13px] leading-[1.4] ${c.faltan || c.sobran ? "font-semibold text-ambar-oscuro" : "text-texto-2"}`}
              >
                {c.asignados} / {c.horasSemanales}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/** «No se puede publicar: existen bloques horarios sin asignar» con los cursos y los bloques pendientes (US31). */
export function AlertaPendientes({ mensaje, pendientes }: { mensaje: string; pendientes: Partial<Pendientes> }) {
  const MAXIMO_BLOQUES = 8;
  const libres = pendientes.bloquesLibres ?? [];
  return (
    <Alerta tipo="error" titulo={mensaje}>
      {pendientes.cursos && pendientes.cursos.length > 0 && (
        <p>
          {pendientes.cursos
            .map((c) => `${c.nombre}: ${c.faltan === 1 ? "falta 1 bloque" : `faltan ${c.faltan} bloques`}`)
            .join(" · ")}
        </p>
      )}
      {libres.length > 0 && (
        <p>
          Bloques libres: {libres.slice(0, MAXIMO_BLOQUES).map(textoBloque).join(" · ")}
          {libres.length > MAXIMO_BLOQUES && ` · y ${libres.length - MAXIMO_BLOQUES} más`}
        </p>
      )}
    </Alerta>
  );
}

// ---------- M-06 · Asignar clase ----------

const MENSAJE_INCOMPLETA = "Debe completar curso, docente y aula antes de guardar";
const CODIGOS_DOCENTE = ["CRUCE_DOCENTE", "DOCENTE_SIN_CURSO"];
const CODIGOS_AULA = ["AULA_OCUPADA", "AULA_INACTIVA"];

interface ErrorClase {
  campo: "docente" | "aula" | "general";
  mensaje: string;
}

function errorDeClase(e: unknown): ErrorClase {
  const mensaje = alertaError(e);
  const codigo = e instanceof ApiError ? e.codigo : "";
  if (CODIGOS_DOCENTE.includes(codigo)) return { campo: "docente", mensaje };
  if (CODIGOS_AULA.includes(codigo)) return { campo: "aula", mensaje };
  return { campo: "general", mensaje };
}

/** «Docentes con Arte y Cultura asignado»: el docente del curso y si ya está ocupado en ese día y bloque. */
function DocentesDelCurso({ curso, ocupacion }: { curso: CursoPlan; ocupacion: Ocupacion | null }) {
  const ocupado = ocupacion?.docentes.find((d) => d.docenteId === curso.docente?.id);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-semibold leading-[1.4] text-texto">Docentes con {curso.nombre} asignado</p>
      {curso.docente ? (
        <div className="flex items-center gap-3 border-b border-borde pb-2">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-kubo-azul text-[11px] font-semibold text-white"
          >
            {iniciales(curso.docente.nombreCorto)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] text-texto">{curso.docente.nombreCompleto}</span>
          {ocupacion &&
            (ocupado ? (
              <Badge tono="rojo" punto>
                Ocupado · {ocupado.seccion}
              </Badge>
            ) : (
              <Badge tono="verde" punto>
                Disponible
              </Badge>
            ))}
        </div>
      ) : (
        <p className="text-[13px] leading-[1.4] text-rojo-oscuro">
          Este curso aún no tiene un docente asignado en la sección. Asígnalo en «Usuarios», en la ficha del docente.
        </p>
      )}
    </div>
  );
}

/**
 * Modal para asignar, cambiar o vaciar la clase de un bloque (US28). Los cruces de docente y de aula se muestran
 * bajo el campo que corresponde con el mensaje del backend (US29, US30).
 */
export function ModalClase({
  cuadricula,
  celda,
  aulas,
  onCerrar,
  onGuardado,
}: {
  cuadricula: Cuadricula;
  celda: Celda;
  aulas: Aula[];
  onCerrar: () => void;
  onGuardado: (nueva: Cuadricula, mensaje: string) => void;
}) {
  const actual = cuadricula.clases.find((c) => c.dia === celda.dia && c.bloqueId === celda.bloque.id);
  const aulaHabitual = aulas.find((a) => a.id === cuadricula.seccion.aula?.id && a.activo)?.id;
  const [cursoId, setCursoId] = useState(actual?.curso.id ?? "");
  const [docenteId, setDocenteId] = useState(actual?.docente.id ?? "");
  const [aulaId, setAulaId] = useState(actual?.aula.id ?? aulaHabitual ?? "");
  const [ocupacion, setOcupacion] = useState<Ocupacion | null>(null);
  const [error, setError] = useState<ErrorClase | null>(null);
  const [enviando, setEnviando] = useState<"guardar" | "vaciar" | null>(null);
  const base = `/horarios/secciones/${cuadricula.seccion.id}`;
  const rutaClase = `${base}/clases/${celda.dia}/${celda.bloque.id}`;

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const datos = await api<Ocupacion>(`${base}/ocupacion?dia=${celda.dia}&bloqueId=${celda.bloque.id}`);
        if (vigente) setOcupacion(datos);
      } catch {
        // es solo una ayuda para elegir: los cruces se validan al guardar
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [base, celda.dia, celda.bloque.id]);

  const curso = cuadricula.plan.find((c) => c.cursoId === cursoId);
  const docentes = cuadricula.plan
    .flatMap((c) => (c.docente ? [c.docente] : []))
    .filter((d, i, lista) => lista.findIndex((x) => x.id === d.id) === i);
  const aulaOcupada = ocupacion?.aulas.find((a) => a.aulaId === aulaId);
  const docenteOcupado = ocupacion?.docentes.find((d) => d.docenteId === docenteId);

  function elegirCurso(id: string) {
    setCursoId(id);
    setDocenteId(cuadricula.plan.find((c) => c.cursoId === id)?.docente?.id ?? "");
    setError(null);
  }

  async function guardar() {
    if (!cursoId || !docenteId || !aulaId) {
      setError({ campo: "general", mensaje: MENSAJE_INCOMPLETA });
      return;
    }
    setEnviando("guardar");
    setError(null);
    try {
      const nueva = await api<Cuadricula>(rutaClase, { method: "PUT", body: { cursoId, docenteId, aulaId } });
      onGuardado(nueva, actual ? "Bloque actualizado." : "Clase asignada.");
    } catch (e) {
      setError(errorDeClase(e));
      setEnviando(null);
    }
  }

  async function vaciar() {
    setEnviando("vaciar");
    setError(null);
    try {
      onGuardado(await api<Cuadricula>(rutaClase, { method: "DELETE" }), "Bloque vaciado.");
    } catch (e) {
      setError(errorDeClase(e));
      setEnviando(null);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="nav-grid-gris"
      tonoIcono="azul"
      titulo={actual ? "Editar clase" : "Asignar clase"}
      subtitulo={`${cuadricula.seccion.etiqueta} · ${textoBloque({ dia: celda.dia, ...celda.bloque })}`}
      pie={
        <>
          {actual && (
            <Boton
              variante="secundario"
              icono="act-trash"
              onClick={vaciar}
              cargando={enviando === "vaciar"}
              disabled={enviando !== null}
              className="mr-auto"
            >
              Vaciar bloque
            </Boton>
          )}
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando !== null}>
            Cancelar
          </Boton>
          <Boton icono="check-blanco" onClick={guardar} cargando={enviando === "guardar"} disabled={enviando !== null}>
            Guardar bloque
          </Boton>
        </>
      }
    >
      {error?.campo === "general" && <Alerta tipo="error" titulo={error.mensaje} />}
      <Selector etiqueta="Curso" valor={cursoId} onCambiar={elegirCurso} obligatorio>
        <option value="">Selecciona un curso</option>
        {cuadricula.plan.map((c) => (
          <option key={c.cursoId} value={c.cursoId}>
            {c.nombre} ({c.asignados} de {c.horasSemanales} bloques)
          </option>
        ))}
      </Selector>
      <Selector
        etiqueta="Docente"
        valor={docenteId}
        onCambiar={(id) => {
          setDocenteId(id);
          setError(null);
        }}
        obligatorio
        error={error?.campo === "docente" ? error.mensaje : undefined}
        ayuda={docenteOcupado ? `Ya tiene clase en ${docenteOcupado.seccion} en este bloque.` : undefined}
      >
        <option value="">Selecciona un docente</option>
        {docentes.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombreCompleto}
          </option>
        ))}
      </Selector>
      <Selector
        etiqueta="Aula"
        valor={aulaId}
        onCambiar={(id) => {
          setAulaId(id);
          setError(null);
        }}
        obligatorio
        error={error?.campo === "aula" ? error.mensaje : undefined}
        ayuda={
          !aulaId || !ocupacion
            ? undefined
            : aulaOcupada
              ? `Ocupada por ${aulaOcupada.seccion} en este bloque.`
              : "Aula disponible en este bloque."
        }
      >
        <option value="">Selecciona un aula</option>
        {aulas
          .filter((a) => a.activo || a.id === aulaId)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
      </Selector>
      {curso && <DocentesDelCurso curso={curso} ocupacion={ocupacion} />}
    </Modal>
  );
}

/** Confirmación de «Publicar»: la versión anterior se archiva y se avisa por correo a los docentes (US31). */
export function ModalPublicar({
  cuadricula,
  onCerrar,
  onPublicado,
  onRechazado,
}: {
  cuadricula: Cuadricula;
  onCerrar: () => void;
  onPublicado: (publicada: CuadriculaPublicada) => void;
  onRechazado: (error: ApiError) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicada = cuadricula.versiones.find((v) => v.estado === "PUBLICADO");

  async function publicar() {
    setEnviando(true);
    setError(null);
    try {
      onPublicado(
        await api<CuadriculaPublicada>(`/horarios/secciones/${cuadricula.seccion.id}/publicar`, { method: "POST" }),
      );
    } catch (e) {
      // los rechazos con detalle (bloques pendientes, cursos de más) se muestran sobre la cuadrícula
      if (e instanceof ApiError && e.codigo.startsWith("HORARIO_")) onRechazado(e);
      else setError(alertaError(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="nav-grid-gris"
      tonoIcono="azul"
      titulo={publicada ? "Publicar nueva versión" : "Publicar horario"}
      subtitulo={`${cuadricula.seccion.etiqueta} · versión ${cuadricula.horario?.version ?? 1}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono="icon-send" onClick={publicar} cargando={enviando}>
            Publicar
          </Boton>
        </>
      }
    >
      {error && <Alerta tipo="error" titulo={error} />}
      <p className="text-[15px] leading-[1.5] text-texto-2">
        El horario quedará visible para los docentes y alumnos de la sección.
        {publicada && ` La versión ${publicada.version} pasará a «Archivado» y quedará en solo lectura.`}
      </p>
      <Alerta tipo="info" titulo="Se avisará por correo a los docentes de la sección">
        Si el correo de algún docente falla, el horario se publica igual.
      </Alerta>
    </Modal>
  );
}
