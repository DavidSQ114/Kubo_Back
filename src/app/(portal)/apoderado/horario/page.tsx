// AP-05 · Horario · Apoderado (US48): horario publicado de la sección del hijo elegido, con el curso, el aula y el
// docente de cada bloque. Sin publicar: «El horario aún no ha sido publicado por la institución». El servidor valida
// el vínculo: un estudiante que no es su hijo responde 403. «Descargar PDF» genera la versión vigente (US66).
"use client";

import { useState } from "react";
import { useHijo } from "@/components/apoderado/PortalApoderado";
import { EncabezadoPagina } from "@/components/portal";
import {
  CargandoHorario,
  ErrorHorario,
  EstadoPublicacion,
  HorarioSemanal,
  HorarioVacio,
  useHorario,
  type HorarioDeEstudiante,
} from "@/components/portal/horario";
import { Alerta, Boton } from "@/components/ui";
import { ApiError, descargar } from "@/lib/api";

export default function HorarioApoderadoPage() {
  const { hijo } = useHijo();
  const { carga, reintentar } = useHorario<HorarioDeEstudiante>(
    `/horarios/apoderado/hijos/${hijo.estudianteId}/horario`,
  );
  const nombre = hijo.nombres.split(" ")[0];
  const aula = hijo.grado && hijo.seccion ? ` · ${hijo.grado}, sección ${hijo.seccion}` : "";
  const [descarga, setDescarga] = useState<{ cargando: boolean; error: string | null }>({
    cargando: false,
    error: null,
  });
  const publicado = carga.fase === "listo" && !!carga.datos.horario;

  async function descargarPdf() {
    setDescarga({ cargando: true, error: null });
    try {
      await descargar(`/horarios/apoderado/hijos/${hijo.estudianteId}/horario/pdf`, "Horario.pdf");
      setDescarga({ cargando: false, error: null });
    } catch (e) {
      setDescarga({ cargando: false, error: e instanceof ApiError ? e.message : "No se pudo descargar el horario." });
    }
  }

  return (
    <>
      <EncabezadoPagina titulo="Horario de clases" descripcion={`Horario semanal de ${nombre}${aula}`}>
        {publicado && (
          <Boton variante="secundario" icono="icon-pdf" onClick={descargarPdf} cargando={descarga.cargando}>
            Descargar PDF
          </Boton>
        )}
      </EncabezadoPagina>
      {descarga.error && <Alerta tipo="error" titulo={descarga.error} />}
      {carga.fase === "cargando" && <CargandoHorario />}
      {carga.fase === "error" && <ErrorHorario mensaje={carga.mensaje} onReintentar={reintentar} />}
      {carga.fase === "listo" && !carga.datos.horario && (
        <HorarioVacio titulo="El horario aún no ha sido publicado por la institución">
          {carga.datos.seccion
            ? `Aparecerá aquí en cuanto el colegio publique el horario de ${carga.datos.seccion.etiqueta}.`
            : `${nombre} no tiene una sección con matrícula vigente en este momento.`}
        </HorarioVacio>
      )}
      {carga.fase === "listo" && carga.datos.horario && (
        <>
          <EstadoPublicacion horario={carga.datos.horario} />
          <HorarioSemanal
            dias={carga.datos.dias}
            bloques={carga.datos.bloques}
            clases={carga.datos.clases}
            vista="estudiante"
            hoy={carga.hoy}
          />
        </>
      )}
    </>
  );
}
