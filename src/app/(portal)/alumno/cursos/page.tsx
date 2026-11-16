// AL-05 · Mis cursos · Alumno (US49): cursos del plan de estudios de su sección, cada uno con su docente y sus horas
// semanales. Las clases virtuales, los materiales y los trabajos del Figma llegan con el aula virtual.
"use client";

import { useEffect, useState } from "react";
import { useAlumno } from "@/components/alumno/PortalAlumno";
import { EncabezadoPagina, mensajeError } from "@/components/portal";
import { Alerta, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

interface CursoDelAlumno {
  cursoId: string;
  codigo: string;
  nombre: string;
  horasSemanales: number;
  docente: { nombreCompleto: string; nombreCorto: string } | null;
}

interface MisCursos {
  anio: number;
  seccionCorta: string | null;
  cursos: CursoDelAlumno[];
}

type Carga = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; datos: MisCursos };

export default function MisCursosAlumnoPage() {
  const panel = useAlumno();
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    api<MisCursos>("/matricula/alumno/cursos")
      .then((datos) => vigente && setCarga({ fase: "listo", datos }))
      .catch((e) => vigente && setCarga({ fase: "error", mensaje: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, [intento]);

  const cursos = carga.fase === "listo" ? carga.datos.cursos : [];
  const descripcion =
    carga.fase === "listo" && cursos.length > 0
      ? `${cursos.length} ${cursos.length === 1 ? "curso" : "cursos"} de ${panel.seccionCorta ?? "tu sección"} en el año ${panel.anio}.`
      : `Los cursos de ${panel.seccionCorta ?? "tu sección"} y el docente de cada uno.`;

  return (
    <>
      <EncabezadoPagina titulo="Mis cursos" descripcion={descripcion} />
      {carga.fase === "cargando" && (
        <div className="flex justify-center py-16" role="status" aria-label="Cargando tus cursos">
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
      {carga.fase === "listo" && cursos.length === 0 && (
        <Alerta tipo="info" titulo="Tu sección aún no tiene cursos registrados">
          Cuando el colegio configure el plan de estudios de tu grado, verás aquí tus cursos y sus docentes.
        </Alerta>
      )}
      {cursos.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cursos.map((c) => (
            <li key={c.cursoId}>
              <Tarjeta className="flex h-full items-center gap-3 p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-kubo-azul/10 text-[12px] font-bold text-kubo-azul">
                  {c.codigo}
                </span>
                <div className="flex min-w-0 flex-1 flex-col leading-[1.4]">
                  <span className="text-[15px] font-semibold text-texto">{c.nombre}</span>
                  <span className={`text-[13px] ${c.docente ? "text-texto-2" : "text-texto-3"}`}>
                    {c.docente ? c.docente.nombreCompleto : "Docente por asignar"}
                  </span>
                </div>
                <span className="shrink-0 text-[13px] text-texto-3">
                  {c.horasSemanales} h<span className="sr-only"> semanales</span>
                </span>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
