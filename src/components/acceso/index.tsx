/* eslint-disable @next/next/no-img-element */
// Estructuras de las pantallas de acceso: panel de marca del login (AC-01) y página centrada con tarjeta (AC-04, AC-06).
import Link from "next/link";
import type { ReactNode } from "react";
import { Icono, Logo } from "@/components/ui";

const BENEFICIOS = [
  { icono: "marca-clipboard", texto: "Matrícula y pensiones integradas" },
  { icono: "marca-grid", texto: "Horarios sin cruces de docentes ni aulas" },
  { icono: "marca-award", texto: "Evaluación por competencias AD · A · B · C" },
  { icono: "marca-shield", texto: "Auditoría de notas y pagos" },
];

/** Panel azul izquierdo de AC-01/02/03. Se oculta en pantallas angostas. */
export function PanelMarca() {
  return (
    <aside className="relative hidden h-screen min-h-[640px] shrink-0 flex-col gap-6 overflow-hidden bg-kubo-azul p-16 lg:flex lg:w-[44%] xl:w-[640px]">
      <Logo variante="marca" />
      <div className="flex-1" />
      <p className="relative z-10 max-w-[500px] text-[40px] font-bold leading-[1.15] text-white">Toda la vida escolar, en un solo lugar.</p>
      <ul className="relative z-10 flex flex-col gap-3.5 pt-2">
        {BENEFICIOS.map((b) => (
          <li key={b.texto} className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/12">
              <Icono nombre={b.icono} size={20} />
            </span>
            <span className="text-[16px] font-medium leading-[1.5] text-white">{b.texto}</span>
          </li>
        ))}
      </ul>
      <div className="flex-1" />
      <p className="relative z-10 text-[12px] leading-[1.4] text-white/60">
        © 2026 Kubo · Plataforma Educativa Integral · Ingeniería de Software PUCP
      </p>
      <img src="/figma/decoracion-login.svg" alt="" aria-hidden className="pointer-events-none absolute left-[300px] top-[420px] size-[520px] max-w-none" />
    </aside>
  );
}

/** Página centrada con el logo arriba y el texto de ayuda abajo (AC-04, AC-06, AC-07, AC-08, AC-09). */
export function PaginaCentrada({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-fondo px-4 py-10">
      <Logo />
      {children}
      <p className="text-[13px] leading-[1.4] text-texto-3">
        ¿Necesitas ayuda? Escribe a{" "}
        <a href="mailto:soporte@kubo.edu.pe" className="hover:underline">
          soporte@kubo.edu.pe
        </a>
      </p>
    </main>
  );
}

export function TarjetaAcceso({ children, ancho = 480 }: { children: ReactNode; ancho?: 440 | 480 }) {
  return (
    <section
      className="flex w-full flex-col items-start gap-5 rounded-lg border border-borde bg-white p-8 shadow-tarjeta"
      style={{ maxWidth: ancho }}
    >
      {children}
    </section>
  );
}

export function IconoCircular({ nombre, tono = "azul" }: { nombre: string; tono?: "azul" | "rojo" }) {
  return (
    <div className={`flex size-14 items-center justify-center rounded-full ${tono === "azul" ? "bg-[rgba(27,77,137,0.1)]" : "bg-[rgba(214,69,69,0.1)]"}`}>
      <Icono nombre={nombre} size={28} />
    </div>
  );
}

export function EncabezadoTarjeta({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <h1 className="text-[24px] font-semibold leading-[1.25] text-texto">{titulo}</h1>
      {children && <div className="text-[16px] leading-[1.5] text-texto-2">{children}</div>}
    </div>
  );
}

export function VolverAlLogin() {
  return (
    <Link href="/login" className="flex items-center gap-1.5 text-[14px] font-semibold leading-[1.4] text-kubo-azul hover:underline">
      <Icono nombre="icon-back" size={18} />
      Volver a iniciar sesión
    </Link>
  );
}
