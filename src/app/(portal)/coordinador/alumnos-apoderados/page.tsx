// «Alumnos y apoderados» del Coordinador académico (bloque M1; mismo estilo que AD-06): busca alumnos y apoderados,
// abre su detalle con vínculos e historial (D-12, US69) y modifica sus datos. Registrar uno nuevo lleva a AD-08 y AD-09.
// Las cuentas (suspender, reactivar, desbloquear) y las bajas siguen siendo del Administrador.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { alertaError } from "@/components/admin/PortalAdmin";
import { ModalPersona, type ModoPersona } from "@/components/admin/personas";
import { Alerta, Boton, Icono, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

const TAMANO = 10;

type Pestana = "alumnos" | "apoderados";

interface Fila {
  personaId: string;
  dni: string;
  nombreCompleto: string;
  detalle: string;
}

interface EstudianteListado {
  personaId: string;
  dni: string;
  nombreCompleto: string;
  gradoIngreso: string | null;
  apoderados: { nombreCompleto: string; parentesco: string; esPrincipal: boolean }[];
}

interface ApoderadoListado {
  personaId: string;
  dni: string;
  nombreCompleto: string;
  telefono: string | null;
  estudiantes: number;
}

interface Pagina<T> {
  items: T[];
  paginacion: { pagina: number; total: number; paginas: number };
}

const aFilaAlumno = (e: EstudianteListado): Fila => ({
  personaId: e.personaId,
  dni: e.dni,
  nombreCompleto: e.nombreCompleto,
  detalle: [
    e.gradoIngreso ? `Ingresó a ${e.gradoIngreso}` : null,
    e.apoderados.find((a) => a.esPrincipal)?.nombreCompleto ?? e.apoderados[0]?.nombreCompleto,
  ]
    .filter(Boolean)
    .join(" · "),
});

const aFilaApoderado = (a: ApoderadoListado): Fila => ({
  personaId: a.personaId,
  dni: a.dni,
  nombreCompleto: a.nombreCompleto,
  detalle: `${a.estudiantes} ${a.estudiantes === 1 ? "estudiante vinculado" : "estudiantes vinculados"}${a.telefono ? ` · ${a.telefono}` : ""}`,
});

export default function AlumnosApoderadosPage() {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>("alumnos");
  const [q, setQ] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState<{
    clave: string;
    filas?: Fila[];
    paginas?: number;
    total?: number;
    error?: string;
  } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<{ personaId: string; modo: ModoPersona } | null>(null);

  // la búsqueda espera a que se deje de escribir
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(q.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const clave = `${pestana}|${busqueda}|${pagina}|${recarga}`;
  useEffect(() => {
    let vigente = true;
    const consulta = new URLSearchParams({ pagina: String(pagina), tamano: String(TAMANO) });
    if (busqueda) consulta.set("q", busqueda);
    async function cargar() {
      try {
        const filas =
          pestana === "alumnos"
            ? await api<Pagina<EstudianteListado>>(`/comunidad/estudiantes?${consulta}`).then((r) => ({
                ...r,
                filas: r.items.map(aFilaAlumno),
              }))
            : await api<Pagina<ApoderadoListado>>(`/comunidad/apoderados?${consulta}`).then((r) => ({
                ...r,
                filas: r.items.map(aFilaApoderado),
              }));
        if (vigente)
          setResultado({ clave, filas: filas.filas, paginas: filas.paginacion.paginas, total: filas.paginacion.total });
      } catch (e) {
        if (vigente) setResultado({ clave, error: alertaError(e) });
      }
    }
    void cargar();
    return () => {
      vigente = false;
    };
  }, [clave, pestana, busqueda, pagina]);

  const actual = resultado?.clave === clave ? resultado : null;

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
          <p className="text-[14px] leading-[1.4] text-texto-3">Matrícula y pagos / Alumnos y apoderados</p>
          <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Alumnos y apoderados</h1>
          <p className="text-[16px] leading-[1.5] text-texto-2">
            Consulta y modifica los datos de alumnos y apoderados y revisa sus vínculos.
          </p>
        </div>
        <Boton
          variante="secundario"
          icono="icon-userplus"
          onClick={() => router.push("/coordinador/matricula/registrar-apoderado")}
        >
          Registrar apoderado
        </Boton>
        <Boton icono="icon-userplus-blanco" onClick={() => router.push("/coordinador/matricula/registrar-estudiante")}>
          Registrar estudiante
        </Boton>
      </div>

      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}

      <Tarjeta className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div role="tablist" aria-label="Personas" className="flex gap-6 border-b border-borde">
            {(
              [
                ["alumnos", "Alumnos"],
                ["apoderados", "Apoderados"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={pestana === valor}
                onClick={() => {
                  setPestana(valor);
                  setPagina(1);
                }}
                className={`-mb-px border-b-2 py-2.5 text-[15px] ${pestana === valor ? "border-kubo-azul font-semibold text-kubo-azul" : "border-transparent text-texto-2 hover:text-texto"}`}
              >
                {texto}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <label className="flex w-full max-w-[360px] items-center gap-2 rounded-lg border border-borde bg-white px-4 py-2.5 focus-within:border-kubo-azul">
            <Icono nombre="icon-search" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o DNI…"
              aria-label="Buscar por nombre o DNI"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-texto outline-none placeholder:text-texto-3"
            />
          </label>
        </div>

        {!actual ? (
          <div className="flex items-center justify-center gap-3 p-10 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando…
          </div>
        ) : actual.error ? (
          <Alerta tipo="error" titulo="No pudimos cargar la lista">
            <p>{actual.error}</p>
            <Boton variante="secundario" onClick={() => setRecarga((r) => r + 1)}>
              Reintentar
            </Boton>
          </Alerta>
        ) : !actual.filas?.length ? (
          <p className="p-6 text-center text-[14px] text-texto-2">
            {busqueda
              ? "No encontramos a nadie con esa búsqueda. Revisa el nombre o el DNI."
              : pestana === "alumnos"
                ? "Aún no hay alumnos registrados. Usa «Registrar estudiante» para agregar el primero."
                : "Aún no hay apoderados registrados. Usa «Registrar apoderado» para agregar el primero."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-borde text-[12px] uppercase tracking-[0.5px] text-texto-3">
                  <th className="py-2.5 pr-4 font-semibold">Nombre</th>
                  <th className="py-2.5 pr-4 font-semibold">DNI</th>
                  <th className="py-2.5 pr-4 font-semibold">
                    {pestana === "alumnos" ? "Grado y apoderado" : "Vínculos"}
                  </th>
                  <th className="py-2.5 font-semibold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {actual.filas.map((f) => (
                  <tr key={f.personaId} className="border-b border-borde last:border-0">
                    <td className="py-3 pr-4 font-semibold text-texto">{f.nombreCompleto}</td>
                    <td className="py-3 pr-4 text-texto-2">{f.dni}</td>
                    <td className="py-3 pr-4 text-texto-2">{f.detalle || "—"}</td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setAbierta({ personaId: f.personaId, modo: "detalle" })}
                        className="px-2 font-semibold text-kubo-azul hover:underline"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {actual?.paginas && actual.paginas > 1 ? (
          <div className="flex items-center justify-end gap-3 text-[14px] text-texto-2">
            <span>
              Página {pagina} de {actual.paginas} · {actual.total} en total
            </span>
            <Boton variante="secundario" onClick={() => setPagina((p) => p - 1)} disabled={pagina <= 1}>
              Anterior
            </Boton>
            <Boton variante="secundario" onClick={() => setPagina((p) => p + 1)} disabled={pagina >= actual.paginas}>
              Siguiente
            </Boton>
          </div>
        ) : null}
      </Tarjeta>

      {abierta && (
        <ModalPersona
          key={`${abierta.personaId}-${abierta.modo}`}
          personaId={abierta.personaId}
          modoInicial={abierta.modo}
          esYo={false}
          onCerrar={() => setAbierta(null)}
          onVerPersona={(personaId) => setAbierta({ personaId, modo: "detalle" })}
          onListo={(mensaje) => {
            setAbierta(null);
            setAviso(mensaje);
            setRecarga((r) => r + 1);
          }}
        />
      )}
    </>
  );
}
