// DO-01 · Inicio del docente
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSesionDocente } from "@/components/docente/PortalDocente";
import { Alerta, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { alertaError } from "@/lib/portal";
import { API } from "@/lib/rutasApi";

const ACCESOS = [
  { href: "/docente/horario", titulo: "Mi horario", texto: "Consulta tus clases del bimestre.", icono: "nav-calendar" },
  {
    href: "/docente/asistencia",
    titulo: "Asistencia",
    texto: "Registra la asistencia de tus estudiantes.",
    icono: "nav-usercheck",
  },
  {
    href: "/docente/notas",
    titulo: "Registro de notas",
    texto: "Ingresa calificaciones por competencia.",
    icono: "nav-award",
  },
  { href: "/docente/cursos", titulo: "Mis cursos", texto: "Materiales, enlaces y aula virtual.", icono: "nav-book" },
];

export default function InicioDocentePage() {
  const sesion = useSesionDocente();
  const [resumen, setResumen] = useState<unknown>(null);
  const [errorResumen, setErrorResumen] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api<unknown>(API.portal.docenteResumen)
      .then((d) => {
        setResumen(d);
        setErrorResumen(null);
      })
      .catch((e) => setErrorResumen(alertaError(e)))
      .finally(() => setCargando(false));
  }, []);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] leading-[1.4] text-texto-3">Inicio</p>
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Hola, {sesion.usuario.nombres}</h1>
        <p className="text-[16px] leading-[1.5] text-texto-2">Este es tu espacio de trabajo docente en Kubo.</p>
      </div>

      {cargando && (
        <div className="flex justify-center py-8">
          <Spinner claro={false} />
        </div>
      )}
      {!cargando && errorResumen && (
        <Alerta tipo="info" titulo="Indicadores del día">
          {errorResumen} Cuando el módulo portal esté disponible, verás aquí tus clases y pendientes.
        </Alerta>
      )}
      {!cargando && !errorResumen && resumen !== null && (
        <Tarjeta className="p-4">
          <pre className="overflow-x-auto text-[12px] text-texto-2">{JSON.stringify(resumen, null, 2)}</pre>
        </Tarjeta>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {ACCESOS.map((a) => (
          <Link key={a.href} href={a.href} className="group">
            <Tarjeta className="flex h-full flex-col gap-3 p-5 transition group-hover:border-kubo-azul">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[rgba(27,77,137,0.12)]">
                <Icono nombre={a.icono} size={20} />
              </div>
              <p className="text-[16px] font-semibold text-texto">{a.titulo}</p>
              <p className="text-[14px] leading-[1.4] text-texto-2">{a.texto}</p>
            </Tarjeta>
          </Link>
        ))}
      </div>
    </>
  );
}
