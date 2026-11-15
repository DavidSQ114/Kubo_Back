// Estructura común de los portales del Docente y del Alumno (DO-01, AL-01): barra lateral azul con el menú del
// perfil, barra superior con el saludo y la insignia del año, y la guardia de sesión por perfil (RF04). En pantallas
// angostas la barra lateral se oculta y se abre con el botón de menú (US50: el portal del alumno se usa en el celular).
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PaginaCentrada, TarjetaAcceso } from "@/components/acceso";
import { Alerta, Badge, Boton, Icono, Logo, Spinner } from "@/components/ui";
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

export interface ItemNav {
  texto: string;
  /** Ícono blanco de `public/figma` (la barra lateral es azul). */
  icono: string;
  /** Sin href, el módulo aún no existe: se muestra «Próximamente». */
  href?: string;
}

const SesionContext = createContext<Sesion | null>(null);

/** Sesión del usuario dentro de un portal armado con EstructuraPortal. */
export function useSesionPortal(): Sesion {
  const s = useContext(SesionContext);
  if (!s) throw new Error("useSesionPortal debe usarse dentro de un portal");
  return s;
}

/** Errores de sesión en cualquier consulta del portal: redirige; los demás se devuelven para mostrarlos. */
export function mensajeError(e: unknown): string {
  const destino = destinoPorErrorDeSesion(e);
  if (destino && typeof window !== "undefined") window.location.assign(destino);
  return e instanceof ApiError || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

/**
 * Guardia de un portal: devuelve la sesión solo si su perfil activo es `rol`. Sin sesión va al login; con la
 * contraseña temporal, a cambiarla; con otro perfil, a «No tiene permisos para acceder a este recurso.» (AC-07).
 */
export function useSesionDeRol(rol: Rol): Sesion | null {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    let vigente = true;
    api<Sesion>("/identidad/sesion")
      .then((s) => {
        if (s.debeCambiarPassword) router.replace("/cambiar-password");
        else if (s.rolActivo !== rol)
          router.replace(`/acceso-denegado?desde=${encodeURIComponent(window.location.pathname)}`);
        else if (vigente) setSesion(s);
      })
      .catch((e) => router.replace(destinoPorErrorDeSesion(e) ?? "/login"));
    return () => {
      vigente = false;
    };
  }, [router, rol]);

  return sesion;
}

export function PantallaCargando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo">
      <Spinner claro={false} />
    </div>
  );
}

async function salirDelPortal(router: ReturnType<typeof useRouter>) {
  await cerrarSesion();
  router.replace("/login");
}

/** Pantalla completa con un aviso y «Cerrar sesión», para cuando el perfil no puede usar su portal. */
export function PantallaAviso({ sesion, titulo, children }: { sesion: Sesion; titulo: string; children: ReactNode }) {
  const router = useRouter();
  const otrosPerfiles = sesion.perfiles.filter((p) => p !== sesion.rolActivo);

  async function cambiarPerfil(rol: Rol) {
    await api("/identidad/sesion/perfil", { method: "PUT", body: { rol } });
    router.replace(inicioPorRol(rol));
  }

  return (
    <PaginaCentrada>
      <TarjetaAcceso>
        <h1 className="text-[24px] font-semibold leading-[1.25] text-texto">Hola, {sesion.usuario.nombres}</h1>
        <Alerta tipo="info" titulo={titulo}>
          {children}
        </Alerta>
        {otrosPerfiles.map((p) => (
          <Boton key={p} variante="secundario" ancho onClick={() => cambiarPerfil(p)}>
            Ingresar como {NOMBRE_ROL[p]}
          </Boton>
        ))}
        <Boton ancho onClick={() => salirDelPortal(router)}>
          Cerrar sesión
        </Boton>
      </TarjetaAcceso>
    </PaginaCentrada>
  );
}

// ---------- Barra lateral ----------

function BarraLateral({
  sesion,
  inicio,
  navegacion,
  detallePerfil,
  abierta,
  onCerrar,
}: {
  sesion: Sesion;
  inicio: string;
  navegacion: ItemNav[];
  detallePerfil: string;
  abierta: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [saliendo, setSaliendo] = useState(false);
  const otrosPerfiles = sesion.perfiles.filter((p) => p !== sesion.rolActivo);
  const clases = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] leading-[1.5]";

  async function cambiarPerfil(rol: Rol) {
    try {
      await api("/identidad/sesion/perfil", { method: "PUT", body: { rol } });
      router.replace(inicioPorRol(rol));
    } catch (e) {
      window.alert(mensajeError(e));
    }
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[264px] shrink-0 flex-col bg-kubo-azul px-4 py-6 transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${abierta ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex items-center px-2 pb-6">
        <Link href={inicio} aria-label="Inicio" onClick={onCerrar}>
          <Logo variante="sidebar" />
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar menú"
          className="rounded-md border border-white/25 p-1.5 hover:bg-white/10 lg:hidden"
        >
          <Icono nombre="nav-chevl" size={18} />
        </button>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none]"
        aria-label="Principal"
      >
        {navegacion.map((item) => {
          if (!item.href) {
            return (
              <span
                key={item.texto}
                aria-disabled="true"
                title={`${item.texto} · disponible próximamente`}
                className={`${clases} cursor-not-allowed font-medium text-white/50`}
              >
                <Icono nombre={item.icono} size={20} className="opacity-50" />
                <span className="min-w-0 flex-1 leading-[1.3]">{item.texto}</span>
                <span className="shrink-0 rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-semibold text-white/75">
                  Próximamente
                </span>
              </span>
            );
          }
          const activo = item.href === inicio ? ruta === inicio : ruta.startsWith(item.href);
          return (
            <Link
              key={item.texto}
              href={item.href}
              onClick={onCerrar}
              aria-current={activo ? "page" : undefined}
              className={`${clases} ${activo ? "bg-white/16 font-semibold text-white" : "font-medium text-white/82 hover:bg-white/10"}`}
            >
              <Icono nombre={item.icono} size={20} />
              <span className="whitespace-nowrap">{item.texto}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex w-full flex-col gap-2 border-t border-white/16 pt-4">
        <div className="flex w-full items-center gap-3 px-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white">
            <span className="text-[14px] font-semibold leading-none text-kubo-azul">{sesion.usuario.iniciales}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-[1.4]">
            <span className="truncate text-[14px] font-semibold text-white">{sesion.usuario.nombreCompleto}</span>
            <span className="truncate text-[12px] text-white/70">{detallePerfil}</span>
          </div>
        </div>
        {otrosPerfiles.map((rol) => (
          <button
            key={rol}
            type="button"
            onClick={() => cambiarPerfil(rol)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-[13px] font-medium text-white/82 hover:bg-white/10"
          >
            Ingresar como {NOMBRE_ROL[rol]}
          </button>
        ))}
        <Link
          href="/cambiar-password"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] font-medium text-white/82 hover:bg-white/10"
        >
          Cambiar contraseña
        </Link>
        <button
          type="button"
          disabled={saliendo}
          onClick={() => {
            setSaliendo(true);
            void salirDelPortal(router);
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium leading-[1.4] text-white/82 hover:bg-white/10"
        >
          <Icono nombre="nav-logout" size={20} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

// ---------- Barra superior ----------

interface SituacionAnio {
  estado: string;
  etiqueta: string;
}

/** Insignia «Año 2026 · Bimestre III en curso». Sin año abierto (o si falla) no se muestra. */
function InsigniaAnio() {
  const [situacion, setSituacion] = useState<SituacionAnio | null>(null);

  useEffect(() => {
    let vigente = true;
    api<SituacionAnio | null>("/academico/anios/actual")
      .then((s) => vigente && setSituacion(s))
      .catch(() => undefined); // la insignia es informativa: un error no interrumpe la pantalla
    return () => {
      vigente = false;
    };
  }, []);

  if (!situacion) return null;
  return (
    <Badge tono={situacion.estado === "EN_CURSO" ? "verde" : "celeste"} punto>
      {situacion.etiqueta}
    </Badge>
  );
}

/**
 * Portal de un perfil: barra lateral, barra superior y el contenido de la página. `saludo` es el texto de la barra
 * superior («Hola, Diego · 1° de secundaria A») y `detallePerfil`, el que va bajo el nombre («Alumno · 1° A»).
 */
export function EstructuraPortal({
  sesion,
  inicio,
  navegacion,
  saludo,
  detallePerfil,
  children,
}: {
  sesion: Sesion;
  inicio: string;
  navegacion: ItemNav[];
  saludo: string;
  detallePerfil: string;
  children: ReactNode;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex min-h-screen bg-fondo">
      {menuAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-40 bg-[rgba(31,35,40,0.45)] lg:hidden"
        />
      )}
      <BarraLateral
        sesion={sesion}
        inicio={inicio}
        navegacion={navegacion}
        detallePerfil={detallePerfil}
        abierta={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-borde bg-white px-4 py-3 lg:px-10">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
            className="rounded-md border border-borde p-2 hover:bg-fondo lg:hidden"
          >
            <Icono nombre="nav-menu" size={20} />
          </button>
          <span className="min-w-0 flex-1 truncate text-[16px] leading-[1.4] text-texto-2">{saludo}</span>
          <span className="hidden sm:block">
            <InsigniaAnio />
          </span>
          <button
            type="button"
            aria-label="Notificaciones"
            title="Notificaciones · disponible próximamente"
            className="size-10 shrink-0"
          >
            <Icono nombre="btn-notificaciones" size={40} />
          </button>
        </header>
        <main className="flex flex-col gap-6 px-4 pt-6 pb-14 lg:px-10 lg:pt-8">
          <SesionContext.Provider value={sesion}>{children}</SesionContext.Provider>
        </main>
      </div>
    </div>
  );
}

/** Encabezado de una página del portal: título de 32 px (28 en el celular) y una línea de contexto. */
export function EncabezadoPagina({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borde pb-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[28px] font-bold leading-[1.2] text-texto lg:text-[32px]">{titulo}</h1>
        {descripcion && <p className="text-[16px] leading-[1.4] text-texto-2">{descripcion}</p>}
      </div>
      {children}
    </header>
  );
}
