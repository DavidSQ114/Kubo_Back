// AD-06 · Usuarios (RF05, RF46)
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { alertaError, useSesion } from "@/components/admin/PortalAdmin";
import {
  Avatar,
  BadgeEstado,
  BadgeRol,
  ModalReactivar,
  ModalRegistrarAdministrador,
  ModalSuspender,
  type Resumen,
  type UsuarioListado,
} from "@/components/admin/usuarios";
import { Alerta, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api, type Rol } from "@/lib/api";
import { ultimoAcceso } from "@/lib/formato";

interface Pagina {
  items: UsuarioListado[];
  paginacion: { pagina: number; tamano: number; total: number; paginas: number };
}

const TAMANO = 10;

const PESTANAS: { rol?: Rol; texto: string; clave: keyof Resumen }[] = [
  { texto: "Todos", clave: "todos" },
  { rol: "DOCENTE", texto: "Docentes", clave: "docentes" },
  { rol: "APODERADO", texto: "Apoderados", clave: "apoderados" },
  { rol: "ALUMNO", texto: "Alumnos", clave: "alumnos" },
  { rol: "ADMINISTRADOR", texto: "Administradores", clave: "administradores" },
];

const ESTADOS = [
  { valor: "", texto: "Estado: todos" },
  { valor: "ACTIVO", texto: "Activos" },
  { valor: "PENDIENTE_ACTIVACION", texto: "Pendientes" },
  { valor: "SUSPENDIDO", texto: "Suspendidos" },
  { valor: "SIN_CUENTA", texto: "Sin cuenta" },
];

function Usuarios({ qInicial }: { qInicial: string }) {
  const sesion = useSesion();
  const [rol, setRolEstado] = useState<Rol | undefined>();
  const [q, setQ] = useState(qInicial);
  const [qDebounced, setQDebounced] = useState(q);
  const [estado, setEstadoFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<{ clave: string; datos?: Pagina; error?: string } | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [errorResumen, setErrorResumen] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aSuspender, setASuspender] = useState<UsuarioListado | null>(null);
  const [aReactivar, setAReactivar] = useState<UsuarioListado | null>(null);
  const [registrando, setRegistrando] = useState(false);

  // Espera 300 ms después de la última tecla antes de buscar; toda búsqueda nueva vuelve a la página 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function setRol(r: Rol | undefined) {
    setRolEstado(r);
    setPagina(1);
  }

  function setEstado(e: string) {
    setEstadoFiltro(e);
    setPagina(1);
  }

  // Clave de la consulta actual: si cambia, se vuelve a pedir la lista. "cargando" se deriva de ella.
  const clave = useMemo(() => {
    const p = new URLSearchParams({ pagina: String(pagina), tamano: String(TAMANO) });
    if (rol) p.set("rol", rol);
    if (qDebounced.trim()) p.set("q", qDebounced.trim());
    if (estado) p.set("estado", estado);
    return `${p}#${recarga}`;
  }, [pagina, rol, qDebounced, estado, recarga]);

  useEffect(() => {
    let vigente = true;
    api<Pagina>(`/comunidad/usuarios?${clave.split("#")[0]}`)
      .then((datos) => {
        if (vigente) setResultado({ clave, datos });
      })
      .catch((e) => {
        if (vigente) setResultado({ clave, error: alertaError(e) });
      });
    return () => {
      vigente = false;
    };
  }, [clave]);

  const cargarResumen = useCallback(() => {
    api<Resumen>("/comunidad/usuarios/resumen")
      .then((r) => {
        setResumen(r);
        setErrorResumen(null);
      })
      .catch((e) => setErrorResumen(alertaError(e)));
  }, []);

  useEffect(cargarResumen, [cargarResumen]);

  const datos = resultado?.datos ?? null;
  const cargando = resultado?.clave !== clave;
  const error = (resultado?.clave === clave ? resultado.error : null) ?? errorResumen;

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  function alTerminarAccion(mensaje: string) {
    setAviso(mensaje);
    cargarResumen();
    setRecarga((n) => n + 1);
  }

  const rango = useMemo(() => {
    if (!datos || datos.paginacion.total === 0) return "Sin resultados";
    const { pagina: pg, tamano, total } = datos.paginacion;
    return `Mostrando ${(pg - 1) * tamano + 1}–${Math.min(pg * tamano, total)} de ${total} usuarios`;
  }, [datos]);

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] whitespace-pre text-texto-3">Comunidad / Usuarios</p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Usuarios</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            Registra docentes y apoderados, revisa sus vínculos y controla el acceso de cada perfil al sistema.
          </p>
        </div>
        <Boton variante="secundario" icono="icon-userplus" onClick={() => setRegistrando(true)}>
          Registrar administrador
        </Boton>
        <Boton
          variante="secundario"
          icono="icon-userplus"
          disabled
          title="Disponible cuando se construya el módulo comunidad (RF12)"
        >
          Registrar apoderado
        </Boton>
        <Boton icono="icon-userplus-blanco" disabled title="Disponible cuando se construya el módulo comunidad (RF11)">
          Registrar docente
        </Boton>
      </div>

      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icono="kpi-book"
          fondo="bg-[rgba(27,77,137,0.12)]"
          titulo="Docentes"
          valor={resumen?.docentes}
          nota="Con perfil activo"
        />
        <Kpi
          icono="kpi-users"
          fondo="bg-[rgba(30,110,74,0.12)]"
          titulo="Apoderados"
          valor={resumen?.apoderados}
          nota="Con perfil activo"
        />
        <Kpi
          icono="kpi-user"
          fondo="bg-[rgba(74,144,217,0.12)]"
          titulo="Alumnos"
          valor={resumen?.alumnos}
          nota="Con perfil activo"
        />
        <Kpi
          icono="kpi-ban"
          fondo="bg-[rgba(214,69,69,0.12)]"
          titulo="Accesos suspendidos"
          valor={resumen?.suspendidos}
          nota="Se pueden reactivar"
        />
      </div>

      <Tarjeta className="flex flex-col gap-4 p-6">
        {/* El desplazamiento horizontal va en un contenedor aparte: el -mb-px de las pestañas provocaba una barra vertical. */}
        <div className="overflow-x-auto">
          <div role="tablist" className="flex w-max min-w-full gap-6 border-b border-borde">
            {PESTANAS.map((p) => {
              const activa = rol === p.rol;
              return (
                <button
                  key={p.texto}
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setRol(p.rol)}
                  className={`-mb-px border-b-2 px-0.5 py-2.5 text-[14px] leading-[1.4] whitespace-nowrap ${
                    activa
                      ? "border-kubo-azul font-semibold text-kubo-azul"
                      : "border-transparent font-medium text-texto-2 hover:text-texto"
                  }`}
                >
                  {p.texto}
                  {resumen ? ` (${resumen[p.clave]})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex w-full max-w-[360px] items-center gap-2 rounded-lg border border-borde bg-white px-4 py-3 focus-within:border-kubo-azul focus-within:ring-1 focus-within:ring-kubo-azul">
            <Icono nombre="icon-search" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, correo o DNI"
              aria-label="Buscar por nombre, correo o DNI"
              className="min-w-0 flex-1 bg-transparent text-[16px] leading-[1.4] text-texto outline-none placeholder:text-texto-3"
            />
          </label>
          <div className="relative w-[180px]">
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              aria-label="Filtrar por estado"
              className="w-full appearance-none rounded-lg border border-borde bg-white px-4 py-3 pr-10 text-[16px] leading-[1.4] text-texto outline-none focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul"
            >
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.texto}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
              <Icono nombre="icon-chevd" size={18} />
            </span>
          </div>
          {cargando && <Spinner claro={false} />}
        </div>

        {error && (
          <Alerta tipo="error" titulo="No pudimos cargar los usuarios">
            {error}
          </Alerta>
        )}

        <div className="overflow-x-auto rounded-lg border border-borde">
          <table className="w-full min-w-[960px] border-collapse bg-white text-left">
            <thead>
              <tr className="border-b border-borde bg-fondo text-[13px] font-semibold leading-[1.4] text-texto-2">
                <th className="px-4 py-2.5 font-semibold">Usuario</th>
                <th className="w-[120px] px-4 py-2.5 font-semibold">Rol</th>
                <th className="w-[110px] px-4 py-2.5 font-semibold">DNI</th>
                <th className="w-[210px] px-4 py-2.5 font-semibold">Detalle</th>
                <th className="w-[130px] px-4 py-2.5 font-semibold">Último acceso</th>
                <th className="w-[130px] px-4 py-2.5 font-semibold">Estado</th>
                <th className="w-[120px] px-4 py-2.5 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {datos?.items.map((u) => {
                const esYo = u.usuarioId === sesion.usuario.id;
                return (
                  <tr
                    key={u.personaId}
                    className={`border-b border-borde text-[14px] leading-[1.4] text-texto last:border-b-0 ${u.estado === "SUSPENDIDO" ? "bg-[rgba(214,69,69,0.07)]" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar usuario={u} />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-semibold">
                            {u.nombreCompleto}
                            {esYo && <span className="ml-1.5 text-[12px] font-normal text-texto-3">(tú)</span>}
                          </span>
                          <span className="text-[12px] text-texto-3">{u.email ?? "Sin correo"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <BadgeRol key={r} rol={r} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{u.dni}</td>
                    <td className="px-4 py-3">{u.detalle ?? <span className="text-texto-3">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ultimoAcceso(u.ultimoAccesoEn)}</td>
                    <td className="px-4 py-3">
                      <BadgeEstado estado={u.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-0.5">
                        <Accion icono="act-eye" texto="Ver detalle · disponible próximamente" />
                        {u.estado !== "SUSPENDIDO" && (
                          <Accion icono="act-edit" texto="Editar · disponible próximamente" />
                        )}
                        {u.usuarioId && u.estado === "SUSPENDIDO" && (
                          <Accion icono="act-refresh" texto="Reactivar acceso" onClick={() => setAReactivar(u)} />
                        )}
                        {u.usuarioId && u.estado !== "SUSPENDIDO" && !esYo && (
                          <Accion icono="act-ban" texto="Suspender acceso" onClick={() => setASuspender(u)} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {datos && datos.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[14px] text-texto-3">
                    No se encontraron usuarios con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {datos && datos.paginacion.total > 0 && (
          <Paginacion
            texto={rango}
            pagina={datos.paginacion.pagina}
            paginas={datos.paginacion.paginas}
            onCambiar={setPagina}
          />
        )}
      </Tarjeta>

      <Alerta tipo="info" titulo="Suspensión de accesos">
        Al suspender un usuario, sus sesiones activas se cierran de inmediato y verá el mensaje “Tu acceso está
        suspendido. Comunícate con la administración del colegio.” Al reactivarlo podrá ingresar con sus credenciales
        originales.
      </Alerta>

      <ModalSuspender usuario={aSuspender} onCerrar={() => setASuspender(null)} onListo={alTerminarAccion} />
      <ModalReactivar usuario={aReactivar} onCerrar={() => setAReactivar(null)} onListo={alTerminarAccion} />
      <ModalRegistrarAdministrador
        abierto={registrando}
        onCerrar={() => setRegistrando(false)}
        onListo={alTerminarAccion}
      />
    </>
  );
}

function Kpi({
  icono,
  fondo,
  titulo,
  valor,
  nota,
}: {
  icono: string;
  fondo: string;
  titulo: string;
  valor?: number;
  nota: string;
}) {
  return (
    <Tarjeta className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-lg ${fondo}`}>
          <Icono nombre={icono} size={20} />
        </div>
        <p className="flex-1 text-[14px] font-medium leading-[1.4] text-texto-2">{titulo}</p>
      </div>
      <p className="text-[28px] font-bold leading-[1.25] text-texto">{valor ?? "—"}</p>
      <p className="text-[13px] leading-[1.4] text-texto-3">{nota}</p>
    </Tarjeta>
  );
}

function Accion({ icono, texto, onClick }: { icono: string; texto: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={texto}
      aria-label={texto}
      className="rounded-md p-[7px] hover:bg-fondo disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Icono nombre={icono} size={18} />
    </button>
  );
}

function Paginacion({
  texto,
  pagina,
  paginas,
  onCambiar,
}: {
  texto: string;
  pagina: number;
  paginas: number;
  onCambiar: (p: number) => void;
}) {
  const numeros = useMemo(() => {
    const set = new Set([1, paginas, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= paginas));
    return [...set].sort((a, b) => a - b);
  }, [pagina, paginas]);

  const boton =
    "flex items-center justify-center rounded-md border text-[16px] font-bold leading-[1.5] tracking-[0.2px]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-[13px] leading-[1.4] text-texto-3">{texto}</p>
      <div className="flex-1" />
      <button
        type="button"
        aria-label="Página anterior"
        disabled={pagina <= 1}
        onClick={() => onCambiar(pagina - 1)}
        className={`${boton} border-borde bg-white p-2.5 disabled:opacity-40`}
      >
        <Icono nombre="pag-chevl" size={20} />
      </button>
      {numeros.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - numeros[i - 1] > 1 && <span className="text-[14px] text-texto-3">…</span>}
          <button
            type="button"
            onClick={() => onCambiar(n)}
            aria-current={n === pagina ? "page" : undefined}
            className={`${boton} px-4 py-2.5 ${n === pagina ? "border-kubo-azul bg-kubo-azul text-white" : "border-borde bg-white text-texto hover:bg-fondo"}`}
          >
            {n}
          </button>
        </span>
      ))}
      <button
        type="button"
        aria-label="Página siguiente"
        disabled={pagina >= paginas}
        onClick={() => onCambiar(pagina + 1)}
        className={`${boton} border-borde bg-white p-2.5 disabled:opacity-40`}
      >
        <Icono nombre="pag-chevr" size={20} />
      </button>
    </div>
  );
}

// La búsqueda de la barra superior navega a /admin/usuarios?q=…; la clave reinicia la pantalla con ese texto.
function UsuariosConParametros() {
  const q = useSearchParams().get("q") ?? "";
  return <Usuarios key={q} qInicial={q} />;
}

export default function UsuariosPage() {
  return (
    <Suspense fallback={<Spinner claro={false} />}>
      <UsuariosConParametros />
    </Suspense>
  );
}
