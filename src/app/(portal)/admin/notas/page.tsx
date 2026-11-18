// AD-15 · Notas y rectificaciones · Administrador (US39, criterio 4; US41): registros cerrados por los docentes por
// año, bimestre y grado, con «Ver» (el registro en solo lectura) y «Publicar» o «Publicar seleccionados». Publicar pasa
// el registro a PUBLICADO: desde ese momento el apoderado y el alumno ven sus notas, y se avisa por correo a los
// apoderados. La pestaña «Solicitudes de rectificación» es la bandeja para aprobar o rechazar las de los docentes.
"use client";

import { useEffect, useState } from "react";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { BandejaRectificaciones } from "@/components/admin/rectificaciones";
import { GrillaNotas, LeyendaLogros, type RegistroDeNotas } from "@/components/docente/notas";
import { Alerta, Badge, Boton, Icono, Modal, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { cantidad, diaYHora } from "@/lib/formato";

interface RegistroPublicable {
  cierreId: string;
  asignacionId: string;
  bimestre: { id: string; numero: number; nombre: string };
  curso: { id: string; codigo: string; nombre: string };
  grado: { id: string; numero: number; nombre: string };
  seccion: { id: string; nombre: string; etiqueta: string };
  docente: string | null;
  estado: "CERRADO" | "PUBLICADO";
  cerradoEn: string | null;
  cerradoPor: string | null;
  publicadoEn: string | null;
  publicadoPor: string | null;
  estudiantes: number;
}

interface Publicaciones {
  anios: { id: string; anio: number; estado: string }[];
  anio: { id: string; anio: number; estado: string } | null;
  bimestres: { id: string; numero: number; nombre: string }[];
  grados: { id: string; numero: number; nombre: string }[];
  porPublicar: RegistroPublicable[];
  publicados: RegistroPublicable[];
}

interface NotasPublicadas {
  publicados: RegistroPublicable[];
  aviso: { apoderados: number; enviados: number };
}

type Pestana = "porPublicar" | "rectificaciones" | "publicados";
type PestanaRegistros = Exclude<Pestana, "rectificaciones">;

interface Filtros {
  anioId: string;
  periodoId: string;
  gradoId: string;
}

const consulta = (f: Filtros) =>
  new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

export default function NotasAdminPage() {
  const [filtros, setFiltros] = useState<Filtros>({ anioId: "", periodoId: "", gradoId: "" });
  const [datos, setDatos] = useState<Publicaciones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [pestana, setPestana] = useState<Pestana>("porPublicar");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState<RegistroPublicable[] | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<NotasPublicadas | null>(null);
  const [viendo, setViendo] = useState<RegistroPublicable | null>(null);
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [intentoPendientes, setIntentoPendientes] = useState(0);

  useEffect(() => {
    let vigente = true;
    api<Publicaciones>(`/evaluacion/publicaciones?${consulta(filtros)}`)
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        setError(null);
      })
      .catch((e) => vigente && setError(alertaError(e)));
    return () => {
      vigente = false;
    };
  }, [filtros, intento]);

  // número de solicitudes pendientes para la pestaña (la bandeja avisa cuando cambia)
  useEffect(() => {
    let vigente = true;
    api<{ pendientes: number }>("/evaluacion/rectificaciones?estado=PENDIENTES&tamano=1")
      .then((d) => vigente && setPendientes(d.pendientes))
      .catch(() => vigente && setPendientes(null));
    return () => {
      vigente = false;
    };
  }, [intentoPendientes]);

  const cambiar = (c: Partial<Filtros>) => {
    setSeleccion(new Set());
    setFiltros((f) => ({ ...f, ...c }));
  };
  const lista = datos && pestana !== "rectificaciones" ? datos[pestana] : [];
  const elegidos = datos ? datos.porPublicar.filter((r) => seleccion.has(r.cierreId)) : [];

  async function publicar(registros: RegistroPublicable[]) {
    setPublicando(true);
    try {
      const r = await api<NotasPublicadas>("/evaluacion/publicaciones", {
        method: "POST",
        body: { cierreIds: registros.map((x) => x.cierreId) },
      });
      setResultado(r);
      setSeleccion(new Set());
      setConfirmar(null);
      setError(null);
      setIntento((n) => n + 1);
    } catch (e) {
      setConfirmar(null);
      setError(alertaError(e));
      setIntento((n) => n + 1);
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-texto-3">Académico / Notas y rectificaciones</p>
        <h1 className="text-[28px] font-semibold text-texto">Notas y rectificaciones</h1>
        <p className="text-[15px] text-texto-2">
          Revisa los registros consolidados por los docentes, publícalos para los apoderados y los alumnos y atiende las
          solicitudes de rectificación.
        </p>
      </div>

      <div role="tablist" aria-label="Registros" className="flex gap-6 border-b border-borde">
        {(
          [
            ["porPublicar", "Registros por publicar"],
            ["rectificaciones", "Solicitudes de rectificación"],
            ["publicados", "Publicados"],
          ] as const
        ).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => {
              setPestana(clave);
              setViendo(null);
            }}
            className={`-mb-px border-b-2 py-2.5 text-[15px] ${pestana === clave ? "border-kubo-azul font-semibold text-kubo-azul" : "border-transparent text-texto-2 hover:text-texto"}`}
          >
            {texto}{" "}
            {clave === "rectificaciones"
              ? pendientes !== null
                ? `(${pendientes})`
                : ""
              : datos
                ? `(${datos[clave].length})`
                : ""}
          </button>
        ))}
      </div>

      {pestana === "rectificaciones" && <BandejaRectificaciones onCambio={() => setIntentoPendientes((n) => n + 1)} />}

      {pestana !== "rectificaciones" && error && <Alerta tipo="error" titulo={error} />}
      {pestana !== "rectificaciones" && resultado && (
        <Alerta tipo="exito" titulo="Notas publicadas.">
          {`Se ${resultado.publicados.length === 1 ? "publicó" : "publicaron"} ${cantidad(resultado.publicados.length, "registro", "registros")}: los apoderados y los alumnos ya ven esas notas. `}
          {resultado.aviso.apoderados === 0
            ? "No había apoderados con correo a quienes avisar."
            : resultado.aviso.enviados === resultado.aviso.apoderados
              ? `Se avisó por correo a ${cantidad(resultado.aviso.apoderados, "apoderado", "apoderados")}.`
              : `Se avisó por correo a ${resultado.aviso.enviados} de ${cantidad(resultado.aviso.apoderados, "apoderado", "apoderados")}; la publicación no se revirtió.`}
        </Alerta>
      )}

      {pestana !== "rectificaciones" && (
        <Tarjeta className="flex flex-col gap-4 p-6">
          {!datos && !error && (
            <div className="flex items-center gap-3 text-[14px] text-texto-2">
              <Spinner claro={false} /> Cargando…
            </div>
          )}
          {datos && !datos.anio && <Alerta tipo="info" titulo="Todavía no hay años académicos registrados." />}
          {datos?.anio && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-32">
                  <Selector
                    etiqueta="Año"
                    valor={datos.anio.id}
                    onCambiar={(v) => cambiar({ anioId: v, periodoId: "", gradoId: "" })}
                  >
                    {datos.anios.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.anio}
                      </option>
                    ))}
                  </Selector>
                </div>
                <div className="w-44">
                  <Selector etiqueta="Bimestre" valor={filtros.periodoId} onCambiar={(v) => cambiar({ periodoId: v })}>
                    <option value="">Todos</option>
                    {datos.bimestres.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre}
                      </option>
                    ))}
                  </Selector>
                </div>
                <div className="w-52">
                  <Selector etiqueta="Grado" valor={filtros.gradoId} onCambiar={(v) => cambiar({ gradoId: v })}>
                    <option value="">Todos los grados</option>
                    {datos.grados.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                  </Selector>
                </div>
                {pestana === "porPublicar" && (
                  <Boton
                    className="ml-auto"
                    icono="icon-send"
                    disabled={elegidos.length === 0}
                    onClick={() => setConfirmar(elegidos)}
                  >
                    Publicar seleccionados ({elegidos.length})
                  </Boton>
                )}
              </div>
              <TablaRegistros
                lista={lista}
                pestana={pestana}
                seleccion={seleccion}
                onSeleccion={setSeleccion}
                onVer={setViendo}
                onPublicar={(r) => setConfirmar([r])}
              />
              <Alerta tipo="info">
                Un registro «Cerrado» solo es visible para el docente y la administración hasta que lo publiques. Luego
                aparece en la libreta del alumno y del apoderado, y sigue sin poder modificarse.
              </Alerta>
            </>
          )}
        </Tarjeta>
      )}

      {viendo && <DetalleRegistro registro={viendo} onCerrar={() => setViendo(null)} />}

      <Modal
        abierto={!!confirmar}
        onCerrar={() => !publicando && setConfirmar(null)}
        icono="icon-send"
        tonoIcono="azul"
        titulo="Publicar notas"
        subtitulo={confirmar ? cantidad(confirmar.length, "registro cerrado", "registros cerrados") : undefined}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setConfirmar(null)} disabled={publicando}>
              Cancelar
            </Boton>
            <Boton icono="icon-send" cargando={publicando} onClick={() => confirmar && void publicar(confirmar)}>
              Publicar
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[14px] leading-[1.5] text-texto-2">
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {confirmar?.map((r) => (
              <li key={r.cierreId} className="text-texto">
                {r.curso.nombre} · {r.seccion.etiqueta} · {r.bimestre.nombre}
              </li>
            ))}
          </ul>
          <p>
            Al publicar, los apoderados y los alumnos verán las notas de estos registros y se avisará por correo a los
            apoderados vinculados. Las notas siguen sin poder modificarse.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function TablaRegistros({
  lista,
  pestana,
  seleccion,
  onSeleccion,
  onVer,
  onPublicar,
}: {
  lista: RegistroPublicable[];
  pestana: PestanaRegistros;
  seleccion: Set<string>;
  onSeleccion: (s: Set<string>) => void;
  onVer: (r: RegistroPublicable) => void;
  onPublicar: (r: RegistroPublicable) => void;
}) {
  if (lista.length === 0) {
    return (
      <p className="rounded-lg border border-borde bg-fondo px-4 py-8 text-center text-[14px] text-texto-2">
        {pestana === "porPublicar"
          ? "No hay registros cerrados por publicar con estos filtros. Aparecen aquí cuando un docente cierra su registro del bimestre."
          : "Aún no hay registros publicados con estos filtros."}
      </p>
    );
  }
  const porPublicar = pestana === "porPublicar";
  const todos = lista.every((r) => seleccion.has(r.cierreId));
  const alternar = (id: string, marcado: boolean) => {
    const s = new Set(seleccion);
    if (marcado) s.add(id);
    else s.delete(id);
    onSeleccion(s);
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-borde">
      <table className="w-full min-w-[820px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-borde bg-fondo text-[13px] font-semibold text-texto-2">
            {porPublicar && (
              <th scope="col" className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={todos}
                  onChange={(e) => onSeleccion(e.target.checked ? new Set(lista.map((r) => r.cierreId)) : new Set())}
                  className="size-4 accent-kubo-azul"
                />
              </th>
            )}
            <th scope="col" className="px-4 py-3">
              Curso y docente
            </th>
            <th scope="col" className="px-4 py-3">
              Sección
            </th>
            <th scope="col" className="px-4 py-3">
              Bimestre
            </th>
            <th scope="col" className="px-4 py-3">
              Estudiantes
            </th>
            <th scope="col" className="px-4 py-3">
              Estado
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {lista.map((r) => (
            <tr key={r.cierreId} className="border-b border-borde last:border-b-0">
              {porPublicar && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${r.curso.nombre} ${r.seccion.etiqueta}`}
                    checked={seleccion.has(r.cierreId)}
                    onChange={(e) => alternar(r.cierreId, e.target.checked)}
                    className="size-4 accent-kubo-azul"
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <span className="block font-semibold text-texto">{r.curso.nombre}</span>
                <span className="block text-[12px] text-texto-3">
                  {r.docente ?? "Docente"}
                  {r.estado === "PUBLICADO" && r.publicadoEn
                    ? ` · publicó ${r.publicadoPor ?? "la administración"} el ${diaYHora(r.publicadoEn)}`
                    : r.cerradoEn
                      ? ` · cerró el ${diaYHora(r.cerradoEn)}`
                      : ""}
                </span>
              </td>
              <td className="px-4 py-3 text-texto">{r.seccion.etiqueta}</td>
              <td className="px-4 py-3 text-texto">{r.bimestre.nombre}</td>
              <td className="px-4 py-3 text-texto">{r.estudiantes}</td>
              <td className="px-4 py-3">
                <Badge tono={r.estado === "PUBLICADO" ? "verde" : "celeste"} punto>
                  {r.estado === "PUBLICADO" ? "Publicado" : "Cerrado"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Boton variante="secundario" onClick={() => onVer(r)}>
                    <Icono nombre="act-eye" size={16} />
                    Ver
                  </Boton>
                  {porPublicar && (
                    <Boton icono="icon-send" onClick={() => onPublicar(r)}>
                      Publicar
                    </Boton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** El registro consolidado en solo lectura: notas por competencia y el logro del curso de cada alumno. */
function DetalleRegistro({ registro, onCerrar }: { registro: RegistroPublicable; onCerrar: () => void }) {
  const [estado, setEstado] = useState<{ id: string; datos?: RegistroDeNotas; error?: string } | null>(null);
  useEffect(() => {
    let vigente = true;
    api<RegistroDeNotas>(`/evaluacion/publicaciones/${registro.cierreId}`)
      .then((datos) => vigente && setEstado({ id: registro.cierreId, datos }))
      .catch((e) => vigente && setEstado({ id: registro.cierreId, error: alertaError(e) }));
    return () => {
      vigente = false;
    };
  }, [registro.cierreId]);
  const actual = estado?.id === registro.cierreId ? estado : null;
  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] font-semibold text-texto">
            {registro.curso.nombre} {registro.seccion.etiqueta} · {registro.bimestre.nombre}
          </h2>
          <p className="text-[14px] text-texto-3">
            {registro.docente ?? "Docente"} · {cantidad(registro.estudiantes, "estudiante", "estudiantes")}
            {actual?.datos?.regla ? ` · ${actual.datos.regla.nombre} (versión ${actual.datos.regla.version})` : ""}
          </p>
        </div>
        <Boton variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
      {!actual && (
        <div className="flex items-center gap-3 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando el registro…
        </div>
      )}
      {actual?.error && <Alerta tipo="error" titulo={actual.error} />}
      {actual?.datos && (
        <>
          <LeyendaLogros />
          <GrillaNotas registro={actual.datos} ediciones={{}} invalidas={new Set()} onCambiar={() => undefined} />
        </>
      )}
    </Tarjeta>
  );
}
