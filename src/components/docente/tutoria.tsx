// Mi tutoría (bloque M3): piezas comunes del portal del tutor dentro del portal docente. El docente que es tutor o
// cotutor de una sección del año en curso ve el menú «Mi tutoría»; esta guardia carga su tutoría, muestra las
// pestañas (Inicio, Asistencia, Reporte, Conducta, Notas, Consolidado) y la pasa a cada pantalla por contexto. La
// protección real está en el servidor: cada ruta responde 403 NO_ES_TUTOR si no es tutor ni cotutor de la sección.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { EncabezadoPagina, mensajeError } from "@/components/portal";
import { Alerta, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

export interface Tutoria {
  rol: "TUTOR" | "COTUTOR";
  seccion: {
    id: string;
    nombre: string;
    etiqueta: string;
    grado: { id: string; numero: number; nombre: string };
  };
  anio: { id: string; anio: number };
}

const TutoriaContext = createContext<Tutoria | null>(null);

/** Tutoría del docente en sesión, dentro de las páginas de /docente/tutoria. */
export function useTutoria(): Tutoria {
  const t = useContext(TutoriaContext);
  if (!t) throw new Error("useTutoria debe usarse dentro de GuardiaTutoria");
  return t;
}

type CargaTutorias = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "listo"; tutorias: Tutoria[] };

/** Tutorías del docente en el año en curso (a lo más una). `null` mientras carga o si falló. */
export function useMisTutorias(): CargaTutorias {
  const [carga, setCarga] = useState<CargaTutorias>({ fase: "cargando" });
  useEffect(() => {
    let vigente = true;
    api<{ tutorias: Tutoria[] }>("/academico/mi-tutoria")
      .then((d) => vigente && setCarga({ fase: "listo", tutorias: d.tutorias }))
      .catch((e) => vigente && setCarga({ fase: "error", mensaje: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, []);
  return carga;
}

const PESTANAS = [
  { texto: "Inicio", href: "/docente/tutoria" },
  { texto: "Asistencia", href: "/docente/tutoria/asistencia" },
  { texto: "Reporte de faltas", href: "/docente/tutoria/reporte" },
  { texto: "Conducta", href: "/docente/tutoria/conducta" },
  { texto: "Notas por alumno", href: "/docente/tutoria/notas" },
  { texto: "Consolidado", href: "/docente/tutoria/consolidado" },
  { texto: "Justificaciones", href: "/docente/tutoria/justificaciones" },
];

function Pestanas() {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones de la tutoría" className="-mx-1 overflow-x-auto [scrollbar-width:thin]">
      <ul className="flex min-w-max gap-1 border-b border-borde px-1">
        {PESTANAS.map((p) => {
          const activa = p.href === "/docente/tutoria" ? ruta === p.href : ruta.startsWith(p.href);
          return (
            <li key={p.href}>
              <Link
                href={p.href}
                aria-current={activa ? "page" : undefined}
                className={`-mb-px inline-flex border-b-2 px-3 py-2.5 text-[14px] leading-[1.4] whitespace-nowrap ${
                  activa
                    ? "border-kubo-azul font-semibold text-kubo-azul"
                    : "border-transparent font-medium text-texto-2 hover:text-texto"
                }`}
              >
                {p.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Guardia y marco de las páginas de la tutoría: encabezado con la sección, pestañas y el contexto. */
export function GuardiaTutoria({ children }: { children: ReactNode }) {
  const carga = useMisTutorias();
  if (carga.fase === "cargando") {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Cargando tu tutoría">
        <Spinner claro={false} />
      </div>
    );
  }
  if (carga.fase === "error")
    return (
      <Alerta tipo="error" titulo="No pudimos cargar tu tutoría">
        {carga.mensaje}
      </Alerta>
    );
  const tutoria = carga.tutorias[0];
  if (!tutoria) {
    return (
      <div className="flex flex-col gap-6">
        <EncabezadoPagina titulo="Mi tutoría" />
        <Alerta tipo="info" titulo="No tienes una tutoría este año">
          La coordinación académica asigna al tutor y al cotutor de cada sección en «Grados y secciones».
        </Alerta>
      </div>
    );
  }
  return (
    <TutoriaContext.Provider value={tutoria}>
      <div className="flex flex-col gap-6">
        <EncabezadoPagina
          titulo={`Mi tutoría · ${tutoria.seccion.etiqueta}`}
          descripcion={`${tutoria.seccion.grado.nombre} · Año ${tutoria.anio.anio} · ${
            tutoria.rol === "TUTOR" ? "Tutor" : "Cotutor"
          } de la sección`}
        />
        <Pestanas />
        {children}
      </div>
    </TutoriaContext.Provider>
  );
}

/** Tarjeta con un número grande (inicio de la tutoría). */
export function Indicador({
  valor,
  texto,
  detalle,
  tono = "text-texto",
}: {
  valor: ReactNode;
  texto: string;
  detalle?: string;
  tono?: string;
}) {
  return (
    <Tarjeta className="flex flex-col gap-1 p-4">
      <span className={`text-[28px] font-bold leading-[1.2] ${tono}`}>{valor}</span>
      <span className="text-[14px] font-semibold leading-[1.4] text-texto">{texto}</span>
      {detalle && <span className="text-[12px] leading-[1.4] text-texto-3">{detalle}</span>}
    </Tarjeta>
  );
}
