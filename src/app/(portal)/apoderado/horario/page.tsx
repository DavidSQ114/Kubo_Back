// AP-05 · Horario · Apoderado (US48): horario publicado de la sección del hijo elegido, con el curso, el aula y el
// docente de cada bloque. Sin publicar: «El horario aún no ha sido publicado por la institución». El servidor valida
// el vínculo: un estudiante que no es su hijo responde 403.
"use client";

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

export default function HorarioApoderadoPage() {
  const { hijo } = useHijo();
  const { carga, reintentar } = useHorario<HorarioDeEstudiante>(
    `/horarios/apoderado/hijos/${hijo.estudianteId}/horario`,
  );
  const nombre = hijo.nombres.split(" ")[0];
  const aula = hijo.grado && hijo.seccion ? ` · ${hijo.grado}, sección ${hijo.seccion}` : "";

  return (
    <>
      <EncabezadoPagina titulo="Horario de clases" descripcion={`Horario semanal de ${nombre}${aula}`} />
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
