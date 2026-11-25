// Solicitudes de matrícula (bloque M4): bandeja de las matrículas que los apoderados enviaron en línea, con filtro por
// estado; cada solicitud abre sus documentos para aprobarlos u observarlos y, con los obligatorios aprobados, asignar
// la sección. ?solicitud=<id> (enlace del aviso de la campana) la abre directamente. Solo Coordinador académico.
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { AnioAcademico } from "@/components/admin/anio";
import { Selector } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import {
  ESTADOS_SOLICITUD,
  fechaEnvio,
  ModalSolicitud,
  TONO_SOLICITUD,
  type DetalleSolicitud,
  type EstadoSolicitud,
  type SolicitudListada,
} from "@/components/coordinador/solicitudesMatricula";
import { Alerta, Badge, Boton, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";

interface Bandeja {
  items: SolicitudListada[];
  totales: Record<EstadoSolicitud, number>;
}

/** Año por defecto: el «En matrícula» y, si no hay, el «En curso». */
const anioPorDefecto = (anios: AnioAcademico[]) =>
  anios.find((a) => a.estado === "EN_MATRICULA") ?? anios.find((a) => a.estado === "EN_CURSO") ?? anios[0];

function PaginaSolicitudes() {
  const parametros = useSearchParams();
  const [anios, setAnios] = useState<AnioAcademico[] | null>(null);
  const [anioId, setAnioId] = useState("");
  const [estado, setEstado] = useState<EstadoSolicitud | "">("");
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [detalle, setDetalle] = useState<DetalleSolicitud | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);

  async function abrir(solicitudId: string) {
    setAbriendo(solicitudId);
    try {
      setDetalle(await api<DetalleSolicitud>(`/matricula/solicitudes/${solicitudId}`));
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setAbriendo(null);
    }
  }

  const desdeAviso = parametros.get("solicitud");
  useEffect(() => {
    api<AnioAcademico[]>("/academico/anios")
      .then((a) => {
        setAnios(a);
        setAnioId(anioPorDefecto(a)?.id ?? "");
      })
      .catch((e) => setError(alertaError(e)));
    if (desdeAviso) {
      api<DetalleSolicitud>(`/matricula/solicitudes/${desdeAviso}`)
        .then(setDetalle)
        .catch((e) => setError(alertaError(e)));
    }
  }, [desdeAviso]);

  useEffect(() => {
    if (!anioId) return;
    let vigente = true;
    const q = new URLSearchParams({ anioId });
    if (estado) q.set("estado", estado);
    api<Bandeja>(`/matricula/solicitudes?${q}`)
      .then((b) => {
        if (!vigente) return;
        setBandeja(b);
        setError(null);
      })
      .catch((e) => vigente && setError(alertaError(e)));
    return () => {
      vigente = false;
    };
  }, [anioId, estado, recarga]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-texto-3">Matrícula y pagos / Solicitudes de matrícula</p>
        <h1 className="text-[28px] font-semibold text-texto">Solicitudes de matrícula</h1>
        <p className="text-[15px] text-texto-2">
          Matrículas que los apoderados enviaron desde su portal. Revisa cada documento y, cuando los obligatorios estén
          aprobados, asigna la sección.
        </p>
      </div>
      {error && <Alerta tipo="error" titulo={error} />}
      {exito && <Alerta tipo="exito" titulo={exito} />}
      <Tarjeta className="flex flex-col gap-4 p-6">
        {!anios && !error && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando…
          </div>
        )}
        {anios && !anios.length && <Alerta tipo="info" titulo="Todavía no hay años académicos registrados." />}
        {anios && anios.length > 0 && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <Selector
                etiqueta="Año"
                valor={anioId}
                onCambiar={(v) => {
                  setBandeja(null);
                  setAnioId(v);
                }}
              >
                {anios.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.anio}
                  </option>
                ))}
              </Selector>
            </div>
            <div className="w-64">
              <Selector etiqueta="Estado" valor={estado} onCambiar={(v) => setEstado(v as EstadoSolicitud | "")}>
                <option value="">Todos los estados</option>
                {ESTADOS_SOLICITUD.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.texto}
                  </option>
                ))}
              </Selector>
            </div>
          </div>
        )}
        {anioId && !bandeja && !error && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando solicitudes…
          </div>
        )}
        {bandeja && !bandeja.items.length && (
          <p className="rounded-lg bg-fondo px-4 py-6 text-center text-[14px] text-texto-2">
            {estado
              ? "No hay solicitudes con ese estado."
              : "Todavía no hay solicitudes. Aparecen cuando un apoderado matricula a su hijo en línea."}
          </p>
        )}
        {bandeja && bandeja.items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-borde">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="bg-fondo text-texto-2">
                <tr>
                  {["Alumno", "Grado", "Apoderado", "Enviada", "Documentos", "Estado", ""].map((t) => (
                    <th key={t} className="px-3 py-2 font-semibold">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bandeja.items.map((s) => (
                  <tr key={s.solicitudId} className="border-t border-borde">
                    <td className="px-3 py-2">
                      <span className="font-semibold text-texto">{s.estudiante}</span>
                      <span className="block text-[12px] text-texto-3">{`DNI ${s.dni}`}</span>
                    </td>
                    <td className="px-3 py-2 text-texto-2">{s.grado}</td>
                    <td className="px-3 py-2 text-texto-2">{s.apoderado ?? "—"}</td>
                    <td className="px-3 py-2 text-texto-2">{fechaEnvio(s.enviadaEn)}</td>
                    <td className="px-3 py-2 text-texto-2">
                      {`${s.documentos.aprobados} aprobados`}
                      <span className="block text-[12px] text-texto-3">
                        {`${s.documentos.enRevision} en revisión · ${s.documentos.observados} observados`}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tono={TONO_SOLICITUD[s.estado]} punto>
                        {s.nombreEstado}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Boton
                        variante="secundario"
                        onClick={() => abrir(s.solicitudId)}
                        cargando={abriendo === s.solicitudId}
                      >
                        Revisar
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      {detalle && (
        <ModalSolicitud
          solicitud={detalle}
          onCerrar={() => {
            setDetalle(null);
            setRecarga((n) => n + 1);
          }}
          onCambio={setDetalle}
          onMatriculado={(mensaje) => {
            setDetalle(null);
            setExito(mensaje);
            setRecarga((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

export default function SolicitudesMatriculaPage() {
  // useSearchParams (?solicitud= desde el aviso de la campana) necesita un límite de Suspense
  return (
    <Suspense
      fallback={
        <Tarjeta className="flex items-center justify-center gap-3 p-12 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando…
        </Tarjeta>
      }
    >
      <PaginaSolicitudes />
    </Suspense>
  );
}
