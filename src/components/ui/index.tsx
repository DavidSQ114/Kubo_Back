/* eslint-disable @next/next/no-img-element */
// Componentes base de Kubo, traducidos del prototipo Figma (guía de estilos).
"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type ButtonHTMLAttributes } from "react";

// ---------- Íconos y logo (SVG exportados del Figma en public/figma) ----------

export function Icono({ nombre, size = 20, className = "" }: { nombre: string; size?: number; className?: string }) {
  return (
    <img
      src={`/figma/${nombre}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Logo Kubo. "claro": sobre fondo claro (AC-04, AC-06). "marca": panel azul del login (AC-01). "sidebar": barra lateral. */
export function Logo({ variante = "claro" }: { variante?: "claro" | "marca" | "sidebar" }) {
  if (variante === "sidebar") {
    return (
      <div className="flex items-center gap-[9px]">
        <Icono nombre="logo-isotipo-sidebar" size={30} />
        <span className="text-[23px] font-bold leading-none text-white">Kubo</span>
      </div>
    );
  }
  if (variante === "marca") {
    return (
      <div className="flex items-center gap-[13px]">
        <Icono nombre="logo-isotipo-blanco" size={44} />
        <div className="flex flex-col gap-1 whitespace-nowrap">
          <span className="text-[34px] font-bold leading-none text-white">Kubo</span>
          <span className="text-[11px] font-semibold leading-[1.2] tracking-[1.4px] text-white/75">
            PLATAFORMA EDUCATIVA INTEGRAL
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Icono nombre="logo-isotipo" size={40} />
      <div className="flex flex-col gap-1 whitespace-nowrap">
        <span className="text-[31px] font-bold leading-none text-texto">
          Ku<span className="text-kubo-azul">b</span>
          <span className="text-verde">o</span>
        </span>
        <span className="text-[10px] font-semibold leading-[1.2] tracking-[1.4px] text-texto-3">
          PLATAFORMA EDUCATIVA INTEGRAL
        </span>
      </div>
    </div>
  );
}

// ---------- Alertas (alerta/err, alerta/warn, alerta/ok, alerta/info) ----------

const ESTILO_ALERTA = {
  error: { caja: "bg-[rgba(214,69,69,0.08)] border-rojo", icono: "alerta-err" },
  aviso: { caja: "bg-[rgba(232,169,59,0.14)] border-ambar", icono: "alerta-warn-lock" },
  exito: { caja: "bg-[rgba(46,158,107,0.08)] border-verde", icono: "alerta-ok-mail" },
  info: { caja: "bg-[rgba(74,144,217,0.08)] border-celeste", icono: "alerta-info" },
} as const;

export function Alerta({
  tipo,
  titulo,
  children,
  icono,
}: {
  tipo: keyof typeof ESTILO_ALERTA;
  titulo?: string;
  children?: ReactNode;
  icono?: string;
}) {
  const e = ESTILO_ALERTA[tipo];
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={`flex w-full items-start gap-3 rounded-lg border-l-4 px-4 py-3 ${e.caja}`}
    >
      <Icono nombre={icono ?? e.icono} size={20} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[14px] leading-[1.4]">
        {titulo && <p className="font-semibold text-texto">{titulo}</p>}
        {children && <div className="text-texto-2">{children}</div>}
      </div>
    </div>
  );
}

// ---------- Campos de formulario ----------

interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  etiqueta: string;
  icono?: string;
  obligatorio?: boolean;
  error?: string;
  derecha?: ReactNode;
}

export function Campo({ etiqueta, icono, obligatorio, error, derecha, className = "", id, ...input }: CampoProps) {
  const autoId = useId();
  const campoId = id ?? autoId;
  return (
    <div className={`flex w-full flex-col gap-1.5 ${className}`}>
      <label htmlFor={campoId} className="flex gap-1 text-[14px] font-medium leading-[1.4] text-texto-2">
        {etiqueta}
        {obligatorio && <span className="text-rojo">*</span>}
      </label>
      <div
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-4 py-3 transition focus-within:border-kubo-azul focus-within:ring-1 focus-within:ring-kubo-azul ${
          error ? "border-rojo ring-1 ring-rojo" : "border-borde"
        }`}
      >
        {icono && <Icono nombre={icono} size={18} />}
        <input
          id={campoId}
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 bg-transparent text-[16px] leading-[1.4] text-texto outline-none placeholder:text-texto-3"
          {...input}
        />
        {derecha}
      </div>
      {error && <p className="text-[13px] leading-[1.4] text-rojo-oscuro">{error}</p>}
    </div>
  );
}

export function CampoPassword(props: Omit<CampoProps, "type" | "derecha" | "icono">) {
  const [visible, setVisible] = useState(false);
  return (
    <Campo
      {...props}
      type={visible ? "text" : "password"}
      icono="icon-lock"
      derecha={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className={`rounded p-0.5 ${visible ? "opacity-100" : "opacity-80 hover:opacity-100"}`}
        >
          <Icono nombre="icon-eye" size={18} />
        </button>
      }
    />
  );
}

export function Casilla({
  etiqueta,
  checked,
  onChange,
  color = "azul",
}: {
  etiqueta: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: "azul" | "verde";
}) {
  const marcado = color === "verde" ? "bg-verde-oscuro border-verde-oscuro" : "bg-kubo-azul border-kubo-azul";
  return (
    <label className="flex cursor-pointer items-center gap-2 select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={`flex size-[18px] items-center justify-center rounded-[4px] border-[1.5px] peer-focus-visible:ring-2 peer-focus-visible:ring-kubo-azul/40 ${
          checked ? marcado : "border-texto-3 bg-white"
        }`}
      >
        {checked && <Icono nombre="check-blanco" size={14} />}
      </span>
      <span className="text-[14px] leading-[1.4] text-texto">{etiqueta}</span>
    </label>
  );
}

// ---------- Botones ----------

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "primario" | "secundario" | "peligro";
  tamano?: "md" | "lg";
  icono?: string;
  cargando?: boolean;
  ancho?: boolean;
}

export function Boton({
  variante = "primario",
  tamano = "md",
  icono,
  cargando,
  ancho,
  children,
  className = "",
  disabled,
  ...resto
}: BotonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-bold tracking-[0.2px] transition disabled:cursor-not-allowed";
  const tam = tamano === "lg" ? "px-6 py-3 text-[20px] leading-[1.5]" : "px-4 py-2.5 text-[16px] leading-[1.5]";
  const estilos = {
    primario: "bg-kubo-azul text-white hover:bg-kubo-azul-oscuro disabled:bg-kubo-azul/60",
    // El borde va por dentro (ring-inset) para medir lo mismo que el botón primario, como en el Figma.
    secundario: "bg-white text-texto ring-1 ring-inset ring-borde hover:bg-fondo disabled:text-texto-3",
    peligro: "bg-rojo text-white hover:bg-rojo-oscuro disabled:bg-rojo/60",
  }[variante];
  return (
    <button
      disabled={disabled || cargando}
      className={`${base} ${tam} ${estilos} ${ancho ? "w-full" : ""} ${className}`}
      {...resto}
    >
      {cargando ? <Spinner claro={variante !== "secundario"} /> : icono && <Icono nombre={icono} size={20} />}
      {children}
    </button>
  );
}

export function Spinner({ claro = true }: { claro?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-5 animate-spin rounded-full border-2 ${claro ? "border-white/40 border-t-white" : "border-borde border-t-kubo-azul"}`}
    />
  );
}

// ---------- Badges ----------

export function Badge({
  children,
  tono,
  punto,
}: {
  children: ReactNode;
  tono: "verde" | "rojo" | "azul" | "celeste" | "gris" | "ambar";
  punto?: boolean;
}) {
  const t = {
    verde: { caja: "bg-[rgba(46,158,107,0.12)] text-verde-oscuro", dot: "dot-verde" },
    rojo: { caja: "bg-[rgba(214,69,69,0.12)] text-rojo-oscuro", dot: "dot-rojo" },
    azul: { caja: "bg-[rgba(27,77,137,0.12)] text-kubo-azul", dot: "dot-gris" },
    celeste: { caja: "bg-[rgba(74,144,217,0.12)] text-kubo-azul", dot: "dot-gris" },
    gris: { caja: "bg-[rgba(139,147,155,0.12)] text-texto-2", dot: "dot-gris" },
    ambar: { caja: "bg-[rgba(232,169,59,0.16)] text-ambar-oscuro", dot: "dot-gris" },
  }[tono];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-semibold leading-[1.5] whitespace-nowrap ${t.caja}`}
    >
      {punto && <Icono nombre={t.dot} size={6} />}
      {children}
    </span>
  );
}

// ---------- Requisitos de contraseña (AC-06) ----------

export function requisitosPassword(nueva: string, confirmacion: string) {
  return [
    { texto: "Mínimo 8 caracteres", ok: nueva.length >= 8 },
    { texto: "Al menos una mayúscula y un número", ok: /[A-ZÁÉÍÓÚÑ]/.test(nueva) && /[0-9]/.test(nueva) },
    { texto: "Las contraseñas coinciden", ok: nueva.length > 0 && nueva === confirmacion },
  ];
}

export function ChecklistPassword({ nueva, confirmacion }: { nueva: string; confirmacion: string }) {
  return (
    <ul className="flex w-full flex-col gap-1.5 rounded-lg bg-fondo p-3">
      {requisitosPassword(nueva, confirmacion).map((r) => (
        <li key={r.texto} className="flex items-center gap-2">
          {r.ok ? (
            <Icono nombre="icon-check-verde" size={16} />
          ) : (
            <span aria-hidden className="mx-[3px] size-[10px] rounded-full border-[1.5px] border-texto-3" />
          )}
          <span className={`text-[13px] leading-[1.4] ${r.ok ? "text-texto" : "text-texto-3"}`}>{r.texto}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Tarjeta y modal ----------

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-borde bg-white shadow-tarjeta ${className}`}>{children}</div>;
}

export function Modal({
  abierto,
  onCerrar,
  icono,
  tonoIcono = "rojo",
  titulo,
  subtitulo,
  children,
  pie,
}: {
  abierto: boolean;
  onCerrar: () => void;
  icono?: string;
  tonoIcono?: "rojo" | "azul";
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  pie: ReactNode;
}) {
  if (!abierto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,35,40,0.45)] p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={titulo}
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl bg-white shadow-modal"
      >
        <div className="flex items-start gap-3 border-b border-borde px-6 py-5">
          {icono && (
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tonoIcono === "rojo" ? "bg-[rgba(214,69,69,0.12)]" : "bg-[rgba(27,77,137,0.1)]"}`}
            >
              <Icono nombre={icono} size={20} />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">{titulo}</h2>
            {subtitulo && <p className="text-[14px] leading-[1.4] text-texto-3">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-md p-1.5 hover:bg-fondo">
            <Icono nombre="modal-x" size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto p-6">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t border-borde bg-fondo px-6 py-4">{pie}</div>
      </div>
    </div>
  );
}
