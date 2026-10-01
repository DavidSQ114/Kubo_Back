// AC-06 · Restablecer contraseña (enlace válido y enlace expirado)
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { EncabezadoTarjeta, IconoCircular, PaginaCentrada, TarjetaAcceso, VolverAlLogin } from "@/components/acceso";
import { Alerta, Badge, Boton, CampoPassword, ChecklistPassword, requisitosPassword, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

type Estado =
  | { fase: "validando" }
  | { fase: "valido"; email: string; minutos: number }
  | { fase: "expirado" }
  | { fase: "listo" };

function Restablecer() {
  const token = useSearchParams().get("token") ?? "";
  const [estado, setEstado] = useState<Estado>(() => (token ? { fase: "validando" } : { fase: "expirado" }));
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ email: string; minutosRestantes: number }>(`/identidad/password/restablecer?token=${encodeURIComponent(token)}`)
      .then((r) => setEstado({ fase: "valido", email: r.email, minutos: r.minutosRestantes }))
      .catch(() => setEstado({ fase: "expirado" }));
  }, [token]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api("/identidad/password/restablecer", { method: "POST", body: { token, nueva, confirmacion } });
      setEstado({ fase: "listo" });
    } catch (err) {
      if (err instanceof ApiError && err.codigo === "ENLACE_EXPIRADO") setEstado({ fase: "expirado" });
      else setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (estado.fase === "validando") {
    return (
      <TarjetaAcceso ancho={440}>
        <div className="flex w-full items-center justify-center gap-3 py-10 text-texto-2">
          <Spinner claro={false} /> Verificando el enlace…
        </div>
      </TarjetaAcceso>
    );
  }

  if (estado.fase === "expirado") {
    return (
      <TarjetaAcceso ancho={440}>
        <Badge tono="rojo" punto>Enlace expirado</Badge>
        <IconoCircular nombre="icon-clock-rojo" tono="rojo" />
        <EncabezadoTarjeta titulo="El enlace ha expirado">
          El enlace ha expirado. Solicita uno nuevo. Por seguridad, cada enlace es de un solo uso y vence a los 30 minutos.
        </EncabezadoTarjeta>
        <Link
          href="/recuperar"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-kubo-azul px-4 py-2.5 text-[16px] font-bold leading-[1.5] tracking-[0.2px] text-white hover:bg-kubo-azul-oscuro"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/figma/icon-refresh-blanco.svg" alt="" aria-hidden width={20} height={20} />
          Solicitar nuevo enlace
        </Link>
        <VolverAlLogin />
      </TarjetaAcceso>
    );
  }

  if (estado.fase === "listo") {
    return (
      <TarjetaAcceso ancho={440}>
        <Badge tono="verde" punto>Contraseña actualizada</Badge>
        <IconoCircular nombre="icon-lock-grande" />
        <EncabezadoTarjeta titulo="Listo, ya puedes ingresar">
          Tu contraseña fue actualizada y se cerraron las sesiones abiertas en otros equipos.
        </EncabezadoTarjeta>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-md bg-kubo-azul px-4 py-2.5 text-[16px] font-bold leading-[1.5] tracking-[0.2px] text-white hover:bg-kubo-azul-oscuro"
        >
          Iniciar sesión
        </Link>
      </TarjetaAcceso>
    );
  }

  const valido = requisitosPassword(nueva, confirmacion).every((r) => r.ok);
  return (
    <TarjetaAcceso ancho={440}>
      <Badge tono="verde" punto>
        Enlace válido · vence en {estado.minutos} min
      </Badge>
      <IconoCircular nombre="icon-lock-grande" />
      <div className="flex w-full flex-col gap-2">
        <h1 className="text-[24px] font-semibold leading-[1.25] text-texto">Crea una nueva contraseña</h1>
        <p className="text-[14px] leading-[1.4] text-texto-2">Cuenta: {estado.email}</p>
      </div>
      <form onSubmit={guardar} className="flex w-full flex-col gap-[18px]" noValidate>
        <CampoPassword etiqueta="Nueva contraseña" obligatorio autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <CampoPassword
          etiqueta="Confirmar contraseña"
          obligatorio
          autoComplete="new-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
        />
        <ChecklistPassword nueva={nueva} confirmacion={confirmacion} />
        {error && <Alerta tipo="error" titulo={error} />}
        <Boton type="submit" ancho cargando={enviando} disabled={!valido}>
          Guardar nueva contraseña
        </Boton>
      </form>
    </TarjetaAcceso>
  );
}

export default function RestablecerPage() {
  return (
    <PaginaCentrada>
      <Suspense fallback={<Spinner claro={false} />}>
        <Restablecer />
      </Suspense>
    </PaginaCentrada>
  );
}
