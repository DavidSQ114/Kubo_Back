// DO-04 · Registro de notas (US37, US39, US40) y M-10 · Cerrar registro del bimestre: grilla de alumnos por
// competencias con la escala AD, A, B o C, el consolidado por alumno, las evidencias de cada calificación (US38: clip
// con su número y columna «Evidencia»), el avance del registro y el modal de cierre con las calificaciones que faltan.
// En el celular cada alumno ocupa una tarjeta; desde 1024 px, una fila de la tabla. Bloque M2: una competencia con
// ítems de evaluación muestra un sub-columna por ítem para calificarlo y su nota calculada en solo lectura (con el
// porqué si falta); la tabla se desplaza dentro de su tarjeta, con la columna del estudiante fija.
"use client";

import { useState } from "react";
import type { CeldaElegida, EvidenciaVista } from "@/components/docente/evidencias";
import { Alerta, Badge, Boton, Icono, Modal } from "@/components/ui";
import { cantidad, diaYHora } from "@/lib/formato";

// ---------- Tipos de la API (/api/v1/evaluacion) ----------

export type Logro = "AD" | "A" | "B" | "C";
export const LOGROS: Logro[] = ["AD", "A", "B", "C"];
export const NOMBRE_LOGRO: Record<Logro, string> = {
  AD: "Logro destacado",
  A: "Logro esperado",
  B: "En proceso",
  C: "En inicio",
};
export const MENSAJE_VALOR_NO_PERMITIDO = "Solo se permiten los valores AD, A, B o C";

export type EstadoRegistro = "ABIERTO" | "CERRADO" | "PUBLICADO";

export interface Bimestre {
  id: string;
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  activo: boolean;
}

export interface CursoDelDocente {
  asignacionId: string;
  curso: { id: string; codigo: string; nombre: string };
  grado: { id: string; numero: number; nombre: string };
  seccion: { id: string; nombre: string };
  etiqueta: string;
  estados: Record<string, EstadoRegistro>;
}

export interface MisRegistros {
  anio: { id: string; anio: number; estado: string } | null;
  bimestres: Bimestre[];
  bimestreActivoId: string | null;
  cursos: CursoDelDocente[];
}

interface NotaVista {
  logro: Logro;
  logroAnterior: Logro | null;
  registradoPor: string | null;
  registradoEn: string;
  modificadoPor: string | null;
  modificadoEn: string | null;
  /** Evidencias de la calificación (US38). */
  evidencias: EvidenciaVista[];
}

export interface AlumnoDeRegistro {
  matriculaId: string;
  nombre: string;
  notas: Record<string, NotaVista>;
  /** Calificación de cada ítem, por id de ítem (bloque M2). */
  calificaciones: Record<string, Logro>;
  /** Por qué no tiene nota una competencia con ítems, por id de competencia. */
  sinNota: Record<string, { motivo: "PESOS_INCOMPLETOS" | "ITEMS_PENDIENTES"; mensaje: string }>;
  completo: boolean;
  consolidado: Logro | null;
}

export interface Pendiente {
  matriculaId: string;
  nombre: string;
  competencias: { competenciaPlanId: string; codigo: string; nombre: string }[];
}

export interface ItemDeRegistro {
  id: string;
  nombre: string;
  peso: number;
  orden: number;
  /** Alumnos con el ítem calificado. */
  calificaciones: number;
}

export interface CompetenciaDeRegistro {
  competenciaPlanId: string;
  codigo: string;
  nombre: string;
  orden: number;
  peso: number | null;
  /** Ítems de evaluación (bloque M2); vacío: se califica directo. */
  items: ItemDeRegistro[];
  sumaPesos: number;
  pesosCompletos: boolean;
}

export interface RegistroDeNotas {
  asignacionId: string;
  curso: { id: string; codigo: string; nombre: string };
  seccion: { id: string; nombre: string; etiqueta: string };
  anio: { id: string; anio: number };
  bimestre: Bimestre;
  estado: EstadoRegistro;
  editable: boolean;
  motivoSoloLectura: "REGISTRO_CERRADO" | "PERIODO_NO_ACTIVO" | null;
  mensaje: string | null;
  correccion: string | null;
  cerradoEn: string | null;
  cerradoPor: string | null;
  regla: { version: number; nombre: string; metodo: "MODA" | "PONDERADO"; criterioDesempate: string } | null;
  competencias: CompetenciaDeRegistro[];
  alumnos: AlumnoDeRegistro[];
  avance: { calificadas: number; total: number; porcentaje: number; alumnosPendientes: number };
  pendientes: Pendiente[];
}

export interface NotasGuardadas extends RegistroDeNotas {
  guardado: {
    nuevas: number;
    modificadas: number;
    sinCambio: number;
    calificaciones: { nuevas: number; modificadas: number };
    recalculo: { calculadas: number; cambiadas: number; quitadas: number };
  };
}

export interface RegistroCerrado extends RegistroDeNotas {
  aviso: { coordinadores: number; enviados: number };
}

/** Celda de la grilla: alumno y competencia. */
export const claveCelda = (matriculaId: string, competenciaPlanId: string) => `${matriculaId}|${competenciaPlanId}`;

const PREFIJO_ITEM = "item:";
/** Celda de un ítem de evaluación (bloque M2): alumno e ítem. */
export const claveItem = (matriculaId: string, itemId: string) => `${matriculaId}|${PREFIJO_ITEM}${itemId}`;

/** Separa una clave de celda: nota directa de una competencia o calificación de un ítem. */
export function leerClave(clave: string) {
  const [matriculaId, resto] = clave.split("|");
  return resto.startsWith(PREFIJO_ITEM)
    ? { matriculaId, itemId: resto.slice(PREFIJO_ITEM.length), competenciaPlanId: null }
    : { matriculaId, itemId: null, competenciaPlanId: resto };
}

/** «40 %», «33,5 %». */
export const porcentaje = (valor: number) => `${String(valor).replace(".", ",")} %`;

export const esLogro = (valor: string): valor is Logro => (LOGROS as string[]).includes(valor);

/** «C1», «C2»…: columna de cada competencia en el orden del plan (como en el Figma). */
export const columnaDe = (indice: number) => `C${indice + 1}`;

// ---------- Logros ----------

const ESTILO_LOGRO: Record<Logro, string> = {
  AD: "border-verde/40 bg-verde/15 text-verde-oscuro",
  A: "border-celeste/40 bg-celeste/15 text-kubo-azul",
  B: "border-ambar/50 bg-ambar/20 text-ambar-oscuro",
  C: "border-rojo/30 bg-rojo/10 text-rojo-oscuro",
};

export function BadgeLogro({ logro, titulo }: { logro: Logro; titulo?: string }) {
  return (
    <span
      title={titulo ?? NOMBRE_LOGRO[logro]}
      className={`inline-flex h-9 w-12 items-center justify-center rounded-md border text-[14px] font-bold ${ESTILO_LOGRO[logro]}`}
    >
      {logro}
    </span>
  );
}

/** Leyenda de la escala (AD Logro destacado, A Logro esperado…). */
export function LeyendaLogros() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Escala de logros">
      {LOGROS.map((l) => (
        <li key={l} className="flex items-center gap-2 text-[13px] text-texto-2">
          <span
            className={`inline-flex h-7 w-9 items-center justify-center rounded-md border text-[13px] font-bold ${ESTILO_LOGRO[l]}`}
          >
            {l}
          </span>
          {NOMBRE_LOGRO[l]}
        </li>
      ))}
    </ul>
  );
}

/** Quién registró la nota y, si se cambió, el valor anterior (US37): se ve al pasar el cursor. */
function detalleNota(n: NotaVista | undefined) {
  if (!n) return undefined;
  const registro = `Registrada${n.registradoPor ? ` por ${n.registradoPor}` : ""} el ${diaYHora(n.registradoEn)}`;
  if (!n.logroAnterior || !n.modificadoEn) return `${n.logro} · ${registro}`;
  const cambio = `cambiada de ${n.logroAnterior} a ${n.logro}${n.modificadoPor ? ` por ${n.modificadoPor}` : ""} el ${diaYHora(n.modificadoEn)}`;
  return `${registro}; ${cambio}`;
}

// ---------- Celda editable ----------

/**
 * Celda de una competencia: se escribe el logro o se elige de la lista (AD, A, B, C). Un valor fuera de la escala
 * se marca en rojo al intentar guardar (US37, criterio 2). En solo lectura muestra el logro guardado.
 */
export function CeldaLogro({
  alumno,
  competencia,
  valor,
  nota,
  editable,
  invalida,
  cambiada,
  onCambiar,
}: {
  alumno: string;
  competencia: string;
  /** Lo que se ve en la celda: lo editado o lo guardado. */
  valor: string;
  nota: NotaVista | undefined;
  editable: boolean;
  invalida: boolean;
  /** Tiene un cambio sin guardar. */
  cambiada: boolean;
  onCambiar: (valor: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const etiqueta = `Logro de ${alumno} en ${competencia}`;
  if (!editable) {
    return nota ? (
      <BadgeLogro logro={nota.logro} titulo={detalleNota(nota)} />
    ) : (
      <span aria-label={`${etiqueta}: sin calificar`} className="text-[14px] text-texto-3">
        —
      </span>
    );
  }
  const estilo = invalida
    ? "border-rojo bg-white text-rojo-oscuro ring-1 ring-rojo"
    : esLogro(valor)
      ? ESTILO_LOGRO[valor]
      : "border-borde bg-white text-texto";
  return (
    <div className="relative inline-block">
      <input
        aria-label={etiqueta}
        aria-invalid={invalida}
        title={detalleNota(nota)}
        value={valor}
        placeholder="—"
        maxLength={4}
        autoComplete="off"
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
        onKeyDown={(e) => e.key === "Escape" && setAbierta(false)}
        onChange={(e) => onCambiar(e.target.value.trim().toUpperCase())}
        className={`h-9 w-12 rounded-md border text-center text-[14px] font-bold outline-none placeholder:font-normal placeholder:text-texto-3 focus:ring-2 focus:ring-kubo-azul/40 ${estilo} ${cambiada ? "underline decoration-2 underline-offset-4" : ""}`}
      />
      {/* en el celular la celda está al borde derecho de su columna: la lista se alinea a la derecha */}
      {abierta && (
        <ul
          role="listbox"
          aria-label={`Elegir ${etiqueta.toLowerCase()}`}
          className="absolute top-full right-0 z-20 mt-1 flex w-[184px] flex-col gap-0.5 rounded-lg border border-borde bg-white p-1.5 shadow-modal lg:right-auto lg:left-1/2 lg:w-[200px] lg:-translate-x-1/2"
        >
          {LOGROS.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={valor === l}
                // mousedown: se elige antes de que el campo pierda el foco y cierre la lista
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCambiar(l);
                  setAbierta(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] whitespace-nowrap text-texto hover:bg-fondo lg:gap-3 lg:text-[14px] ${valor === l ? "bg-fondo font-semibold" : ""}`}
              >
                <span
                  className={`inline-flex h-7 w-9 items-center justify-center rounded-md border text-[13px] font-bold ${ESTILO_LOGRO[l]}`}
                >
                  {l}
                </span>
                {NOMBRE_LOGRO[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Consolidado({ alumno, cerrado }: { alumno: AlumnoDeRegistro; cerrado: boolean }) {
  if (alumno.consolidado) {
    return (
      <BadgeLogro
        logro={alumno.consolidado}
        titulo={cerrado ? "Logro consolidado del curso" : "Logro que resultaría al cerrar (vista previa)"}
      />
    );
  }
  return alumno.completo ? (
    <span className="text-[13px] text-texto-3">—</span>
  ) : (
    <Badge tono="ambar" punto>
      Incompleto
    </Badge>
  );
}

// ---------- Evidencias (US38) ----------

/** Clip con el número de evidencias de la calificación; abre M-07. */
function MarcaEvidencia({ total, etiqueta, onAbrir }: { total: number; etiqueta: string; onAbrir: () => void }) {
  const texto = cantidad(total, "evidencia", "evidencias");
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Evidencias de ${etiqueta}: ${texto}`}
      title={texto}
      className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[12px] font-semibold text-kubo-azul hover:bg-fondo"
    >
      <Icono nombre="icon-clip" size={14} />
      {total}
    </button>
  );
}

/** Evidencias de todas las calificaciones del alumno. */
const evidenciasDelAlumno = (a: AlumnoDeRegistro) => Object.values(a.notas).flatMap((n) => n.evidencias ?? []);

/** «Adjuntar» (registro abierto y con alguna calificación guardada) o el resumen de lo adjuntado (columna «Evidencia»). */
function AccionEvidencia({
  registro,
  alumno,
  onAbrir,
}: {
  registro: RegistroDeNotas;
  alumno: AlumnoDeRegistro;
  onAbrir: () => void;
}) {
  const todas = evidenciasDelAlumno(alumno);
  const archivos = todas.filter((e) => e.archivo).length;
  const resumen = archivos
    ? cantidad(archivos, "archivo", "archivos")
    : todas.length
      ? cantidad(todas.length, "comentario", "comentarios")
      : null;
  const conNotas = Object.keys(alumno.notas).length > 0;
  if (registro.estado === "ABIERTO" && conNotas) {
    return (
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Adjuntar evidencia de ${alumno.nombre}`}
        className="inline-flex flex-col items-start gap-0.5 rounded-md px-2 py-1 text-left hover:bg-fondo"
      >
        <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-kubo-azul">
          <Icono nombre="icon-clip" size={16} /> Adjuntar
        </span>
        {resumen && <span className="text-[12px] text-texto-3">{resumen}</span>}
      </button>
    );
  }
  if (!resumen) return <span className="text-[13px] text-texto-3">—</span>;
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Ver evidencias de ${alumno.nombre}`}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold text-kubo-azul hover:bg-fondo"
    >
      <Icono nombre={archivos ? "icon-pdf" : "icon-comentario"} size={16} /> {resumen}
    </button>
  );
}

// ---------- Grilla ----------

export interface PropsGrilla {
  registro: RegistroDeNotas;
  ediciones: Record<string, string>;
  invalidas: Set<string>;
  onCambiar: (clave: string, valor: string) => void;
  /**
   * Abre M-07 para una calificación o, sin competencia, para el alumno (columna «Evidencia»). Sin él (vista del
   * Administrador en AD-15) no se muestran las evidencias.
   */
  onEvidencias?: (celda: CeldaElegida) => void;
  /** Abre la gestión de ítems de una competencia (bloque M2); sin él, no se muestra el botón «Ítems». */
  onItems?: (competenciaPlanId: string) => void;
}

/** Valor que se ve en una celda: lo editado o, si no se tocó, lo guardado. */
export function valorDeCelda(
  registro: RegistroDeNotas,
  ediciones: Record<string, string>,
  a: AlumnoDeRegistro,
  competenciaPlanId: string,
) {
  const clave = claveCelda(a.matriculaId, competenciaPlanId);
  return clave in ediciones ? ediciones[clave] : (a.notas[competenciaPlanId]?.logro ?? "");
}

/** Valor de la celda de un ítem: lo editado o, si no se tocó, la calificación guardada. */
export function valorDeItem(ediciones: Record<string, string>, a: AlumnoDeRegistro, itemId: string) {
  const clave = claveItem(a.matriculaId, itemId);
  return clave in ediciones ? ediciones[clave] : (a.calificaciones?.[itemId] ?? "");
}

/** Total de pesos de los ítems: «100 %» en verde u otro valor en rojo. */
export function TotalPesosItems({ suma, completos }: { suma: number; completos: boolean }) {
  return (
    <span
      title={completos ? "Los pesos suman 100 %" : "Los pesos deben sumar 100 % para calcular la nota"}
      className={`inline-flex items-center rounded-full px-1.5 py-px text-[11px] font-bold ${completos ? "bg-verde/15 text-verde-oscuro" : "bg-rojo/10 text-rojo-oscuro"}`}
    >
      {porcentaje(suma)}
    </span>
  );
}

/** Nota calculada de una competencia con ítems: solo lectura; si falta, «—» con el porqué. */
function NotaCalculada({ alumno, competencia }: { alumno: AlumnoDeRegistro; competencia: CompetenciaDeRegistro }) {
  const nota = alumno.notas[competencia.competenciaPlanId];
  if (nota) return <BadgeLogro logro={nota.logro} titulo={`Calculada por ítems · ${detalleNota(nota)}`} />;
  const motivo = alumno.sinNota?.[competencia.competenciaPlanId]?.mensaje ?? "Sin nota";
  return (
    <span title={motivo} className="inline-flex h-9 w-12 items-center justify-center gap-0.5 text-[14px] text-texto-3">
      —<Icono nombre="alerta-warn" size={14} />
      <span className="sr-only">Sin nota: {motivo}</span>
    </span>
  );
}

const STICKY = "sticky left-0 z-10";

export function GrillaNotas({ registro, ediciones, invalidas, onCambiar, onEvidencias, onItems }: PropsGrilla) {
  const cerrado = registro.estado !== "ABIERTO";
  const conItems = registro.competencias.some((c) => c.items.length > 0);
  const marca = (a: AlumnoDeRegistro, c: CompetenciaDeRegistro, i: number) => {
    const evidencias = a.notas[c.competenciaPlanId]?.evidencias?.length ?? 0;
    return (
      onEvidencias &&
      evidencias > 0 && (
        <MarcaEvidencia
          total={evidencias}
          etiqueta={`${a.nombre} en ${columnaDe(i)}`}
          onAbrir={() => onEvidencias({ matriculaId: a.matriculaId, competenciaPlanId: c.competenciaPlanId })}
        />
      )
    );
  };
  const celda = (a: AlumnoDeRegistro, c: CompetenciaDeRegistro, i: number) => {
    const clave = claveCelda(a.matriculaId, c.competenciaPlanId);
    return (
      <span className="inline-flex items-center gap-0.5">
        {c.items.length ? (
          <NotaCalculada alumno={a} competencia={c} />
        ) : (
          <CeldaLogro
            alumno={a.nombre}
            competencia={`${columnaDe(i)} · ${c.nombre}`}
            valor={valorDeCelda(registro, ediciones, a, c.competenciaPlanId)}
            nota={a.notas[c.competenciaPlanId]}
            editable={registro.editable}
            invalida={invalidas.has(clave)}
            cambiada={clave in ediciones}
            onCambiar={(v) => onCambiar(clave, v)}
          />
        )}
        {marca(a, c, i)}
      </span>
    );
  };
  const celdaItem = (a: AlumnoDeRegistro, it: ItemDeRegistro, i: number) => {
    const clave = claveItem(a.matriculaId, it.id);
    const guardada = a.calificaciones?.[it.id];
    return registro.editable ? (
      <CeldaLogro
        alumno={a.nombre}
        competencia={`${columnaDe(i)} · ${it.nombre}`}
        valor={valorDeItem(ediciones, a, it.id)}
        nota={undefined}
        editable
        invalida={invalidas.has(clave)}
        cambiada={clave in ediciones}
        onCambiar={(v) => onCambiar(clave, v)}
      />
    ) : guardada ? (
      <BadgeLogro logro={guardada} titulo={`${it.nombre}: ${NOMBRE_LOGRO[guardada]}`} />
    ) : (
      <span className="text-[14px] text-texto-3">—</span>
    );
  };
  const botonItems = (c: CompetenciaDeRegistro, i: number) =>
    onItems && (
      <button
        type="button"
        onClick={() => onItems(c.competenciaPlanId)}
        aria-label={`Ítems de ${columnaDe(i)} · ${c.nombre}`}
        className="inline-flex items-center gap-1 rounded-md border border-borde bg-white px-1.5 py-0.5 text-[12px] font-semibold text-kubo-azul hover:bg-fondo"
      >
        <Icono nombre="icon-sliders" size={12} /> Ítems
      </button>
    );
  const accion = (a: AlumnoDeRegistro) =>
    onEvidencias && (
      <AccionEvidencia
        registro={registro}
        alumno={a}
        onAbrir={() => onEvidencias({ matriculaId: a.matriculaId, competenciaPlanId: null })}
      />
    );
  const fila = (a: AlumnoDeRegistro) =>
    registro.competencias.some(
      (c) =>
        invalidas.has(claveCelda(a.matriculaId, c.competenciaPlanId)) ||
        c.items.some((it) => invalidas.has(claveItem(a.matriculaId, it.id))),
    );
  const filas = conItems ? 2 : 1;

  return (
    <>
      {/* Desde 1024 px: tabla; con muchos ítems se desplaza dentro de su tarjeta, no la página */}
      <div className="hidden max-w-full overflow-x-auto rounded-lg border border-borde lg:block">
        <table className="w-full border-collapse text-left">
          <thead className="bg-fondo">
            <tr>
              <th
                scope="col"
                rowSpan={filas}
                className={`${STICKY} bg-fondo px-4 py-3 text-[13px] font-semibold text-texto-2`}
              >
                Estudiante
              </th>
              {registro.competencias.map((c, i) => (
                <th
                  key={c.competenciaPlanId}
                  scope="col"
                  colSpan={c.items.length ? c.items.length + 1 : 1}
                  rowSpan={c.items.length ? 1 : filas}
                  title={c.nombre}
                  className={`px-2 py-2.5 text-center text-[13px] font-semibold text-texto-2 ${c.items.length ? "border-x border-borde" : ""}`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    {columnaDe(i)}
                    {c.items.length > 0 && <TotalPesosItems suma={c.sumaPesos} completos={c.pesosCompletos} />}
                  </span>
                  <span className="mx-auto block max-w-[130px] truncate text-[12px] font-normal text-texto-3">
                    {c.nombre}
                  </span>
                  {onItems && <span className="mt-1 flex justify-center">{botonItems(c, i)}</span>}
                </th>
              ))}
              <th scope="col" rowSpan={filas} className="px-3 py-3 text-center text-[13px] font-semibold text-texto-2">
                Consolidado
              </th>
              {onEvidencias && (
                <th scope="col" rowSpan={filas} className="px-3 py-3 text-[13px] font-semibold text-texto-2">
                  Evidencia
                </th>
              )}
            </tr>
            {conItems && (
              <tr className="border-t border-borde">
                {registro.competencias.flatMap((c, i) =>
                  c.items.length
                    ? [
                        ...c.items.map((it, k) => (
                          <th
                            key={it.id}
                            scope="col"
                            title={`${it.nombre} · peso ${porcentaje(it.peso)}`}
                            className={`px-1.5 py-2 text-center text-[11px] font-medium text-texto-2 ${k === 0 ? "border-l border-borde" : ""}`}
                          >
                            <span className="mx-auto block max-w-[84px] truncate">{it.nombre}</span>
                            <span className="block font-normal text-texto-3">{porcentaje(it.peso)}</span>
                          </th>
                        )),
                        <th
                          key={`${c.competenciaPlanId}-nota`}
                          scope="col"
                          className="border-r border-borde px-1.5 py-2 text-center text-[11px] font-semibold text-texto"
                        >
                          Nota {columnaDe(i)}
                          <span className="block font-normal text-texto-3">calculada</span>
                        </th>,
                      ]
                    : [],
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {registro.alumnos.map((a) => {
              // la columna fija necesita un fondo opaco: blanco con el tinte rojo encima
              const fondo = fila(a) ? "bg-white bg-linear-to-r from-rojo/5 to-rojo/5" : "bg-white";
              return (
                <tr key={a.matriculaId} className={`border-t border-borde ${fondo}`}>
                  <th
                    scope="row"
                    className={`${STICKY} ${fondo} px-4 py-2.5 text-[14px] font-medium whitespace-nowrap text-texto`}
                  >
                    {a.nombre}
                  </th>
                  {registro.competencias.flatMap((c, i) =>
                    c.items.length
                      ? [
                          ...c.items.map((it, k) => (
                            <td
                              key={it.id}
                              className={`px-1 py-2.5 text-center ${k === 0 ? "border-l border-borde" : ""}`}
                            >
                              {celdaItem(a, it, i)}
                            </td>
                          )),
                          <td
                            key={`${c.competenciaPlanId}-nota`}
                            className="border-r border-borde bg-fondo/60 px-1.5 py-2.5 text-center"
                          >
                            {celda(a, c, i)}
                          </td>,
                        ]
                      : [
                          <td key={c.competenciaPlanId} className="px-2 py-2.5 text-center">
                            {celda(a, c, i)}
                          </td>,
                        ],
                  )}
                  <td className="px-3 py-2.5 text-center">
                    <Consolidado alumno={a} cerrado={cerrado} />
                  </td>
                  {onEvidencias && <td className="px-3 py-2.5">{accion(a)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Celular y tablet: una tarjeta por alumno */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {registro.alumnos.map((a) => (
          <li
            key={a.matriculaId}
            className={`flex flex-col gap-3 rounded-lg border p-4 ${fila(a) ? "border-rojo/40 bg-rojo/5" : "border-borde bg-white"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-[15px] font-semibold leading-[1.3] text-texto">{a.nombre}</p>
              <Consolidado alumno={a} cerrado={cerrado} />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
              {registro.competencias.map((c, i) =>
                c.items.length ? (
                  <div
                    key={c.competenciaPlanId}
                    className="col-span-full flex flex-col gap-2 rounded-lg border border-borde p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] text-texto-2" title={c.nombre}>
                        <span className="font-semibold text-texto">{columnaDe(i)}</span> · {c.nombre}
                      </span>
                      {celda(a, c, i)}
                    </div>
                    {!a.notas[c.competenciaPlanId] && a.sinNota?.[c.competenciaPlanId] && (
                      <p className="text-[12px] text-ambar-oscuro">{a.sinNota[c.competenciaPlanId].mensaje}</p>
                    )}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                      {c.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-[12px] text-texto-2" title={it.nombre}>
                            {it.nombre} · {porcentaje(it.peso)}
                          </span>
                          {celdaItem(a, it, i)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key={c.competenciaPlanId} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13px] text-texto-2" title={c.nombre}>
                      <span className="font-semibold text-texto">{columnaDe(i)}</span> · {c.nombre}
                    </span>
                    {celda(a, c, i)}
                  </div>
                ),
              )}
            </div>
            {onEvidencias && (
              <div className="flex items-center justify-between gap-3 border-t border-borde pt-2">
                <span className="text-[13px] text-texto-2">Evidencia</span>
                {accion(a)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** «Avance del registro: 72 %» con su barra (DO-04). */
export function AvanceRegistro({ avance }: { avance: RegistroDeNotas["avance"] }) {
  return (
    <div className="flex min-w-[220px] flex-col gap-1.5">
      <p className="text-[13px] font-semibold text-texto">Avance del registro: {avance.porcentaje} %</p>
      <div
        role="progressbar"
        aria-valuenow={avance.porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance del registro"
        className="h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-borde"
      >
        <div className="h-full rounded-full bg-kubo-azul" style={{ width: `${avance.porcentaje}%` }} />
      </div>
      <p className="text-[13px] text-texto-3">
        {avance.alumnosPendientes === 0
          ? "Todas las competencias están calificadas."
          : `${avance.alumnosPendientes} ${avance.alumnosPendientes === 1 ? "estudiante" : "estudiantes"} con competencias pendientes`}
      </p>
    </div>
  );
}

// ---------- M-10 · Cerrar registro del bimestre ----------

export function ModalCerrarRegistro({
  registro,
  pendientes,
  cambiosSinGuardar,
  cerrando,
  error,
  onConfirmar,
  onCerrar,
}: {
  registro: RegistroDeNotas;
  /** Del servidor o de la respuesta NOTAS_INCOMPLETAS. */
  pendientes: Pendiente[];
  cambiosSinGuardar: boolean;
  cerrando: boolean;
  error: string | null;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  const columna = new Map(registro.competencias.map((c, i) => [c.competenciaPlanId, columnaDe(i)]));
  const bloqueado = cambiosSinGuardar || pendientes.length > 0;
  const regla = registro.regla
    ? `${registro.regla.nombre.toLowerCase()}, versión ${registro.regla.version}`
    : "la regla del bimestre";
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-lock"
      tonoIcono="azul"
      titulo="Cerrar registro del bimestre"
      subtitulo={`${registro.curso.nombre} ${registro.seccion.etiqueta} · ${registro.bimestre.nombre}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar}>
            Volver al registro
          </Boton>
          <Boton icono="icon-lock" cargando={cerrando} disabled={bloqueado} onClick={onConfirmar}>
            Cerrar registro
          </Boton>
        </>
      }
    >
      {error && <Alerta tipo="error" titulo={error} />}
      {cambiosSinGuardar && (
        <Alerta tipo="aviso" titulo="Tienes cambios sin guardar">
          Guarda tus cambios antes de cerrar el registro.
        </Alerta>
      )}
      {pendientes.length > 0 && (
        <>
          <Alerta tipo="error" titulo="Existen registros de notas incompletos">
            Completa estas calificaciones para poder cerrar el registro.
          </Alerta>
          <ul className="flex flex-col">
            {pendientes.map((p) => (
              <li
                key={p.matriculaId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-borde py-2.5 text-[14px]"
              >
                <span className="flex items-center gap-2 font-medium text-texto">
                  <Icono nombre="alerta-err" size={16} />
                  {p.nombre}
                </span>
                <span className="text-[13px] text-rojo-oscuro">
                  {p.competencias.map((c) => columna.get(c.competenciaPlanId) ?? c.codigo).join(", ")} · sin calificar
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-col gap-2 rounded-lg bg-fondo p-4">
        <p className="text-[13px] font-semibold text-texto">Al cerrar el registro:</p>
        <ul className="flex flex-col gap-1.5 text-[13px] text-texto-2">
          {[
            `Se calcula el logro consolidado con la regla vigente (${regla}).`,
            "El estado cambia a «Cerrado» y ya no podrás editar las notas.",
            "Se notifica a la coordinación académica para que publique las notas a los apoderados.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Icono nombre="icon-check-verde" size={16} className="mt-px" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
