// Piezas de AD-06 Usuarios: tipos, badges, avatar y los modales M-04 (suspender), reactivar y registrar administrador.
"use client";

import { useState, type FormEvent } from "react";
import { Alerta, Badge, Boton, Campo, Casilla, Icono, Modal } from "@/components/ui";
import { api, ApiError, NOMBRE_ROL, type Rol } from "@/lib/api";
import { alertaError } from "./PortalAdmin";

export type EstadoCuenta = "ACTIVO" | "PENDIENTE_ACTIVACION" | "SUSPENDIDO" | "DADO_DE_BAJA" | "SIN_CUENTA";

export interface UsuarioListado {
  personaId: string;
  usuarioId: string | null;
  nombreCompleto: string;
  iniciales: string;
  email: string | null;
  dni: string;
  roles: Rol[];
  detalle: string | null;
  estado: EstadoCuenta;
  ultimoAccesoEn: string | null;
}

export interface Resumen {
  todos: number;
  administradores: number;
  docentes: number;
  apoderados: number;
  alumnos: number;
  suspendidos: number;
}

const TONO_ROL: Record<Rol, "azul" | "verde" | "celeste" | "gris"> = {
  DOCENTE: "azul",
  APODERADO: "verde",
  ALUMNO: "celeste",
  ADMINISTRADOR: "gris",
};

const COLOR_AVATAR: Record<Rol, string> = {
  DOCENTE: "bg-kubo-azul",
  ADMINISTRADOR: "bg-kubo-azul",
  APODERADO: "bg-verde-oscuro",
  ALUMNO: "bg-celeste",
};

export function BadgeRol({ rol }: { rol: Rol }) {
  return <Badge tono={TONO_ROL[rol]}>{NOMBRE_ROL[rol]}</Badge>;
}

export function BadgeEstado({ estado }: { estado: EstadoCuenta }) {
  if (estado === "ACTIVO")
    return (
      <Badge tono="verde" punto>
        Activo
      </Badge>
    );
  if (estado === "SUSPENDIDO")
    return (
      <Badge tono="rojo" punto>
        Suspendido
      </Badge>
    );
  if (estado === "PENDIENTE_ACTIVACION")
    return (
      <Badge tono="ambar" punto>
        Pendiente
      </Badge>
    );
  if (estado === "DADO_DE_BAJA")
    return (
      <Badge tono="gris" punto>
        De baja
      </Badge>
    );
  return (
    <Badge tono="gris" punto>
      Sin cuenta
    </Badge>
  );
}

export function Avatar({ usuario, tamano = 34 }: { usuario: UsuarioListado; tamano?: 34 | 40 }) {
  const color = usuario.estado === "SUSPENDIDO" ? "bg-texto-3" : COLOR_AVATAR[usuario.roles[0] ?? "DOCENTE"];
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${color}`}
      style={{ width: tamano, height: tamano }}
    >
      <span className={`font-semibold leading-none text-white ${tamano === 40 ? "text-[15px]" : "text-[13px]"}`}>
        {usuario.iniciales}
      </span>
    </div>
  );
}

function FichaUsuario({ usuario }: { usuario: UsuarioListado }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-lg bg-fondo p-3.5">
      <Avatar usuario={usuario} tamano={40} />
      <div className="flex min-w-0 flex-1 flex-col leading-[1.4]">
        <span className="truncate text-[14px] font-semibold text-texto">{usuario.nombreCompleto}</span>
        <span className="truncate text-[12px] text-texto-3">
          {usuario.email ?? "Sin correo"} · DNI {usuario.dni}
        </span>
      </div>
      <div className="flex gap-1">
        {usuario.roles.map((r) => (
          <BadgeRol key={r} rol={r} />
        ))}
      </div>
    </div>
  );
}

// ---------- M-04 · Suspender acceso ----------

const MOTIVOS_SUSPENSION = [
  "Estudiante retirado de la institución",
  "Docente o personal que dejó la institución",
  "Licencia o ausencia prolongada",
  "Uso indebido de la cuenta",
  "Solicitud del propio usuario",
  "Otro",
];

export function ModalSuspender({
  usuario,
  onCerrar,
  onListo,
}: {
  usuario: UsuarioListado | null;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [notificar, setNotificar] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setMotivo("");
    setDetalle("");
    setNotificar(true);
    setError(null);
    onCerrar();
  }

  async function confirmar() {
    if (!usuario?.usuarioId) return;
    if (motivo === "Otro" && !detalle.trim()) {
      setError("Describe el motivo en el detalle.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await api(`/identidad/usuarios/${usuario.usuarioId}/suspender`, {
        method: "POST",
        body: { motivo, detalle: detalle.trim() || null, notificar },
      });
      onListo(`Se suspendió el acceso de ${usuario.nombreCompleto}.`);
      cerrar();
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={Boolean(usuario)}
      onCerrar={cerrar}
      icono="kpi-ban"
      titulo="Suspender acceso"
      subtitulo="Esta acción se puede revertir con “Reactivar”."
      pie={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="peligro" icono="icon-ban-blanco" onClick={confirmar} cargando={enviando} disabled={!motivo}>
            Suspender acceso
          </Boton>
        </>
      }
    >
      {usuario && <FichaUsuario usuario={usuario} />}
      <Alerta tipo="error">
        El usuario no podrá iniciar sesión y todas sus sesiones activas se cerrarán de inmediato.
      </Alerta>
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="motivo-suspension" className="flex gap-1 text-[14px] font-medium leading-[1.4] text-texto-2">
          Motivo <span className="text-rojo">*</span>
        </label>
        <div className="relative">
          <select
            id="motivo-suspension"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={`w-full appearance-none rounded-lg border border-borde bg-white px-4 py-3 pr-10 text-[16px] leading-[1.4] outline-none focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul ${motivo ? "text-texto" : "text-texto-3"}`}
          >
            <option value="" disabled>
              Selecciona un motivo
            </option>
            {MOTIVOS_SUSPENSION.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
            <Icono nombre="icon-chevd" size={18} />
          </span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="detalle-suspension" className="text-[14px] font-medium leading-[1.4] text-texto-2">
          Detalle {motivo === "Otro" ? <span className="text-rojo">*</span> : "(opcional)"}
        </label>
        <textarea
          id="detalle-suspension"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          maxLength={1000}
          rows={2}
          className="h-[72px] w-full resize-none rounded-lg border border-borde bg-white px-4 py-3 text-[16px] leading-[1.5] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul"
        />
      </div>
      <Casilla
        etiqueta="Notificar al usuario por correo electrónico"
        checked={notificar}
        onChange={setNotificar}
        color="verde"
      />
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}

// ---------- Reactivar acceso ----------

export function ModalReactivar({
  usuario,
  onCerrar,
  onListo,
}: {
  usuario: UsuarioListado | null;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setMotivo("");
    setError(null);
    onCerrar();
  }

  async function confirmar() {
    if (!usuario?.usuarioId) return;
    setEnviando(true);
    setError(null);
    try {
      await api(`/identidad/usuarios/${usuario.usuarioId}/reactivar`, {
        method: "POST",
        body: { motivo: motivo.trim() || null },
      });
      onListo(`Se reactivó el acceso de ${usuario.nombreCompleto}.`);
      cerrar();
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={Boolean(usuario)}
      onCerrar={cerrar}
      icono="act-refresh"
      tonoIcono="azul"
      titulo="Reactivar acceso"
      subtitulo="El usuario podrá volver a ingresar con sus credenciales."
      pie={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono="icon-refresh-blanco" onClick={confirmar} cargando={enviando}>
            Reactivar acceso
          </Boton>
        </>
      }
    >
      {usuario && <FichaUsuario usuario={usuario} />}
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="motivo-reactivacion" className="text-[14px] font-medium leading-[1.4] text-texto-2">
          Motivo (opcional)
        </label>
        <textarea
          id="motivo-reactivacion"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Ej.: Retorno de licencia"
          className="h-[72px] w-full resize-none rounded-lg border border-borde bg-white px-4 py-3 text-[16px] leading-[1.5] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul"
        />
      </div>
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}

// ---------- Registrar administrador (pantalla no diseñada en el Figma: usa el estilo de M-04) ----------

interface ResultadoRegistro {
  nombreCompleto: string;
  email: string;
  personaExistia: boolean;
  cuentaCreada: boolean;
  correoEnviado: boolean;
  passwordTemporal: string | null;
}

const VACIO = { dni: "", nombres: "", apellidos: "", email: "", telefono: "", cargo: "" };

export function ModalRegistrarAdministrador({
  abierto,
  onCerrar,
  onListo,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRegistro | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cambiar = (campo: keyof typeof VACIO) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [campo]: e.target.value }));

  function cerrar() {
    setDatos(VACIO);
    setErrores({});
    setError(null);
    setResultado(null);
    setCopiado(false);
    onCerrar();
  }

  async function registrar(e?: FormEvent) {
    e?.preventDefault();
    setEnviando(true);
    setErrores({});
    setError(null);
    try {
      const r = await api<ResultadoRegistro>("/comunidad/administradores", {
        method: "POST",
        body: {
          dni: datos.dni,
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          email: datos.email,
          telefono: datos.telefono.trim() || null,
          cargo: datos.cargo.trim() || null,
        },
      });
      setResultado(r);
      onListo(`Se registró a ${r.nombreCompleto} como administrador.`);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === "DATOS_INVALIDOS")
        setErrores(err.detalles as Record<string, string>);
      else setError(alertaError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      icono="icon-userplus"
      tonoIcono="azul"
      titulo={resultado ? "Administrador registrado" : "Registrar administrador"}
      subtitulo={
        resultado ? undefined : "Se creará su cuenta con una contraseña temporal que deberá cambiar al ingresar."
      }
      pie={
        resultado ? (
          <Boton onClick={cerrar}>Listo</Boton>
        ) : (
          <>
            <Boton variante="secundario" onClick={cerrar} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton icono="icon-userplus-blanco" onClick={() => registrar()} cargando={enviando}>
              Registrar
            </Boton>
          </>
        )
      }
    >
      {resultado ? (
        <>
          <Alerta tipo="exito" titulo={`${resultado.nombreCompleto} ya es administrador`}>
            {resultado.personaExistia
              ? "La persona ya estaba registrada: se le agregó el perfil sin duplicar sus datos. "
              : ""}
            {resultado.cuentaCreada
              ? resultado.correoEnviado
                ? `Enviamos sus credenciales a ${resultado.email}.`
                : `No se pudo enviar el correo a ${resultado.email}: entrégale la contraseña temporal.`
              : "Ya tenía una cuenta, así que puede ingresar con su contraseña actual."}
          </Alerta>
          {resultado.passwordTemporal && (
            <div className="flex w-full flex-col gap-1.5">
              <p className="text-[14px] font-medium leading-[1.4] text-texto-2">
                Contraseña temporal (solo se muestra esta vez)
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-borde bg-fondo px-4 py-3">
                <code className="flex-1 text-[18px] font-semibold tracking-[1px] text-texto">
                  {resultado.passwordTemporal}
                </code>
                <Boton
                  variante="secundario"
                  onClick={() => {
                    navigator.clipboard?.writeText(resultado.passwordTemporal ?? "");
                    setCopiado(true);
                  }}
                >
                  {copiado ? "Copiada" : "Copiar"}
                </Boton>
              </div>
            </div>
          )}
        </>
      ) : (
        <form onSubmit={registrar} className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Campo
            etiqueta="DNI"
            obligatorio
            inputMode="numeric"
            maxLength={8}
            value={datos.dni}
            onChange={cambiar("dni")}
            error={errores.dni}
          />
          <Campo
            etiqueta="Correo"
            obligatorio
            type="email"
            value={datos.email}
            onChange={cambiar("email")}
            error={errores.email}
          />
          <Campo
            etiqueta="Nombres"
            obligatorio
            value={datos.nombres}
            onChange={cambiar("nombres")}
            error={errores.nombres}
          />
          <Campo
            etiqueta="Apellidos"
            obligatorio
            value={datos.apellidos}
            onChange={cambiar("apellidos")}
            error={errores.apellidos}
          />
          <Campo
            etiqueta="Teléfono (opcional)"
            inputMode="tel"
            value={datos.telefono}
            onChange={cambiar("telefono")}
            error={errores.telefono}
          />
          <Campo
            etiqueta="Cargo (opcional)"
            placeholder="Ej.: Secretaria académica"
            value={datos.cargo}
            onChange={cambiar("cargo")}
            error={errores.cargo}
          />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          {error && (
            <div className="sm:col-span-2">
              <Alerta tipo="error" titulo={error} />
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
