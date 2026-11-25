// DO-02 · Mi horario · Docente (US34): cuadrícula semanal con el curso, la sección y el aula de cada bloque con
// clase, de todas sus secciones con horario publicado. Sin clases publicadas: «Aún no tienes cursos asignados para
// este periodo». Siempre muestra la versión publicada vigente.
"use client";

import { EncabezadoPagina } from "@/components/portal";
import {
  CargandoHorario,
  ErrorHorario,
  HorarioSemanal,
  HorarioVacio,
  useHorario,
  type Bloque,
  type ClaseHorario,
  type Dia,
} from "@/components/portal/horario";
import { Badge, Icono, Tarjeta } from "@/components/ui";

interface HorarioDeDocente {
  anio: { id: string; anio: number } | null;
  dias: Dia[];
  bloques: Bloque[];
  clases: ClaseHorario[];
  resumen: { bloques: number; secciones: string[] };
}

function Indicador({
  icono,
  titulo,
  valor,
  detalle,
}: {
  icono: string;
  titulo: string;
  valor: number;
  detalle: string;
}) {
  return (
    <Tarjeta className="flex flex-col gap-2 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-kubo-azul/10">
          <Icono nombre={icono} size={20} />
        </span>
        <span className="text-[14px] text-texto-2">{titulo}</span>
      </div>
      <span className="text-[28px] font-bold leading-none text-texto">{valor}</span>
      <span className="text-[13px] leading-[1.4] text-texto-3">{detalle}</span>
    </Tarjeta>
  );
}

export default function MiHorarioDocentePage() {
  const { carga, reintentar } = useHorario<HorarioDeDocente>("/horarios/mi-horario");

  return (
    <>
      <EncabezadoPagina
        titulo="Mi horario"
        descripcion="Horario semanal consolidado de tus clases publicadas. Se actualiza automáticamente cuando la coordinación académica realiza cambios."
      >
        {carga.fase === "listo" && carga.datos.anio && (
          <Badge tono="verde" punto>
            Año {carga.datos.anio.anio}
          </Badge>
        )}
      </EncabezadoPagina>

      {carga.fase === "cargando" && <CargandoHorario />}
      {carga.fase === "error" && <ErrorHorario mensaje={carga.mensaje} onReintentar={reintentar} />}
      {carga.fase === "listo" && carga.datos.clases.length === 0 && (
        <HorarioVacio titulo="Aún no tienes cursos asignados para este periodo">
          Cuando la coordinación académica te asigne cursos y publique los horarios, aparecerán aquí.
        </HorarioVacio>
      )}
      {carga.fase === "listo" && carga.datos.clases.length > 0 && (
        <>
          <HorarioSemanal
            dias={carga.datos.dias}
            bloques={carga.datos.bloques}
            clases={carga.datos.clases}
            vista="docente"
            hoy={carga.hoy}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Indicador
              icono="nav-grid-azul"
              titulo="Bloques por semana"
              valor={carga.datos.resumen.bloques}
              detalle="Bloques con clase en tus horarios publicados."
            />
            <Indicador
              icono="kpi-users"
              titulo="Secciones a cargo"
              valor={carga.datos.resumen.secciones.length}
              detalle={carga.datos.resumen.secciones.join(" · ")}
            />
          </div>
        </>
      )}
    </>
  );
}
