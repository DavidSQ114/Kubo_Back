// Piezas de AD-02 Año académico y bimestres (US06, US07): tipos, badges, formulario «Registrar año académico»,
// tabla «Periodos de evaluación» y el modal que confirma cada cambio de estado del año.
"use client";

import { useState, type FormEvent } from "react";
import { Alerta, Badge, Boton, Campo, Icono, Modal } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fechaDia } from "@/lib/formato";
import { alertaError } from "./PortalAdmin";

export type EstadoAnio = "PLANIFICADO" | "EN_MATRICULA" | "EN_CURSO" | "EN_CIERRE" | "CERRADO";
export type EstadoPeriodo = "INACTIVO" | "ACTIVO" | "EN_CIERRE" | "FINALIZADO";

export interface Periodo {
  id: string;
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPeriodo;
}

export interface AnioAcademico {
  id: string;
  anio: number;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoAnio;
  periodos: Periodo[];
}

export const ESTADOS_ANIO: EstadoAnio[] = ["PLANIFICADO", "EN_MATRICULA", "EN_CURSO", "EN_CIERRE", "CERRADO"];
export const CANTIDAD_BIMESTRES = 4;
const NUMERALES = ["I", "II", "III", "IV"];
const MS_POR_DIA = 86_400_000;
const DIAS_POR_SEMANA = 7;

const ESTILO_ESTADO_ANIO: Record<EstadoAnio, { texto: string; tono: "azul" | "celeste" | "verde" | "ambar" | "gris" }> =
  {
    PLANIFICADO: { texto: "Planificado", tono: "azul" },
    EN_MATRICULA: { texto: "En matrícula", tono: "celeste" },
    EN_CURSO: { texto: "En curso", tono: "verde" },
    EN_CIERRE: { texto: "En cierre", tono: "ambar" },
    CERRADO: { texto: "Cerrado", tono: "gris" },
  };

const ESTILO_ESTADO_PERIODO: Record<EstadoPeriodo, { texto: string; tono: "azul" | "verde" | "ambar" | "gris" }> = {
  INACTIVO: { texto: "Inactivo", tono: "azul" },
  ACTIVO: { texto: "Activo", tono: "verde" },
  EN_CIERRE: { texto: "En cierre", tono: "ambar" },
  FINALIZADO: { texto: "Finalizado", tono: "gris" },
};

/** Cada transición es un botón en la fila del año, con su confirmación. EN_MATRICULA = «Abrir matrícula» (US06). */
export const TRANSICIONES: Record<
  Exclude<EstadoAnio, "PLANIFICADO">,
  { accion: string; titulo: string; detalle: (anio: number) => string; secundaria?: boolean; peligro?: boolean }
> = {
  EN_MATRICULA: {
    accion: "Abrir matrícula",
    titulo: "Abrir la matrícula",
    detalle: (anio) => `El año ${anio} pasará a «En matrícula» y se habilitará el registro de matrículas.`,
  },
  EN_CURSO: {
    accion: "Iniciar clases",
    titulo: "Iniciar las clases",
    detalle: (anio) =>
      `El año ${anio} pasará a «En curso»: será el año vigente para horarios, asistencia y notas. ` +
      "Solo puede haber un año en curso.",
  },
  EN_CIERRE: {
    accion: "Iniciar cierre",
    titulo: "Iniciar el cierre del año",
    detalle: (anio) => `El año ${anio} pasará a «En cierre» para que se terminen de publicar las notas.`,
    secundaria: true,
  },
  CERRADO: {
    accion: "Cerrar año",
    titulo: "Cerrar el año académico",
    detalle: (anio) =>
      `El año ${anio} quedará cerrado y ya no se podrá modificar. ` +
      "Solo se puede cerrar si todas las notas de sus bimestres están publicadas.",
    secundaria: true,
    peligro: true,
  },
};

export const nombreBimestre = (numero: number) => `Bimestre ${NUMERALES[numero - 1] ?? numero}`;

export function siguienteEstado(estado: EstadoAnio): Exclude<EstadoAnio, "PLANIFICADO"> | null {
  const siguiente = ESTADOS_ANIO[ESTADOS_ANIO.indexOf(estado) + 1];
  return siguiente && siguiente !== "PLANIFICADO" ? siguiente : null;
}

/** La matrícula está habilitada mientras el año está En matrícula o En curso. */
export const matriculaHabilitada = (estado: EstadoAnio) => estado === "EN_MATRICULA" || estado === "EN_CURSO";

export function BadgeEstadoAnio({ estado }: { estado: EstadoAnio }) {
  const e = ESTILO_ESTADO_ANIO[estado];
  return (
    <Badge tono={e.tono} punto>
      {e.texto}
    </Badge>
  );
}

function BadgeEstadoPeriodo({ estado }: { estado: EstadoPeriodo }) {
  const e = ESTILO_ESTADO_PERIODO[estado];
  return (
    <Badge tono={e.tono} punto>
      {e.texto}
    </Badge>
  );
}

/** Mensaje del backend tal cual; si son errores de formulario, se agregan los de cada campo. */
function mensajeDe(e: unknown): string {
  if (e instanceof ApiError && e.codigo === "DATOS_INVALIDOS") {
    return [e.message, ...Object.values(e.detalles).map(String)].join(" ");
  }
  return alertaError(e);
}

// ---------- Registrar año académico ----------

const VACIO = { anio: "", fechaInicio: "", fechaFin: "" };

/** Errores del backend que corresponden a un campo del formulario. */
const CAMPO_DEL_ERROR: Record<string, keyof typeof VACIO> = {
  FECHAS_INVALIDAS: "fechaFin",
  ANIO_NO_COINCIDE: "anio",
};

/** Id del campo «Año»: el botón «Nuevo año académico» del encabezado lo enfoca. */
export const ID_CAMPO_ANIO = "anio-nuevo";

export function FormularioAnio({ onCreado }: { onCreado: (anio: AnioAcademico) => void }) {
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo: keyof typeof VACIO) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [campo]: e.target.value }));

  function limpiar() {
    setDatos(VACIO);
    setErrores({});
    setAviso(null);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    setAviso(null);
    try {
      const creado = await api<AnioAcademico>("/academico/anios", {
        method: "POST",
        body: { anio: Number(datos.anio) || undefined, fechaInicio: datos.fechaInicio, fechaFin: datos.fechaFin },
      });
      limpiar();
      onCreado(creado);
    } catch (err) {
      const campo = err instanceof ApiError ? CAMPO_DEL_ERROR[err.codigo] : undefined;
      if (err instanceof ApiError && err.codigo === "DATOS_INVALIDOS")
        setErrores(err.detalles as Record<string, string>);
      else if (err instanceof ApiError && campo) setErrores({ [campo]: err.message });
      else setAviso(alertaError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-5" noValidate>
      <EncabezadoTarjeta titulo="Registrar año académico" subtitulo="Los campos con * son obligatorios" />
      <Campo
        id={ID_CAMPO_ANIO}
        etiqueta="Año"
        obligatorio
        inputMode="numeric"
        maxLength={4}
        placeholder="Ej.: 2027"
        value={datos.anio}
        onChange={cambiar("anio")}
        error={errores.anio}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Fecha de inicio"
          obligatorio
          type="date"
          icono="icon-calendar-gris"
          value={datos.fechaInicio}
          onChange={cambiar("fechaInicio")}
          error={errores.fechaInicio}
        />
        <Campo
          etiqueta="Fecha de fin"
          obligatorio
          type="date"
          icono="icon-calendar-gris"
          value={datos.fechaFin}
          onChange={cambiar("fechaFin")}
          error={errores.fechaFin}
        />
      </div>
      {aviso && <Alerta tipo="aviso" icono="alerta-warn-lock" titulo={aviso} />}
      <div className="flex justify-end gap-3">
        <Boton type="button" variante="secundario" onClick={limpiar} disabled={enviando}>
          Cancelar
        </Boton>
        <Boton type="submit" icono="check-blanco" cargando={enviando}>
          Guardar año
        </Boton>
      </div>
    </form>
  );
}

export function EncabezadoTarjeta({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">{titulo}</h2>
      <p className="text-[14px] leading-[1.4] text-texto-3">{subtitulo}</p>
    </div>
  );
}

// ---------- Periodos de evaluación (US07) ----------

interface FilaBimestre {
  numero: number;
  fechaInicio: string;
  fechaFin: string;
}

function filasIniciales(anio: AnioAcademico): FilaBimestre[] {
  return Array.from({ length: CANTIDAD_BIMESTRES }, (_, i) => {
    const p = anio.periodos.find((x) => x.numero === i + 1);
    return { numero: i + 1, fechaInicio: p?.fechaInicio ?? "", fechaFin: p?.fechaFin ?? "" };
  });
}

/** Semanas redondeadas entre inicio y fin ("—" si faltan fechas o no son válidas). */
function semanas(f: FilaBimestre): string {
  if (!f.fechaInicio || !f.fechaFin || f.fechaFin <= f.fechaInicio) return "—";
  const dias = (Date.parse(f.fechaFin) - Date.parse(f.fechaInicio)) / MS_POR_DIA;
  return String(Math.round(dias / DIAS_POR_SEMANA));
}

/** Columna «Registro de notas» según el estado del bimestre guardado. */
function registroNotas(p: Periodo | undefined): string {
  if (!p) return "—";
  const corta = (fecha: string) => fechaDia(fecha).slice(0, 5);
  if (p.estado === "FINALIZADO") return "Notas publicadas";
  if (p.estado === "ACTIVO") return `Habilitado hasta ${corta(p.fechaFin)}`;
  if (p.estado === "EN_CIERRE") return "En cierre";
  return `Se habilita el ${corta(p.fechaInicio)}`;
}

/**
 * Los 4 bimestres se guardan juntos. Para reiniciarlo con datos nuevos, el padre cambia su key (estándar 6.5).
 * Los bimestres FINALIZADOS y los años CERRADOS se muestran sin edición.
 */
export function FormularioBimestres({
  anio,
  onGuardado,
}: {
  anio: AnioAcademico;
  onGuardado: (mensaje: string) => void;
}) {
  const [filas, setFilas] = useState(() => filasIniciales(anio));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soloLectura = anio.estado === "CERRADO";

  function cambiar(numero: number, campo: "fechaInicio" | "fechaFin", valor: string) {
    setFilas((actuales) => actuales.map((f) => (f.numero === numero ? { ...f, [campo]: valor } : f)));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (filas.some((f) => !f.fechaInicio || !f.fechaFin)) {
      setError("Completa las fechas de inicio y fin de los 4 bimestres.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await api(`/academico/anios/${anio.id}/periodos`, { method: "PUT", body: { periodos: filas } });
      onGuardado(`Se guardaron los bimestres del año ${anio.anio}.`);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[260px] flex-1">
          <EncabezadoTarjeta
            titulo={`Periodos de evaluación · ${anio.anio}`}
            subtitulo="Divide el año en 4 bimestres sin solapamientos"
          />
        </div>
        {!soloLectura && (
          <>
            <Boton
              type="button"
              variante="secundario"
              icono="icon-plus-gris"
              disabled
              title="El año se divide siempre en 4 bimestres"
            >
              Agregar bimestre
            </Boton>
            <Boton type="submit" icono="check-blanco" cargando={guardando}>
              Guardar configuración
            </Boton>
          </>
        )}
      </div>

      {error && <Alerta tipo="error" titulo={error} />}

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full min-w-[880px] border-collapse bg-white text-left">
          <thead>
            <tr className="border-b border-borde bg-fondo text-[13px] font-semibold leading-[1.4] text-texto-2">
              <th className="w-[150px] px-4 py-3 font-semibold">Periodo</th>
              <th className="w-[220px] px-4 py-3 font-semibold">Fecha de inicio</th>
              <th className="w-[220px] px-4 py-3 font-semibold">Fecha de fin</th>
              <th className="w-[110px] px-4 py-3 font-semibold">Semanas</th>
              <th className="px-4 py-3 font-semibold">Registro de notas</th>
              <th className="w-[130px] px-4 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const guardado = anio.periodos.find((p) => p.numero === f.numero);
              const editable = !soloLectura && guardado?.estado !== "FINALIZADO";
              const nombre = nombreBimestre(f.numero);
              return (
                <tr
                  key={f.numero}
                  className="border-b border-borde text-[14px] leading-[1.4] text-texto last:border-b-0"
                >
                  <td className="px-4 py-3 font-semibold">{nombre}</td>
                  {(["fechaInicio", "fechaFin"] as const).map((campo) => (
                    <td key={campo} className={`px-4 ${editable ? "py-2" : "py-3"}`}>
                      {editable ? (
                        <CampoFecha
                          etiqueta={`${nombre}: ${campo === "fechaInicio" ? "fecha de inicio" : "fecha de fin"}`}
                          valor={f[campo]}
                          onCambiar={(v) => cambiar(f.numero, campo, v)}
                        />
                      ) : (
                        fechaDia(f[campo])
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3">{semanas(f)}</td>
                  <td className="px-4 py-3">{registroNotas(guardado)}</td>
                  <td className="px-4 py-3">
                    {guardado ? (
                      <BadgeEstadoPeriodo estado={guardado.estado} />
                    ) : (
                      <span className="text-texto-3">Sin guardar</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2">
        <Icono nombre="icon-info" size={16} className="mt-px" />
        <p className="text-[13px] leading-[1.4] text-texto-3">
          Fuera del rango de un bimestre, el registro de notas se muestra en modo solo lectura con el mensaje «Este
          periodo de evaluación no está activo».
        </p>
      </div>
    </form>
  );
}

/** Selector de fecha de la tabla de bimestres (la etiqueta queda para lectores de pantalla). */
function CampoFecha({
  etiqueta,
  valor,
  onCambiar,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  return (
    <label className="flex w-full items-center gap-2 rounded-lg border border-borde bg-white px-4 py-3 focus-within:border-kubo-azul focus-within:ring-1 focus-within:ring-kubo-azul">
      <Icono nombre="icon-calendar-gris" size={18} />
      <input
        type="date"
        aria-label={etiqueta}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[16px] leading-[1.4] text-texto outline-none"
      />
    </label>
  );
}

// ---------- Confirmar cambio de estado ----------

export function ModalCambioEstado({
  anio,
  onCerrar,
  onListo,
}: {
  anio: AnioAcademico | null;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destino = anio ? siguienteEstado(anio.estado) : null;
  const transicion = destino ? TRANSICIONES[destino] : null;

  function cerrar() {
    setError(null);
    onCerrar();
  }

  async function confirmar() {
    if (!anio || !destino || !transicion) return;
    setEnviando(true);
    setError(null);
    try {
      await api(`/academico/anios/${anio.id}/estado`, { method: "POST", body: { estado: destino } });
      onListo(`El año ${anio.anio} pasó a «${ESTILO_ESTADO_ANIO[destino].texto}».`);
      cerrar();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={Boolean(anio && transicion)}
      onCerrar={cerrar}
      icono={transicion?.peligro ? "kpi-ban" : "icon-calendar"}
      tonoIcono={transicion?.peligro ? "rojo" : "azul"}
      titulo={transicion?.titulo ?? ""}
      subtitulo="Los estados del año solo avanzan: este cambio no se puede deshacer."
      pie={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante={transicion?.peligro ? "peligro" : "primario"} onClick={confirmar} cargando={enviando}>
            {transicion?.accion}
          </Boton>
        </>
      }
    >
      {anio && transicion && (
        <>
          <div className="flex w-full items-center gap-3 rounded-lg bg-fondo p-3.5">
            <span className="text-[16px] font-semibold text-texto">Año {anio.anio}</span>
            <BadgeEstadoAnio estado={anio.estado} />
            <span aria-hidden className="text-texto-3">
              →
            </span>
            {destino && <BadgeEstadoAnio estado={destino} />}
          </div>
          <p className="text-[14px] leading-[1.5] text-texto-2">{transicion.detalle(anio.anio)}</p>
        </>
      )}
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}

/** Año activo por defecto: el que está en curso, si no el que está en matrícula, si no el más reciente abierto. */
export function anioPorDefecto(anios: AnioAcademico[]): AnioAcademico | undefined {
  return (
    anios.find((a) => a.estado === "EN_CURSO") ??
    anios.find((a) => a.estado === "EN_MATRICULA") ??
    anios.find((a) => a.estado !== "CERRADO") ??
    anios[0]
  );
}
