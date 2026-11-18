// DO-01 · Inicio · Docente (US34, US14, US35, US37): saludo, acceso a «Mi horario», a «Asistencia» y al «Registro de
// notas», y los cursos y secciones que tiene asignados. La clase en curso del Figma llega con su módulo.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EncabezadoPagina, mensajeError, useSesionPortal } from "@/components/portal";
import { Alerta, Badge, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaLarga, hoyEnLima } from "@/lib/formato";

interface MiCurso {
  id: string;
  anio: { anio: number };
  curso: { nombre: string };
  grado: { numero: number };
  seccion: { nombre: string };
  horasSemanales: number;
  horarioPublicado: boolean;
}

type Carga = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; cursos: MiCurso[] };

/** Cursos y secciones asignados al docente en sesión (US14, criterio 1). */
function MisCursos() {
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    api<MiCurso[]>("/academico/mis-cursos")
      .then((cursos) => vigente && setCarga({ fase: "listo", cursos }))
      .catch((e) => vigente && setCarga({ fase: "error", mensaje: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, [intento]);

  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <h2 className="text-[18px] font-semibold leading-[1.3] text-texto">Mis cursos</h2>
      {carga.fase === "cargando" && (
        <div className="flex justify-center py-6">
          <Spinner claro={false} />
        </div>
      )}
      {carga.fase === "error" && (
        <Alerta tipo="error" titulo="No pudimos cargar tus cursos">
          {carga.mensaje}{" "}
          <button
            type="button"
            onClick={() => {
              setCarga({ fase: "cargando" });
              setIntento((n) => n + 1);
            }}
            className="font-semibold text-kubo-azul underline"
          >
            Reintentar
          </button>
        </Alerta>
      )}
      {carga.fase === "listo" && carga.cursos.length === 0 && (
        <p className="text-[14px] leading-[1.5] text-texto-3">
          Aún no tienes cursos asignados. Cuando la administración te asigne cursos, aparecerán aquí.
        </p>
      )}
      {carga.fase === "listo" && carga.cursos.length > 0 && (
        <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {carga.cursos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[14px]">
              <span className="min-w-0 flex-1 font-semibold text-texto">
                {c.curso.nombre} · {c.grado.numero}° {c.seccion.nombre}
              </span>
              <span className="text-texto-3">
                {c.horasSemanales} h semanales · {c.anio.anio}
              </span>
              <Badge tono={c.horarioPublicado ? "verde" : "gris"}>
                {c.horarioPublicado ? "Horario publicado" : "Horario sin publicar"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

export default function InicioDocentePage() {
  const sesion = useSesionPortal();
  return (
    <>
      <EncabezadoPagina
        titulo={`¡Hola, ${sesion.usuario.nombres.split(" ")[0]}!`}
        descripcion={`Hoy es ${fechaLarga(hoyEnLima())}.`}
      />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-6">
          <Link
            href="/docente/asistencia"
            className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-5 shadow-tarjeta hover:border-kubo-azul"
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-kubo-azul/10">
              <Icono nombre="nav-usercheck-azul" size={24} />
            </span>
            <span className="text-[18px] font-semibold leading-[1.3] text-texto">Asistencia</span>
            <span className="text-[14px] leading-[1.5] text-texto-2">
              Registra la asistencia de tus clases de hoy y corrige tus registros dentro del plazo.
            </span>
            <span className="text-[14px] font-semibold text-kubo-azul">Tomar asistencia</span>
          </Link>
          <Link
            href="/docente/notas"
            className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-5 shadow-tarjeta hover:border-kubo-azul"
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-kubo-azul/10">
              <Icono nombre="nav-award-azul" size={24} />
            </span>
            <span className="text-[18px] font-semibold leading-[1.3] text-texto">Registro de notas</span>
            <span className="text-[14px] leading-[1.5] text-texto-2">
              Califica cada competencia con AD, A, B o C y cierra el registro del bimestre.
            </span>
            <span className="text-[14px] font-semibold text-kubo-azul">Registrar notas</span>
          </Link>
          <Link
            href="/docente/horario"
            className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-5 shadow-tarjeta hover:border-kubo-azul"
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-kubo-azul/10">
              <Icono nombre="nav-grid-azul" size={24} />
            </span>
            <span className="text-[18px] font-semibold leading-[1.3] text-texto">Mi horario</span>
            <span className="text-[14px] leading-[1.5] text-texto-2">
              Tus clases de la semana con su curso, sección y aula, de todas tus secciones publicadas.
            </span>
            <span className="text-[14px] font-semibold text-kubo-azul">Ver horario</span>
          </Link>
        </div>
        <MisCursos />
      </div>
    </>
  );
}
