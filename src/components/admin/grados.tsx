// Piezas de AD-03 Grados, secciones y aulas (US08, US09): tipos, barra de vacantes, panel «Nueva sección»,
// bloque «Aulas físicas» y la confirmación para eliminar una sección.
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Alerta, Badge, Boton, Campo, Icono, Modal } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { alertaError } from "./PortalAdmin";

export interface Grado {
  id: string;
  numero: number;
  nombre: string;
}

export interface Vacantes {
  matriculados: number;
  aforo: number;
  disponibles: number;
  completo: boolean;
}

export interface Seccion {
  id: string;
  anioAcademicoId: string;
  nombre: string;
  aforoMaximo: number;
  estado: "ACTIVA" | "INACTIVA";
  grado: Grado;
  aula: { id: string; nombre: string; aforo: number; activo: boolean } | null;
  tutor: { id: string; nombreCompleto: string; nombreCorto: string } | null;
  vacantes: Vacantes;
}

export interface Aula {
  id: string;
  nombre: string;
  ubicacion: string | null;
  aforo: number;
  activo: boolean;
  secciones: { id: string; grado: number; nombre: string; matriculados: number; aforoMaximo: number }[];
}

export interface Docente {
  id: string;
  nombreCompleto: string;
  nombreCorto: string;
}

export const ID_CAMPO_SECCION = "seccion-nombre";
export const ID_CAMPO_AULA = "aula-nombre";

export const nombreSeccion = (s: { grado: { numero: number } | number; nombre: string }) =>
  `${typeof s.grado === "number" ? s.grado : s.grado.numero}° ${s.nombre}`;

/** Errores de formulario: DATOS_INVALIDOS por campo; los demás, el mensaje del backend tal cual. */
function separarErrores(e: unknown, campoDe: Record<string, string> = {}) {
  if (e instanceof ApiError && e.codigo === "DATOS_INVALIDOS") {
    return { campos: e.detalles as Record<string, string>, general: null };
  }
  if (e instanceof ApiError && campoDe[e.codigo]) return { campos: { [campoDe[e.codigo]]: e.message }, general: null };
  return { campos: {}, general: alertaError(e) };
}

// ---------- Vacantes ----------

/** Barra «27/30»: roja cuando la sección (o el aula) está llena. */
export function BarraOcupacion({ ocupados, total }: { ocupados: number; total: number }) {
  const lleno = ocupados >= total;
  const ancho = total > 0 ? Math.min(100, Math.round((ocupados / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-borde" aria-hidden>
        <div className={`h-full rounded-full ${lleno ? "bg-rojo" : "bg-verde"}`} style={{ width: `${ancho}%` }} />
      </div>
      <span className={`text-[14px] tabular-nums ${lleno ? "text-rojo-oscuro" : "text-texto"}`}>
        {ocupados}/{total}
      </span>
    </div>
  );
}

export function BadgeEstadoSeccion({ seccion }: { seccion: Seccion }) {
  if (seccion.estado === "INACTIVA") {
    return (
      <Badge tono="gris" punto>
        Inactiva
      </Badge>
    );
  }
  if (seccion.vacantes.completo) {
    return (
      <Badge tono="rojo" punto>
        Aforo completo
      </Badge>
    );
  }
  return (
    <Badge tono="verde" punto>
      Activa
    </Badge>
  );
}

// ---------- Panel «Nueva sección» / «Editar sección» ----------

interface DatosSeccion {
  gradoId: string;
  nombre: string;
  aforoMaximo: string;
  aulaId: string;
  tutorId: string;
}

function datosIniciales(seccion: Seccion | null, grados: Grado[]): DatosSeccion {
  if (seccion) {
    return {
      gradoId: seccion.grado.id,
      nombre: seccion.nombre,
      aforoMaximo: String(seccion.aforoMaximo),
      aulaId: seccion.aula?.id ?? "",
      tutorId: seccion.tutor?.id ?? "",
    };
  }
  return { gradoId: grados[0]?.id ?? "", nombre: "", aforoMaximo: "", aulaId: "", tutorId: "" };
}

/**
 * Crea o edita una sección del año elegido. Para pasar de una sección a otra, el padre cambia su key (estándar 6.5).
 * El aula y el tutor son opcionales; al elegir un aula, el aforo se completa con el suyo si estaba vacío.
 */
export function PanelSeccion({
  anio,
  seccion,
  grados,
  aulas,
  docentes,
  soloLectura,
  onCancelar,
  onGuardado,
}: {
  anio: { id: string; anio: number };
  seccion: Seccion | null;
  grados: Grado[];
  aulas: Aula[];
  docentes: Docente[];
  soloLectura: boolean;
  onCancelar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const [datos, setDatos] = useState(() => datosIniciales(seccion, grados));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Aulas activas, más la que ya tenga la sección aunque esté inactiva (para que se vea cuál es).
  const opcionesAula = aulas.filter((a) => a.activo || a.id === seccion?.aula?.id);

  const cambiar = (campo: keyof DatosSeccion) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [campo]: e.target.value }));

  function elegirAula(aulaId: string) {
    const aula = aulas.find((a) => a.id === aulaId);
    setDatos((d) => ({ ...d, aulaId, aforoMaximo: d.aforoMaximo || (aula ? String(aula.aforo) : "") }));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    setError(null);
    const cuerpo = {
      gradoId: datos.gradoId,
      nombre: datos.nombre,
      aforoMaximo: Number(datos.aforoMaximo) || 0,
      aulaId: datos.aulaId || null,
      tutorId: datos.tutorId || null,
    };
    try {
      if (seccion) {
        await api(`/academico/secciones/${seccion.id}`, { method: "PATCH", body: cuerpo });
      } else {
        await api("/academico/secciones", { method: "POST", body: { ...cuerpo, anioAcademicoId: anio.id } });
      }
      const nombre = `${grados.find((g) => g.id === datos.gradoId)?.numero ?? ""}° ${datos.nombre.trim().toUpperCase()}`;
      onGuardado(seccion ? `Se actualizó la sección ${nombre}.` : `Se creó la sección ${nombre}.`);
    } catch (err) {
      const r = separarErrores(err, {
        SECCION_DUPLICADA: "nombre",
        NOMBRE_SECCION_INVALIDO: "nombre",
        AFORO_INVALIDO: "aforoMaximo",
        AFORO_EXCEDE_AULA: "aforoMaximo",
        AULA_INACTIVA: "aulaId",
        TUTOR_NO_DISPONIBLE: "tutorId",
      });
      setErrores(r.campos);
      setError(r.general);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">
          {seccion ? `Editar sección ${nombreSeccion(seccion)}` : "Nueva sección"}
        </h2>
        <p className="text-[14px] leading-[1.4] text-texto-3">Año académico {anio.anio}</p>
      </div>

      {soloLectura && <Alerta tipo="info" titulo="El año está cerrado: sus secciones ya no se modifican." />}

      <Selector
        etiqueta="Grado"
        obligatorio
        valor={datos.gradoId}
        onCambiar={(v) => setDatos((d) => ({ ...d, gradoId: v }))}
        deshabilitado={soloLectura}
        error={errores.gradoId}
      >
        {grados.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nombre}
          </option>
        ))}
      </Selector>
      <Campo
        id={ID_CAMPO_SECCION}
        etiqueta="Nombre de la sección"
        obligatorio
        maxLength={3}
        placeholder="Ej.: A"
        value={datos.nombre}
        onChange={cambiar("nombre")}
        disabled={soloLectura}
        error={errores.nombre}
      />
      <Selector
        etiqueta="Aula física"
        valor={datos.aulaId}
        onCambiar={elegirAula}
        deshabilitado={soloLectura}
        error={errores.aulaId}
        ayuda="El aforo del aula define las vacantes de la sección."
      >
        <option value="">Sin aula asignada</option>
        {opcionesAula.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre} · aforo {a.aforo}
            {a.activo ? "" : " (inactiva)"}
          </option>
        ))}
      </Selector>
      <Campo
        etiqueta="Aforo máximo"
        obligatorio
        inputMode="numeric"
        placeholder="Ej.: 30"
        value={datos.aforoMaximo}
        onChange={cambiar("aforoMaximo")}
        disabled={soloLectura}
        error={errores.aforoMaximo}
      />
      <Selector
        etiqueta="Tutor (opcional)"
        valor={datos.tutorId}
        onCambiar={(v) => setDatos((d) => ({ ...d, tutorId: v }))}
        deshabilitado={soloLectura}
        error={errores.tutorId}
        ayuda={docentes.length === 0 ? "Aún no hay docentes activos registrados." : undefined}
      >
        <option value="">Seleccionar docente</option>
        {docentes.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombreCompleto}
          </option>
        ))}
      </Selector>

      {!seccion && !soloLectura && (
        <Alerta tipo="info">
          Al guardar, la sección queda «Activa» con vacantes 0/aforo y disponible en el formulario de matrícula.
        </Alerta>
      )}
      {error && <Alerta tipo="error" titulo={error} />}

      {!soloLectura && (
        <div className="flex justify-end gap-3">
          <Boton type="button" variante="secundario" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardando}>
            Guardar sección
          </Boton>
        </div>
      )}
    </form>
  );
}

/** Lista desplegable con el mismo estilo que Campo (etiqueta, obligatorio, error y ayuda). */
export function Selector({
  etiqueta,
  valor,
  onCambiar,
  children,
  obligatorio,
  deshabilitado,
  error,
  ayuda,
  oculto,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  children: ReactNode;
  obligatorio?: boolean;
  deshabilitado?: boolean;
  error?: string;
  ayuda?: string;
  /** La etiqueta queda solo para lectores de pantalla (filtros). */
  oculto?: boolean;
}) {
  const id = `selector-${etiqueta.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={id}
        className={`flex gap-1 text-[14px] font-medium leading-[1.4] text-texto-2 ${oculto ? "sr-only" : ""}`}
      >
        {etiqueta}
        {obligatorio && <span className="text-rojo">*</span>}
      </label>
      <div className="relative">
        <select
          id={id}
          value={valor}
          disabled={deshabilitado}
          onChange={(e) => onCambiar(e.target.value)}
          className={`w-full appearance-none rounded-lg border bg-white px-4 py-3 pr-10 text-[16px] leading-[1.4] text-texto outline-none focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul disabled:bg-fondo ${
            error ? "border-rojo ring-1 ring-rojo" : "border-borde"
          }`}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
          <Icono nombre="icon-chevd" size={18} />
        </span>
      </div>
      {error && <p className="text-[13px] leading-[1.4] text-rojo-oscuro">{error}</p>}
      {ayuda && !error && <p className="text-[13px] leading-[1.4] text-texto-3">{ayuda}</p>}
    </div>
  );
}

// ---------- Aulas físicas ----------

const AULA_VACIA = { nombre: "", ubicacion: "", aforo: "" };

/** «Aula 101 · Pabellón A · 1er piso · 30»: formulario en línea para registrar o editar un aula (US09). */
export function FormularioAula({
  aula,
  onCancelar,
  onGuardado,
}: {
  aula: Aula | null;
  onCancelar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const [datos, setDatos] = useState(() =>
    aula ? { nombre: aula.nombre, ubicacion: aula.ubicacion ?? "", aforo: String(aula.aforo) } : AULA_VACIA,
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo: keyof typeof AULA_VACIA) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    setError(null);
    const cuerpo = { nombre: datos.nombre, ubicacion: datos.ubicacion.trim() || null, aforo: Number(datos.aforo) };
    try {
      if (aula) await api(`/academico/aulas/${aula.id}`, { method: "PATCH", body: cuerpo });
      else await api("/academico/aulas", { method: "POST", body: cuerpo });
      if (!aula) setDatos(AULA_VACIA);
      onGuardado(aula ? `Se actualizó ${datos.nombre.trim()}.` : `Se registró ${datos.nombre.trim()}.`);
    } catch (err) {
      const r = separarErrores(err, {
        AULA_DUPLICADA: "nombre",
        AFORO_INVALIDO: "aforo",
        AFORO_MENOR_QUE_SECCIONES: "aforo",
      });
      setErrores(r.campos);
      setError(r.general);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Campo
          id={ID_CAMPO_AULA}
          etiqueta="Nombre del aula"
          obligatorio
          placeholder="Ej.: Aula 305"
          value={datos.nombre}
          onChange={cambiar("nombre")}
          error={errores.nombre}
        />
        <Campo
          etiqueta="Ubicación"
          placeholder="Ej.: Pabellón C · 3er piso"
          value={datos.ubicacion}
          onChange={cambiar("ubicacion")}
          error={errores.ubicacion}
        />
        <Campo
          etiqueta="Aforo máximo"
          obligatorio
          inputMode="numeric"
          placeholder="Ej.: 30"
          value={datos.aforo}
          onChange={cambiar("aforo")}
          error={errores.aforo}
        />
        <div className="flex gap-2 md:pt-[27px]">
          {aula && (
            <Boton type="button" variante="secundario" onClick={onCancelar} disabled={guardando}>
              Cancelar
            </Boton>
          )}
          <Boton type="submit" icono={aula ? "check-blanco" : "icon-plus-blanco"} cargando={guardando}>
            {aula ? "Guardar aula" : "Registrar aula"}
          </Boton>
        </div>
      </div>
      {error && <Alerta tipo="error" titulo={error} />}
    </form>
  );
}

// ---------- Eliminar sección ----------

export function ModalEliminarSeccion({
  seccion,
  onCerrar,
  onListo,
  onError,
}: {
  seccion: Seccion | null;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
  /** Error del backend (p. ej. con alumnos matriculados): se muestra fuera del modal, con la opción de inactivar. */
  onError: (seccion: Seccion, codigo: string, mensaje: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!seccion) return;
    setEnviando(true);
    try {
      await api(`/academico/secciones/${seccion.id}`, { method: "DELETE" });
      onListo(`Se eliminó la sección ${nombreSeccion(seccion)}.`);
    } catch (err) {
      onError(seccion, err instanceof ApiError ? err.codigo : "ERROR", alertaError(err));
    } finally {
      setEnviando(false);
      onCerrar();
    }
  }

  return (
    <Modal
      abierto={Boolean(seccion)}
      onCerrar={onCerrar}
      icono="kpi-ban"
      titulo={seccion ? `Eliminar la sección ${nombreSeccion(seccion)}` : ""}
      subtitulo="Solo se puede eliminar una sección sin alumnos matriculados."
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="peligro" onClick={confirmar} cargando={enviando}>
            Eliminar sección
          </Boton>
        </>
      }
    >
      <p className="text-[14px] leading-[1.5] text-texto-2">
        La sección dejará de existir. Si ya tiene alumnos, conviene inactivarla: así no recibe nuevas matrículas y
        conserva su historial.
      </p>
    </Modal>
  );
}
