// Notas por alumno · Coordinador académico (bloque M2; el Figma no tiene frame propio): busca un alumno del año por
// DNI o nombre y muestra su libreta completa, con todos los cursos y bimestres. Lo que aún no está publicado para el
// apoderado y el alumno sale marcado «Sin publicar» (cerrado, en registro o sin notas). Las competencias con ítems de
// evaluación muestran cada ítem con su peso y su calificativo.
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { LibretaCompleta } from "@/components/portal/notasDelAlumno";
import { Alerta, Boton, Campo, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

interface MatriculaEncontrada {
  matriculaId: string;
  estudiante: { nombreCompleto: string; dni: string };
  grado: string | null;
  seccion: { id: string; nombre: string } | null;
  estado: string;
}

const TAMANO_BUSQUEDA = 10;

export default function NotasPorAlumnoPage() {
  const [anios, setAnios] = useState<{ id: string; anio: number; estado: string }[]>([]);
  const [anioId, setAnioId] = useState("");
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<MatriculaEncontrada[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api<{ anios: { id: string; anio: number; estado: string }[]; anio: { id: string } | null }>(
      "/evaluacion/publicaciones",
    )
      .then((d) => {
        if (!vigente) return;
        setAnios(d.anios);
        setAnioId(d.anio?.id ?? d.anios[0]?.id ?? "");
      })
      .catch((e) => vigente && setError(alertaError(e)));
    return () => {
      vigente = false;
    };
  }, []);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    const q = texto.trim();
    if (q.length < 2) {
      setError("Escribe al menos 2 caracteres del nombre o el DNI.");
      return;
    }
    setBuscando(true);
    setError(null);
    setElegida(null);
    try {
      const params = new URLSearchParams({ anioId, q, pagina: "1", tamano: String(TAMANO_BUSQUEDA) });
      const r = await api<{ items: MatriculaEncontrada[] }>(`/matricula/matriculas?${params}`);
      setResultados(r.items);
      if (r.items.length === 1) setElegida(r.items[0].matriculaId);
    } catch (err) {
      setError(alertaError(err));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-texto-3">Académico / Notas por alumno</p>
        <h1 className="text-[28px] font-semibold text-texto">Notas por alumno</h1>
        <p className="text-[15px] text-texto-2">
          Busca a un alumno por su DNI o su nombre para ver su libreta completa del año, también lo que aún no se
          publica.
        </p>
      </div>

      <Tarjeta className="p-4 lg:p-5">
        <form onSubmit={buscar} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[160px_1fr_auto]">
          <Selector etiqueta="Año" valor={anioId} onCambiar={setAnioId}>
            {anios.map((a) => (
              <option key={a.id} value={a.id}>
                {a.anio}
              </option>
            ))}
          </Selector>
          <Campo
            etiqueta="DNI o nombre del alumno"
            icono="icon-search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej.: 71234567 o Castillo"
            maxLength={100}
          />
          <Boton type="submit" icono="icon-search" cargando={buscando} disabled={!anioId}>
            Buscar
          </Boton>
        </form>
      </Tarjeta>

      {error && <Alerta tipo="error" titulo={error} />}
      {resultados && resultados.length === 0 && (
        <Tarjeta className="p-8 text-center">
          <p className="text-[16px] font-semibold text-texto">No encontramos alumnos matriculados con esa búsqueda.</p>
          <p className="text-[14px] text-texto-2">Revisa el DNI o prueba con el apellido.</p>
        </Tarjeta>
      )}
      {resultados && resultados.length > 1 && (
        <Tarjeta className="p-2">
          <ul aria-label="Alumnos encontrados" className="flex flex-col">
            {resultados.map((m) => (
              <li key={m.matriculaId}>
                <button
                  type="button"
                  onClick={() => setElegida(m.matriculaId)}
                  aria-pressed={elegida === m.matriculaId}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-fondo ${elegida === m.matriculaId ? "bg-fondo" : ""}`}
                >
                  <span className="text-[14px] font-semibold text-texto">{m.estudiante.nombreCompleto}</span>
                  <span className="text-[13px] text-texto-3">
                    DNI {m.estudiante.dni} · {m.seccion?.nombre ?? m.grado ?? "Sin sección"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      {elegida && (
        <LibretaCompleta
          key={elegida}
          ruta={`/evaluacion/reportes/alumnos/${elegida}/notas`}
          mensajeDeError={alertaError}
        />
      )}
    </div>
  );
}
