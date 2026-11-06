// Portal del Apoderado (US42): barra lateral clara con «Inicio», «Pagos» y los módulos que llegarán después, barra
// superior con el estudiante consultado y «Cambiar de hijo» (AP-01, AP-02) y la selección de hijo (AC-05).
// También es la guardia de las páginas /apoderado: exige sesión con perfil APODERADO (RF04). Lo que ve cada hijo lo
// autoriza el servidor en cada consulta; aquí solo se recuerda cuál se eligió.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PaginaCentrada, TarjetaAcceso } from "@/components/acceso";
import { Alerta, Badge, Boton, Icono, Spinner } from "@/components/ui";
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

export interface Hijo {
  estudianteId: string;
  nombres: string;
  nombreCompleto: string;
  iniciales: string;
  anio: number;
  estadoMatricula: "MATRICULADO" | "RETIRADO";
  nombreEstadoMatricula: string;
  /** «3° de secundaria». */
  grado: string | null;
  /** «B». */
  seccion: string | null;
  /** «3° B». */
  seccionCorta: string | null;
  cuotasVencidas: number;
}

interface RespuestaHijos {
  hijos: Hijo[];
  seleccionadoId: string | null;
}

interface ContextoApoderado {
  sesion: Sesion;
  hijo: Hijo;
  hijos: Hijo[];
}

const ApoderadoContext = createContext<ContextoApoderado | null>(null);

/** Sesión y estudiante que se está consultando (el elegido en AC-05 o el único vinculado). */
export function useHijo(): ContextoApoderado {
  const c = useContext(ApoderadoContext);
  if (!c) throw new Error("useHijo debe usarse dentro del portal del apoderado");
  return c;
}

/** Errores de sesión en cualquier consulta del portal: redirige; los demás se devuelven para mostrarlos. */
export function mensajeError(e: unknown): string {
  const destino = destinoPorErrorDeSesion(e);
  if (destino && typeof window !== "undefined") window.location.assign(destino);
  return e instanceof ApiError || e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "listo"; sesion: Sesion; hijos: Hijo[]; seleccionadoId: string | null; eligiendo: boolean };

export function PortalApoderado({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });

  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      const sesion = await api<Sesion>("/identidad/sesion");
      if (sesion.debeCambiarPassword) return router.replace("/cambiar-password");
      if (sesion.rolActivo !== "APODERADO") {
        return router.replace(`/acceso-denegado?desde=${encodeURIComponent(window.location.pathname)}`);
      }
      const r = await api<RespuestaHijos>("/matricula/apoderado/hijos");
      if (vigente)
        setEstado({ fase: "listo", sesion, hijos: r.hijos, seleccionadoId: r.seleccionadoId, eligiendo: false });
    }
    cargar().catch((e) => {
      const destino = destinoPorErrorDeSesion(e);
      if (destino) router.replace(destino);
      else if (vigente) setEstado({ fase: "error", mensaje: (e as Error).message });
    });
    return () => {
      vigente = false;
    };
  }, [router, intento]);

  if (estado.fase === "cargando") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fondo">
        <Spinner claro={false} />
      </div>
    );
  }
  if (estado.fase === "error") {
    return (
      <PaginaCentrada>
        <TarjetaAcceso>
          <Alerta tipo="error" titulo="No pudimos cargar tu información">
            {estado.mensaje}
          </Alerta>
          <Boton
            ancho
            onClick={() => {
              setEstado({ fase: "cargando" });
              setIntento((n) => n + 1);
            }}
          >
            Reintentar
          </Boton>
        </TarjetaAcceso>
      </PaginaCentrada>
    );
  }

  const { sesion, hijos, seleccionadoId, eligiendo } = estado;
  if (hijos.length === 0) return <SinHijos sesion={sesion} />;
  const hijo = hijos.find((h) => h.estudianteId === seleccionadoId);
  if (!hijo || eligiendo) {
    return (
      <SeleccionHijo
        sesion={sesion}
        hijos={hijos}
        actualId={hijo?.estudianteId ?? null}
        onCancelar={() => setEstado({ ...estado, eligiendo: false })}
        onElegido={(id) => {
          setEstado({ ...estado, seleccionadoId: id, eligiendo: false });
          router.push("/apoderado");
        }}
      />
    );
  }

  return (
    <ApoderadoContext.Provider value={{ sesion, hijo, hijos }}>
      <div className="flex min-h-screen bg-fondo">
        <BarraLateral sesion={sesion} />
        <div className="flex min-w-0 flex-1 flex-col">
          <BarraSuperior
            hijo={hijo}
            puedeCambiar={hijos.length > 1}
            onCambiar={() => setEstado({ ...estado, eligiendo: true })}
          />
          {/* key: al cambiar de hijo, la página se monta de nuevo y vuelve a pedir sus datos */}
          <main key={hijo.estudianteId} className="flex flex-col gap-6 px-10 pt-8 pb-14">
            {children}
          </main>
        </div>
      </div>
    </ApoderadoContext.Provider>
  );
}

// ---------- Barra lateral (AP-01) ----------

interface ItemNav {
  texto: string;
  icono: string;
  href?: string; // sin href = módulo aún no disponible («Próximamente»)
}

const NAVEGACION: ItemNav[] = [
  { texto: "Inicio", icono: "nav-home", href: "/apoderado" },
  { texto: "Pagos", icono: "nav-wallet", href: "/apoderado/pagos" },
  { texto: "Notas", icono: "nav-award" },
  { texto: "Asistencia", icono: "nav-usercheck" },
  { texto: "Horario", icono: "nav-grid" },
];

function BarraLateral({ sesion }: { sesion: Sesion }) {
  const router = useRouter();
  const ruta = usePathname();
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
      window.alert(mensajeError(e));
    }
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[256px] shrink-0 flex-col border-r border-borde bg-white px-3 py-6">
      <Link href="/apoderado" aria-label="Inicio" className="flex items-center gap-[9px] px-3 pb-8">
        <Icono nombre="logo-isotipo" size={30} />
        <span className="text-[23px] font-bold leading-none text-kubo-azul">Kubo</span>
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto" aria-label="Principal">
        {NAVEGACION.map((item) => {
          const activo = item.href === "/apoderado" ? ruta === "/apoderado" : !!item.href && ruta.startsWith(item.href);
          const clases = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] leading-[1.5]";
          if (!item.href) {
            return (
              <span
                key={item.texto}
                aria-disabled="true"
                title={`${item.texto} · disponible próximamente`}
                className={`${clases} cursor-not-allowed font-medium text-texto-3`}
              >
                <Icono nombre={`${item.icono}-gris`} size={20} className="opacity-50" />
                <span className="flex-1">{item.texto}</span>
                <span className="rounded-full bg-fondo px-2 py-0.5 text-[11px] font-semibold text-texto-3">
                  Próximamente
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.texto}
              href={item.href}
              aria-current={activo ? "page" : undefined}
              className={`${clases} ${activo ? "bg-kubo-azul/10 font-semibold text-kubo-azul" : "font-medium text-texto-2 hover:bg-fondo"}`}
            >
              <Icono nombre={`${item.icono}-${activo ? "azul" : "gris"}`} size={20} />
              {item.texto}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-col gap-1 border-t border-borde pt-4">
        <div className="flex items-center gap-3 px-2 pb-1">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fondo text-[14px] font-semibold text-texto-2">
            {sesion.usuario.iniciales}
          </span>
          <div className="flex min-w-0 flex-col leading-[1.4]">
            <span className="truncate text-[14px] font-semibold text-texto">{sesion.usuario.nombreCompleto}</span>
            <span className="text-[12px] text-texto-3">{NOMBRE_ROL[sesion.rolActivo]}</span>
          </div>
        </div>
        {otrosPerfiles.map((rol) => (
          <button
            key={rol}
            type="button"
            onClick={() => cambiarPerfil(rol)}
            className="rounded-lg px-3 py-1.5 text-left text-[13px] font-medium text-texto-2 hover:bg-fondo"
          >
            Ingresar como {NOMBRE_ROL[rol]}
          </button>
        ))}
        <Link
          href="/cambiar-password"
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-texto-2 hover:bg-fondo"
        >
          Cambiar contraseña
        </Link>
        <button
          type="button"
          onClick={salir}
          disabled={saliendo}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium text-texto-2 hover:bg-fondo"
        >
          <Icono nombre="nav-logout-gris" size={20} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

// ---------- Barra superior: estudiante consultado ----------

export function AvatarHijo({ hijo, tamano = "md" }: { hijo: Pick<Hijo, "iniciales">; tamano?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-verde-oscuro font-bold text-white ${tamano === "lg" ? "size-16 text-[22px]" : "size-9 text-[13px]"}`}
    >
      {hijo.iniciales}
    </span>
  );
}

function BarraSuperior({
  hijo,
  puedeCambiar,
  onCambiar,
}: {
  hijo: Hijo;
  puedeCambiar: boolean;
  onCambiar: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-borde bg-white px-10 py-3">
      <div className="flex items-center gap-3 rounded-lg border border-borde px-2 py-1.5">
        <AvatarHijo hijo={hijo} />
        <div className="flex flex-col pr-2 leading-[1.3]">
          <span className="text-[12px] text-texto-3">Consultando a</span>
          <span className="text-[14px] font-semibold text-texto">
            {hijo.nombreCompleto}
            {hijo.seccionCorta ? ` · ${hijo.seccionCorta}` : ""}
          </span>
        </div>
        {puedeCambiar && (
          <button
            type="button"
            onClick={onCambiar}
            className="flex items-center gap-2 border-l border-borde px-3 py-1.5 text-[14px] font-semibold text-kubo-azul hover:underline"
          >
            <Icono nombre="icon-traslado" size={18} />
            Cambiar de hijo
          </button>
        )}
      </div>
      {hijo.estadoMatricula === "RETIRADO" && <Badge tono="ambar">Retirado</Badge>}
      <div className="flex-1" />
      <Badge tono="verde" punto>
        Año {hijo.anio}
      </Badge>
    </header>
  );
}

// ---------- AC-05 · ¿A quién deseas consultar? ----------

function SeleccionHijo({
  sesion,
  hijos,
  actualId,
  onElegido,
  onCancelar,
}: {
  sesion: Sesion;
  hijos: Hijo[];
  actualId: string | null;
  onElegido: (estudianteId: string) => void;
  onCancelar: () => void;
}) {
  const router = useRouter();
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function elegir(estudianteId: string) {
    setEligiendo(estudianteId);
    setError(null);
    try {
      await api("/matricula/apoderado/hijo-elegido", { method: "PUT", body: { estudianteId } });
      onElegido(estudianteId);
    } catch (e) {
      setError(mensajeError(e));
      setEligiendo(null);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-fondo px-4 py-10">
      <div className="flex items-center gap-[9px]">
        <Icono nombre="logo-isotipo" size={34} />
        <span className="text-[28px] font-bold leading-none text-texto">
          Ku<span className="text-kubo-azul">b</span>
          <span className="text-verde">o</span>
        </span>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">¿A quién deseas consultar?</h1>
        <p className="text-[16px] text-texto-2">
          Hola, {sesion.usuario.nombres}. Tienes {hijos.length} estudiantes vinculados a tu cuenta.
        </p>
      </div>
      {error && (
        <div className="w-full max-w-[744px]">
          <Alerta tipo="error" titulo={error} />
        </div>
      )}
      <ul className="grid w-full max-w-[744px] grid-cols-1 gap-6 md:grid-cols-2">
        {hijos.map((h) => (
          <li key={h.estudianteId} className="flex flex-col gap-4 rounded-lg border border-borde bg-white p-6">
            <div className="flex items-center gap-4">
              <AvatarHijo hijo={h} tamano="lg" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[20px] font-semibold leading-[1.3] text-texto">{h.nombreCompleto}</span>
                <span className="text-[14px] text-texto-2">
                  {h.grado && h.seccion ? `${h.grado} · Sección ${h.seccion}` : `Año ${h.anio}`}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-borde pt-4 text-[14px] text-texto-2">
              <div className="flex items-center justify-between">
                <span>Pensiones</span>
                {h.cuotasVencidas > 0 ? (
                  <Badge tono="rojo" punto>
                    {h.cuotasVencidas === 1 ? "1 vencida" : `${h.cuotasVencidas} vencidas`}
                  </Badge>
                ) : (
                  <Badge tono="verde" punto>
                    Al día
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>Matrícula {h.anio}</span>
                <Badge tono={h.estadoMatricula === "RETIRADO" ? "ambar" : "azul"}>{h.nombreEstadoMatricula}</Badge>
              </div>
            </div>
            <Boton ancho cargando={eligiendo === h.estudianteId} onClick={() => elegir(h.estudianteId)}>
              Ver panel del estudiante
            </Boton>
          </li>
        ))}
      </ul>
      <p className="flex max-w-[744px] items-start gap-2 text-[13px] leading-[1.4] text-texto-3">
        <Icono nombre="icon-info" size={16} />
        Si solo tienes un estudiante vinculado, ingresarás directamente a su panel. Puedes cambiar de estudiante en
        cualquier momento desde la barra superior.
      </p>
      <div className="flex items-center gap-6">
        {actualId && (
          <button type="button" onClick={onCancelar} className="text-[14px] font-semibold text-kubo-azul">
            Volver al panel
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            await cerrarSesion();
            router.replace("/login");
          }}
          className="flex items-center gap-2 text-[14px] font-semibold text-texto-2"
        >
          <Icono nombre="nav-logout-gris" size={18} />
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}

// ---------- Sin hijos matriculados ----------

function SinHijos({ sesion }: { sesion: Sesion }) {
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
        <Alerta tipo="info" titulo="Aún no tienes estudiantes matriculados vinculados a tu cuenta">
          Cuando la matrícula de tu hijo o hija esté confirmada, podrás consultar aquí sus pagos. Si ya está
          matriculado, comunícate con la secretaría del colegio para que lo vinculen a tu cuenta.
        </Alerta>
        {otrosPerfiles.map((p) => (
          <Boton key={p} variante="secundario" ancho onClick={() => cambiarPerfil(p)}>
            Ingresar como {NOMBRE_ROL[p]}
          </Boton>
        ))}
        <Boton
          ancho
          onClick={async () => {
            await cerrarSesion();
            router.replace("/login");
          }}
        >
          Cerrar sesión
        </Boton>
      </TarjetaAcceso>
    </PaginaCentrada>
  );
}
