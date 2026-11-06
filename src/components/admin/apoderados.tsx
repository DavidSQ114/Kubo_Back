// Piezas de AD-08 Registrar apoderado (US15) y AD-09 Registrar estudiante (US17): buscador de apoderados y de
// estudiantes, filas de vínculo (parentesco, principal, autorizado) y validaciones del navegador.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Badge, Boton, Casilla, Icono, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { alertaError } from "./PortalAdmin";

/** Mismos valores que comunidad/domain (PARENTESCOS): el backend los valida. */
export const PARENTESCOS = [
  "Madre",
  "Padre",
  "Abuela",
  "Abuelo",
  "Tía",
  "Tío",
  "Hermana",
  "Hermano",
  "Tutor legal",
  "Otro",
] as const;

export const MENSAJE_SIN_APODERADO = "Debe asociar al menos un apoderado antes de continuar";
export const MENSAJE_APODERADO_EXISTENTE = "Ya existe un apoderado registrado con este DNI";
export const MENSAJE_ESTUDIANTE_EXISTENTE = "Ya existe un estudiante registrado con este DNI";
export const MENSAJE_TELEFONO = "El número de teléfono debe tener 9 dígitos";

/** Respuesta de GET /comunidad/apoderados. */
export interface ApoderadoListado {
  apoderadoId: string;
  personaId: string;
  dni: string;
  nombreCompleto: string;
  telefono: string | null;
  email: string | null;
  ocupacion: string | null;
  estudiantes: number;
}

/** Respuesta de GET /comunidad/estudiantes. */
export interface EstudianteListado {
  estudianteId: string;
  personaId: string;
  dni: string;
  nombreCompleto: string;
  gradoIngreso: string | null;
  apoderados: { apoderadoId: string; nombreCompleto: string; parentesco: string; esPrincipal: boolean }[];
}

interface Pagina<T> {
  items: T[];
  paginacion: { total: number };
}

/** Vínculo que se está armando en pantalla (con el estudiante o con el apoderado). */
export interface VinculoEnPantalla {
  parentesco: string;
  esPrincipal: boolean;
  autorizado: boolean;
}

export const iniciales = (nombreCompleto: string) => {
  const partes = nombreCompleto.trim().split(/\s+/);
  return `${partes[0]?.charAt(0) ?? ""}${partes.length > 2 ? partes[partes.length - 2].charAt(0) : (partes[1]?.charAt(0) ?? "")}`.toUpperCase();
};

/** «987654321» → «987 654 321». */
export const telefonoLegible = (t: string | null) => (t ? t.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3") : "");

export function Avatar({ nombre, tono = "azul" }: { nombre: string; tono?: "azul" | "verde" }) {
  return (
    <span
      aria-hidden
      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white ${
        tono === "verde" ? "bg-verde-oscuro" : "bg-celeste"
      }`}
    >
      {iniciales(nombre)}
    </span>
  );
}

// ---------- Buscador por DNI o nombre ----------

const ESPERA_BUSQUEDA_MS = 300; // espera a que se deje de escribir antes de consultar
const LARGO_MINIMO_BUSQUEDA = 2;

/**
 * Caja de búsqueda con resultados debajo (DNI o nombre). `ruta` es /comunidad/apoderados o /comunidad/estudiantes.
 * Cada resultado se dibuja con `fila`; los ya elegidos se marcan con `elegidos` (ids) y no se pueden volver a agregar.
 */
export function Buscador<T>({
  ruta,
  etiqueta,
  placeholder,
  idDe,
  elegidos,
  fila,
  onElegir,
  deshabilitado,
  vacio,
}: {
  ruta: string;
  etiqueta: string;
  placeholder: string;
  idDe: (item: T) => string;
  elegidos: string[];
  fila: (item: T) => ReactNode;
  onElegir: (item: T) => void;
  deshabilitado?: boolean;
  vacio: ReactNode;
}) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<{ q: string; items: T[] | null; error: string | null }>({
    q: "",
    items: null,
    error: null,
  });
  const q = texto.trim();
  const activa = q.length >= LARGO_MINIMO_BUSQUEDA;

  useEffect(() => {
    if (!activa) return;
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const r = await api<Pagina<T>>(`${ruta}?q=${encodeURIComponent(q)}&tamano=6`);
        if (vigente) setEstado({ q, items: r.items, error: null });
      } catch (e) {
        if (vigente) setEstado({ q, items: [], error: alertaError(e) });
      }
    }, ESPERA_BUSQUEDA_MS);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [q, activa, ruta]);

  const actual = activa && estado.q === q ? estado : null;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-medium leading-[1.4] text-texto-2">{etiqueta}</span>
        <span className="flex w-full items-center gap-2 rounded-lg border border-borde bg-white px-4 py-3 focus-within:border-kubo-azul focus-within:ring-1 focus-within:ring-kubo-azul">
          <Icono nombre="icon-search" size={18} />
          <input
            type="search"
            value={texto}
            disabled={deshabilitado}
            maxLength={100}
            placeholder={placeholder}
            onChange={(e) => setTexto(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[16px] leading-[1.4] text-texto outline-none placeholder:text-texto-3"
          />
          {activa && !actual && <Spinner claro={false} />}
        </span>
      </label>
      {actual && (
        <div className="flex flex-col divide-y divide-borde rounded-lg border border-borde bg-white">
          {actual.error && <p className="px-4 py-3 text-[14px] text-rojo-oscuro">{actual.error}</p>}
          {!actual.error && actual.items?.length === 0 && (
            <div className="px-4 py-3 text-[14px] text-texto-2">{vacio}</div>
          )}
          {actual.items?.map((item) => {
            const yaElegido = elegidos.includes(idDe(item));
            return (
              <div key={idDe(item)} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">{fila(item)}</div>
                <Boton
                  variante="secundario"
                  icono={yaElegido ? undefined : "icon-plus-gris"}
                  disabled={yaElegido}
                  onClick={() => {
                    onElegir(item);
                    setTexto("");
                  }}
                >
                  {yaElegido ? "Agregado" : "Vincular"}
                </Boton>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Fila de un vínculo ----------

/**
 * Persona elegida (estudiante en AD-08, apoderado en AD-09) con los datos del vínculo: parentesco, principal y
 * autorizado. `principalBloqueado` deja la casilla marcada y fija cuando es el único apoderado (AD-09).
 */
export function FilaVinculo({
  nombre,
  detalle,
  vinculo,
  error,
  ayudaPrincipal,
  principalBloqueado,
  deshabilitado,
  onCambiar,
  onQuitar,
}: {
  nombre: string;
  detalle: string;
  vinculo: VinculoEnPantalla;
  error?: string;
  ayudaPrincipal?: string;
  principalBloqueado?: boolean;
  deshabilitado?: boolean;
  onCambiar: (cambios: Partial<VinculoEnPantalla>) => void;
  onQuitar: () => void;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        vinculo.esPrincipal ? "border-verde bg-verde/5" : "border-borde bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar nombre={nombre} tono={vinculo.esPrincipal ? "verde" : "azul"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-2 text-[14px] font-semibold leading-[1.4] text-texto">
            {nombre} {vinculo.esPrincipal && <Badge tono="verde">Principal</Badge>}
          </span>
          <span className="text-[12px] text-texto-3">{detalle}</span>
        </div>
        {!deshabilitado && (
          <button
            type="button"
            onClick={onQuitar}
            aria-label={`Quitar a ${nombre}`}
            className="rounded-md p-1.5 hover:bg-fondo"
          >
            <Icono nombre="act-trash" size={18} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-[14px] text-texto-2">
          Parentesco <span className="text-rojo">*</span>
          <select
            value={vinculo.parentesco}
            disabled={deshabilitado}
            onChange={(e) => onCambiar({ parentesco: e.target.value })}
            className={`rounded-lg border bg-white px-3 py-2 text-[14px] text-texto outline-none focus:border-kubo-azul ${
              error ? "border-rojo ring-1 ring-rojo" : "border-borde"
            }`}
          >
            <option value="">Elige</option>
            {PARENTESCOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {!deshabilitado && (
          <>
            {principalBloqueado ? (
              <span className="text-[14px] text-texto-2">Apoderado principal (es el único)</span>
            ) : (
              <Casilla
                etiqueta="Apoderado principal"
                checked={vinculo.esPrincipal}
                onChange={(esPrincipal) => onCambiar({ esPrincipal })}
                color="verde"
              />
            )}
            <Casilla
              etiqueta="Autorizado"
              checked={vinculo.autorizado}
              onChange={(autorizado) => onCambiar({ autorizado })}
            />
          </>
        )}
      </div>
      {error && <p className="text-[13px] leading-[1.4] text-rojo-oscuro">{error}</p>}
      {ayudaPrincipal && !error && <p className="text-[13px] leading-[1.4] text-texto-3">{ayudaPrincipal}</p>}
    </div>
  );
}

// ---------- Validaciones del navegador (mismos mensajes que el backend, que igual valida todo) ----------

const HOY = () => new Date().toISOString().slice(0, 10);

export function errorFechaNacimiento(fecha: string, obligatoria: boolean): string | null {
  if (!fecha) return obligatoria ? "Ingresa la fecha de nacimiento" : null;
  if (fecha > HOY()) return "La fecha de nacimiento no puede ser futura";
  return null;
}

export function errorNombre(valor: string, campo: "los nombres" | "los apellidos"): string | null {
  return valor.trim().length < 2 ? `Ingresa ${campo}` : null;
}

export const dniValido = (dni: string) => /^\d{8}$/.test(dni.trim());

/** Errores de los vínculos: falta parentesco (por índice). */
export function erroresParentesco(vinculos: VinculoEnPantalla[]): Record<number, string> {
  return Object.fromEntries(vinculos.flatMap((v, i) => (v.parentesco ? [] : [[i, "Elige el parentesco"]])));
}

/** Línea de la tarjeta «Validaciones» de AD-09. */
export function ItemValidacion({ ok, titulo, detalle }: { ok: boolean | null; titulo: string; detalle?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
          ok === null ? "bg-fondo text-texto-3" : ok ? "bg-verde/15 text-verde-oscuro" : "bg-rojo/10 text-rojo-oscuro"
        }`}
      >
        {ok === null ? "·" : ok ? "✓" : "✕"}
      </span>
      <span className="flex flex-col">
        <span className="text-[14px] font-medium leading-[1.4] text-texto">
          <span className="sr-only">{ok === null ? "Pendiente: " : ok ? "Cumple: " : "Falta: "}</span>
          {titulo}
        </span>
        {detalle && (
          <span className={`text-[12px] leading-[1.4] ${ok === false ? "text-rojo-oscuro" : "text-texto-3"}`}>
            {detalle}
          </span>
        )}
      </span>
    </li>
  );
}
