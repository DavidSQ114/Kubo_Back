// Portal del Coordinador académico (bloque M1): mismo diseño que el del Administrador (AD-06; el Figma no tiene frames
// propios del coordinador) con su menú: configuración académica, matrícula y tesorería, horarios, asistencia de
// alumnos, notas y los reportes de notas por alumno y de logro de competencias (bloque M2). Es la guardia de las
// páginas /coordinador: exige sesión con perfil COORDINADOR (RF04).
"use client";

import type { ReactNode } from "react";
import { PortalGestion, type DestinosPortal, type NavegacionGestion } from "@/components/admin/PortalAdmin";

const NAVEGACION: NavegacionGestion = [
  { items: [{ texto: "Inicio", icono: "nav-home", href: "/coordinador" }] },
  {
    grupo: "CONFIGURACIÓN",
    items: [
      { texto: "Año y bimestres", icono: "nav-calendar", href: "/coordinador/anio" },
      { texto: "Grados y secciones", icono: "nav-layers", href: "/coordinador/grados" },
      { texto: "Cursos y competencias", icono: "nav-book", href: "/coordinador/cursos" },
      { texto: "Reglas de evaluación", icono: "nav-sliders", href: "/coordinador/reglas" },
      { texto: "Asignaciones docentes", icono: "nav-users", href: "/coordinador/asignaciones" },
    ],
  },
  {
    grupo: "MATRÍCULA Y PAGOS",
    items: [
      { texto: "Matrícula", icono: "nav-clipboard", href: "/coordinador/matricula" },
      { texto: "Alumnos y apoderados", icono: "nav-users", href: "/coordinador/alumnos-apoderados" },
      { texto: "Pensiones y pagos", icono: "nav-wallet", href: "/coordinador/pagos" },
      { texto: "Morosidad", icono: "nav-alert", href: "/coordinador/morosidad" },
    ],
  },
  {
    grupo: "ACADÉMICO",
    items: [
      { texto: "Horarios", icono: "nav-grid", href: "/coordinador/horarios" },
      { texto: "Asistencia de alumnos", icono: "nav-usercheck", href: "/coordinador/asistencia" },
      { texto: "Notas y rectificaciones", icono: "nav-award", href: "/coordinador/notas" },
      { texto: "Notas por alumno", icono: "nav-book", href: "/coordinador/notas-alumno" },
      { texto: "Logro de competencias", icono: "nav-grid", href: "/coordinador/reporte-competencias" },
      { texto: "Bitácora de notas", icono: "nav-shield", href: "/coordinador/bitacora-notas" },
    ],
  },
];

const DESTINOS: DestinosPortal = {
  inicio: "/coordinador",
  volverDeRegistro: "/coordinador/alumnos-apoderados",
  nombreVolverDeRegistro: "Alumnos y apoderados",
  registrarEstudiante: "/coordinador/matricula/registrar-estudiante",
  registrarApoderado: "/coordinador/matricula/registrar-apoderado",
  matricula: "/coordinador/matricula",
  pagos: "/coordinador/pagos",
  cursos: "/coordinador/cursos",
};

export function PortalCoordinador({ children }: { children: ReactNode }) {
  return (
    <PortalGestion rol="COORDINADOR" navegacion={NAVEGACION} destinos={DESTINOS}>
      {children}
    </PortalGestion>
  );
}
