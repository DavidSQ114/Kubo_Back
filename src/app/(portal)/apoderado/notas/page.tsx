// AP-04 · Libreta de notas · Apoderado (US46): logros del hijo elegido por bimestre, curso y competencia, con el
// consolidado de cada curso; los cursos sin publicar muestran «Pendiente de publicación». AP-06 (US26): con 2 o más
// pensiones vencidas, el mensaje de restricción y la deuda, sin ninguna calificación. «Descargar libreta (PDF)»
// (US66). Evidencias del docente en cada calificación (US47, M-09). El servidor decide qué se ve: solo registros
// publicados y solo hijos vinculados (403 si no es su hijo); con deuda no llega ninguna nota ni evidencia.
"use client";

import Link from "next/link";
import { useState } from "react";
import { useHijo } from "@/components/apoderado/PortalApoderado";
import { EncabezadoPagina, mensajeError } from "@/components/portal";
import { useConsulta, type Carga } from "@/components/portal/asistencia";
import { ModalEvidenciaDocente, type EvidenciaElegida } from "@/components/portal/evidencias";
import {
  CargandoLibreta,
  ErrorLibreta,
  EstadoDelBimestre,
  LibretaVacia,
  PestanasBimestre,
  ResumenDelBimestre,
  TarjetaConducta,
  TablaLibreta,
  TarjetaEscala,
  type Libreta,
  type LibretaDelHijo,
} from "@/components/portal/libreta";
import { Alerta, Badge, Boton, Icono, Tarjeta } from "@/components/ui";
import { ApiError, descargar } from "@/lib/api";
import { diaMes, soles } from "@/lib/formato";

const PENDIENTE = "Pendiente de publicación";

export default function LibretaApoderadoPage() {
  const { hijo } = useHijo();
  const { carga, reintentar } = useConsulta<LibretaDelHijo>(`/evaluacion/apoderado/hijos/${hijo.estudianteId}/libreta`);
  const nombre = hijo.nombres.split(" ")[0];
  // el bimestre elegido se reinicia al cambiar de hijo (la página se vuelve a montar con otra key)
  return <Contenido key={hijo.estudianteId} nombre={nombre} carga={carga} reintentar={reintentar} />;
}

function Contenido({
  nombre,
  carga,
  reintentar,
}: {
  nombre: string;
  carga: Carga<LibretaDelHijo>;
  reintentar: () => void;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [descarga, setDescarga] = useState<{ cargando: boolean; error: string | null }>({
    cargando: false,
    error: null,
  });
  const datos = carga.fase === "listo" ? carga.datos : null;
  const bimestres = datos ? (datos.restringido ? datos.bimestres : datos.libreta.bimestres) : [];
  const porDefecto = datos && !datos.restringido ? datos.libreta.bimestrePorDefectoId : (bimestres.at(-1)?.id ?? null);
  const seleccionado = elegido ?? porDefecto;
  const bimestre = datos && !datos.restringido ? datos.libreta.bimestres.find((b) => b.id === seleccionado) : null;
  const descargable = !!bimestre?.cursos.some((c) => c.publicado);

  async function descargarLibreta() {
    if (!datos || datos.restringido || !bimestre) return;
    setDescarga({ cargando: true, error: null });
    try {
      await descargar(
        `/evaluacion/apoderado/hijos/${datos.libreta.estudiante.estudianteId}/libreta/pdf?periodoId=${bimestre.id}`,
        "Libreta.pdf",
      );
      setDescarga({ cargando: false, error: null });
    } catch (e) {
      // con deuda el servidor no genera el archivo (LIBRETA_RESTRINGIDA): se muestra su mensaje
      setDescarga({ cargando: false, error: e instanceof ApiError ? e.message : mensajeError(e) });
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Libreta de notas"
        descripcion={`Logros de ${nombre} por curso y competencia, según la evaluación por competencias.`}
      >
        <Boton
          variante="secundario"
          icono="icon-pdf"
          onClick={descargarLibreta}
          cargando={descarga.cargando}
          disabled={!descargable}
          title={descargable ? undefined : "Disponible cuando haya cursos publicados en el bimestre"}
        >
          Descargar libreta (PDF)
        </Boton>
      </EncabezadoPagina>
      {descarga.error && <Alerta tipo="error" titulo={descarga.error} />}
      {carga.fase === "cargando" && <CargandoLibreta />}
      {carga.fase === "error" && <ErrorLibreta mensaje={carga.mensaje} onReintentar={reintentar} />}
      {datos && bimestres.length > 0 && (
        <PestanasBimestre
          bimestres={datos.restringido ? datos.bimestres : datos.libreta.bimestres}
          seleccionado={seleccionado}
          onElegir={setElegido}
        />
      )}
      {datos?.restringido && <Restriccion datos={datos} nombre={nombre} />}
      {datos && !datos.restringido && !bimestre && (
        <LibretaVacia titulo="El año escolar aún no tiene bimestres">
          La libreta aparecerá cuando el colegio configure los bimestres del año {datos.libreta.anio.anio}.
        </LibretaVacia>
      )}
      {datos && !datos.restringido && bimestre && <Bimestre libreta={datos.libreta} id={bimestre.id} />}
    </>
  );
}

function Bimestre({ libreta, id }: { libreta: Libreta; id: string }) {
  const bimestre = libreta.bimestres.find((b) => b.id === id)!;
  const [evidencia, setEvidencia] = useState<EvidenciaElegida | null>(null);
  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-4">
        <Tarjeta className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Dato titulo="Estudiante" valor={libreta.estudiante.nombreCompleto} />
          <Dato
            titulo="Grado y sección"
            valor={libreta.grado ? `${libreta.grado} · ${libreta.seccion}` : "Sin sección"}
          />
          <Dato titulo="Tutor" valor={libreta.tutor ?? "Por asignar"} />
          <div className="flex flex-col items-start gap-1">
            <span className="text-[13px] text-texto-3">Estado</span>
            <EstadoDelBimestre bimestre={bimestre} />
          </div>
        </Tarjeta>
        {bimestre.cursos.length === 0 ? (
          <LibretaVacia titulo="Aún no hay cursos en este bimestre">
            Los cursos aparecen cuando el colegio arma el plan de estudios de la sección.
          </LibretaVacia>
        ) : (
          <TablaLibreta
            bimestre={bimestre}
            pendiente={PENDIENTE}
            onVerEvidencia={(curso, c) =>
              setEvidencia({
                curso: curso.nombre,
                docente: curso.docente,
                competencia: c.nombre,
                logro: c.logro,
                evidencias: c.evidencias,
              })
            }
          />
        )}
        <p className="flex items-start gap-2 text-[12px] leading-[1.5] text-texto-3">
          <span className="mt-0.5 shrink-0">
            <Icono nombre="icon-info" size={14} />
          </span>
          Solo se muestran cursos cerrados por el docente y publicados por la coordinación académica. Los demás aparecen
          como «{PENDIENTE}».
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <TarjetaEscala />
        <ResumenDelBimestre bimestre={bimestre} />
        <TarjetaConducta bimestre={bimestre} />
      </div>
      {evidencia && <ModalEvidenciaDocente elegida={evidencia} onCerrar={() => setEvidencia(null)} />}
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] text-texto-3">{titulo}</span>
      <span className="text-[15px] font-medium text-texto">{valor}</span>
    </div>
  );
}

/** AP-06 · Libreta restringida por deuda (US26): el mensaje del backlog y las pensiones vencidas, sin notas. */
function Restriccion({ datos, nombre }: { datos: Extract<LibretaDelHijo, { restringido: true }>; nombre: string }) {
  return (
    <>
      <Tarjeta className="flex flex-col items-center gap-5 px-5 py-10 text-center sm:px-10">
        <span className="flex size-16 items-center justify-center rounded-full bg-rojo/10">
          <Icono nombre="icon-lock" size={28} />
        </span>
        <div className="flex max-w-[560px] flex-col gap-2">
          <h2 className="text-[20px] font-semibold leading-[1.35] text-texto">{datos.mensaje}</h2>
          <p className="text-[14px] leading-[1.5] text-texto-2">
            El acceso a la libreta se restablecerá automáticamente cuando se registre el pago.
          </p>
        </div>
        <Link
          href="/apoderado/pagos"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-kubo-azul px-5 text-[15px] font-semibold text-white hover:bg-kubo-azul-oscuro"
        >
          <Icono nombre="nav-wallet" size={18} />
          Ver pagos pendientes
        </Link>
        <div className="flex w-full max-w-[560px] flex-col text-left">
          <h3 className="pb-2 text-[15px] font-semibold text-texto">Pensiones vencidas de {nombre}</h3>
          <ul className="flex flex-col divide-y divide-borde border-y border-borde">
            {datos.deuda.pensiones.map((p) => (
              <li key={p.cuotaId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-[14px]">
                <span className="flex-1 font-medium text-texto">{p.concepto}</span>
                <span className="text-[13px] text-texto-3">venció {diaMes(p.fechaVencimiento)}</span>
                <span className="font-semibold text-texto">{soles(p.monto)}</span>
                <Badge tono="rojo" punto>
                  Vencido
                </Badge>
              </li>
            ))}
          </ul>
          <p className="flex items-center justify-between py-3 text-[15px]">
            <span className="font-semibold text-texto">Total por regularizar</span>
            <span className="text-[17px] font-bold text-rojo-oscuro">{soles(datos.deuda.total)}</span>
          </p>
        </div>
      </Tarjeta>
      <p className="flex items-start gap-2 text-[12px] leading-[1.5] text-texto-3">
        <span className="mt-0.5 shrink-0">
          <Icono nombre="icon-info" size={14} />
        </span>
        La restricción aplica cuando el estudiante tiene 2 o más pensiones vencidas. Las calificaciones no se muestran
        mientras se mantenga la deuda.
      </p>
    </>
  );
}
