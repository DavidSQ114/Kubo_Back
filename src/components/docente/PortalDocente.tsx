// Portal del Docente (DO-01 a DO-05 · US34, US35, US37, US61, US62): menú con «Inicio», «Mi horario», «Asistencia»,
// «Registro de notas» y «Aula virtual». Es la guardia de las páginas /docente: exige sesión con perfil DOCENTE (RF04).
"use client";

import type { ReactNode } from "react";
import { EstructuraPortal, PantallaCargando, useSesionDeRol, type ItemNav } from "@/components/portal";

const NAVEGACION: ItemNav[] = [
  { texto: "Inicio", icono: "nav-home", href: "/docente" },
  { texto: "Mi horario", icono: "nav-grid", href: "/docente/horario" },
  { texto: "Asistencia", icono: "nav-usercheck", href: "/docente/asistencia" },
  { texto: "Registro de notas", icono: "nav-award", href: "/docente/notas" },
  { texto: "Aula virtual", icono: "nav-book", href: "/docente/aula-virtual" },
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
