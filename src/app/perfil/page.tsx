// Mi perfil (bloque M1, todos los roles) · pantalla no diseñada en el Figma: usa el lenguaje visual de AD-06 (tarjetas
// blancas sobre el fondo y la barra azul del portal). Se abre desde la tarjeta del usuario en el menú de cada portal:
// nombres, apellidos, DNI enmascarado, correo, teléfono, dirección, roles y último ingreso, con «Cambiar contraseña».
// Cada uno cambia su teléfono y su dirección; el correo y el DNI solo los cambia el administrador.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alerta, Badge, Boton, Campo, Icono, Logo, Spinner, Tarjeta } from "@/components/ui";
import { api, ApiError, destinoPorErrorDeSesion, inicioPorRol, NOMBRE_ROL, type Rol } from "@/lib/api";
import { ultimoAcceso } from "@/lib/formato";

interface MiPerfil {
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  dni: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  roles: Rol[];
  rolActivo: Rol;
  ultimoAccesoEn: string | null;
}

type Carga = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; perfil: MiPerfil };

export default function MiPerfilPage() {
  const router = useRouter();
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    api<MiPerfil>("/comunidad/mi-perfil")
      .then((perfil) => vigente && setCarga({ fase: "listo", perfil }))
      .catch((e) => {
        const destino = destinoPorErrorDeSesion(e);
        if (destino) router.replace(destino);
        else if (vigente) setCarga({ fase: "error", mensaje: (e as Error).message });
      });
    return () => {
      vigente = false;
    };
  }, [router, intento]);

  const inicio = carga.fase === "listo" ? inicioPorRol(carga.perfil.rolActivo) : null;

  return (
    <div className="flex min-h-screen flex-col bg-fondo">
      <header className="flex items-center gap-4 bg-kubo-azul px-5 py-4 sm:px-10">
        <Logo variante="sidebar" />
        <div className="flex-1" />
        {inicio && (
          <Link
            href={inicio}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] font-semibold text-white hover:bg-white/10"
          >
            <Icono nombre="icon-home-blanco" size={18} /> Volver a mi portal
          </Link>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-5 pt-8 pb-14 sm:px-10">
        <div className="flex flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] text-texto-3">Mi cuenta / Mi perfil</p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Mi perfil</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            Revisa tus datos y mantén al día tu teléfono y tu dirección.
          </p>
        </div>

        {carga.fase === "cargando" && (
          <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando…
          </Tarjeta>
        )}
        {carga.fase === "error" && (
          <Alerta tipo="error" titulo="No pudimos cargar tu perfil">
            <p>{carga.mensaje}</p>
            <Boton
              variante="secundario"
              onClick={() => {
                setCarga({ fase: "cargando" });
                setIntento((n) => n + 1);
              }}
            >
              Reintentar
            </Boton>
          </Alerta>
        )}
        {carga.fase === "listo" && (
          <Perfil perfil={carga.perfil} onActualizado={(perfil) => setCarga({ fase: "listo", perfil })} />
        )}
      </main>
    </div>
  );
}

function Perfil({ perfil, onActualizado }: { perfil: MiPerfil; onActualizado: (p: MiPerfil) => void }) {
  const iniciales = `${perfil.nombres.charAt(0)}${perfil.apellidos.charAt(0)}`.toUpperCase();
  const datos: [string, string][] = [
    ["Nombres", perfil.nombres],
    ["Apellidos", perfil.apellidos],
    ["DNI", perfil.dni],
    ["Correo", perfil.email ?? "Sin correo"],
    ["Último ingreso", ultimoAcceso(perfil.ultimoAccesoEn)],
  ];
  return (
    <>
      <Tarjeta className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-kubo-azul">
            <span className="text-[20px] font-semibold text-white">{iniciales}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="text-[20px] font-semibold leading-[1.3] break-words text-texto">{perfil.nombreCompleto}</p>
            <div className="flex flex-wrap gap-1.5">
              {perfil.roles.map((r) => (
                <Badge key={r} tono={r === perfil.rolActivo ? "azul" : "gris"}>
                  {NOMBRE_ROL[r]}
                  {r === perfil.rolActivo && perfil.roles.length > 1 ? " · en uso" : ""}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {datos.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex min-w-0 flex-col leading-[1.4]">
              <dt className="text-[12px] text-texto-3">{etiqueta}</dt>
              <dd className="text-[15px] break-words text-texto">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] leading-[1.4] text-texto-3">
          Para corregir tu correo o tu DNI, comunícate con el administrador del colegio.
        </p>
      </Tarjeta>

      <FormularioContacto perfil={perfil} onActualizado={onActualizado} />

      <Tarjeta className="flex flex-wrap items-center gap-4 p-6">
        <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
          <h2 className="text-[18px] font-semibold text-texto">Contraseña</h2>
          <p className="text-[14px] leading-[1.4] text-texto-2">
            Cámbiala si crees que alguien más la conoce. Se cerrarán tus otras sesiones.
          </p>
        </div>
        <Link
          href="/cambiar-password"
          className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[16px] font-bold text-texto ring-1 ring-inset ring-borde hover:bg-fondo"
        >
          <Icono nombre="icon-key" size={18} /> Cambiar contraseña
        </Link>
      </Tarjeta>
    </>
  );
}

function FormularioContacto({ perfil, onActualizado }: { perfil: MiPerfil; onActualizado: (p: MiPerfil) => void }) {
  const [telefono, setTelefono] = useState(perfil.telefono ?? "");
  const [direccion, setDireccion] = useState(perfil.direccion ?? "");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiado = telefono.trim() !== (perfil.telefono ?? "") || direccion.trim() !== (perfil.direccion ?? "");

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setErrores({});
    setError(null);
    setAviso(null);
    setGuardando(true);
    try {
      const actualizado = await api<MiPerfil>("/comunidad/mi-perfil", {
        method: "PATCH",
        body: { telefono: telefono.trim() || null, direccion: direccion.trim() || null },
      });
      setTelefono(actualizado.telefono ?? "");
      setDireccion(actualizado.direccion ?? "");
      setAviso("Tus datos de contacto se guardaron.");
      onActualizado(actualizado);
    } catch (err) {
      if (err instanceof ApiError && err.codigo === "DATOS_INVALIDOS") {
        setErrores(err.detalles as Record<string, string>);
      } else setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[18px] font-semibold text-texto">Datos de contacto</h2>
        <p className="text-[14px] leading-[1.4] text-texto-2">El colegio los usa para comunicarse contigo.</p>
      </div>
      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      {error && <Alerta tipo="error" titulo={error} />}
      <form onSubmit={guardar} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Campo
          etiqueta="Teléfono"
          inputMode="tel"
          placeholder="9 dígitos, por ejemplo 987654321"
          maxLength={15}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          error={errores.telefono}
        />
        <Campo
          etiqueta="Dirección"
          placeholder="Calle, número y distrito"
          maxLength={200}
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          error={errores.direccion}
        />
        <div className="flex justify-end sm:col-span-2">
          <Boton type="submit" cargando={guardando} disabled={!cambiado}>
            Guardar cambios
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
