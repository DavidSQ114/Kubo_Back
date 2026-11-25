// DO-03 · Toma de asistencia (US35, US36): lista de la clase con el estado y la observación de cada alumno, sus
// contadores, el aviso de alumnos sin marcar y el modo de solo lectura cuando vence el plazo de corrección. En el
// celular cada alumno ocupa una tarjeta; desde 1024 px, una fila de la tabla. Con `tutoria` (bloque M3) la usa el
// tutor de la sección: guarda por su ruta, pide motivo al modificar lo ya guardado y justifica faltas y tardanzas.
"use client";

import { useState } from "react";
import { mensajeError } from "@/components/portal";
import { ESTADOS_ASISTENCIA, NOMBRE_ESTADO, type EstadoAsistencia } from "@/components/portal/asistencia";
import { Alerta, Badge, Boton, Icono, Tarjeta } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { cantidad, diaSemanaCorto, diaYHora } from "@/lib/formato";

export interface ResumenSesion {
  presentes: number;
  tardanzas: number;
  ausentes: number;
  justificados: number;
  tardanzasJustificadas?: number;
  sinMarcar: number;
}

interface EstadoRegistro {
  registrada: boolean;
  registradaEn: string | null;
  editableHasta: string | null;
  editable: boolean;
  motivoSoloLectura: string | null;
  resumen: ResumenSesion | null;
}

interface DatosClase {
  curso: { id: string; codigo: string; nombre: string };
  seccion: { id: string; etiqueta: string };
  aula: { id: string; nombre: string };
  bloque: { id: string; horaInicio: string; horaFin: string; etiqueta: string };
}

export interface ClaseDeHoy extends DatosClase {
  claseId: string;
  sesion: ({ id: string } & EstadoRegistro) | null;
}

export interface ClasesDeHoy {
  fecha: string;
  sinClases: { motivo: string; mensaje: string } | null;
  clases: ClaseDeHoy[];
}

export interface SesionVista extends DatosClase, EstadoRegistro {
  id: string;
  fecha: string;
  docente: { id: string; nombreCompleto: string; nombreCorto: string };
}

export interface AlumnoDeSesion {
  registroId: string | null;
  matriculaId: string;
  nombre: string;
  dni: string | null;
  estado: EstadoAsistencia | null;
  observacion: string | null;
  estadoAnterior: EstadoAsistencia | null;
  registradoPor: string | null;
  registradoEn: string | null;
  modificadoPor: string | null;
  modificadoEn: string | null;
  motivoCambio: string | null;
  faltas: number;
  tardanzas: number;
}

export interface SesionDetalle extends SesionVista {
  plazoHoras: number;
  bimestre: string | null;
  faltasParaResaltar: number;
  alumnos: AlumnoDeSesion[];
  resumen: ResumenSesion;
}

export interface SesionGuardada extends SesionDetalle {
  avisos: { avisos: number; correos: number };
}

const LARGO_MAXIMO_OBSERVACION = 200;

const ESTILO_ESTADO: Record<EstadoAsistencia, string> = {
  PRESENTE: "border-verde bg-verde/10 text-verde-oscuro",
  TARDANZA: "border-ambar bg-ambar/15 text-ambar-oscuro",
  FALTA: "border-rojo bg-rojo/10 text-rojo-oscuro",
  FALTA_JUSTIFICADA: "border-celeste bg-celeste/10 text-kubo-azul",
  TARDANZA_JUSTIFICADA: "border-celeste bg-celeste/10 text-kubo-azul",
};

/** Lista desplegable con los estados de asistencia («Presente», «Tardanza», «Ausente»…), del color de su estado. */
function SelectorEstado({
  alumno,
  valor,
  falta,
  deshabilitado,
  onCambiar,
}: {
  alumno: string;
  valor: EstadoAsistencia | null;
  /** El alumno quedó sin marcar al intentar guardar (US35, criterio 3). */
  falta: boolean;
  deshabilitado: boolean;
  onCambiar: (estado: EstadoAsistencia | null) => void;
}) {
  const estilo = valor
    ? ESTILO_ESTADO[valor]
    : falta
      ? "border-rojo bg-white text-rojo-oscuro"
      : "border-borde bg-white text-texto-3";
  return (
    <select
      aria-label={`Estado de asistencia de ${alumno}`}
      aria-invalid={falta}
      value={valor ?? ""}
      disabled={deshabilitado}
      onChange={(e) => onCambiar((e.target.value || null) as EstadoAsistencia | null)}
      className={`h-10 w-full rounded-md border px-3 text-[14px] font-semibold leading-[1.4] outline-none focus-visible:ring-2 focus-visible:ring-kubo-azul/40 disabled:cursor-not-allowed disabled:opacity-80 ${estilo}`}
    >
      <option value="">Sin marcar</option>
      {ESTADOS_ASISTENCIA.map((e) => (
        <option key={e} value={e}>
          {NOMBRE_ESTADO[e]}
        </option>
      ))}
    </select>
  );
}

function Contador({ cantidad, texto, tono }: { cantidad: number; texto: string; tono: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-md border border-borde bg-white px-2.5 py-1 text-[13px] text-texto-2">
      <span className={`text-[15px] font-bold ${tono}`}>{cantidad}</span>
      {texto}
    </span>
  );
}

interface Marca {
  estado: EstadoAsistencia | null;
  observacion: string;
}

const COLUMNAS = "lg:grid lg:grid-cols-[32px_minmax(0,1.2fr)_180px_56px_76px_minmax(0,1fr)] lg:items-center lg:gap-4";

/** Modo tutor de la lista (bloque M3). */
export interface ListaDeTutoria {
  seccionId: string;
  /** Abre la justificación de un registro guardado (falta o tardanza). */
  onJustificar: (alumno: AlumnoDeSesion) => void;
}

const LARGO_MAXIMO_MOTIVO = 300;
const LARGO_MINIMO_MOTIVO = 5;
const JUSTIFICABLES: (EstadoAsistencia | null)[] = ["FALTA", "TARDANZA"];

/**
 * Lista editable de una sesión. El estado de cada alumno vive aquí hasta guardar; el padre cambia la `key` cuando
 * llega una sesión nueva o recién guardada, y la lista vuelve a partir de lo registrado.
 */
export function ListaAsistencia({
  sesion,
  onGuardada,
  tutoria,
}: {
  sesion: SesionDetalle;
  onGuardada: (guardada: SesionGuardada) => void;
  tutoria?: ListaDeTutoria;
}) {
  const [marcas, setMarcas] = useState<Record<string, Marca>>(() =>
    Object.fromEntries(
      sesion.alumnos.map((a) => [a.matriculaId, { estado: a.estado, observacion: a.observacion ?? "" }]),
    ),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinMarcar, setSinMarcar] = useState<{ mensaje: string; ids: string[] } | null>(null);
  const [motivo, setMotivo] = useState("");
  const editable = sesion.editable;
  // registros ya guardados que la lista cambia: para el tutor son una modificación con motivo (bloque M3)
  const modificados = sesion.alumnos.filter((a) => {
    const m = marcas[a.matriculaId];
    return a.registroId && m && (m.estado !== a.estado || (m.observacion.trim() || null) !== a.observacion);
  }).length;
  const pideMotivo = Boolean(tutoria) && modificados > 0;

  const estados = sesion.alumnos.map((a) => marcas[a.matriculaId]?.estado ?? null);
  const cuenta = (e: EstadoAsistencia | null) => estados.filter((x) => x === e).length;
  const cambiar = (matriculaId: string, cambio: Partial<Marca>) =>
    setMarcas((m) => ({ ...m, [matriculaId]: { ...m[matriculaId], ...cambio } }));

  function marcarPresentes() {
    setMarcas((m) =>
      Object.fromEntries(
        Object.entries(m).map(([id, marca]) => [id, { ...marca, estado: marca.estado ?? "PRESENTE" }]),
      ),
    );
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    setSinMarcar(null);
    try {
      const alumnos = sesion.alumnos.map((a) => ({
        matriculaId: a.matriculaId,
        estado: marcas[a.matriculaId].estado,
        observacion: marcas[a.matriculaId].observacion.trim() || null,
      }));
      const ruta = tutoria
        ? `/horarios/tutoria/${tutoria.seccionId}/sesiones/${sesion.id}/registros`
        : `/horarios/asistencia/sesiones/${sesion.id}/registros`;
      const cuerpo = tutoria ? { alumnos, motivo: pideMotivo ? motivo.trim() : null } : { alumnos };
      onGuardada(await api<SesionGuardada>(ruta, { method: "PUT", body: cuerpo }));
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "ASISTENCIA_INCOMPLETA") {
        const faltantes = (e.detalles.faltantes ?? []) as { matriculaId: string }[];
        setSinMarcar({ mensaje: e.message, ids: faltantes.map((f) => f.matriculaId) });
      } else setError(mensajeError(e));
    }
    setGuardando(false);
  }

  // los que el servidor señaló y siguen sin estado: al marcarlos dejan de resaltarse
  const pendientes = sesion.alumnos.filter(
    (a) => sinMarcar?.ids.includes(a.matriculaId) && !marcas[a.matriculaId]?.estado,
  );
  // «Lima Sánchez, Hugo; Mora Díaz, Renata y …»: el punto y coma separa a los alumnos, porque cada nombre ya lleva coma
  const nombres = pendientes.map((a) => a.nombre);
  const faltanMarcar =
    nombres.length > 1 ? `${nombres.slice(0, -1).join("; ")} y ${nombres.at(-1)}` : (nombres[0] ?? "");

  return (
    <Tarjeta className="flex flex-col gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <Boton variante="exito" icono="check-blanco" onClick={marcarPresentes} disabled={cuenta(null) === 0}>
            Marcar todos como presentes
          </Boton>
        )}
        <div className="flex-1" />
        <div className="flex flex-wrap gap-2" aria-live="polite">
          <Contador cantidad={cuenta("PRESENTE")} texto="presentes" tono="text-verde-oscuro" />
          <Contador cantidad={cuenta("TARDANZA")} texto="tardanzas" tono="text-ambar-oscuro" />
          <Contador cantidad={cuenta("FALTA")} texto="ausentes" tono="text-rojo-oscuro" />
          <Contador cantidad={cuenta("FALTA_JUSTIFICADA")} texto="justificados" tono="text-kubo-azul" />
          {(tutoria || cuenta("TARDANZA_JUSTIFICADA") > 0) && (
            <Contador cantidad={cuenta("TARDANZA_JUSTIFICADA")} texto="tardanzas justificadas" tono="text-kubo-azul" />
          )}
          <Contador cantidad={cuenta(null)} texto="sin marcar" tono="text-texto" />
        </div>
      </div>

      {!editable && sesion.motivoSoloLectura && (
        <Alerta tipo="aviso" titulo={sesion.motivoSoloLectura}>
          {tutoria
            ? "Fuera del bimestre en curso, las correcciones las hace la coordinación académica."
            : sesion.registrada
              ? "Si necesitas corregirla, solicítalo a la coordinación académica; el cambio quedará en la bitácora de auditoría."
              : "Si la clase quedó sin registro, comunícalo a la coordinación académica."}
        </Alerta>
      )}
      {sinMarcar && pendientes.length > 0 && (
        <Alerta tipo="error" titulo={sinMarcar.mensaje}>
          Falta marcar a: {faltanMarcar}.
        </Alerta>
      )}
      {error && <Alerta tipo="error" titulo={error} />}

      {sesion.alumnos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borde px-4 py-8 text-center text-[14px] text-texto-2">
          Esta sección no tiene estudiantes con matrícula vigente.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-borde">
          <div
            aria-hidden
            className={`hidden border-b border-borde bg-fondo px-4 py-2.5 text-[13px] font-semibold text-texto-2 ${COLUMNAS}`}
          >
            <span>N.º</span>
            <span>Estudiante</span>
            <span>Estado de asistencia</span>
            <span className="text-center">Faltas</span>
            <span className="text-center">Tardanzas</span>
            <span>Observación</span>
          </div>
          <ol className="flex flex-col divide-y divide-borde">
            {sesion.alumnos.map((a, i) => {
              const marca = marcas[a.matriculaId];
              const falta = pendientes.some((p) => p.matriculaId === a.matriculaId);
              const resaltaFaltas = a.faltas >= sesion.faltasParaResaltar;
              return (
                <li
                  key={a.matriculaId}
                  className={`flex flex-col gap-2 px-4 py-3 ${COLUMNAS} ${falta ? "bg-rojo/5" : "bg-white"}`}
                >
                  <span className="hidden text-[14px] text-texto-2 lg:block">{i + 1}</span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[14px] font-medium leading-[1.4] text-texto">
                      <span className="text-texto-3 lg:hidden">{i + 1}. </span>
                      {a.nombre}
                    </span>
                    {a.estadoAnterior && a.modificadoEn && (
                      <span className="text-[12px] leading-[1.4] text-texto-3">
                        Corregido el {diaYHora(a.modificadoEn)} · antes: {NOMBRE_ESTADO[a.estadoAnterior]}
                        {tutoria && a.modificadoPor ? ` · por ${a.modificadoPor}` : ""}
                      </span>
                    )}
                    {tutoria && a.motivoCambio && (
                      <span className="text-[12px] leading-[1.4] text-texto-3">Motivo: {a.motivoCambio}</span>
                    )}
                    {tutoria &&
                      editable &&
                      a.registroId &&
                      JUSTIFICABLES.includes(a.estado) &&
                      marca.estado === a.estado && (
                        <button
                          type="button"
                          onClick={() => tutoria.onJustificar(a)}
                          className="self-start text-[13px] font-semibold text-kubo-azul underline-offset-2 hover:underline"
                        >
                          Justificar {a.estado === "FALTA" ? "falta" : "tardanza"}
                        </button>
                      )}
                  </div>
                  <SelectorEstado
                    alumno={a.nombre}
                    valor={marca.estado}
                    falta={falta}
                    deshabilitado={!editable || guardando}
                    onCambiar={(estado) => cambiar(a.matriculaId, { estado })}
                  />
                  <span className="text-[12px] text-texto-3 lg:hidden">
                    Faltas: <span className={resaltaFaltas ? "font-bold text-rojo-oscuro" : ""}>{a.faltas}</span> ·
                    Tardanzas: {a.tardanzas}
                  </span>
                  <span className="hidden justify-center lg:flex">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-[13px] ${resaltaFaltas ? "bg-rojo/12 font-bold text-rojo-oscuro" : "text-texto-2"}`}
                    >
                      {a.faltas}
                    </span>
                  </span>
                  <span className="hidden text-center text-[13px] text-texto-2 lg:block">{a.tardanzas}</span>
                  {editable ? (
                    <input
                      aria-label={`Observación de ${a.nombre}`}
                      value={marca.observacion}
                      maxLength={LARGO_MAXIMO_OBSERVACION}
                      disabled={guardando}
                      onChange={(e) => cambiar(a.matriculaId, { observacion: e.target.value })}
                      placeholder="Agregar nota"
                      className="h-9 w-full rounded-md border border-borde bg-white px-3 text-[13px] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul"
                    />
                  ) : (
                    <span className="text-[13px] leading-[1.4] text-texto-2">{marca.observacion || "—"}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <p className="flex items-start gap-2 text-[12px] leading-[1.5] text-texto-3">
        <span className="mt-0.5 shrink-0">
          <Icono nombre="icon-info" size={14} />
        </span>
        Faltas sin justificar y tardanzas acumuladas {sesion.bimestre ? `en el ${sesion.bimestre}` : "en el año"} en
        este curso. Se resaltan {sesion.faltasParaResaltar} o más faltas.
      </p>

      {editable && pideMotivo && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`motivo-${sesion.id}`} className="text-[14px] font-semibold text-texto">
            Motivo de la modificación <span className="text-rojo">*</span>
          </label>
          <textarea
            id={`motivo-${sesion.id}`}
            value={motivo}
            maxLength={LARGO_MAXIMO_MOTIVO}
            rows={2}
            disabled={guardando}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: El alumno llegó a tiempo; se registró mal."
            className="w-full rounded-md border border-borde bg-white px-3 py-2 text-[14px] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul"
          />
          <span className="text-[12px] text-texto-3">
            Cambias {modificados} {modificados === 1 ? "registro guardado" : "registros guardados"}: el cambio queda en
            la bitácora de auditoría.
          </span>
        </div>
      )}

      {editable && sesion.alumnos.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
          <span className="text-[13px] leading-[1.4] text-texto-3">
            Lista completa de la sección · {cantidad(sesion.alumnos.length, "estudiante", "estudiantes")}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] leading-[1.4] text-texto-3">
              {tutoria
                ? "Como tutor puedes registrar y modificar la asistencia durante el bimestre en curso"
                : sesion.editableHasta
                  ? `Puedes corregir este registro hasta el ${diaYHora(sesion.editableHasta)}`
                  : `Podrás corregirlo durante ${sesion.plazoHoras} horas después de guardarlo`}
            </span>
            <Boton
              icono="check-blanco"
              onClick={guardar}
              cargando={guardando}
              disabled={pideMotivo && motivo.trim().length < LARGO_MINIMO_MOTIVO}
            >
              {sesion.registrada ? "Guardar cambios" : "Guardar asistencia"}
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

/** «Matemática · 3° A · 09:15»: una clase en los selectores y listas. */
export const etiquetaClase = (c: DatosClase) => `${c.curso.nombre} · ${c.seccion.etiqueta} · ${c.bloque.horaInicio}`;

/** Insignia del registro de una sesión: sin registrar, editable hasta cierta hora o solo lectura. */
export function BadgeRegistro({ estado }: { estado: EstadoRegistro | null }) {
  if (!estado?.registrada) return <Badge tono="gris">Sin registrar</Badge>;
  if (estado.editable) {
    return (
      <Badge tono="verde" punto>
        Asistencia registrada
      </Badge>
    );
  }
  return (
    <Badge tono="gris">
      <Icono nombre="icon-lock" size={12} />
      Solo lectura
    </Badge>
  );
}

/** Sesiones de los últimos días del docente: abre una para corregirla dentro del plazo o para consultarla. */
export function RegistrosAnteriores({
  sesiones,
  elegida,
  onElegir,
}: {
  sesiones: SesionVista[];
  elegida: string | null;
  onElegir: (sesionId: string) => void;
}) {
  return (
    <Tarjeta className="flex flex-col gap-4 p-4 lg:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Registros anteriores</h2>
        <p className="text-[13px] leading-[1.4] text-texto-3">
          Tus clases de los últimos días. Pasado el plazo de corrección quedan en solo lectura.
        </p>
      </div>
      {sesiones.length === 0 ? (
        <p className="text-[14px] leading-[1.5] text-texto-2">Aún no tienes registros de asistencia en estos días.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {sesiones.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="flex min-w-[200px] flex-1 flex-col">
                <span className="text-[14px] font-semibold leading-[1.4] text-texto">
                  {diaSemanaCorto(s.fecha)} · {s.bloque.horaInicio} · {s.curso.nombre} {s.seccion.etiqueta}
                </span>
                <span className="text-[12px] leading-[1.4] text-texto-3">
                  {s.registradaEn
                    ? `Registro guardado el ${diaYHora(s.registradaEn)}`
                    : "La lista no se llegó a guardar"}
                  {s.editable && s.editableHasta ? ` · puedes corregirlo hasta el ${diaYHora(s.editableHasta)}` : ""}
                </span>
              </div>
              {s.resumen && s.registrada && (
                <span className="text-[12px] text-texto-2">
                  {s.resumen.presentes} P · {s.resumen.tardanzas} T · {s.resumen.ausentes} A · {s.resumen.justificados}{" "}
                  J
                </span>
              )}
              <BadgeRegistro estado={s} />
              <Boton
                variante="secundario"
                className="!px-3 !py-1.5 !text-[14px]"
                aria-pressed={elegida === s.id}
                onClick={() => onElegir(s.id)}
              >
                {s.editable ? "Abrir" : "Ver"}
              </Boton>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}
