// M-24 · Enviar recordatorios de pago (US59): confirmación del envío desde el panel de morosidad (AD-12) y alerta con
// el resultado (cuántos se enviaron y cuántos se omitieron).
"use client";

import { useState } from "react";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Boton, Icono, Modal } from "@/components/ui";
import { api } from "@/lib/api";

export interface RecordatoriosEnviados {
  enviados: number;
  omitidos: number;
  correos: { registrados: number; enviados: number };
  resultados: {
    matriculaId: string;
    estudiante: string;
    enviado: boolean;
    motivo: "SIN_CUOTAS_VENCIDAS" | "SIN_DESTINATARIO" | null;
    ultimoRecordatorio: string | null;
  }[];
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Modal M-24: qué se enviará a los apoderados de los estudiantes elegidos y el botón «Enviar N recordatorios». */
export function ModalRecordatorios({
  matriculaIds,
  onCerrar,
  onEnviados,
}: {
  matriculaIds: string[];
  onCerrar: () => void;
  onEnviados: (r: RecordatoriosEnviados) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cantidad = matriculaIds.length;

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await api<RecordatoriosEnviados>("/matricula/morosidad/recordatorios", {
        method: "POST",
        body: { matriculaIds },
      });
      onEnviados(r);
    } catch (e) {
      setError(alertaError(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={() => !enviando && onCerrar()}
      icono="notif-campana-azul"
      tonoIcono="azul"
      titulo="Enviar recordatorios de pago"
      subtitulo={`${plural(cantidad, "estudiante seleccionado", "estudiantes seleccionados")} en el panel de morosidad`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono="icon-send" onClick={() => void enviar()} cargando={enviando}>
            {`Enviar ${plural(cantidad, "recordatorio", "recordatorios")}`}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alerta tipo="error" titulo={error} />}
        <div className="overflow-hidden rounded-lg border border-borde">
          <p className="border-b border-borde bg-fondo px-4 py-2.5 text-[13px] font-semibold text-texto-2">
            Qué se enviará
          </p>
          <ul className="text-[14px] leading-[1.4]">
            <li className="flex items-center gap-3 border-b border-borde px-4 py-3 text-texto">
              <Icono nombre="notif-campana-azul" size={16} />
              Notificación interna al apoderado responsable del pago
            </li>
            <li className="flex items-center gap-3 border-b border-borde px-4 py-3 text-texto">
              <Icono nombre="icon-mail" size={16} />
              Correo con el detalle de las cuotas vencidas, sus montos y los días de atraso
            </li>
            <li className="flex items-center gap-3 px-4 py-3 text-texto-3">
              <Icono nombre="act-ban" size={16} />
              No se envía a quienes ya no tengan cuotas vencidas al momento del envío
            </li>
          </ul>
        </div>
        <Alerta tipo="info" titulo="Se registrará la fecha del último recordatorio">
          Queda guardada por estudiante, para que puedas ver cuándo se le avisó por última vez antes de volver a
          insistir.
        </Alerta>
      </div>
    </Modal>
  );
}

/** Alerta con el resultado del envío (US59, criterio 2): cuántos se enviaron y por qué se omitieron los demás. */
export function ResultadoRecordatorios({ r }: { r: RecordatoriosEnviados }) {
  const sinDeuda = r.resultados.filter((x) => x.motivo === "SIN_CUOTAS_VENCIDAS").length;
  const sinDestino = r.resultados.filter((x) => x.motivo === "SIN_DESTINATARIO").length;
  const omisiones = [
    sinDeuda
      ? `No se envió a ${plural(sinDeuda, "estudiante que ya regularizó", "estudiantes que ya regularizaron")}.`
      : "",
    sinDestino
      ? `${plural(sinDestino, "estudiante no tiene", "estudiantes no tienen")} un apoderado responsable con cuenta o correo.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (!r.enviados) {
    return (
      <Alerta tipo="aviso" titulo="No se envió ningún recordatorio">
        {omisiones}
      </Alerta>
    );
  }
  return (
    <Alerta
      tipo="exito"
      titulo={`Se ${r.enviados === 1 ? "envió" : "enviaron"} ${plural(r.enviados, "recordatorio", "recordatorios")}`}
    >
      {`Los apoderados responsables recibieron una notificación interna y un correo con el detalle de la deuda.${omisiones ? ` ${omisiones}` : ""}`}
    </Alerta>
  );
}
