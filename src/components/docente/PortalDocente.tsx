// Portal del Docente (DO-01, DO-02 · US34): menú con «Inicio» y «Mi horario»; la asistencia y el registro de notas
// llegan con sus módulos. Es la guardia de las páginas /docente: exige sesión con perfil DOCENTE (RF04).
"use client";

import type { ReactNode } from "react";
import { EstructuraPortal, PantallaCargando, useSesionDeRol, type ItemNav } from "@/components/portal";

const NAVEGACION: ItemNav[] = [
  { texto: "Inicio", icono: "nav-home", href: "/docente" },
  { texto: "Mi horario", icono: "nav-grid", href: "/docente/horario" },
  { texto: "Asistencia", icono: "nav-usercheck" },
  { texto: "Registro de notas", icono: "nav-award" },
];

export function PortalDocente({ children }: { children: ReactNode }) {
  const sesion = useSesionDeRol("DOCENTE");
  if (!sesion) return <PantallaCargando />;
  return (
    <EstructuraPortal
      sesion={sesion}
      inicio="/docente"
      navegacion={NAVEGACION}
      saludo={`Hola, ${sesion.usuario.nombres.split(" ")[0]} · Docente`}
      detallePerfil="Docente"
    >
      {children}
    </EstructuraPortal>
  );
}
