// Piezas de AD-06 para una persona (US69): detalle con historial de cambios, edición en dos pasos y baja. Desde el
// detalle de un estudiante sin cuenta se crea su acceso al portal del alumno (US49). El detalle muestra los vínculos:
// apoderados de un estudiante e hijos de un apoderado, con enlace al detalle de cada uno (D-12).
// Pantalla no diseñada en el Figma: usa el estilo de los modales M-04.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alerta, Boton, Campo, Icono, Modal, Spinner } from "@/components/ui";
import { api, ApiError, NOMBRE_ROL, type Rol } from "@/lib/api";
import { fechaDia, fechaHora, hoyEnLima } from "@/lib/formato";
import { alertaError } from "./PortalAdmin";
import { BadgeEstado, BadgeRol, type EstadoCuenta } from "./usuarios";

const CAMPOS = [
  "email",
  "telefono",
  "direccion",
  "fechaNacimiento",
  "ocupacion",
  "especialidad",
  "sexo",
  "colegioProcedencia",
  "dni",
  "nombres",
  "apellidos",
] as const;
type CampoPersona = (typeof CAMPOS)[number];

const ETIQUETA: Record<CampoPersona, string> = {
  email: "Correo",
  telefono: "Teléfono",
  direccion: "Dirección",
  fechaNacimiento: "Fecha de nacimiento",
  ocupacion: "Ocupación",
  especialidad: "Especialidad",
  sexo: "Sexo",
  colegioProcedencia: "Colegio de procedencia",
  dni: "DNI",
  nombres: "Nombres",
  apellidos: "Apellidos",
};

/** Cambiarlos exige un motivo, que queda en la bitácora. */
const CAMPOS_IDENTIDAD: readonly CampoPersona[] = ["dni", "nombres", "apellidos"];

/** Datos que solo tiene quien posee ese perfil. */
const PERFIL_DEL_CAMPO: Partial<Record<CampoPersona, Rol>> = {
  ocupacion: "APODERADO",
  especialidad: "DOCENTE",
  colegioProcedencia: "ALUMNO",
};

const NOMBRE_SEXO: Record<string, string> = { FEMENINO: "Femenino", MASCULINO: "Masculino" };

type DetallePersona = Record<CampoPersona, string | null> & {
  personaId: string;
  nombreCompleto: string;
  dni: string;
  perfiles: Rol[];
  perfilesRegistrados: Rol[];
  estudianteId: string | null;
  cuenta: { usuarioId: string; estado: EstadoCuenta; usada: boolean } | null;
};

/** Respuesta de «Crear acceso al portal» (US49): la contraseña temporal llega una sola vez. */
interface AccesoCreado {
  nombreCompleto: string;
  email: string;
  correoEnviado: boolean;
  passwordTemporal: string | null;
}

/** Estudiante activo que todavía no tiene cuenta: se le puede crear el acceso al portal (US49). */
const puedeCrearAcceso = (d: DetallePersona) => Boolean(d.estudianteId) && d.perfiles.includes("ALUMNO") && !d.cuenta;

interface Cambio {
  campo: CampoPersona;
  anterior: string | null;
  nuevo: string | null;
}

interface EventoHistorial {
  id: string;
  accion: string;
  fecha: string;
  responsable: string | null;
  motivo: string | null;
  cambios: Cambio[];
  perfil: Rol | null;
}

interface ResultadoEdicion {
  nombreCompleto: string;
  cambios: CampoPersona[];
  sesionesCerradas: boolean;
  avisos: { nuevo: boolean; anterior: boolean } | null;
}

interface ResultadoBaja {
  resultado: "ELIMINADA" | "PERFIL_DESACTIVADO";
  nombreCompleto: string;
  perfiles: Rol[];
  motivos: string[];
}

type Formulario = Record<CampoPersona, string>;
export type ModoPersona = "detalle" | "editar";
type Modo = ModoPersona | "revisar" | "eliminar" | "acceso";

const TITULO: Record<Modo, string> = {
  detalle: "Detalle de la persona",
  editar: "Editar persona",
  revisar: "Confirmar cambios",
  eliminar: "Eliminar persona",
  acceso: "Crear acceso al portal",
};

const SUBTITULO: Record<Modo, string> = {
  detalle: "Datos registrados y cambios que se les hicieron.",
  editar: "Corrige solo lo necesario: se guardan únicamente los campos que cambies.",
  revisar: "Revisa lo que va a cambiar. Cada cambio queda en la auditoría.",
  eliminar: "Se elimina solo si no tiene registros asociados.",
  acceso: "El estudiante ingresará con su correo y una contraseña temporal que deberá cambiar.",
};

const camposDe = (d: DetallePersona) =>
  CAMPOS.filter((c) => {
    const perfil = PERFIL_DEL_CAMPO[c];
    return !perfil || d.perfilesRegistrados.includes(perfil);
  });

const aFormulario = (d: DetallePersona) => Object.fromEntries(CAMPOS.map((c) => [c, d[c] ?? ""])) as Formulario;

function normalizar(campo: CampoPersona, valor: string): string {
  if (campo === "telefono") return valor.replace(/[\s-]/g, "");
  if (campo === "email") return valor.trim().toLowerCase();
  return valor.trim();
}

/** Campos del formulario cuyo valor es distinto del registrado: solo esos se envían. */
function cambiosDe(d: DetallePersona, formulario: Formulario): Cambio[] {
  return camposDe(d).flatMap((campo) => {
    const nuevo = normalizar(campo, formulario[campo]) || null;
    return nuevo === (d[campo] ?? null) ? [] : [{ campo, anterior: d[campo] ?? null, nuevo }];
  });
}

function mostrar(campo: CampoPersona, valor: string | null): string {
  if (!valor) return "—";
  if (campo === "fechaNacimiento") return fechaDia(valor);
  if (campo === "sexo") return NOMBRE_SEXO[valor] ?? valor;
  return valor;
}

function mensajeEdicion(r: ResultadoEdicion): string {
  const base = `Se actualizaron los datos de ${r.nombreCompleto}.`;
  if (!r.sesionesCerradas) return base;
  const avisos =
    r.avisos?.nuevo && r.avisos.anterior
      ? "se avisó al correo nuevo y al anterior."
      : "no se pudo enviar alguno de los avisos por correo: comunícaselo a la persona.";
  return `${base} Se cerraron sus sesiones y ${avisos}`;
}

function mensajeBaja(r: ResultadoBaja): string {
  if (r.resultado === "ELIMINADA") return `Se eliminó a ${r.nombreCompleto}.`;
  const perfiles = r.perfiles.map((p) => NOMBRE_ROL[p]).join(", ");
  const porque = r.motivos.length ? ` porque ${r.motivos.join(", ")}` : "";
  return `${r.nombreCompleto} no se eliminó${porque}. Se desactivó su perfil: ${perfiles}.`;
}

const CLASE_SELECT =
  "w-full appearance-none rounded-lg border border-borde bg-white px-4 py-3 pr-10 text-[16px] leading-[1.4] text-texto outline-none focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul";

function Selector({
  id,
  etiqueta,
  valor,
  onCambiar,
  opciones,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  opciones: { valor: string; texto: string }[];
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-medium leading-[1.4] text-texto-2">
        {etiqueta}
      </label>
      <div className="relative">
        <select id={id} value={valor} onChange={(e) => onCambiar(e.target.value)} className={CLASE_SELECT}>
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
          <Icono nombre="icon-chevd" size={18} />
        </span>
      </div>
    </div>
  );
}

function ListaDeCambios({ cambios }: { cambios: Cambio[] }) {
  return (
    <ul className="flex w-full flex-col gap-2">
      {cambios.map((c) => (
        <li key={c.campo} className="flex flex-col gap-0.5 rounded-lg bg-fondo px-3.5 py-2.5 text-[14px] leading-[1.4]">
          <span className="font-semibold text-texto">{ETIQUETA[c.campo]}</span>
          <span className="break-words text-texto-2">
            <span className="text-texto-3 line-through">{mostrar(c.campo, c.anterior)}</span>
            {" → "}
            {mostrar(c.campo, c.nuevo)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Historial({ eventos }: { eventos: EventoHistorial[] }) {
  if (!eventos.length) {
    return (
      <p className="text-[14px] leading-[1.4] text-texto-3">
        Aún no se registran cambios en los datos de esta persona. Cuando se editen, aquí verás qué cambió, quién lo hizo
        y cuándo.
      </p>
    );
  }
  return (
    <ol className="flex w-full flex-col gap-3">
      {eventos.map((e) => (
        <li key={e.id} className="flex flex-col gap-2 border-l-2 border-borde pl-3.5">
          <p className="text-[13px] leading-[1.4] text-texto-3">
            {fechaHora(new Date(e.fecha))} · {e.responsable ?? "Usuario eliminado"}
          </p>
          {e.perfil ? (
            <p className="text-[14px] font-semibold leading-[1.4] text-texto">
              Se desactivó el perfil {NOMBRE_ROL[e.perfil]}
            </p>
          ) : (
            <ListaDeCambios cambios={e.cambios} />
          )}
          {e.motivo && <p className="text-[13px] leading-[1.4] text-texto-2">Motivo: {e.motivo}</p>}
        </li>
      ))}
    </ol>
  );
}

interface VinculoDePersona {
  vinculoId: string;
  personaId: string;
  nombreCompleto: string;
  activo: boolean;
  parentesco: string;
  esPrincipal: boolean;
  autorizado: boolean;
  responsablePago: boolean;
  matricula: { anio: number; estado: string; seccion: string | null } | null;
}

interface VinculosDePersona {
  apoderados: VinculoDePersona[];
  hijos: VinculoDePersona[];
}

const NOMBRE_ESTADO_MATRICULA: Record<string, string> = {
  EN_PROCESO: "En proceso",
  MATRICULADO: "Matriculado",
  RETIRADO: "Retirado",
  ANULADO: "Anulada",
  FINALIZADO: "Finalizado",
};

/** D-12: un apoderado del estudiante o un hijo del apoderado, con enlace a su propio detalle. */
function FilaVinculo({
  v,
  esHijo = false,
  onVer,
}: {
  v: VinculoDePersona;
  esHijo?: boolean;
  onVer?: (personaId: string) => void;
}) {
  const etiquetas = [v.parentesco, v.esPrincipal && "Principal", v.responsablePago && "Responsable del pago"].filter(
    Boolean,
  );
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-borde px-3.5 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col leading-[1.4]">
        {onVer ? (
          <button
            type="button"
            onClick={() => onVer(v.personaId)}
            className="w-fit text-left text-[14px] font-semibold text-kubo-azul hover:underline"
          >
            {v.nombreCompleto}
          </button>
        ) : (
          <span className="text-[14px] font-semibold text-texto">{v.nombreCompleto}</span>
        )}
        <span className="text-[13px] text-texto-2">
          {etiquetas.join(" · ")}
          {!v.activo ? " · Inactivo" : ""}
        </span>
      </div>
      {esHijo && (
        <span className="text-[13px] text-texto-2">
          {v.matricula
            ? `${v.matricula.seccion ?? "Sin sección"} · ${NOMBRE_ESTADO_MATRICULA[v.matricula.estado] ?? v.matricula.estado} (${v.matricula.anio})`
            : "Sin matrícula"}
        </span>
      )}
    </li>
  );
}

/** D-12: apoderados del estudiante e hijos del apoderado, para no tener que buscarlos por DNI. */
function Vinculos({ vinculos, onVer }: { vinculos: VinculosDePersona; onVer?: (personaId: string) => void }) {
  const { apoderados, hijos } = vinculos;
  if (!apoderados.length && !hijos.length) return null;
  return (
    <div className="flex w-full flex-col gap-3 border-t border-borde pt-4">
      {apoderados.length > 0 && (
        <>
          <h3 className="text-[14px] font-semibold leading-[1.4] text-texto">Apoderados</h3>
          <ul className="flex flex-col gap-2">
            {apoderados.map((v) => (
              <FilaVinculo key={v.vinculoId} v={v} onVer={onVer} />
            ))}
          </ul>
        </>
      )}
      {hijos.length > 0 && (
        <>
          <h3 className="text-[14px] font-semibold leading-[1.4] text-texto">Hijos (estudiantes vinculados)</h3>
          <ul className="flex flex-col gap-2">
            {hijos.map((v) => (
              <FilaVinculo key={v.vinculoId} v={v} esHijo onVer={onVer} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Detalle({
  detalle,
  historial,
  vinculos,
  onCrearAcceso,
  onVerPersona,
}: {
  detalle: DetallePersona;
  historial: EventoHistorial[];
  vinculos: VinculosDePersona;
  onCrearAcceso: () => void;
  onVerPersona?: (personaId: string) => void;
}) {
  return (
    <>
      <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-fondo p-3.5">
        <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-texto">{detalle.nombreCompleto}</span>
        {detalle.perfiles.map((r) => (
          <BadgeRol key={r} rol={r} />
        ))}
        <BadgeEstado estado={detalle.cuenta?.estado ?? "SIN_CUENTA"} />
      </div>
      {puedeCrearAcceso(detalle) && (
        <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-borde p-3.5">
          <p className="min-w-0 flex-1 text-[14px] leading-[1.4] text-texto-2">
            Este estudiante aún no tiene una cuenta para ingresar al portal del alumno.
          </p>
          <Boton variante="secundario" icono="icon-key" onClick={onCrearAcceso}>
            Crear acceso al portal
          </Boton>
        </div>
      )}
      <dl className="grid w-full grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {camposDe(detalle).map((campo) => (
          <div key={campo} className="flex min-w-0 flex-col leading-[1.4]">
            <dt className="text-[12px] text-texto-3">{ETIQUETA[campo]}</dt>
            <dd className="break-words text-[14px] text-texto">{mostrar(campo, detalle[campo])}</dd>
          </div>
        ))}
      </dl>
      <Vinculos vinculos={vinculos} onVer={onVerPersona} />
      <div className="flex w-full flex-col gap-3 border-t border-borde pt-4">
        <h3 className="text-[14px] font-semibold leading-[1.4] text-texto">Historial de cambios</h3>
        <Historial eventos={historial} />
      </div>
    </>
  );
}

/**
 * Modal de una persona de AD-06. Carga su detalle y su historial una vez y pasa por sus modos: detalle, editar,
 * revisar (solo los campos que cambian, antes de guardar) y eliminar. Se reinicia con `key` al cambiar de persona.
 */
export function ModalPersona({
  personaId,
  modoInicial,
  esYo,
  onCerrar,
  onListo,
  onVerPersona,
}: {
  personaId: string;
  modoInicial: ModoPersona;
  esYo: boolean;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
  /** D-12: abrir el detalle de un apoderado o de un hijo vinculado. */
  onVerPersona?: (personaId: string) => void;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [carga, setCarga] = useState<{
    detalle?: DetallePersona;
    historial?: EventoHistorial[];
    vinculos?: VinculosDePersona;
    error?: string;
  }>({});
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [motivo, setMotivo] = useState("");
  const [perfilARetirar, setPerfilARetirar] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [emailAcceso, setEmailAcceso] = useState("");
  const [acceso, setAcceso] = useState<AccesoCreado | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      api<DetallePersona>(`/comunidad/personas/${personaId}`),
      api<{ items: EventoHistorial[] }>(`/comunidad/personas/${personaId}/historial`),
      api<VinculosDePersona>(`/comunidad/personas/${personaId}/vinculos`),
    ])
      .then(([detalle, historial, vinculos]) => {
        if (!vigente) return;
        setCarga({ detalle, historial: historial.items, vinculos });
        setFormulario(aFormulario(detalle));
        setEmailAcceso(detalle.email ?? "");
      })
      .catch((e) => {
        if (vigente) setCarga({ error: alertaError(e) });
      });
    return () => {
      vigente = false;
    };
  }, [personaId]);

  const { detalle, historial, vinculos } = carga;
  const cambios = useMemo(() => (detalle && formulario ? cambiosDe(detalle, formulario) : []), [detalle, formulario]);
  const pideMotivo = cambios.some((c) => CAMPOS_IDENTIDAD.includes(c.campo));
  const cambiaCorreoDeCuenta = Boolean(detalle?.cuenta) && cambios.some((c) => c.campo === "email");

  const cambiar = (campo: CampoPersona) => (e: { target: { value: string } }) =>
    setFormulario((f) => (f ? { ...f, [campo]: e.target.value } : f));

  function volverDe(actual: Modo) {
    setError(null);
    if (actual === "revisar") setModo("editar");
    else if (actual === "detalle" || modoInicial === "editar") onCerrar();
    else setModo("detalle");
  }

  async function guardar() {
    if (!detalle) return;
    if (pideMotivo && motivo.trim().length < 5) {
      setError("Describe el motivo del cambio (mínimo 5 caracteres).");
      return;
    }
    setEnviando(true);
    setError(null);
    setErrores({});
    try {
      const cuerpo: Record<string, string | null> = Object.fromEntries(cambios.map((c) => [c.campo, c.nuevo]));
      if (pideMotivo) cuerpo.motivo = motivo.trim();
      const r = await api<ResultadoEdicion>(`/comunidad/personas/${personaId}`, { method: "PATCH", body: cuerpo });
      // Al cambiar el propio correo se cierra también esta sesión: hay que volver a ingresar.
      if (esYo && r.sesionesCerradas) router.replace("/login");
      else onListo(mensajeEdicion(r));
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "DATOS_INVALIDOS") {
        setErrores(e.detalles as Record<string, string>);
        setModo("editar");
      } else setError(alertaError(e));
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar() {
    setEnviando(true);
    setError(null);
    try {
      const consulta = perfilARetirar ? `?perfil=${perfilARetirar}` : "";
      const r = await api<ResultadoBaja>(`/comunidad/personas/${personaId}${consulta}`, { method: "DELETE" });
      onListo(mensajeBaja(r));
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setEnviando(false);
    }
  }

  async function crearAcceso() {
    if (!detalle?.estudianteId) return;
    setEnviando(true);
    setError(null);
    setErrores({});
    try {
      const ruta = `/comunidad/estudiantes/${detalle.estudianteId}/acceso`;
      setAcceso(await api<AccesoCreado>(ruta, { method: "POST", body: { email: emailAcceso.trim() } }));
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "DATOS_INVALIDOS") setErrores(e.detalles as Record<string, string>);
      else setError(alertaError(e));
    } finally {
      setEnviando(false);
    }
  }

  // Con el acceso ya creado, cerrar de cualquier forma vuelve al listado actualizado.
  const cerrar = acceso ? () => onListo(`Se creó el acceso al portal de ${acceso.nombreCompleto}.`) : onCerrar;

  const pie =
    !detalle || !formulario ? (
      <Boton variante="secundario" onClick={onCerrar}>
        Cerrar
      </Boton>
    ) : modo === "detalle" ? (
      <>
        {!esYo && (
          <Boton variante="secundario" onClick={() => setModo("eliminar")}>
            Eliminar
          </Boton>
        )}
        <div className="flex-1" />
        <Boton variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
        <Boton onClick={() => setModo("editar")}>Editar</Boton>
      </>
    ) : modo === "editar" ? (
      <>
        <Boton variante="secundario" onClick={() => volverDe("editar")}>
          Cancelar
        </Boton>
        <Boton onClick={() => setModo("revisar")} disabled={!cambios.length}>
          Revisar cambios
        </Boton>
      </>
    ) : modo === "acceso" ? (
      acceso ? (
        <Boton onClick={cerrar}>Listo</Boton>
      ) : (
        <>
          <Boton variante="secundario" onClick={() => volverDe("acceso")} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton onClick={crearAcceso} cargando={enviando} disabled={!emailAcceso.trim()}>
            Crear acceso
          </Boton>
        </>
      )
    ) : modo === "revisar" ? (
      <>
        <Boton variante="secundario" onClick={() => volverDe("revisar")} disabled={enviando}>
          Volver
        </Boton>
        <Boton onClick={guardar} cargando={enviando}>
          Guardar cambios
        </Boton>
      </>
    ) : (
      <>
        <Boton variante="secundario" onClick={() => volverDe("eliminar")} disabled={enviando}>
          Cancelar
        </Boton>
        <Boton variante="peligro" onClick={eliminar} cargando={enviando}>
          Eliminar
        </Boton>
      </>
    );

  return (
    <Modal
      abierto
      onCerrar={cerrar}
      icono={
        modo === "eliminar" ? "act-trash" : modo === "detalle" ? "act-eye" : modo === "acceso" ? "icon-key" : "act-edit"
      }
      tonoIcono={modo === "eliminar" ? "rojo" : "azul"}
      titulo={TITULO[modo]}
      subtitulo={SUBTITULO[modo]}
      pie={pie}
    >
      {carga.error && (
        <Alerta tipo="error" titulo="No pudimos cargar los datos de la persona">
          {carga.error} Cierra esta ventana e inténtalo nuevamente.
        </Alerta>
      )}
      {!carga.error && (!detalle || !formulario || !historial) && (
        <div className="flex w-full justify-center py-8">
          <Spinner claro={false} />
        </div>
      )}

      {detalle && historial && vinculos && modo === "detalle" && (
        <Detalle
          detalle={detalle}
          historial={historial}
          vinculos={vinculos}
          onCrearAcceso={() => setModo("acceso")}
          onVerPersona={onVerPersona}
        />
      )}

      {detalle && modo === "acceso" && !acceso && (
        <>
          <Alerta tipo="info" titulo={`Acceso de ${detalle.nombreCompleto} al portal del alumno`}>
            Se creará su cuenta con una contraseña temporal. En su primer ingreso deberá cambiarla. Solo se crea a
            estudiantes con matrícula vigente.
          </Alerta>
          <Campo
            etiqueta="Correo del estudiante"
            type="email"
            obligatorio
            maxLength={254}
            value={emailAcceso}
            onChange={(e) => setEmailAcceso(e.target.value)}
            error={errores.email}
          />
        </>
      )}

      {acceso && (
        <>
          <Alerta tipo="exito" titulo={`Se creó el acceso de ${acceso.nombreCompleto}`}>
            {acceso.correoEnviado
              ? `Enviamos sus credenciales a ${acceso.email}.`
              : `No se pudo enviar el correo a ${acceso.email}: entrégale la contraseña temporal.`}
          </Alerta>
          {acceso.passwordTemporal && (
            <div className="flex w-full flex-col gap-1.5">
              <p className="text-[14px] font-medium leading-[1.4] text-texto-2">
                Contraseña temporal (solo se muestra esta vez)
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-borde bg-fondo px-4 py-3">
                <code className="flex-1 text-[18px] font-semibold tracking-[1px] text-texto">
                  {acceso.passwordTemporal}
                </code>
                <Boton
                  variante="secundario"
                  onClick={() => {
                    navigator.clipboard?.writeText(acceso.passwordTemporal ?? "");
                    setCopiado(true);
                  }}
                >
                  {copiado ? "Copiada" : "Copiar"}
                </Boton>
              </div>
            </div>
          )}
        </>
      )}

      {detalle && formulario && modo === "editar" && (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Correo"
            type="email"
            value={formulario.email}
            onChange={cambiar("email")}
            error={errores.email}
          />
          <Campo
            etiqueta="Teléfono"
            inputMode="tel"
            maxLength={11}
            value={formulario.telefono}
            onChange={cambiar("telefono")}
            error={errores.telefono}
          />
          <Campo
            etiqueta="Dirección"
            className="sm:col-span-2"
            maxLength={200}
            value={formulario.direccion}
            onChange={cambiar("direccion")}
            error={errores.direccion}
          />
          <Campo
            etiqueta="Fecha de nacimiento"
            type="date"
            max={hoyEnLima()}
            value={formulario.fechaNacimiento}
            onChange={cambiar("fechaNacimiento")}
            error={errores.fechaNacimiento}
          />
          <Selector
            id="sexo-persona"
            etiqueta="Sexo"
            valor={formulario.sexo}
            onCambiar={(v) => setFormulario((f) => (f ? { ...f, sexo: v } : f))}
            opciones={[
              { valor: "", texto: "Sin registrar" },
              { valor: "FEMENINO", texto: "Femenino" },
              { valor: "MASCULINO", texto: "Masculino" },
            ]}
          />
          {detalle.perfilesRegistrados.includes("APODERADO") && (
            <Campo
              etiqueta="Ocupación (apoderado)"
              maxLength={100}
              value={formulario.ocupacion}
              onChange={cambiar("ocupacion")}
              error={errores.ocupacion}
            />
          )}
          {detalle.perfilesRegistrados.includes("DOCENTE") && (
            <Campo
              etiqueta="Especialidad (docente)"
              maxLength={100}
              value={formulario.especialidad}
              onChange={cambiar("especialidad")}
              error={errores.especialidad}
            />
          )}
          {detalle.perfilesRegistrados.includes("ALUMNO") && (
            <Campo
              etiqueta="Colegio de procedencia (estudiante)"
              maxLength={150}
              value={formulario.colegioProcedencia}
              onChange={cambiar("colegioProcedencia")}
              error={errores.colegioProcedencia}
            />
          )}
          <div className="flex flex-col gap-1 border-t border-borde pt-4 sm:col-span-2">
            <h3 className="text-[14px] font-semibold leading-[1.4] text-texto">Identidad</h3>
            <p className="text-[13px] leading-[1.4] text-texto-3">
              Cambiar el DNI, los nombres o los apellidos exige indicar un motivo en el siguiente paso.
            </p>
          </div>
          <Campo
            etiqueta="DNI"
            inputMode="numeric"
            maxLength={8}
            value={formulario.dni}
            onChange={cambiar("dni")}
            error={errores.dni}
          />
          <div className="hidden sm:block" />
          <Campo
            etiqueta="Nombres"
            maxLength={100}
            value={formulario.nombres}
            onChange={cambiar("nombres")}
            error={errores.nombres}
          />
          <Campo
            etiqueta="Apellidos"
            maxLength={100}
            value={formulario.apellidos}
            onChange={cambiar("apellidos")}
            error={errores.apellidos}
          />
          {errores.motivo && (
            <div className="sm:col-span-2">
              <Alerta tipo="error" titulo={errores.motivo} />
            </div>
          )}
        </div>
      )}

      {detalle && modo === "revisar" && (
        <>
          <p className="text-[14px] leading-[1.4] text-texto-2">
            Vas a cambiar {cambios.length === 1 ? "un dato" : `${cambios.length} datos`} de{" "}
            <span className="font-semibold text-texto">{detalle.nombreCompleto}</span>:
          </p>
          <ListaDeCambios cambios={cambios} />
          {cambiaCorreoDeCuenta && (
            <Alerta tipo="aviso" icono="alerta-warn" titulo="Cambia el correo con el que ingresa a Kubo">
              Sus sesiones abiertas se cerrarán y se avisará del cambio al correo nuevo y al anterior.
              {esYo ? " Es tu propia cuenta: tendrás que volver a iniciar sesión." : ""}
            </Alerta>
          )}
          {pideMotivo && (
            <div className="flex w-full flex-col gap-1.5">
              <label htmlFor="motivo-edicion" className="flex gap-1 text-[14px] font-medium leading-[1.4] text-texto-2">
                Motivo del cambio de identidad <span className="text-rojo">*</span>
              </label>
              <textarea
                id="motivo-edicion"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Ej.: El DNI se digitó mal en el registro"
                className="h-[72px] w-full resize-none rounded-lg border border-borde bg-white px-4 py-3 text-[16px] leading-[1.5] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul"
              />
            </div>
          )}
        </>
      )}

      {detalle && modo === "eliminar" && (
        <>
          <Alerta tipo="error" titulo={`¿Eliminar a ${detalle.nombreCompleto}?`}>
            Si no tiene una cuenta usada, vínculos, matrículas, pagos ni asignaciones, se elimina definitivamente. Si
            los tiene, se conserva su historial y solo se desactiva su perfil.
          </Alerta>
          {detalle.perfiles.length > 1 && (
            <Selector
              id="perfil-a-retirar"
              etiqueta="Perfil a retirar"
              valor={perfilARetirar}
              onCambiar={setPerfilARetirar}
              opciones={[
                { valor: "", texto: "Todos sus perfiles" },
                ...detalle.perfiles.map((p) => ({ valor: p, texto: `Solo ${NOMBRE_ROL[p]}` })),
              ]}
            />
          )}
        </>
      )}

      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}
