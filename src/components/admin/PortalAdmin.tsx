// Estructura de los portales de gestión, según AD-06: barra lateral (Sidebar / admin) + barra superior con la campana
// de notificaciones (US55, M-11). La usan el portal del Administrador (/admin) y el del Coordinador académico
// (/coordinador, bloque M1), cada uno con su menú y sus destinos.
// También es la guardia de esas páginas (RF04): exige sesión válida con el perfil del portal; otro perfil vuelve al
// inicio de su propio portal.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CampanaNotificaciones } from "@/components/portal/notificaciones";
import { Badge, Icono, Spinner } from "@/components/ui";
import {
  api,
  ApiError,
  cerrarSesion,
  destinoPorErrorDeSesion,
  inicioPorRol,
  NOMBRE_ROL,
  type Rol,
  type Sesion,
} from "@/lib/api";

const SesionContext = createContext<Sesion | null>(null);

export function useSesion(): Sesion {
  const s = useContext(SesionContext);
  if (!s) throw new Error("useSesion debe usarse dentro del portal");
  return s;
}

/**
 * Pantallas a las que enlazan las piezas compartidas por los dos portales de gestión (registro de estudiantes y
 * apoderados, matrícula, pagos…). Un destino ausente no existe en ese portal y su enlace no se muestra.
 */
export interface DestinosPortal {
  inicio: string;
  /** A dónde vuelve un registro de estudiante o apoderado al terminar o cancelar. */
  volverDeRegistro: string;
  /** Nombre de esa pantalla en «Volver a …». */
  nombreVolverDeRegistro: string;
  registrarEstudiante: string;
  registrarApoderado: string;
  matricula?: string;
  pagos?: string;
  cursos?: string;
}

const DestinosContext = createContext<DestinosPortal | null>(null);

export function useDestinos(): DestinosPortal {
  const d = useContext(DestinosContext);
  if (!d) throw new Error("useDestinos debe usarse dentro de un portal de gestión");
  return d;
}

export interface ItemNav {
  texto: string;
  icono: string;
  href: string;
}

export type NavegacionGestion = { grupo?: string; items: ItemNav[] }[];

const NAVEGACION_ADMIN: NavegacionGestion = [
  { items: [{ texto: "Inicio", icono: "nav-home", href: "/admin" }] },
  { grupo: "COMUNIDAD", items: [{ texto: "Usuarios", icono: "nav-users", href: "/admin/usuarios" }] },
  {
    grupo: "INSTITUCIÓN",
    items: [
      { texto: "Espacios", icono: "nav-layers", href: "/admin/espacios" },
      { texto: "Parámetros del sistema", icono: "nav-sliders", href: "/admin/parametros" },
    ],
  },
  {
    grupo: "PERSONAL",
    items: [{ texto: "Asistencia docente", icono: "nav-usercheck", href: "/admin/asistencia-docente" }],
  },
  { grupo: "SEGURIDAD", items: [{ texto: "Auditoría y errores", icono: "nav-shield", href: "/admin/auditoria" }] },
];

const DESTINOS_ADMIN: DestinosPortal = {
  inicio: "/admin",
  volverDeRegistro: "/admin/usuarios",
  nombreVolverDeRegistro: "Usuarios",
  registrarEstudiante: "/admin/usuarios/registrar-estudiante",
  registrarApoderado: "/admin/usuarios/registrar-apoderado",
};

export function PortalAdmin({ children }: { children: ReactNode }) {
  return (
    <PortalGestion rol="ADMINISTRADOR" navegacion={NAVEGACION_ADMIN} destinos={DESTINOS_ADMIN} busquedaUsuarios>
      {children}
    </PortalGestion>
  );
}

/**
 * Portal de gestión de un perfil: guardia de sesión, barra lateral con su menú y barra superior. Con
 * `busquedaUsuarios`, la barra superior busca en «Usuarios» (solo el administrador tiene esa pantalla).
 */
export function PortalGestion({
  rol,
  navegacion,
  destinos,
  busquedaUsuarios = false,
  children,
}: {
  rol: Rol;
  navegacion: NavegacionGestion;
  destinos: DestinosPortal;
  busquedaUsuarios?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    api<Sesion>("/identidad/sesion")
      .then((s) => {
        if (s.debeCambiarPassword) router.replace("/cambiar-password");
        // un perfil que entra por URL a un portal ajeno vuelve al inicio de su propio portal (bloque M1)
        else if (s.rolActivo !== rol) router.replace(inicioPorRol(s.rolActivo));
        else setSesion(s);
      })
      .catch((e) => router.replace(destinoPorErrorDeSesion(e) ?? "/login"));
  }, [router, rol]);

  if (!sesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fondo">
        <Spinner claro={false} />
      </div>
    );
  }

  return (
    <SesionContext.Provider value={sesion}>
      <DestinosContext.Provider value={destinos}>
        <div className="flex min-h-screen bg-fondo">
          <BarraLateral sesion={sesion} navegacion={navegacion} inicio={destinos.inicio} />
          <div className="flex min-w-0 flex-1 flex-col">
            <BarraSuperior busquedaUsuarios={busquedaUsuarios} />
            <main className="flex flex-col gap-6 px-10 pt-8 pb-14">{children}</main>
          </div>
        </div>
      </DestinosContext.Provider>
    </SesionContext.Provider>
  );
}

function BarraLateral({
  sesion,
  navegacion,
  inicio,
}: {
  sesion: Sesion;
  navegacion: NavegacionGestion;
  inicio: string;
}) {
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
          <Link href={inicio} aria-label="Inicio">
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
        {navegacion.map((g, i) => (
          <nav key={i} className="flex w-full flex-col gap-0.5" aria-label={g.grupo ?? "Principal"}>
            {g.grupo && !minimizada && (
              <p className="px-3 pt-3.5 pb-1.5 text-[11px] font-semibold leading-[1.3] tracking-[1px] text-white/60">
                {g.grupo}
              </p>
            )}
            {g.grupo && minimizada && <div className="mx-3 my-2 h-px bg-white/15" />}
            {g.items.map((item) => {
              const activo =
                item.href === inicio
                  ? ruta === inicio
                  : // «/admin/asistencia» no debe quedar activo en «/admin/asistencia-docente»
                    ruta === item.href || ruta.startsWith(`${item.href}/`);
              const clases = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] leading-[1.5] ${minimizada ? "justify-center" : ""}`;
              const contenido = (
                <>
                  <Icono nombre={item.icono} size={20} />
                  {!minimizada && <span className="whitespace-nowrap">{item.texto}</span>}
                </>
              );
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

/** Evento del navegador con el que AD-02 avisa que cambió un año o sus bimestres: la insignia se vuelve a pedir. */
const EVENTO_ANIO_CAMBIADO = "kubo:anio-cambiado";

export function avisarCambioDeAnio() {
  window.dispatchEvent(new Event(EVENTO_ANIO_CAMBIADO));
}

interface SituacionAnio {
  estado: string;
  etiqueta: string;
}

/** Insignia «Año 2026 · Bimestre IV en curso» con el año por defecto. Sin año abierto (o si falla) no se muestra. */
function InsigniaAnio() {
  const [situacion, setSituacion] = useState<SituacionAnio | null>(null);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const s = await api<SituacionAnio | null>("/academico/anios/actual");
        if (vigente) setSituacion(s);
      } catch {
        if (vigente) setSituacion(null); // la insignia es informativa: un error no interrumpe la pantalla
      }
    }
    void cargar();
    window.addEventListener(EVENTO_ANIO_CAMBIADO, cargar);
    return () => {
      vigente = false;
      window.removeEventListener(EVENTO_ANIO_CAMBIADO, cargar);
    };
  }, []);

  if (!situacion) return null;
  return (
    <Badge tono={situacion.estado === "EN_CURSO" ? "verde" : "celeste"} punto>
      {situacion.etiqueta}
    </Badge>
  );
}

function BarraSuperior({ busquedaUsuarios }: { busquedaUsuarios: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function buscar(e: FormEvent) {
    e.preventDefault();
    router.push(`/admin/usuarios${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-[73px] items-center gap-4 border-b border-borde bg-white px-10 py-3">
      {busquedaUsuarios && <BusquedaUsuarios q={q} setQ={setQ} buscar={buscar} />}
      <div className="flex-1" />
      <InsigniaAnio />
      <CampanaNotificaciones />
    </header>
  );
}

function BusquedaUsuarios({
  q,
  setQ,
  buscar,
}: {
  q: string;
  setQ: (q: string) => void;
  buscar: (e: FormEvent) => void;
}) {
  return (
    <>
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
    </>
  );
}

/** Errores de sesión en cualquier acción del portal: redirige; los demás se devuelven para mostrarlos. */
export function alertaError(e: unknown): string {
  const destino = destinoPorErrorDeSesion(e);
  if (destino && typeof window !== "undefined") window.location.assign(destino);
  return e instanceof ApiError || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}
