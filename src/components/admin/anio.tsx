// Piezas de AD-02 Año académico y bimestres (US06, US07): tipos, badges, línea de estados,
// formulario de los 4 bimestres y los modales de crear año y de cambio de estado.
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

const ESTILO_ESTADO_ANIO: Record<EstadoAnio, { texto: string; tono: "azul" | "celeste" | "verde" | "ambar" | "gris" }> =
  {
    PLANIFICADO: { texto: "Planificado", tono: "azul" },
    EN_MATRICULA: { texto: "En matrícula", tono: "celeste" },
    EN_CURSO: { texto: "En curso", tono: "verde" },
    EN_CIERRE: { texto: "En cierre", tono: "ambar" },
    CERRADO: { texto: "Cerrado", tono: "gris" },
  };

const ESTILO_ESTADO_PERIODO: Record<EstadoPeriodo, { texto: string; tono: "azul" | "verde" | "ambar" | "gris" }> = {
  INACTIVO: { texto: "Inactivo", tono: "gris" },
  ACTIVO: { texto: "Activo", tono: "verde" },
  EN_CIERRE: { texto: "En cierre", tono: "ambar" },
  FINALIZADO: { texto: "Finalizado", tono: "azul" },
};

/** Cada transición es un botón con su confirmación. EN_MATRICULA = «Abrir matrícula» (US06). */
export const TRANSICIONES: Record<
  Exclude<EstadoAnio, "PLANIFICADO">,
  { accion: string; titulo: string; detalle: (anio: number) => string; peligro?: boolean }
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
  },
  CERRADO: {
    accion: "Cerrar año",
    titulo: "Cerrar el año académico",
    detalle: (anio) =>
      `El año ${anio} quedará cerrado y ya no se podrá modificar. ` +
      "Solo se puede cerrar si todas las notas de sus bimestres están publicadas.",
    peligro: true,
  },
};

export const nombreBimestre = (numero: number) => `Bimestre ${NUMERALES[numero - 1] ?? numero}`;

export function siguienteEstado(estado: EstadoAnio): Exclude<EstadoAnio, "PLANIFICADO"> | null {
  const siguiente = ESTADOS_ANIO[ESTADOS_ANIO.indexOf(estado) + 1];
  return siguiente && siguiente !== "PLANIFICADO" ? siguiente : null;
}

export function BadgeEstadoAnio({ estado }: { estado: EstadoAnio }) {
  const e = ESTILO_ESTADO_ANIO[estado];
  return (
    <Badge tono={e.tono} punto>
      {e.texto}
    </Badge>
  );
}

export function BadgeEstadoPeriodo({ estado }: { estado: EstadoPeriodo }) {
  const e = ESTILO_ESTADO_PERIODO[estado];
  return <Badge tono={e.tono}>{e.texto}</Badge>;
}

/** Mensaje del backend tal cual; si son errores de formulario, se agregan los de cada campo. */
function mensajeDe(e: unknown): string {
  if (e instanceof ApiError && e.codigo === "DATOS_INVALIDOS") {
    return [e.message, ...Object.values(e.detalles).map(String)].join(" ");
  }
  return alertaError(e);
}

// ---------- Línea de estados del año ----------

export function LineaEstados({ estado }: { estado: EstadoAnio }) {
  const actual = ESTADOS_ANIO.indexOf(estado);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Estados del año académico">
      {ESTADOS_ANIO.map((e, i) => {
        const hecho = i < actual;
        const esActual = i === actual;
        return (
          <li key={e} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className={`h-px w-6 ${hecho || esActual ? "bg-kubo-azul" : "bg-borde"}`} />}
            <span
              aria-current={esActual ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] leading-[1.4] ${
                esActual
                  ? "bg-kubo-azul font-semibold text-white"
                  : hecho
                    ? "bg-kubo-azul/10 font-medium text-kubo-azul"
                    : "border border-borde font-medium text-texto-3"
              }`}
            >
              {hecho && <Icono nombre="icon-check-verde" size={14} />}
              {ESTILO_ESTADO_ANIO[e].texto}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Formulario de los 4 bimestres (US07) ----------

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

/**
 * Se guardan los 4 juntos. Para reiniciarlo con datos nuevos, el padre cambia su key (estándar 6.5).
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
  const sinGuardar = anio.periodos.length < CANTIDAD_BIMESTRES;

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
    <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Bimestres</h2>
        <p className="text-[14px] leading-[1.4] text-texto-2">
          Cada bimestre debe estar dentro del año ({fechaDia(anio.fechaInicio)} al {fechaDia(anio.fechaFin)}) y no puede
          solaparse con otro. Un bimestre finalizado ya no se edita.
        </p>
      </div>

      {sinGuardar && !soloLectura && (
        <Alerta tipo="info" titulo="Bimestres pendientes">
          Registra las fechas de los 4 bimestres para que el año pueda usarse en notas y asistencia.
        </Alerta>
      )}

      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full min-w-[640px] border-collapse bg-white text-left">
          <thead>
            <tr className="border-b border-borde bg-fondo text-[13px] font-semibold leading-[1.4] text-texto-2">
              <th className="w-[160px] px-4 py-2.5 font-semibold">Bimestre</th>
              <th className="px-4 py-2.5 font-semibold">Fecha de inicio</th>
              <th className="px-4 py-2.5 font-semibold">Fecha de fin</th>
              <th className="w-[130px] px-4 py-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const guardado = anio.periodos.find((p) => p.numero === f.numero);
              const bloqueado = soloLectura || guardado?.estado === "FINALIZADO";
              const nombre = nombreBimestre(f.numero);
              return (
                <tr key={f.numero} className="border-b border-borde text-[14px] text-texto last:border-b-0">
                  <td className="px-4 py-3 font-semibold">{nombre}</td>
                  <td className="px-4 py-2">
                    <CampoFecha
                      etiqueta={`${nombre}: fecha de inicio`}
                      valor={f.fechaInicio}
                      deshabilitado={bloqueado}
                      onCambiar={(v) => cambiar(f.numero, "fechaInicio", v)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <CampoFecha
                      etiqueta={`${nombre}: fecha de fin`}
                      valor={f.fechaFin}
                      deshabilitado={bloqueado}
                      onCambiar={(v) => cambiar(f.numero, "fechaFin", v)}
                    />
                  </td>
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

      {error && <Alerta tipo="error" titulo={error} />}

      {!soloLectura && (
        <div className="flex justify-end">
          <Boton type="submit" cargando={guardando}>
            Guardar bimestres
          </Boton>
        </div>
      )}
    </form>
  );
}

/** Selector de fecha compacto para la tabla de bimestres (la etiqueta queda para lectores de pantalla). */
function CampoFecha({
  etiqueta,
  valor,
  deshabilitado,
  onCambiar,
}: {
  etiqueta: string;
  valor: string;
  deshabilitado: boolean;
  onCambiar: (valor: string) => void;
}) {
  return (
    <input
      type="date"
      aria-label={etiqueta}
      value={valor}
      disabled={deshabilitado}
      onChange={(e) => onCambiar(e.target.value)}
      className="w-full rounded-lg border border-borde bg-white px-3 py-2 text-[15px] leading-[1.4] text-texto outline-none focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul disabled:bg-fondo disabled:text-texto-2"
    />
  );
}

// ---------- Crear año académico ----------

const VACIO = { anio: "", fechaInicio: "", fechaFin: "" };

export function ModalCrearAnio({
  abierto,
  onCerrar,
  onCreado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: (anio: AnioAcademico) => void;
}) {
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo: keyof typeof VACIO) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [campo]: e.target.value }));

  function cerrar() {
    setDatos(VACIO);
    setErrores({});
    setError(null);
    onCerrar();
  }

  async function crear(e?: FormEvent) {
    e?.preventDefault();
    setEnviando(true);
    setErrores({});
    setError(null);
    try {
      const creado = await api<AnioAcademico>("/academico/anios", {
        method: "POST",
        body: { anio: Number(datos.anio) || undefined, fechaInicio: datos.fechaInicio, fechaFin: datos.fechaFin },
      });
      setDatos(VACIO);
      onCreado(creado);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === "DATOS_INVALIDOS")
        setErrores(err.detalles as Record<string, string>);
      else setError(alertaError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      icono="icon-calendar"
      tonoIcono="azul"
      titulo="Crear año académico"
      subtitulo="Se crea en estado «Planificado». Después podrás registrar sus bimestres y abrir la matrícula."
      pie={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton onClick={() => crear()} cargando={enviando}>
            Crear año
          </Boton>
        </>
      }
    >
      <form onSubmit={crear} className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Campo
          etiqueta="Año"
          obligatorio
          inputMode="numeric"
          maxLength={4}
          placeholder="Ej.: 2026"
          value={datos.anio}
          onChange={cambiar("anio")}
          error={errores.anio}
          className="sm:col-span-2"
        />
        <Campo
          etiqueta="Fecha de inicio"
          obligatorio
          type="date"
          value={datos.fechaInicio}
          onChange={cambiar("fechaInicio")}
          error={errores.fechaInicio}
        />
        <Campo
          etiqueta="Fecha de fin"
          obligatorio
          type="date"
          value={datos.fechaFin}
          onChange={cambiar("fechaFin")}
          error={errores.fechaFin}
        />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        {error && (
          <div className="sm:col-span-2">
            <Alerta tipo="error" titulo={error} />
          </div>
        )}
      </form>
    </Modal>
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
