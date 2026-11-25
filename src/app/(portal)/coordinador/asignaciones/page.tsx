// AD-07 · «Carga académica» (US14) como pantalla propia del Coordinador académico (bloque M1): elige un docente y el
// año, y asígnale los cursos y secciones que dictará. Antes se hacía al registrar al docente desde «Usuarios».
"use client";

import { useEffect, useState } from "react";
import { anioPorDefecto, type AnioAcademico } from "@/components/admin/anio";
import { CargaAcademica } from "@/components/admin/docentes";
import type { Docente } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

interface Catalogos {
  anios: AnioAcademico[];
  docentes: Docente[];
}

export default function AsignacionesDocentesPage() {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [docenteId, setDocenteId] = useState("");
  const [anioElegido, setAnioElegido] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const [anios, docentes] = await Promise.all([
          api<AnioAcademico[]>("/academico/anios"),
          api<Docente[]>("/comunidad/docentes"),
        ]);
        if (vigente) setCatalogos({ anios, docentes });
      } catch (e) {
        if (vigente) setError(alertaError(e));
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const anio = catalogos
    ? (catalogos.anios.find((a) => a.id === anioElegido) ?? anioPorDefecto(catalogos.anios))
    : undefined;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] leading-[1.4] text-texto-3">Configuración / Asignaciones docentes</p>
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Asignaciones docentes</h1>
        <p className="text-[16px] leading-[1.5] text-texto-2">
          Asigna a cada docente los cursos y secciones que dictará{anio ? ` en ${anio.anio}` : ""}.
        </p>
      </div>
      {error ? (
        <Alerta tipo="error" titulo="No pudimos cargar los docentes">
          <p>{error}</p>
          <Boton
            variante="secundario"
            onClick={() => {
              setError(null);
              setRecarga((r) => r + 1);
            }}
          >
            Reintentar
          </Boton>
        </Alerta>
      ) : !catalogos ? (
        <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando…
        </Tarjeta>
      ) : !catalogos.docentes.length ? (
        <Alerta tipo="info" titulo="Aún no hay docentes activos">
          El administrador registra a los docentes desde «Usuarios». Cuando haya alguno, podrás asignarle cursos aquí.
        </Alerta>
      ) : (
        <CargaAcademica
          docentes={catalogos.docentes}
          docenteId={docenteId}
          onDocente={setDocenteId}
          anios={catalogos.anios}
          anio={anio}
          onAnio={setAnioElegido}
        />
      )}
    </>
  );
}
