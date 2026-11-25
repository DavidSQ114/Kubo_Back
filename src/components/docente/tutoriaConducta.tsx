// Mi tutoría · Conducta (bloque M3): el tutor o cotutor registra y modifica la nota de conducta de cada alumno de la
// sección en el bimestre elegido (AD, A, B o C y un comentario opcional de hasta 500 caracteres) mientras el periodo no
// esté finalizado. Se ve en la libreta del apoderado y del alumno cuando el bimestre está publicado.
"use client";

import { useState } from "react";
import { BadgeLogro, NOMBRE_LOGRO } from "@/components/docente/notas";
import { mensajeError } from "@/components/portal";
import { CargandoAsistencia, ErrorAsistencia, useConsulta } from "@/components/portal/asistencia";
import { Alerta, Boton, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { diaYHora, fechaDia } from "@/lib/formato";
import { useTutoria } from "./tutoria";

type Logro = "AD" | "A" | "B" | "C";
const LOGROS: Logro[] = ["AD", "A", "B", "C"];
const LARGO_MAXIMO_COMENTARIO = 500;

interface Periodo {
  id: string;
  numero: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
}

interface ConductaDeLaSeccion {
  periodos: Periodo[];
  periodo: Periodo;
  editable: boolean;
  motivoSoloLectura: string | null;
  alumnos: {
    matriculaId: string;
    nombre: string;
    valor: Logro | null;
    comentario: string | null;
    actualizadaPor: string | null;
    actualizadaEn: string | null;
  }[];
  resumen: Record<Logro | "SIN_NOTA", number>;
}

interface Marca {
  valor: Logro | "";
  comentario: string;
}

/** Lista editable de la conducta del bimestre; el padre cambia la key al guardar o al cambiar de bimestre. */
function ListaConducta({
  seccionId,
  datos,
  onGuardado,
}: {
  seccionId: string;
  datos: ConductaDeLaSeccion;
  onGuardado: (d: ConductaDeLaSeccion, mensaje: string) => void;
}) {
  const [marcas, setMarcas] = useState<Record<string, Marca>>(() =>
    Object.fromEntries(
      datos.alumnos.map((a) => [a.matriculaId, { valor: a.valor ?? "", comentario: a.comentario ?? "" }]),
    ),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = datos.editable;
  const cambiar = (id: string, cambio: Partial<Marca>) => setMarcas((m) => ({ ...m, [id]: { ...m[id], ...cambio } }));
  // solo viajan los alumnos con nota; el servidor no toca las que quedan igual
  const conNota = datos.alumnos.filter((a) => marcas[a.matriculaId].valor !== "");
  const cambiadas = datos.alumnos.filter((a) => {
    const m = marcas[a.matriculaId];
    return m.valor !== (a.valor ?? "") || m.comentario.trim() !== (a.comentario ?? "");
  });
  const sinValorConComentario = datos.alumnos.some(
    (a) => marcas[a.matriculaId].valor === "" && marcas[a.matriculaId].comentario.trim() !== "",
  );

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const notas = conNota.map((a) => ({
        matriculaId: a.matriculaId,
        valor: marcas[a.matriculaId].valor,
        comentario: marcas[a.matriculaId].comentario.trim() || null,
      }));
      const r = await api<ConductaDeLaSeccion & { guardadas: { creadas: number; modificadas: number } }>(
        `/evaluacion/tutoria/${seccionId}/conducta/${datos.periodo.id}`,
        { method: "PUT", body: { notas } },
      );
      const { creadas, modificadas } = r.guardadas;
      onGuardado(
        r,
        creadas + modificadas
          ? `Conducta guardada: ${creadas} registradas y ${modificadas} modificadas.`
          : "No había cambios que guardar.",
      );
    } catch (e) {
      setError(mensajeError(e));
      setGuardando(false);
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-4 p-4 lg:p-5">
      {!editable && datos.motivoSoloLectura && <Alerta tipo="aviso" titulo={datos.motivoSoloLectura} />}
      {error && <Alerta tipo="error" titulo={error} />}
      <div className="overflow-hidden rounded-lg border border-borde">
        <div
          aria-hidden
          className="hidden border-b border-borde bg-fondo px-4 py-2.5 text-[13px] font-semibold text-texto-2 lg:grid lg:grid-cols-[32px_minmax(0,1fr)_150px_minmax(0,1.3fr)] lg:gap-4"
        >
          <span>N.º</span>
          <span>Estudiante</span>
          <span>Conducta</span>
          <span>Comentario (opcional)</span>
        </div>
        <ol className="flex flex-col divide-y divide-borde">
          {datos.alumnos.map((a, i) => {
            const m = marcas[a.matriculaId];
            return (
              <li
                key={a.matriculaId}
                className="flex flex-col gap-2 bg-white px-4 py-3 lg:grid lg:grid-cols-[32px_minmax(0,1fr)_150px_minmax(0,1.3fr)] lg:items-center lg:gap-4"
              >
                <span className="hidden text-[14px] text-texto-2 lg:block">{i + 1}</span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-medium leading-[1.4] text-texto">
                    <span className="text-texto-3 lg:hidden">{i + 1}. </span>
                    {a.nombre}
                  </span>
                  {a.actualizadaEn && (
                    <span className="text-[12px] leading-[1.4] text-texto-3">
                      {a.actualizadaPor ? `${a.actualizadaPor} · ` : ""}
                      {diaYHora(a.actualizadaEn)}
                    </span>
                  )}
                </div>
                {editable ? (
                  <select
                    aria-label={`Conducta de ${a.nombre}`}
                    value={m.valor}
                    disabled={guardando}
                    onChange={(e) => cambiar(a.matriculaId, { valor: e.target.value as Logro | "" })}
                    className="h-10 w-full rounded-md border border-borde bg-white px-3 text-[14px] font-semibold text-texto outline-none focus:border-kubo-azul"
                  >
                    <option value="">Sin nota</option>
                    {LOGROS.map((l) => (
                      <option key={l} value={l}>
                        {l} · {NOMBRE_LOGRO[l]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{a.valor ? <BadgeLogro logro={a.valor} /> : <span className="text-texto-3">—</span>}</span>
                )}
                {editable ? (
                  <input
                    aria-label={`Comentario de conducta de ${a.nombre}`}
                    value={m.comentario}
                    maxLength={LARGO_MAXIMO_COMENTARIO}
                    disabled={guardando}
                    onChange={(e) => cambiar(a.matriculaId, { comentario: e.target.value })}
                    placeholder="Agregar comentario"
                    className="h-10 w-full rounded-md border border-borde bg-white px-3 text-[13px] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul"
                  />
                ) : (
                  <span className="text-[13px] leading-[1.4] text-texto-2">{a.comentario || "—"}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
          <span className="text-[13px] leading-[1.4] text-texto-3">
            {sinValorConComentario
              ? "Un comentario necesita una nota de conducta: los alumnos sin nota no se guardan."
              : `${cambiadas.length} ${cambiadas.length === 1 ? "cambio" : "cambios"} sin guardar · el cambio queda en la auditoría`}
          </span>
          <Boton icono="check-blanco" onClick={guardar} cargando={guardando} disabled={conNota.length === 0}>
            Guardar conducta
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}

export function ConductaTutoria() {
  const t = useTutoria();
  const [periodoId, setPeriodoId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const ruta = `/evaluacion/tutoria/${t.seccion.id}/conducta${periodoId ? `?periodoId=${periodoId}` : ""}`;
  const { carga, reintentar, recargar } = useConsulta<ConductaDeLaSeccion>(ruta);

  if (carga.fase === "cargando") return <CargandoAsistencia />;
  if (carga.fase === "error") return <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />;
  const d = carga.datos;
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="flex flex-wrap items-end gap-4 p-4 lg:p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bimestre-conducta" className="text-[14px] font-semibold text-texto">
            Bimestre
          </label>
          <select
            id="bimestre-conducta"
            value={d.periodo.id}
            onChange={(e) => {
              setAviso(null);
              setPeriodoId(e.target.value);
            }}
            className="h-10 rounded-md border border-borde bg-white px-3 text-[14px] text-texto outline-none focus:border-kubo-azul"
          >
            {d.periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.estado === "FINALIZADO" ? " (finalizado)" : ""}
              </option>
            ))}
          </select>
        </div>
        <p className="min-w-[200px] flex-1 text-[13px] leading-[1.5] text-texto-3">
          Del {fechaDia(d.periodo.fechaInicio)} al {fechaDia(d.periodo.fechaFin)}. La conducta aparece en la libreta del
          apoderado y del alumno cuando el bimestre está publicado.
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Resumen de la conducta">
          {LOGROS.map((l) => (
            <li key={l} className="flex items-center gap-1.5 text-[13px] text-texto-2">
              <BadgeLogro logro={l} /> {d.resumen[l]}
            </li>
          ))}
          <li className="text-[13px] text-texto-3">Sin nota: {d.resumen.SIN_NOTA}</li>
        </ul>
      </Tarjeta>
      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      {d.alumnos.length === 0 ? (
        <Alerta tipo="info" titulo="La sección no tiene alumnos con matrícula vigente en este bimestre." />
      ) : (
        <ListaConducta
          key={`${d.periodo.id}-${version}`}
          seccionId={t.seccion.id}
          datos={d}
          onGuardado={(_, mensaje) => {
            setAviso(mensaje);
            setVersion((n) => n + 1);
            recargar();
          }}
        />
      )}
    </div>
  );
}
