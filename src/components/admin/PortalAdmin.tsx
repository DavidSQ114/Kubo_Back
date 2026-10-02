// Estructura del portal del Administrador: barra lateral (Sidebar / admin) + barra superior, según AD-06.
// También es la guardia de las páginas /admin: exige sesión válida con perfil ADMINISTRADOR (RF04).
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Icono, Spinner } from "@/components/ui";
import { api, cerrarSesion, destinoPorErrorDeSesion, inicioPorRol, NOMBRE_ROL, type Rol, type Sesion } from "@/lib/api";
import { alertaError } from "@/lib/portal";

const SesionContext = createContext<Sesion | null>(null);

export function useSesion(): Sesion {
  const s = useContext(SesionContext);
  if (!s) throw new Error("useSesion debe usarse dentro del portal");
  return s;
}

interface ItemNav {
  texto: string;
  icono: string;
  href?: string; // sin href = módulo aún no disponible
}

const NAVEGACION: { grupo?: string; items: ItemNav[] }[] = [
  { items: [{ texto: "Inicio", icono: "nav-home", href: "/admin" }] },
  {
    grupo: "CONFIGURACIÓN",
    items: [
      { texto: "Año y bimestres", icono: "nav-calendar", href: "/admin/anio-bimestres" },
      { texto: "Grados, secciones y aulas", icono: "nav-layers", href: "/admin/grados-secciones" },
      { texto: "Cursos y competencias", icono: "nav-book", href: "/admin/cursos" },
      { texto: "Reglas de evaluación", icono: "nav-sliders", href: "/admin/reglas-evaluacion" },
    ],
  },
  {
    grupo: "COMUNIDAD",
    items: [
      { texto: "Usuarios", icono: "nav-users", href: "/admin/usuarios" },
      { texto: "Matrícula", icono: "nav-clipboard", href: "/admin/matricula" },
    ],
  },
  {
    grupo: "TESORERÍA",
    items: [
      { texto: "Pensiones y pagos", icono: "nav-wallet", href: "/admin/pensiones" },
      { texto: "Morosidad", icono: "nav-alert", href: "/admin/morosidad" },
    ],
  },
  {
    grupo: "ACADÉMICO",
    items: [
      { texto: "Horarios", icono: "nav-grid", href: "/admin/horarios" },
      { texto: "Asistencia docente", icono: "nav-usercheck", href: "/admin/asistencia-docente" },
      { texto: "Notas y rectificaciones", icono: "nav-award", href: "/admin/notas" },
    ],
  },
  { grupo: "SEGURIDAD", items: [{ texto: "Auditoría", icono: "nav-shield", href: "/admin/auditoria" }] },
];

export function PortalAdmin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    api<Sesion>("/identidad/sesion")
      .then((s) => {
        if (s.debeCambiarPassword) router.replace("/cambiar-password");
        else if (s.rolActivo !== "ADMINISTRADOR")
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
      alertaError(e);
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
          <Link href="/admin" aria-label="Inicio">
            <LogoSidebar />
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

      {/* En pantallas bajas solo se desplaza el menú (sin barra visible): el usuario y «Cerrar sesión» quedan siempre a la vista. */}
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none]">
        {NAVEGACION.map((g, i) => (
          <nav key={i} className="flex w-full flex-col gap-0.5" aria-label={g.grupo ?? "Principal"}>
            {g.grupo && !minimizada && (
              <p className="px-3 pt-3.5 pb-1.5 text-[11px] font-semibold leading-[1.3] tracking-[1px] text-white/60">
                {g.grupo}
              </p>
            )}
            {g.grupo && minimizada && <div className="mx-3 my-2 h-px bg-white/15" />}
            {g.items.map((item) => {
              const activo = item.href
                ? item.href === "/admin"
                  ? ruta === "/admin"
                  : ruta.startsWith(item.href)
                : false;
              const clases = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] leading-[1.5] ${minimizada ? "justify-center" : ""}`;
              const contenido = (
                <>
                  <Icono nombre={item.icono} size={20} />
                  {!minimizada && <span className="whitespace-nowrap">{item.texto}</span>}
                </>
              );
              if (!item.href) {
                return (
                  <span
                    key={item.texto}
                    title={`${item.texto} · disponible próximamente`}
                    className={`${clases} cursor-not-allowed font-medium text-white/82 opacity-45`}
                  >
                    {contenido}
                  </span>
                );
              }
              return (
                <Link
                  key={item.texto}
                  href={item.href}
                  title={minimizada ? item.texto : undefined}
                  className={`${clases} ${activo ? "bg-white/16 font-semibold text-white" : "font-medium text-white/82 hover:bg-white/10"}`}
                >
                  {contenido}
                </Link>
              );
            })}
          </nav>
        ))}
      </div>

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

function LogoSidebar() {
  return (
    <div className="flex items-center gap-[9px]">
      <Icono nombre="logo-isotipo-sidebar" size={30} />
      <span className="text-[23px] font-bold leading-none text-white">Kubo</span>
    </div>
  );
}

function BarraSuperior() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function buscar(e: FormEvent) {
    e.preventDefault();
    router.push(`/admin/usuarios${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-borde bg-white px-10 py-3">
      <form onSubmit={buscar} className="w-full max-w-[400px]" role="search">
        <label className="flex w-full items-center gap-2 rounded-lg border border-borde bg-white px-4 py-3 focus-within:border-kubo-azul focus-within:ring-1 focus-within:ring-kubo-azul">
          <Icono nombre="icon-search" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar estudiante, docente o DNI…"
            aria-label="Buscar usuarios"
            className="min-w-0 flex-1 bg-transparent text-[16px] leading-[1.4] text-texto outline-none placeholder:text-texto-3"
          />
        </label>
      </form>
      <div className="flex-1" />
      <button
        type="button"
        aria-label="Notificaciones"
        title="Notificaciones · disponible próximamente"
        className="size-10 shrink-0"
      >
        <Icono nombre="btn-notificaciones" size={40} />
      </button>
    </header>
  );
}

export { alertaError } from "@/lib/portal";
