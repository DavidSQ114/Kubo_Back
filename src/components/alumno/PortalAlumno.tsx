// Portal del Alumno (AL-01 · US49): panel simplificado con «Inicio», «Mis cursos», «Mi horario» y «Mi asistencia»
// (US52); «Mis notas» se muestra como «Próximamente» hasta que exista su módulo. Es la guardia de las páginas /alumno:
// exige sesión con perfil ALUMNO (RF04) y una matrícula vigente, que el servidor comprueba en cada consulta.
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PaginaCentrada, TarjetaAcceso } from "@/components/acceso";
import {
  EstructuraPortal,
  mensajeError,
  PantallaAviso,
  PantallaCargando,
  useSesionDeRol,
  type ItemNav,
} from "@/components/portal";
import { Alerta, Boton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

export interface PanelAlumno {
  estudiante: { estudianteId: string; nombres: string; nombreCompleto: string; iniciales: string };
  anio: number;
  /** «1° de secundaria». */
  grado: string | null;
  /** «A». */
  seccion: string | null;
  /** «1° A». */
  seccionCorta: string | null;
}

const AlumnoContext = createContext<PanelAlumno | null>(null);

/** Datos del alumno en sesión: su nombre y el grado y la sección de su matrícula vigente. */
export function useAlumno(): PanelAlumno {
  const panel = useContext(AlumnoContext);
  if (!panel) throw new Error("useAlumno debe usarse dentro del portal del alumno");
  return panel;
}

const NAVEGACION: ItemNav[] = [
  { texto: "Inicio", icono: "nav-home", href: "/alumno" },
  { texto: "Mis cursos", icono: "nav-book", href: "/alumno/cursos" },
  { texto: "Mi horario", icono: "nav-grid", href: "/alumno/horario" },
  { texto: "Mis notas", icono: "nav-award" },
  { texto: "Mi asistencia", icono: "nav-usercheck", href: "/alumno/asistencia" },
];

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "sin-matricula"; mensaje: string }
  | { fase: "listo"; panel: PanelAlumno };

export function PortalAlumno({ children }: { children: ReactNode }) {
  const sesion = useSesionDeRol("ALUMNO");
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!sesion) return;
    let vigente = true;
    api<PanelAlumno>("/matricula/alumno/panel")
      .then((panel) => vigente && setEstado({ fase: "listo", panel }))
      .catch((e) => {
        if (!vigente) return;
        if (e instanceof ApiError && e.codigo === "SIN_MATRICULA_VIGENTE") {
          setEstado({ fase: "sin-matricula", mensaje: e.message });
        } else setEstado({ fase: "error", mensaje: mensajeError(e) });
      });
    return () => {
      vigente = false;
    };
  }, [sesion, intento]);

  if (!sesion || estado.fase === "cargando") return <PantallaCargando />;
  if (estado.fase === "sin-matricula") {
    return (
      <PantallaAviso sesion={sesion} titulo="Tu portal aún no está disponible">
        {estado.mensaje}
      </PantallaAviso>
    );
  }
  if (estado.fase === "error") {
    return (
      <PaginaCentrada>
        <TarjetaAcceso>
          <Alerta tipo="error" titulo="No pudimos cargar tu información">
            {estado.mensaje}
          </Alerta>
          <Boton
            ancho
            onClick={() => {
              setEstado({ fase: "cargando" });
              setIntento((n) => n + 1);
            }}
          >
            Reintentar
          </Boton>
        </TarjetaAcceso>
      </PaginaCentrada>
    );
  }

  const { panel } = estado;
  const nombre = panel.estudiante.nombres.split(" ")[0];
  const aula = panel.grado && panel.seccion ? `${panel.grado} ${panel.seccion}` : `Año ${panel.anio}`;
  return (
    <AlumnoContext.Provider value={panel}>
      <EstructuraPortal
        sesion={sesion}
        inicio="/alumno"
        navegacion={NAVEGACION}
        saludo={`Hola, ${nombre} · ${aula}`}
        detallePerfil={panel.seccionCorta ? `Alumno · ${panel.seccionCorta}` : "Alumno"}
      >
        {children}
      </EstructuraPortal>
    </AlumnoContext.Provider>
  );
}
