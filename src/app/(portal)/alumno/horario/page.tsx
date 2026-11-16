// AL-02 · Mi horario · Alumno (US50): horario publicado de su sección con el curso, el aula y el docente de cada
// bloque. Sin publicar: «El horario aún no ha sido publicado». En el celular se ve un día a la vez (pestañas por día).
"use client";

import { useAlumno } from "@/components/alumno/PortalAlumno";
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

export default function MiHorarioAlumnoPage() {
  const panel = useAlumno();
  const { carga, reintentar } = useHorario<HorarioDeEstudiante>("/horarios/alumno/horario");
  const aula = panel.grado && panel.seccion ? `${panel.grado} · Sección ${panel.seccion}` : `Año ${panel.anio}`;

  return (
    <>
      <EncabezadoPagina titulo="Mi horario" descripcion={aula} />
      {carga.fase === "cargando" && <CargandoHorario />}
      {carga.fase === "error" && <ErrorHorario mensaje={carga.mensaje} onReintentar={reintentar} />}
      {carga.fase === "listo" && !carga.datos.horario && (
        <HorarioVacio titulo="El horario aún no ha sido publicado">
          Aparecerá aquí en cuanto tu colegio publique el horario de tu sección.
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
