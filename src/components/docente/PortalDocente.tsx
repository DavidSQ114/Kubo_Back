// Portal del Docente (DO-01 a DO-05 · US34, US35, US37, US61, US62): menú con «Inicio», «Mi horario», «Asistencia»,
// «Registro de notas» y «Aula virtual», y «Mi tutoría» si es tutor o cotutor de una sección del año en curso (bloque
// M3). Es la guardia de las páginas /docente: exige sesión con perfil DOCENTE (RF04).
"use client";

import type { ReactNode } from "react";
import type { Sesion } from "@/lib/api";
import { EstructuraPortal, PantallaCargando, useSesionDeRol, type ItemNav } from "@/components/portal";
import { useMisTutorias } from "./tutoria";

const NAVEGACION: ItemNav[] = [
  { texto: "Inicio", icono: "nav-home", href: "/docente" },
  { texto: "Mi horario", icono: "nav-grid", href: "/docente/horario" },
  { texto: "Asistencia", icono: "nav-usercheck", href: "/docente/asistencia" },
  { texto: "Registro de notas", icono: "nav-award", href: "/docente/notas" },
  { texto: "Aula virtual", icono: "nav-book", href: "/docente/aula-virtual" },
];

const MI_TUTORIA: ItemNav = { texto: "Mi tutoría", icono: "nav-users", href: "/docente/tutoria" };

export function PortalDocente({ children }: { children: ReactNode }) {
  const sesion = useSesionDeRol("DOCENTE");
  if (!sesion) return <PantallaCargando />;
  return <PortalConSesion sesion={sesion}>{children}</PortalConSesion>;
}

/** El menú «Mi tutoría» aparece solo si el docente es tutor o cotutor; la consulta va con la sesión ya validada. */
function PortalConSesion({ sesion, children }: { sesion: Sesion; children: ReactNode }) {
  const tutorias = useMisTutorias();
  const navegacion = tutorias.fase === "listo" && tutorias.tutorias.length ? [...NAVEGACION, MI_TUTORIA] : NAVEGACION;
  return (
    <EstructuraPortal
      sesion={sesion}
      inicio="/docente"
      navegacion={navegacion}
      saludo={`Hola, ${sesion.usuario.nombres.split(" ")[0]} · Docente`}
      detallePerfil="Docente"
    >
      {children}
    </EstructuraPortal>
  );
}
