// Asistencia de alumnos · Administrador (US36, criterio 3): sesiones de clase de una fecha, la lista de cada una y el
// modal M-20 «Corregir asistencia fuera de plazo», con motivo obligatorio. La lista no tiene pantalla propia en el
// Figma (solo la pestaña «Asistencia de alumnos» de AD-14 y el modal): sigue el estilo de las tablas del portal y se
// documenta en docs/frontend-asistencia.md.
"use client";

import { useState } from "react";
import { alertaError } from "@/components/admin/PortalAdmin";
import type { AlumnoDeSesion, SesionDetalle, SesionGuardada } from "@/components/docente/asistencia";
import { BadgeEstado, ESTADOS_ASISTENCIA, NOMBRE_ESTADO, type EstadoAsistencia } from "@/components/portal/asistencia";
import { Alerta, Boton, Icono, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { diaYHora, fechaDia, fechaHora } from "@/lib/formato";

const LARGO_MINIMO_MOTIVO = 5;
const LARGO_MAXIMO_MOTIVO = 300;

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] leading-[1.4] text-texto-3">{etiqueta}</span>
      <span className="text-[15px] font-medium leading-[1.4] text-texto">{children}</span>
    </div>
  );
}

const iniciales = (nombreDeLista: string) => {
  const [apellidos = "", nombres = ""] = nombreDeLista.split(", ");
  return `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
};

/** M-20 · Corregir asistencia fuera de plazo: nuevo estado, motivo obligatorio y aviso de auditoría. */
export function ModalCorregirAsistencia({
  sesion,
  alumno,
  onCerrar,
  onCorregida,
}: {
  sesion: SesionDetalle;
  alumno: AlumnoDeSesion;
  onCerrar: () => void;
  onCorregida: (sesion: SesionGuardada) => void;
}) {
  const [estado, setEstado] = useState<EstadoAsistencia | null>(null);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motivoValido = motivo.trim().length >= LARGO_MINIMO_MOTIVO;

  async function guardar() {
    if (!estado || !motivoValido) return;
    setGuardando(true);
    setError(null);
    try {
      onCorregida(
        await api<SesionGuardada>(`/horarios/asistencia/registros/${alumno.registroId}/corregir`, {
          method: "POST",
          body: { estado, motivo: motivo.trim() },
        }),
      );
    } catch (e) {
      setError(alertaError(e));
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-clock-rojo"
      titulo="Corregir asistencia fuera de plazo"
      subtitulo={
        sesion.editable
          ? "El docente aún puede corregirla; tu cambio queda con motivo y en la bitácora"
          : `Pasaron más de ${sesion.plazoHoras} horas: solo la coordinación académica puede modificarla`
      }
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton icono="check-blanco" onClick={guardar} cargando={guardando} disabled={!estado || !motivoValido}>
            Guardar corrección
          </Boton>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-lg border border-borde bg-fondo px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-kubo-azul text-[14px] font-semibold text-white">
          {iniciales(alumno.nombre)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold leading-[1.4] text-texto">{alumno.nombre}</span>
          <span className="text-[13px] leading-[1.4] text-texto-3">
            {sesion.seccion.etiqueta}
            {alumno.dni ? ` · DNI ${alumno.dni}` : ""}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-borde">
        <p className="border-b border-borde bg-fondo px-4 py-2.5 text-[13px] font-semibold text-texto-2">
          Sesión de clase
        </p>
        <div className="grid grid-cols-2 gap-4 border-b border-borde p-4 sm:grid-cols-3">
          <Dato etiqueta="Curso">{sesion.curso.nombre}</Dato>
          <Dato etiqueta="Fecha">{fechaDia(sesion.fecha)}</Dato>
          <Dato etiqueta="Hora">
            {sesion.bloque.horaInicio} – {sesion.bloque.horaFin}
          </Dato>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
          <Dato etiqueta="Estado actual">{alumno.estado && <BadgeEstado estado={alumno.estado} />}</Dato>
          <Dato etiqueta="Registrado por">{alumno.registradoPor ?? "—"}</Dato>
          <Dato etiqueta="Fecha del registro">
            {alumno.registradoEn ? fechaHora(new Date(alumno.registradoEn)) : "—"}
          </Dato>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex gap-1 text-[14px] font-medium text-texto-2">
          Nuevo estado <span className="text-rojo">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {ESTADOS_ASISTENCIA.filter((e) => e !== alumno.estado).map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={estado === e}
              onClick={() => setEstado(e)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${estado === e ? "border-kubo-azul bg-celeste/15 font-semibold text-kubo-azul" : "border-borde bg-white text-texto hover:bg-fondo"}`}
            >
              {estado === e && <Icono nombre="icon-check-verde" size={14} />}
              {NOMBRE_ESTADO[e]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-[14px] font-medium text-texto-2">
        <span className="flex gap-1">
          Motivo del cambio <span className="text-rojo">*</span>
        </span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={LARGO_MAXIMO_MOTIVO}
          rows={3}
          placeholder="Por ejemplo: la apoderada presentó el certificado médico fuera del plazo."
          className="w-full rounded-lg border border-borde bg-white px-4 py-3 text-[15px] font-normal leading-[1.5] text-texto outline-none placeholder:text-texto-3 focus:border-kubo-azul focus:ring-1 focus:ring-kubo-azul"
        />
        <span className="text-[13px] font-normal text-texto-3">
          Obligatorio. Queda guardado junto con el valor anterior y el nuevo.
        </span>
      </label>

      <Alerta tipo="aviso" icono="alerta-warn" titulo="Este cambio quedará registrado en la bitácora de auditoría">
        Se guardará tu usuario, la fecha y hora, el estado anterior, el nuevo estado y el motivo.
      </Alerta>
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}

/** Lista de una sesión para el administrador: estado de cada alumno, su última corrección y «Corregir». */
export function ListaDeSesion({
  sesion,
  onCorregir,
}: {
  sesion: SesionDetalle;
  onCorregir: (alumno: AlumnoDeSesion) => void;
}) {
  if (!sesion.registrada) {
    return (
      <p className="rounded-lg border border-dashed border-borde px-4 py-8 text-center text-[14px] leading-[1.5] text-texto-2">
        El docente abrió esta sesión pero no guardó la lista: no hay registros que corregir.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-borde">
      <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-borde bg-fondo text-[13px] font-semibold text-texto-2">
            <th scope="col" className="w-[48px] px-4 py-2.5">
              N.º
            </th>
            <th scope="col" className="px-4 py-2.5">
              Estudiante
            </th>
            <th scope="col" className="px-4 py-2.5">
              Estado
            </th>
            <th scope="col" className="px-4 py-2.5">
              Observación
            </th>
            <th scope="col" className="px-4 py-2.5">
              Última corrección
            </th>
            <th scope="col" className="px-4 py-2.5 text-right">
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {sesion.alumnos.map((a, i) => (
            <tr key={a.matriculaId} className="border-b border-borde align-top last:border-b-0">
              <td className="px-4 py-3 text-texto-2">{i + 1}</td>
              <td className="px-4 py-3">
                <span className="block font-medium text-texto">{a.nombre}</span>
                {a.dni && <span className="block text-[12px] text-texto-3">DNI {a.dni}</span>}
              </td>
              <td className="px-4 py-3">
                {a.estado ? <BadgeEstado estado={a.estado} /> : <span className="text-texto-3">Sin registro</span>}
              </td>
              <td className="max-w-[220px] px-4 py-3 text-texto-2">{a.observacion ?? "—"}</td>
              <td className="max-w-[260px] px-4 py-3 text-[13px] leading-[1.4] text-texto-2">
                {a.modificadoEn ? (
                  <>
                    <span className="block">
                      {diaYHora(a.modificadoEn)} · {a.modificadoPor ?? "—"}
                      {a.estadoAnterior ? ` · antes: ${NOMBRE_ESTADO[a.estadoAnterior]}` : ""}
                    </span>
                    {a.motivoCambio && <span className="block text-texto-3">Motivo: {a.motivoCambio}</span>}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {a.registroId && (
                  <Boton
                    variante="secundario"
                    icono="act-edit"
                    className="!px-3 !py-1.5 !text-[14px]"
                    aria-label={`Corregir la asistencia de ${a.nombre}`}
                    onClick={() => onCorregir(a)}
                  >
                    Corregir
                  </Boton>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
