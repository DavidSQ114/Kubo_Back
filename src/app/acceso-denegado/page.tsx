// AC-07 · Acceso denegado (403)
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PaginaCentrada } from "@/components/acceso";
import { Badge, Icono, Spinner } from "@/components/ui";
import { api, inicioPorRol, NOMBRE_ROL, type Sesion } from "@/lib/api";
import { fechaHora } from "@/lib/formato";

function AccesoDenegado() {
  // Ruta que se intentó abrir (la envía la guardia del portal). Solo se muestra si es una ruta interna simple.
  const desde = useSearchParams().get("desde") ?? "";
  const ruta = /^\/[\w\-/]{0,80}$/.test(desde) ? desde : null;
  // La sesión y la hora se resuelven en el navegador: la página se prerenderiza y la hora del servidor no serviría.
  const [carga, setCarga] = useState<{ sesion: Sesion | null; momento: string } | null>(null);

  useEffect(() => {
    api<Sesion>("/identidad/sesion")
      .then((sesion) => setCarga({ sesion, momento: fechaHora(new Date()) }))
      .catch(() => setCarga({ sesion: null, momento: fechaHora(new Date()) }));
  }, []);

  const sesion = carga?.sesion ?? null;
  const perfil = sesion ? NOMBRE_ROL[sesion.rolActivo].toLowerCase() : null;

  return (
    <section className="flex w-full max-w-[1096px] flex-col gap-2 rounded-lg border border-borde bg-white p-8 shadow-tarjeta">
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[rgba(214,69,69,0.08)]">
          <Icono nombre="denegado-lock" size={32} />
        </div>
        <h1 className="text-[20px] font-semibold leading-[1.3] text-texto">No tiene permisos para acceder a este recurso.</h1>
        <p className="max-w-[420px] text-[14px] leading-[1.4] text-texto-2">
          {perfil ? `Tu perfil de ${perfil} no tiene acceso a este módulo.` : "Tu perfil no tiene acceso a este módulo."} Si crees que se trata de
          un error, comunícate con la administración del colegio.
        </p>
        <Link
          href={sesion ? inicioPorRol(sesion.rolActivo) : "/login"}
          className="flex items-center gap-2 rounded-md bg-kubo-azul px-4 py-2.5 text-[16px] font-bold leading-[1.5] tracking-[0.2px] text-white hover:bg-kubo-azul-oscuro"
        >
          <Icono nombre="icon-home-blanco" size={20} />
          {sesion ? "Volver a mi inicio" : "Iniciar sesión"}
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Badge tono="gris" punto>Código 403</Badge>
        <span className="text-[12px] leading-[1.4] text-texto-3">{[ruta, carga?.momento].filter(Boolean).join(" · ")}</span>
      </div>
    </section>
  );
}

export default function AccesoDenegadoPage() {
  return (
    <PaginaCentrada>
      <Suspense fallback={<Spinner claro={false} />}>
        <AccesoDenegado />
      </Suspense>
    </PaginaCentrada>
  );
}
