// AL-01 · Inicio · Alumno (US49): panel simplificado con accesos solo a Horario, Mis cursos, Notas, Asistencia y
// Notificaciones. Las tres últimas aún no existen y se muestran como «Próximamente», igual que en el portal del
// apoderado.
"use client";

import Link from "next/link";
import { useAlumno } from "@/components/alumno/PortalAlumno";
import { EncabezadoPagina } from "@/components/portal";
import { Icono } from "@/components/ui";
import { fechaLarga, hoyEnLima } from "@/lib/formato";

interface Acceso {
  titulo: string;
  descripcion: string;
  icono: string;
  /** Sin destino, el módulo aún no existe. */
  href?: string;
  accion?: string;
}

const ACCESOS: Acceso[] = [
  {
    titulo: "Mi horario",
    descripcion: "Revisa tus clases de la semana, aulas y docentes.",
    icono: "nav-grid-azul",
    href: "/alumno/horario",
    accion: "Ver horario",
  },
  {
    titulo: "Mis cursos",
    descripcion: "Los cursos de tu sección y el docente de cada uno.",
    icono: "nav-book-azul",
    href: "/alumno/cursos",
    accion: "Ver cursos",
  },
  {
    titulo: "Mis notas",
    descripcion: "Consulta tus logros por curso y competencia.",
    icono: "nav-award-azul",
  },
  {
    titulo: "Mi asistencia",
    descripcion: "Tus faltas y tardanzas del bimestre y del año.",
    icono: "nav-usercheck-azul",
  },
  {
    titulo: "Notificaciones",
    descripcion: "Avisos del colegio sobre tus clases y tus notas.",
    icono: "alerta-info",
  },
];

function TarjetaAccesoPanel({ acceso }: { acceso: Acceso }) {
  const contenido = (
    <>
      <span className="flex size-12 items-center justify-center rounded-lg bg-kubo-azul/10">
        <Icono nombre={acceso.icono} size={24} />
      </span>
      <span className="text-[18px] font-semibold leading-[1.3] text-texto">{acceso.titulo}</span>
      <span className="flex-1 text-[14px] leading-[1.5] text-texto-2">{acceso.descripcion}</span>
    </>
  );
  if (!acceso.href) {
    return (
      <li className="flex flex-col gap-3 rounded-lg border border-dashed border-borde bg-white p-5 opacity-80">
        {contenido}
        <span className="w-fit rounded-full bg-fondo px-2.5 py-0.5 text-[12px] font-semibold text-texto-3">
          Próximamente
        </span>
      </li>
    );
  }
  return (
    <li className="flex">
      <Link
        href={acceso.href}
        className="flex w-full flex-col gap-3 rounded-lg border border-borde bg-white p-5 shadow-tarjeta hover:border-kubo-azul"
      >
        {contenido}
        <span className="text-[14px] font-semibold text-kubo-azul">{acceso.accion}</span>
      </Link>
    </li>
  );
}

export default function InicioAlumnoPage() {
  const panel = useAlumno();
  const aula = panel.grado && panel.seccion ? `${panel.grado}, sección ${panel.seccion}` : `Año ${panel.anio}`;

  return (
    <>
      <EncabezadoPagina
        titulo={`¡Hola, ${panel.estudiante.nombres.split(" ")[0]}!`}
        descripcion={`Hoy es ${fechaLarga(hoyEnLima())} · ${aula}`}
      />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6 xl:grid-cols-3">
        {ACCESOS.map((a) => (
          <TarjetaAccesoPanel key={a.titulo} acceso={a} />
        ))}
      </ul>
      <p className="flex items-start gap-2 text-[13px] leading-[1.5] text-texto-3">
        <Icono nombre="icon-lock" size={16} />
        Tu cuenta de alumno es de consulta: puedes ver tu horario y tus cursos. No puedes modificar registros
        académicos.
      </p>
    </>
  );
}
