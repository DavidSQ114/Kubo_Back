// DO-04 · «Competencias de mi curso» (bloque M2): el docente agrega o quita competencias del catálogo oficial (área de
// su curso) en el plan de su curso y grado, con su peso, mientras ninguna tenga notas en el año. Reutiliza el editor
// de AD-04 con el endpoint del docente y avisa que el cambio aplica a todas las secciones del grado.
"use client";

import { useState } from "react";
import { EditorCompetencias, type DetallePlan } from "@/components/admin/cursos";
import { CargandoAsistencia, ErrorAsistencia, useConsulta } from "@/components/portal/asistencia";
import { Alerta, Boton, Modal } from "@/components/ui";

interface CompetenciasDeMiCurso extends DetallePlan {
  asignacionId: string;
  secciones: string[];
  editable: boolean;
  motivo: string | null;
}

/** «3° A, 3° B y 3° C». */
function listaSecciones(secciones: string[]) {
  if (secciones.length <= 1) return secciones[0] ?? "";
  return `${secciones.slice(0, -1).join(", ")} y ${secciones[secciones.length - 1]}`;
}

export function ModalCompetenciasDelCurso({
  asignacionId,
  onCerrar,
  onGuardado,
}: {
  asignacionId: string;
  onCerrar: () => void;
  /** Tras guardar: el registro de notas se vuelve a cargar con las nuevas columnas. */
  onGuardado: (mensaje: string) => void;
}) {
  const ruta = `/academico/mis-cursos/${asignacionId}/competencias`;
  const consulta = useConsulta<CompetenciasDeMiCurso>(ruta);
  const [version, setVersion] = useState(0);
  const datos = consulta.carga.fase === "listo" ? consulta.carga.datos : null;

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-award"
      tonoIcono="azul"
      titulo="Competencias de mi curso"
      subtitulo={
        datos ? `${datos.plan.curso.nombre} · ${datos.plan.grado.nombre} · área de ${datos.plan.curso.area.nombre}` : ""
      }
      pie={
        <Boton variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      {consulta.carga.fase === "cargando" && <CargandoAsistencia />}
      {consulta.carga.fase === "error" && (
        <ErrorAsistencia mensaje={consulta.carga.mensaje} onReintentar={consulta.reintentar} />
      )}
      {datos && (
        <>
          {datos.editable ? (
            <Alerta tipo="aviso" titulo="El cambio aplica a todas las secciones del grado">
              Las competencias son del plan de {datos.plan.curso.nombre} en {datos.plan.grado.nombre}
              {datos.secciones.length > 0 ? ` (${listaSecciones(datos.secciones)})` : ""}: también las verán los
              docentes de las otras secciones. Solo se pueden cambiar mientras ninguna tenga notas en el año.
            </Alerta>
          ) : (
            <Alerta tipo="info" titulo="Las competencias de este curso ya no se pueden cambiar desde aquí">
              {datos.motivo}
            </Alerta>
          )}
          <p className="text-[13px] leading-[1.4] text-texto-2">
            Marca las competencias del catálogo oficial que evalúas. El peso es opcional: indícalo en todas o en
            ninguna; se usa cuando la regla del año es «Promedio ponderado».
          </p>
          <EditorCompetencias
            key={version}
            detalle={datos}
            soloLectura={!datos.editable}
            ponderado
            ruta={ruta}
            onDescartar={() => setVersion((v) => v + 1)}
            onGuardado={() => {
              consulta.recargar();
              setVersion((v) => v + 1);
              onGuardado(`Se guardaron las competencias de ${datos.plan.curso.nombre} en ${datos.plan.grado.nombre}.`);
            }}
          />
        </>
      )}
    </Modal>
  );
}
