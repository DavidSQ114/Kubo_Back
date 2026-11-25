// Inicio de los portales de gestión (AD-01 del Administrador y del Coordinador académico, bloque M1): saludo y una
// tarjeta por cada pantalla del menú. Todas llevan a una pantalla existente (sin «Próximamente»).
"use client";

import Link from "next/link";
import { useSesion } from "@/components/admin/PortalAdmin";
import { Icono, Tarjeta } from "@/components/ui";
import { NOMBRE_ROL } from "@/lib/api";

export interface AccesoInicio {
  href: string;
  titulo: string;
  descripcion: string;
  icono: string;
}

export function InicioGestion({ descripcion, accesos }: { descripcion: string; accesos: AccesoInicio[] }) {
  const sesion = useSesion();
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] leading-[1.4] text-texto-3">Inicio · {NOMBRE_ROL[sesion.rolActivo]}</p>
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Hola, {sesion.usuario.nombres}</h1>
        <p className="text-[16px] leading-[1.5] text-texto-2">{descripcion}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {accesos.map((a) => (
          <Link key={a.href} href={a.href} className="group">
            <Tarjeta className="flex h-full flex-col gap-3 p-5 transition group-hover:border-kubo-azul">
              <div className="flex size-10 items-center justify-center rounded-lg bg-kubo-azul/10">
                <Icono nombre={a.icono} size={20} />
              </div>
              <p className="text-[16px] font-semibold text-texto">{a.titulo}</p>
              <p className="text-[14px] leading-[1.4] text-texto-2">{a.descripcion}</p>
            </Tarjeta>
          </Link>
        ))}
      </div>
    </>
  );
}
