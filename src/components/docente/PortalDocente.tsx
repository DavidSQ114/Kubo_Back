// Estructura del portal del Docente (DO-01 a DO-07): barra lateral + barra superior.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Icono, Spinner } from "@/components/ui";
import { api, cerrarSesion, destinoPorErrorDeSesion, inicioPorRol, NOMBRE_ROL, type Rol, type Sesion } from "@/lib/api";
import { alertaError } from "@/lib/portal";

const SesionContext = createContext<Sesion | null>(null);

export function useSesionDocente(): Sesion {
  const s = useContext(SesionContext);
  if (!s) throw new Error("useSesionDocente debe usarse dentro del portal docente");
  return s;
}

interface ItemNav {
  texto: string;
  icono: string;
  href: string;
}

const NAVEGACION: ItemNav[] = [
  { texto: "Inicio", icono: "nav-home", href: "/docente" },
  { texto: "Mi horario", icono: "nav-calendar", href: "/docente/horario" },
  { texto: "Asistencia", icono: "nav-usercheck", href: "/docente/asistencia" },
  { texto: "Registro de notas", icono: "nav-award", href: "/docente/notas" },
  { texto: "Mis cursos", icono: "nav-book", href: "/docente/cursos" },
  { texto: "Trabajos del curso", icono: "nav-clipboard", href: "/docente/trabajos" },
  { texto: "Revisar entregas", icono: "nav-layers", href: "/docente/entregas" },
];

export function PortalDocente({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    api<Sesion>("/identidad/sesion")
      .then((s) => {
        if (s.debeCambiarPassword) router.replace("/cambiar-password");
        else if (s.rolActivo !== "DOCENTE")
          router.replace(`/acceso-denegado?desde=${encodeURIComponent(window.location.pathname)}`);
        else setSesion(s);
      })
      .catch((e) => router.replace(destinoPorErrorDeSesion(e) ?? "/login"));
  }, [router]);

  if (!sesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fondo">
        <Spinner claro={false} />
      </div>
    );
  }

  return (
    <SesionContext.Provider value={sesion}>
      <div className="flex min-h-screen bg-fondo">
        <BarraLateral sesion={sesion} />
        <div className="flex min-w-0 flex-1 flex-col">
          <BarraSuperior />
          <main className="flex flex-col gap-6 px-10 pt-8 pb-14">{children}</main>
        </div>
      </div>
    </SesionContext.Provider>
  );
}

function BarraLateral({ sesion }: { sesion: Sesion }) {
  const router = useRouter();
  const ruta = usePathname();
  const [minimizada, setMinimizada] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const otrosPerfiles = sesion.perfiles.filter((p) => p !== sesion.rolActivo);

  async function salir() {
    setSaliendo(true);
    await cerrarSesion();
    router.replace("/login");
  }

  async function cambiarPerfil(rol: Rol) {
    try {
      await api("/identidad/sesion/perfil", { method: "PUT", body: { rol } });
      router.replace(inicioPorRol(rol));
    } catch (e) {
      alert(alertaError(e));
    }
  }

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col bg-kubo-azul py-6 transition-[width] ${minimizada ? "w-[76px] px-3" : "w-[264px] px-4"}`}
    >
      <div className={`flex items-center pb-6 ${minimizada ? "flex-col gap-3 px-0" : "px-2"}`}>
        {minimizada ? (
          <Icono nombre="logo-isotipo-sidebar" size={30} />
        ) : (
          <Link href="/docente" aria-label="Inicio docente">
            <div className="flex items-center gap-[9px]">
              <Icono nombre="logo-isotipo-sidebar" size={30} />
              <span className="text-[23px] font-bold leading-none text-white">Kubo</span>
            </div>
          </Link>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setMinimizada((m) => !m)}
          aria-label={minimizada ? "Expandir menú" : "Minimizar menú"}
          className="rounded-md border border-white/25 p-1.5 hover:bg-white/10"
        >
          <Icono nombre="nav-chevl" size={18} className={minimizada ? "rotate-180" : ""} />
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none]" aria-label="Docente">
        {NAVEGACION.map((item) => {
          const activo =
            item.href === "/docente" ? ruta === "/docente" : ruta === item.href || ruta.startsWith(`${item.href}/`);
          const clases = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] leading-[1.5] ${minimizada ? "justify-center" : ""} ${
            activo ? "bg-white/16 font-semibold text-white" : "font-medium text-white/82 hover:bg-white/10"
          }`;
          return (
            <Link key={item.href} href={item.href} title={minimizada ? item.texto : undefined} className={clases}>
              <Icono nombre={item.icono} size={20} />
              {!minimizada && <span className="whitespace-nowrap">{item.texto}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex w-full flex-col gap-2 border-t border-white/16 pt-4">
        <div className={`flex w-full items-center gap-3 ${minimizada ? "justify-center px-0" : "px-2"}`}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
            <span className="text-[14px] font-semibold leading-none text-kubo-azul">{sesion.usuario.iniciales}</span>
          </div>
          {!minimizada && (
            <div className="flex min-w-0 flex-1 flex-col leading-[1.4]">
              <span className="truncate text-[14px] font-semibold text-white">{sesion.usuario.nombreCompleto}</span>
              <span className="text-[12px] text-white/70">{NOMBRE_ROL[sesion.rolActivo]}</span>
            </div>
          )}
        </div>
        {!minimizada &&
          otrosPerfiles.map((rol) => (
            <button
              key={rol}
              type="button"
              onClick={() => cambiarPerfil(rol)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-[13px] font-medium text-white/82 hover:bg-white/10"
            >
              Ingresar como {NOMBRE_ROL[rol]}
            </button>
          ))}
        {!minimizada && (
          <Link
            href="/cambiar-password"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] font-medium text-white/82 hover:bg-white/10"
          >
            Cambiar contraseña
          </Link>
        )}
        <button
          type="button"
          onClick={salir}
          disabled={saliendo}
          title={minimizada ? "Cerrar sesión" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium leading-[1.4] text-white/82 hover:bg-white/10 ${minimizada ? "justify-center" : ""}`}
        >
          <Icono nombre="nav-logout" size={20} />
          {!minimizada && "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}

function BarraSuperior() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-borde bg-white px-10 py-3">
      <p className="text-[14px] leading-[1.4] text-texto-3">Portal docente</p>
      <div className="flex-1" />
      <button
        type="button"
        aria-label="Notificaciones"
        title="Notificaciones · disponible cuando exista el módulo de notificaciones"
        className="size-10 shrink-0"
      >
        <Icono nombre="btn-notificaciones" size={40} />
      </button>
    </header>
  );
}

export { alertaError } from "@/lib/portal";
