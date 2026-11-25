// Asistencia de alumnos · Administrador (US36, criterio 3 · modal M-20): sesiones de clase de una fecha con sus
// contadores; al abrir una se ve su lista y se corrige un registro fuera del plazo del docente, con motivo
// obligatorio y auditoría. Pantalla sin diseño propio en el Figma: ver docs/frontend-asistencia.md. Comparte las
// pestañas de AD-14 con la asistencia docente (US32).
"use client";

import { useState } from "react";
import { ListaDeSesion, ModalCorregirAsistencia } from "@/components/admin/asistencia";
import {
  BadgeRegistro,
  type AlumnoDeSesion,
  type SesionDetalle,
  type SesionVista,
} from "@/components/docente/asistencia";
import { CargandoAsistencia, ErrorAsistencia, useConsulta } from "@/components/portal/asistencia";
import { Alerta, Boton, Icono, Tarjeta } from "@/components/ui";
import { diaYHora, fechaLarga, hoyEnLima } from "@/lib/formato";

/** Lista de la sesión elegida. El padre cambia la `key` al elegir otra sesión. */
function DetalleDeSesion({ sesionId, onCorregida }: { sesionId: string; onCorregida: () => void }) {
  const { carga, reintentar, recargar } = useConsulta<SesionDetalle>(`/horarios/asistencia/sesiones/${sesionId}`);
  const [alumno, setAlumno] = useState<AlumnoDeSesion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (carga.fase === "cargando") return <CargandoAsistencia />;
  if (carga.fase === "error") return <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />;
  const s = carga.datos;
  return (
    <Tarjeta className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">
            {s.curso.nombre} · {s.seccion.etiqueta}
          </h2>
          <p className="text-[14px] leading-[1.5] text-texto-2">
            {fechaLarga(s.fecha)} · {s.bloque.horaInicio} – {s.bloque.horaFin} · {s.aula.nombre} · Docente:{" "}
            {s.docente.nombreCompleto}
          </p>
          {s.registradaEn && (
            <p className="text-[13px] leading-[1.4] text-texto-3">
              Registro guardado el {diaYHora(s.registradaEn)}.{" "}
              {s.editable && s.editableHasta
                ? `El docente puede corregirlo hasta el ${diaYHora(s.editableHasta)}.`
                : `El plazo de ${s.plazoHoras} horas del docente ya venció.`}
            </p>
          )}
        </div>
        <BadgeRegistro estado={s} />
      </div>
      {aviso && <Alerta tipo="exito" icono="icon-check-verde" titulo={aviso} />}
      <ListaDeSesion
        sesion={s}
        onCorregir={(a) => {
          setAviso(null);
          setAlumno(a);
        }}
      />
      {alumno && (
        <ModalCorregirAsistencia
          key={alumno.matriculaId}
          sesion={s}
          alumno={alumno}
          onCerrar={() => setAlumno(null)}
          onCorregida={() => {
            setAviso(`Corrección guardada: la asistencia de ${alumno.nombre} quedó registrada en la bitácora.`);
            setAlumno(null);
            recargar();
            onCorregida();
          }}
        />
      )}
    </Tarjeta>
  );
}

export default function AsistenciaAlumnosPage() {
  const hoy = hoyEnLima();
  const [fecha, setFecha] = useState(hoy);
  const [seccion, setSeccion] = useState("");
  const [elegida, setElegida] = useState<string | null>(null);
  const { carga, reintentar, recargar } = useConsulta<{ sesiones: SesionVista[] }>(
    `/horarios/asistencia/sesiones?fecha=${fecha}`,
  );

  const sesiones = carga.fase === "listo" ? carga.datos.sesiones : [];
  const secciones = [...new Map(sesiones.map((s) => [s.seccion.id, s.seccion.etiqueta])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "es", { numeric: true }),
  );
  const visibles = sesiones.filter((s) => !seccion || s.seccion.id === seccion);
  const sesionElegida = visibles.find((s) => s.id === elegida);

  return (
    <>
      <div className="flex min-w-[280px] flex-col gap-1.5">
        <p className="text-[14px] leading-[1.4] whitespace-pre text-texto-3">Académico / Asistencia de alumnos</p>
        <h1 className="text-[32px] font-bold leading-[1.2] text-texto">Asistencia de alumnos</h1>
        <p className="max-w-[760px] text-[16px] leading-[1.5] text-texto-2">
          Consulta la asistencia que registran los docentes en cada clase y corrige un registro cuando ya venció su
          plazo. Cada corrección exige un motivo y queda en la bitácora de auditoría.
        </p>
      </div>

      <Tarjeta className="flex flex-wrap items-end gap-4 p-5">
        <label className="flex w-[200px] flex-col gap-1.5 text-[14px] font-medium text-texto-2">
          Fecha
          <input
            type="date"
            value={fecha}
            max={hoy}
            onChange={(e) => {
              if (!e.target.value) return;
              setFecha(e.target.value);
              setSeccion("");
              setElegida(null);
            }}
            className="h-11 w-full rounded-lg border border-borde bg-white px-3 text-[16px] font-normal text-texto outline-none focus:border-kubo-azul"
          />
        </label>
        <label className="flex w-[200px] flex-col gap-1.5 text-[14px] font-medium text-texto-2">
          Sección
          <select
            value={seccion}
            onChange={(e) => setSeccion(e.target.value)}
            disabled={secciones.length === 0}
            className="h-11 w-full rounded-lg border border-borde bg-white px-3 text-[16px] font-normal text-texto outline-none focus:border-kubo-azul disabled:bg-fondo disabled:text-texto-3"
          >
            <option value="">Todas</option>
            {secciones.map(([id, etiqueta]) => (
              <option key={id} value={id}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <p className="flex-1 text-right text-[13px] leading-[1.4] text-texto-3">{fechaLarga(fecha)}</p>
      </Tarjeta>

      {carga.fase === "cargando" && <CargandoAsistencia />}
      {carga.fase === "error" && <ErrorAsistencia mensaje={carga.mensaje} onReintentar={reintentar} />}
      {carga.fase === "listo" && sesiones.length === 0 && (
        <Tarjeta className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Icono nombre="nav-usercheck-gris" size={28} />
          <p className="text-[16px] font-semibold text-texto">No hay asistencia registrada en esta fecha</p>
          <p className="max-w-[440px] text-[14px] leading-[1.4] text-texto-2">
            Las sesiones aparecen cuando un docente abre su clase del día para tomar asistencia. Elige otra fecha para
            consultar registros anteriores.
          </p>
        </Tarjeta>
      )}
      {carga.fase === "listo" && sesiones.length > 0 && (
        <Tarjeta className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-[14px]">
            <caption className="sr-only">Sesiones de clase del {fechaLarga(fecha)}</caption>
            <thead>
              <tr className="border-b border-borde bg-fondo text-[13px] font-semibold text-texto-2">
                {["Hora", "Curso", "Sección", "Docente", "Registro", "P · T · A · J"].map((columna) => (
                  <th key={columna} scope="col" className="px-4 py-3">
                    {columna}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-borde last:border-b-0 ${s.id === elegida ? "bg-kubo-azul/5" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-texto">
                    {s.bloque.horaInicio} – {s.bloque.horaFin}
                  </td>
                  <td className="px-4 py-3 text-texto">{s.curso.nombre}</td>
                  <td className="px-4 py-3 text-texto">{s.seccion.etiqueta}</td>
                  <td className="px-4 py-3 text-texto-2">{s.docente.nombreCorto}</td>
                  <td className="px-4 py-3">
                    <BadgeRegistro estado={s} />
                  </td>
                  <td className="px-4 py-3 text-texto-2">
                    {s.resumen
                      ? `${s.resumen.presentes} · ${s.resumen.tardanzas} · ${s.resumen.ausentes} · ${s.resumen.justificados}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Boton
                      variante="secundario"
                      icono="act-eye"
                      className="!px-3 !py-1.5 !text-[14px]"
                      aria-pressed={s.id === elegida}
                      onClick={() => setElegida(s.id)}
                    >
                      Ver lista
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}

      {sesionElegida && <DetalleDeSesion key={sesionElegida.id} sesionId={sesionElegida.id} onCorregida={recargar} />}
    </>
  );
}
