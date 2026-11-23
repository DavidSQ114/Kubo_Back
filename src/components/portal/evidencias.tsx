// M-09 · Evidencia del docente (US47): en la libreta del apoderado (AP-04) y en «Mis notas» del alumno (AL-03), al
// presionar una calificación con evidencia se muestra el comentario del docente y el archivo: un JPG en un visor
// integrado, sin descargarlo; un PDF se abre en otra pestaña o se descarga. Una calificación sin evidencia no muestra
// ninguna opción. El archivo se pide a la API, que vuelve a validar el permiso (nunca hay URLs públicas).
"use client";

import { useEffect, useState } from "react";
import { esImagen, pesoLegible, rutaArchivoEvidencia, type EvidenciaVista } from "@/components/docente/evidencias";
import { BadgeLogro, type Logro } from "@/components/docente/notas";
import { mensajeError } from "@/components/portal";
import { Alerta, Boton, Icono, Modal, Spinner } from "@/components/ui";
import { abrirEnPestana, descargar, obtenerArchivo } from "@/lib/api";
import { fechaDia, hoyEnLima } from "@/lib/formato";

export interface EvidenciaElegida {
  curso: string;
  docente: string | null;
  /** «C1 Resuelve problemas de cantidad». */
  competencia: string;
  logro: Logro | null;
  evidencias: EvidenciaVista[];
}

/** «Ver evidencia» si alguna trae archivo, «Ver comentario» si solo hay comentarios; nada si no hay evidencias. */
export function EnlaceEvidencia({
  evidencias,
  onAbrir,
  etiqueta,
}: {
  evidencias: EvidenciaVista[];
  onAbrir: () => void;
  /** Para lectores de pantalla: «Ver evidencia de Resuelve problemas de cantidad». */
  etiqueta: string;
}) {
  if (!evidencias.length) return null;
  const conArchivo = evidencias.some((e) => e.archivo);
  const texto = conArchivo ? "Ver evidencia" : "Ver comentario";
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`${texto} de ${etiqueta}`}
      className="inline-flex items-center gap-1.5 rounded-md text-[14px] font-semibold text-kubo-azul hover:underline"
    >
      <Icono nombre={conArchivo ? "icon-imagen" : "icon-comentario"} size={16} />
      {texto}
    </button>
  );
}

/** La imagen se pide a la API con la sesión y se muestra desde la memoria del navegador. */
function VisorImagen({ evidencia }: { evidencia: EvidenciaVista }) {
  const [estado, setEstado] = useState<{ url: string | null; error: string | null }>({ url: null, error: null });
  useEffect(() => {
    let vigente = true;
    let url: string | null = null;
    obtenerArchivo(rutaArchivoEvidencia(evidencia.id))
      .then(({ blob }) => {
        if (!vigente) return;
        url = URL.createObjectURL(blob);
        setEstado({ url, error: null });
      })
      .catch((e) => vigente && setEstado({ url: null, error: mensajeError(e) }));
    return () => {
      vigente = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [evidencia.id]);

  if (estado.error) return <Alerta tipo="error" titulo={estado.error} />;
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-lg bg-borde/50 p-3">
      {estado.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen protegida en memoria (blob:), no optimizable
        <img
          src={estado.url}
          alt={`Evidencia del docente: ${evidencia.archivo?.nombre ?? "imagen"}`}
          className="max-h-[320px] w-auto max-w-full rounded-md object-contain shadow-tarjeta"
        />
      ) : (
        <span className="flex items-center gap-2 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando la imagen…
        </span>
      )}
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-texto-3">{titulo}</span>
      <span className="text-[14px] font-medium break-words text-texto">{children}</span>
    </div>
  );
}

function UnaEvidencia({ evidencia, onError }: { evidencia: EvidenciaVista; onError: (m: string) => void }) {
  const [ocupado, setOcupado] = useState<"abrir" | "descargar" | null>(null);
  const a = evidencia.archivo;
  async function hacer(accion: "abrir" | "descargar") {
    if (!a) return;
    setOcupado(accion);
    try {
      if (accion === "abrir") await abrirEnPestana(rutaArchivoEvidencia(evidencia.id));
      else await descargar(rutaArchivoEvidencia(evidencia.id), a.nombre);
    } catch (e) {
      onError(mensajeError(e));
    } finally {
      setOcupado(null);
    }
  }
  return (
    <article className="flex flex-col gap-3">
      {a && esImagen(a) && <VisorImagen evidencia={evidencia} />}
      {a && !esImagen(a) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-fondo p-4">
          <Icono nombre="icon-pdf" size={28} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-texto">{a.nombre}</span>
          {a.tipo === "PDF" && (
            <Boton variante="secundario" cargando={ocupado === "abrir"} onClick={() => hacer("abrir")}>
              Abrir PDF
            </Boton>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Dato titulo="Fecha">{fechaDia(hoyEnLima(new Date(evidencia.subidoEn)))}</Dato>
        {a && (
          <Dato titulo="Archivo">
            {a.nombre} · {pesoLegible(a.tamanoBytes)}
          </Dato>
        )}
      </div>
      {evidencia.comentario && (
        <div className="flex flex-col gap-1 rounded-lg bg-fondo px-4 py-3">
          <span className="text-[13px] font-semibold text-texto-2">Comentario del docente</span>
          <p className="text-[14px] leading-[1.5] whitespace-pre-line text-texto">{evidencia.comentario}</p>
        </div>
      )}
      {a && (
        <div>
          <Boton
            variante="secundario"
            icono="icon-descargar"
            cargando={ocupado === "descargar"}
            onClick={() => hacer("descargar")}
          >
            Descargar
          </Boton>
        </div>
      )}
    </article>
  );
}

/** M-09: comentario del docente y archivo de cada evidencia de la calificación. */
export function ModalEvidenciaDocente({ elegida, onCerrar }: { elegida: EvidenciaElegida; onCerrar: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-imagen"
      tonoIcono="azul"
      titulo="Evidencia del docente"
      subtitulo={`${elegida.curso} · ${elegida.competencia}`}
      pie={<Boton onClick={onCerrar}>Cerrar</Boton>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Dato titulo="Logro">{elegida.logro ? <BadgeLogro logro={elegida.logro} /> : "—"}</Dato>
        <Dato titulo="Docente">{elegida.docente ?? "—"}</Dato>
      </div>
      {error && <Alerta tipo="error" titulo={error} />}
      <div className="flex flex-col gap-5 divide-y divide-borde [&>*+*]:pt-5">
        {elegida.evidencias.map((e) => (
          <UnaEvidencia key={e.id} evidencia={e} onError={setError} />
        ))}
      </div>
    </Modal>
  );
}
