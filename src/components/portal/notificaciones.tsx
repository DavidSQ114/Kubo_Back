// M-11 a M-14 · Notificaciones (US55): campana de la cabecera de todos los portales. Muestra la cantidad de no leídas
// (se consulta al cargar y cada 60 segundos) y abre el panel con las últimas notificaciones del usuario, cada una con
// su enlace a la pantalla, las pestañas «Todas» y «No leídas» y «Marcar como leídas».
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alerta, Badge, Icono, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { haceCuanto } from "@/lib/formato";

/** Cada cuánto se actualiza el indicador de la campana. */
const INTERVALO_INDICADOR_MS = 60_000;
/** Por encima de este número, el indicador muestra «99+». */
const MAXIMO_INDICADOR = 99;

export interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  leida: boolean;
  creadaEn: string;
}

interface Panel {
  noLeidas: number;
  items: Notificacion[];
}

type Pestana = "todas" | "no-leidas";

type EstadoPanel = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; items: Notificacion[] };

/** Ícono y fondo de cada tipo de notificación (M-11 a M-14). */
const ICONO_TIPO: Record<string, { icono: string; fondo: string }> = {
  NOTAS: { icono: "nav-award-azul", fondo: "bg-[rgba(27,77,137,0.1)]" },
  HORARIO: { icono: "nav-grid-azul", fondo: "bg-[rgba(27,77,137,0.1)]" },
  PAGO: { icono: "notif-billetera-verde", fondo: "bg-[rgba(46,158,107,0.12)]" },
  RECTIFICACION: { icono: "icon-comentario", fondo: "bg-[rgba(74,144,217,0.12)]" },
  ASISTENCIA: { icono: "alerta-warn", fondo: "bg-[rgba(232,169,59,0.16)]" },
  RECORDATORIO: { icono: "notif-alerta-rojo", fondo: "bg-[rgba(214,69,69,0.12)]" },
};
const ICONO_POR_DEFECTO = { icono: "notif-campana-azul", fondo: "bg-[rgba(27,77,137,0.1)]" };

const mensajeDe = (e: unknown) =>
  e instanceof ApiError || e instanceof Error ? e.message : "No se pudieron cargar las notificaciones.";

function FilaNotificacion({ n, onAbrir }: { n: Notificacion; onAbrir: (n: Notificacion) => void }) {
  const estilo = ICONO_TIPO[n.tipo] ?? ICONO_POR_DEFECTO;
  return (
    <li className="border-b border-borde last:border-b-0">
      <button
        type="button"
        onClick={() => onAbrir(n)}
        className={`flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-fondo focus-visible:bg-fondo focus-visible:outline-none ${n.leida ? "bg-white" : "bg-fondo"}`}
      >
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${estilo.fondo}`}>
          <Icono nombre={estilo.icono} size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold leading-[1.4] text-texto">{n.titulo}</span>
          <span className="text-[14px] leading-[1.4] text-texto-2">{n.mensaje}</span>
          <span className="text-[12px] leading-[1.5] text-texto-3">{haceCuanto(n.creadaEn)}</span>
        </span>
        {!n.leida && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-kubo-azul" aria-label="No leída" role="img" />
        )}
      </button>
    </li>
  );
}

/** Campana con el indicador de no leídas y el panel de notificaciones (US55). */
export function CampanaNotificaciones() {
  const router = useRouter();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState<Pestana>("todas");
  const [estado, setEstado] = useState<EstadoPanel>({ fase: "cargando" });
  const [marcando, setMarcando] = useState(false);

  // indicador: al cargar y cada 60 s; un error (por ejemplo, sin conexión) no interrumpe la pantalla
  useEffect(() => {
    let vigente = true;
    async function contar() {
      try {
        const r = await api<{ noLeidas: number }>("/notificaciones/no-leidas");
        if (vigente) setNoLeidas(r.noLeidas);
      } catch {
        // la campana es informativa: se vuelve a intentar en la siguiente consulta
      }
    }
    void contar();
    const intervalo = window.setInterval(contar, INTERVALO_INDICADOR_MS);
    return () => {
      vigente = false;
      window.clearInterval(intervalo);
    };
  }, []);

  const cargar = useCallback(async (filtro: Pestana) => {
    setEstado({ fase: "cargando" });
    try {
      const p = await api<Panel>(`/notificaciones?estado=${filtro}`);
      setEstado({ fase: "listo", items: p.items });
      setNoLeidas(p.noLeidas);
    } catch (e) {
      setEstado({ fase: "error", mensaje: mensajeDe(e) });
    }
  }, []);

  const cerrar = useCallback((devolverFoco = false) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }, []);

  // se cierra al hacer clic fuera del panel o con Escape
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) cerrar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(true);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto, cerrar]);

  function alternar() {
    if (abierto) return cerrar();
    setAbierto(true);
    void cargar(pestana);
  }

  function elegirPestana(p: Pestana) {
    setPestana(p);
    void cargar(p);
  }

  async function marcarTodas() {
    setMarcando(true);
    try {
      const r = await api<{ noLeidas: number }>("/notificaciones/marcar-leidas", { method: "POST", body: {} });
      setNoLeidas(r.noLeidas);
      setEstado((s) =>
        s.fase !== "listo"
          ? s
          : { fase: "listo", items: pestana === "no-leidas" ? [] : s.items.map((n) => ({ ...n, leida: true })) },
      );
    } catch (e) {
      setEstado({ fase: "error", mensaje: mensajeDe(e) });
    } finally {
      setMarcando(false);
    }
  }

  async function abrir(n: Notificacion) {
    if (!n.leida) {
      try {
        const r = await api<{ noLeidas: number }>("/notificaciones/marcar-leidas", {
          method: "POST",
          body: { ids: [n.id] },
        });
        setNoLeidas(r.noLeidas);
        setEstado((s) =>
          s.fase === "listo"
            ? { fase: "listo", items: s.items.map((x) => (x.id === n.id ? { ...x, leida: true } : x)) }
            : s,
        );
      } catch {
        // si no se pudo marcar, igual se abre la pantalla: seguirá como no leída
      }
    }
    if (n.enlace) {
      cerrar();
      router.push(n.enlace);
    }
  }

  const indicador = noLeidas > MAXIMO_INDICADOR ? `${MAXIMO_INDICADOR}+` : String(noLeidas);

  return (
    <div ref={contenedor} className="relative shrink-0">
      <button
        ref={boton}
        type="button"
        onClick={alternar}
        aria-label={noLeidas ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={`relative flex size-10 items-center justify-center rounded-lg border bg-white hover:bg-fondo ${abierto ? "border-kubo-azul" : "border-borde"}`}
      >
        <Icono nombre="notif-campana-gris" size={20} />
        {noLeidas > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rojo px-1 text-[11px] font-bold leading-none text-white">
            {indicador}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute top-[calc(100%+8px)] right-0 z-40 flex w-[400px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-borde bg-white shadow-modal"
        >
          <div className="flex flex-col gap-3 px-5 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Notificaciones</h2>
              {noLeidas > 0 && <Badge tono="azul">{`${indicador} ${noLeidas === 1 ? "nueva" : "nuevas"}`}</Badge>}
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => void marcarTodas()}
                disabled={marcando || noLeidas === 0}
                className="text-[14px] font-semibold text-kubo-azul hover:underline disabled:cursor-default disabled:text-texto-3 disabled:no-underline"
              >
                {marcando ? "Marcando…" : "Marcar como leídas"}
              </button>
            </div>
            <div role="tablist" aria-label="Filtrar notificaciones" className="flex gap-6 border-b border-borde">
              {(
                [
                  ["todas", "Todas"],
                  ["no-leidas", `No leídas (${noLeidas})`],
                ] as const
              ).map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  role="tab"
                  aria-selected={pestana === valor}
                  onClick={() => elegirPestana(valor)}
                  className={`-mb-px border-b-2 px-0.5 pb-2.5 text-[15px] ${pestana === valor ? "border-kubo-azul font-semibold text-kubo-azul" : "border-transparent text-texto-2 hover:text-texto"}`}
                >
                  {texto}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[min(520px,calc(100vh-240px))] overflow-y-auto">
            {estado.fase === "cargando" && (
              <div className="flex items-center justify-center gap-3 px-5 py-10 text-[14px] text-texto-2">
                <Spinner claro={false} /> Cargando…
              </div>
            )}
            {estado.fase === "error" && (
              <div className="flex flex-col gap-3 p-5">
                <Alerta tipo="error" titulo={estado.mensaje} />
                <button
                  type="button"
                  onClick={() => void cargar(pestana)}
                  className="self-start text-[14px] font-semibold text-kubo-azul hover:underline"
                >
                  Reintentar
                </button>
              </div>
            )}
            {estado.fase === "listo" && !estado.items.length && (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-fondo">
                  <Icono nombre="notif-campana-gris" size={22} />
                </span>
                <p className="text-[15px] font-semibold text-texto">
                  {pestana === "no-leidas" ? "Estás al día" : "No tienes notificaciones"}
                </p>
                <p className="text-[14px] text-texto-2">
                  {pestana === "no-leidas"
                    ? "No tienes notificaciones sin leer."
                    : "Aquí verás los avisos de notas, horarios, pagos y otras novedades."}
                </p>
              </div>
            )}
            {estado.fase === "listo" && estado.items.length > 0 && (
              <ul>
                {estado.items.map((n) => (
                  <FilaNotificacion key={n.id} n={n} onAbrir={(x) => void abrir(x)} />
                ))}
              </ul>
            )}
          </div>

          <p className="border-t border-borde bg-fondo px-5 py-3 text-center text-[13px] text-texto-3">
            Se muestran los avisos de los últimos 30 días
          </p>
        </div>
      )}
    </div>
  );
}
