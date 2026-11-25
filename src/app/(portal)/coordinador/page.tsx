// Inicio del Coordinador académico (bloque M1; mismo diseño que AD-01): accesos a la configuración del año, la
// matrícula, los pagos, los horarios, la asistencia de alumnos y las notas.
"use client";

import { InicioGestion, type AccesoInicio } from "@/components/admin/inicio";

const ACCESOS: AccesoInicio[] = [
  {
    href: "/coordinador/anio",
    titulo: "Año y bimestres",
    descripcion: "Crea el año académico, registra sus bimestres y montos y abre la matrícula.",
    icono: "icon-calendar",
  },
  {
    href: "/coordinador/grados",
    titulo: "Grados y secciones",
    descripcion: "Organiza las secciones de cada grado con su aula, su tutor y sus vacantes.",
    icono: "icon-capas",
  },
  {
    href: "/coordinador/cursos",
    titulo: "Cursos y competencias",
    descripcion: "Mantén el catálogo de cursos y competencias y los planes de estudio de cada grado.",
    icono: "kpi-book",
  },
  {
    href: "/coordinador/asignaciones",
    titulo: "Asignaciones docentes",
    descripcion: "Asigna a cada docente los cursos y secciones que dictará en el año.",
    icono: "kpi-user",
  },
  {
    href: "/coordinador/matricula",
    titulo: "Matrícula",
    descripcion: "Registra alumnos y apoderados, matricúlalos en una sección y gestiona retiros y traslados.",
    icono: "icon-documento",
  },
  {
    href: "/coordinador/pagos",
    titulo: "Pensiones y pagos",
    descripcion: "Registra pagos, emite recibos y revisa el estado de cuenta de cada alumno.",
    icono: "icon-clip",
  },
  {
    href: "/coordinador/horarios",
    titulo: "Horarios",
    descripcion: "Arma el horario de cada sección sin cruces de docente ni de aula y publícalo.",
    icono: "icon-clock-rojo",
  },
  {
    href: "/coordinador/notas",
    titulo: "Notas y rectificaciones",
    descripcion: "Publica las notas de cada bimestre y resuelve las solicitudes de rectificación.",
    icono: "icon-award",
  },
];

export default function InicioCoordinadorPage() {
  return <InicioGestion descripcion="Este es tu panel de coordinación académica de Kubo." accesos={ACCESOS} />;
}
