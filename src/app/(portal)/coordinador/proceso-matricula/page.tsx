// Proceso de matrícula (bloque M4): por año, las fechas en que los apoderados matriculan a sus hijos desde su portal
// y los documentos que deben subir (nombre y si es obligatorio). Solo Coordinador académico.
"use client";

import { useEffect, useState } from "react";
import type { AnioAcademico } from "@/components/admin/anio";
import { Selector, separarErrores } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Campo, Casilla, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia } from "@/lib/formato";

type EstadoProceso = "SIN_CONFIGURAR" | "PROXIMO" | "ABIERTO" | "CERRADO";

interface Proceso {
  anio: { id: string; anio: number; estado: string; nombreEstado: string };
  configurado: boolean;
  estado: EstadoProceso;
  nombreEstado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  actualizadoEn: string | null;
  documentos: { documentoId: string; nombre: string; obligatorio: boolean }[];
  sugeridos: { nombre: string; obligatorio: boolean }[];
}

interface Fila {
  /** Clave local estable para la lista (el id del documento o una nueva). */
  clave: string;
  id: string | null;
  nombre: string;
  obligatorio: boolean;
}

const TONO_ESTADO: Record<EstadoProceso, "gris" | "celeste" | "verde" | "ambar"> = {
  SIN_CONFIGURAR: "gris",
  PROXIMO: "celeste",
  ABIERTO: "verde",
  CERRADO: "ambar",
};
const MAXIMO_DOCUMENTOS = 15;

let secuencia = 0;
const nuevaClave = () => `nuevo-${++secuencia}`;

/** Año por defecto: el «En matrícula» y, si no hay, el «En curso». */
const anioPorDefecto = (anios: AnioAcademico[]) =>
  anios.find((a) => a.estado === "EN_MATRICULA") ?? anios.find((a) => a.estado === "EN_CURSO") ?? anios[0];

function Formulario({ proceso, onGuardado }: { proceso: Proceso; onGuardado: (p: Proceso) => void }) {
  const [inicio, setInicio] = useState(proceso.fechaInicio ?? "");
  const [fin, setFin] = useState(proceso.fechaFin ?? "");
  const [filas, setFilas] = useState<Fila[]>(() =>
    proceso.configurado
      ? proceso.documentos.map((d) => ({
          clave: d.documentoId,
          id: d.documentoId,
          nombre: d.nombre,
          obligatorio: d.obligatorio,
        }))
      : proceso.sugeridos.map((d) => ({ clave: nuevaClave(), id: null, ...d })),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cerrado = proceso.anio.estado === "CERRADO";

  const cambiar = (clave: string, c: Partial<Fila>) =>
    setFilas((f) => f.map((x) => (x.clave === clave ? { ...x, ...c } : x)));

  async function guardar() {
    const e: Record<string, string> = {};
    if (!inicio) e.fechaInicio = "Elige la fecha de inicio";
    if (!fin) e.fechaFin = "Elige la fecha de fin";
    if (inicio && fin && inicio > fin) e.fechaFin = "La fecha de fin no puede ser anterior al inicio";
    if (filas.some((f) => !f.nombre.trim())) e.documentos = "Escribe el nombre de cada documento";
    if (!filas.length) e.documentos = "Agrega al menos un documento requerido";
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    setGeneral(null);
    try {
      const p = await api<Proceso>(`/matricula/procesos/${proceso.anio.id}`, {
        method: "PUT",
        body: {
          fechaInicio: inicio,
          fechaFin: fin,
          documentos: filas.map((f) => ({ id: f.id, nombre: f.nombre.trim(), obligatorio: f.obligatorio })),
        },
      });
      onGuardado(p);
    } catch (err) {
      const r = separarErrores(err);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!proceso.configurado && (
        <Alerta tipo="info" titulo={`La matrícula ${proceso.anio.anio} en línea todavía no está configurada`}>
          Se propone una lista de documentos habitual. Revísala, fija las fechas y guarda para abrir la matrícula en el
          portal del apoderado.
        </Alerta>
      )}
      {cerrado && <Alerta tipo="aviso" titulo="El año está cerrado: su proceso de matrícula ya no cambia." />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Inicio de la matrícula"
          obligatorio
          type="date"
          value={inicio}
          error={errores.fechaInicio}
          disabled={cerrado}
          onChange={(e) => setInicio(e.target.value)}
        />
        <Campo
          etiqueta="Fin de la matrícula"
          obligatorio
          type="date"
          min={inicio || undefined}
          value={fin}
          error={errores.fechaFin}
          disabled={cerrado}
          onChange={(e) => setFin(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-texto">Documentos requeridos</h2>
          <span className="text-[13px] text-texto-3">{`${filas.length} de ${MAXIMO_DOCUMENTOS}`}</span>
        </div>
        <p className="text-[13px] text-texto-3">
          El apoderado sube cada documento en PDF o JPG (hasta 5 MB). Los obligatorios deben estar aprobados antes de
          asignar la sección.
        </p>
        <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {filas.map((f, i) => (
            <li key={f.clave} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="w-5 text-[13px] text-texto-3">{i + 1}</span>
              <input
                aria-label={`Nombre del documento ${i + 1}`}
                maxLength={100}
                value={f.nombre}
                disabled={cerrado}
                onChange={(e) => cambiar(f.clave, { nombre: e.target.value })}
                className="min-w-[200px] flex-1 rounded-lg border border-borde bg-white px-3 py-2 text-[15px] text-texto outline-none focus:border-kubo-azul"
              />
              <Casilla
                etiqueta="Obligatorio"
                checked={f.obligatorio}
                deshabilitada={cerrado}
                onChange={(v) => cambiar(f.clave, { obligatorio: v })}
              />
              <button
                type="button"
                disabled={cerrado}
                onClick={() => setFilas((x) => x.filter((y) => y.clave !== f.clave))}
                className="text-[14px] font-semibold text-rojo-oscuro hover:underline disabled:opacity-40"
              >
                Quitar
              </button>
            </li>
          ))}
          {!filas.length && <li className="px-3 py-4 text-center text-[14px] text-texto-3">Sin documentos.</li>}
        </ul>
        {errores.documentos && <p className="text-[13px] text-rojo-oscuro">{errores.documentos}</p>}
        <div>
          <Boton
            variante="secundario"
            disabled={cerrado || filas.length >= MAXIMO_DOCUMENTOS}
            onClick={() => setFilas((x) => [...x, { clave: nuevaClave(), id: null, nombre: "", obligatorio: true }])}
          >
            Agregar documento
          </Boton>
        </div>
      </div>
      {general && <Alerta tipo="error" titulo={general} />}
      {!cerrado && (
        <div className="flex justify-end">
          <Boton icono="check-blanco" onClick={guardar} cargando={guardando}>
            Guardar proceso
          </Boton>
        </div>
      )}
    </div>
  );
}

export default function ProcesoMatriculaPage() {
  const [anios, setAnios] = useState<AnioAcademico[] | null>(null);
  const [anioId, setAnioId] = useState("");
  const [proceso, setProceso] = useState<Proceso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    api<AnioAcademico[]>("/academico/anios")
      .then((a) => {
        setAnios(a);
        setAnioId(anioPorDefecto(a)?.id ?? "");
      })
      .catch((e) => setError(alertaError(e)));
  }, []);

  useEffect(() => {
    if (!anioId) return;
    let vigente = true;
    api<Proceso>(`/matricula/procesos/${anioId}`)
      .then((p) => {
        if (!vigente) return;
        setProceso(p);
        setError(null);
      })
      .catch((e) => vigente && setError(alertaError(e)));
    return () => {
      vigente = false;
    };
  }, [anioId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-texto-3">Matrícula y pagos / Proceso de matrícula</p>
        <h1 className="text-[28px] font-semibold text-texto">Proceso de matrícula</h1>
        <p className="text-[15px] text-texto-2">
          Fechas en que los apoderados matriculan a sus hijos desde su portal y documentos que deben subir.
        </p>
      </div>
      {error && <Alerta tipo="error" titulo={error} />}
      {exito && <Alerta tipo="exito" titulo={exito} />}
      <Tarjeta className="flex flex-col gap-5 p-6">
        {!anios && !error && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando…
          </div>
        )}
        {anios && !anios.length && <Alerta tipo="info" titulo="Todavía no hay años académicos registrados." />}
        {anios && anios.length > 0 && (
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-36">
              <Selector
                etiqueta="Año"
                valor={anioId}
                onCambiar={(v) => {
                  setProceso(null);
                  setExito(null);
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
            {proceso && (
              <div className="flex items-center gap-2 pb-3 text-[14px] text-texto-2">
                <Badge tono={TONO_ESTADO[proceso.estado]} punto>
                  {proceso.nombreEstado}
                </Badge>
                {proceso.fechaInicio && proceso.fechaFin && (
                  <span>{`Del ${fechaDia(proceso.fechaInicio)} al ${fechaDia(proceso.fechaFin)}`}</span>
                )}
              </div>
            )}
          </div>
        )}
        {anioId && !proceso && !error && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando el proceso…
          </div>
        )}
        {proceso && (
          <Formulario
            key={`${proceso.anio.id}-${proceso.actualizadoEn ?? ""}`}
            proceso={proceso}
            onGuardado={(p) => {
              setProceso(p);
              setExito(`Se guardó el proceso de matrícula ${p.anio.anio}.`);
            }}
          />
        )}
      </Tarjeta>
    </div>
  );
}
