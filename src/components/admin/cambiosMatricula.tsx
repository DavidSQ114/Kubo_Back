// Cambios sobre una matrícula «Matriculado» desde su detalle en AD-10: traslado de sección (M-05, US19), retiro del
// estudiante (M-18, US57) y ficha de matrícula en PDF (US20). Además, el historial de secciones del detalle.
"use client";

import { useEffect, useState } from "react";
import { Alerta, Boton, Campo, Modal, Spinner } from "@/components/ui";
import { api, descargar } from "@/lib/api";
import { diaMes, fechaDia, hoyEnLima } from "@/lib/formato";
import { Avatar } from "./apoderados";
import { Selector, separarErrores, type Seccion } from "./grados";
import { NOMBRE_ESTADO, soles, TarjetaSeccion, type DetalleMatricula } from "./matricula";
import { alertaError } from "./PortalAdmin";

export const MENSAJE_OTRO_GRADO = "Solo se permite el traslado entre secciones del mismo grado";
export const MENSAJE_SIN_MOTIVO_RETIRO = "Seleccione el motivo del retiro";

export const MOTIVOS_RETIRO = [
  { valor: "TRASLADO", texto: "Traslado a otro colegio" },
  { valor: "MOTIVOS_ECONOMICOS", texto: "Motivos económicos" },
  { valor: "MOTIVOS_SALUD", texto: "Motivos de salud" },
  { valor: "OTRO", texto: "Otro motivo" },
] as const;

function CabeceraEstudiante({ detalle, linea }: { detalle: DetalleMatricula; linea: string }) {
  const nombre = detalle.estudiante?.nombreCompleto ?? "—";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-borde bg-fondo p-3">
      <Avatar nombre={nombre} tono="verde" />
      <div className="flex min-w-0 flex-col text-[13px]">
        <span className="font-semibold text-texto">{nombre}</span>
        <span className="text-texto-3">{linea}</span>
      </div>
    </div>
  );
}

// ---------- M-05 · Traslado de sección (US19) ----------

export function ModalTraslado({
  detalle,
  onCerrar,
  onTrasladado,
}: {
  detalle: DetalleMatricula;
  onCerrar: () => void;
  onTrasladado: (d: DetalleMatricula) => void;
}) {
  const [secciones, setSecciones] = useState<Seccion[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoyEnLima());
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const actual = detalle.seccion;

  useEffect(() => {
    async function cargar() {
      try {
        setSecciones(await api<Seccion[]>(`/academico/secciones?anioId=${detalle.anio.id}`));
      } catch (e) {
        setErrorCarga(alertaError(e));
      }
    }
    void cargar();
  }, [detalle.anio.id]);

  // solo otras secciones activas del mismo grado (US19); el backend lo vuelve a verificar
  const opciones = (secciones ?? []).filter(
    (s) => s.grado.id === actual?.gradoId && s.id !== actual?.id && s.estado === "ACTIVA",
  );

  async function trasladar() {
    if (!destino) {
      setErrores({ seccionDestinoId: "Elige la sección de destino" });
      return;
    }
    setErrores({});
    setGeneral(null);
    setEnviando(true);
    try {
      const d = await api<DetalleMatricula>(`/matricula/matriculas/${detalle.matriculaId}/trasladar`, {
        method: "POST",
        body: { seccionDestinoId: destino, fecha, motivo: motivo.trim() || null },
      });
      onTrasladado(d);
    } catch (err) {
      const r = separarErrores(err);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-traslado"
      tonoIcono="azul"
      titulo="Traslado de sección"
      subtitulo="Solo entre secciones del mismo grado"
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono="icon-traslado-blanco" onClick={trasladar} cargando={enviando} disabled={!opciones.length}>
            Trasladar
          </Boton>
        </>
      }
    >
      <CabeceraEstudiante
        detalle={detalle}
        linea={`Sección actual: ${actual?.nombre ?? "—"}${actual?.aula ? ` · Aula ${actual.aula}` : ""}`}
      />
      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-medium text-texto-2">Sección de destino</p>
        {errorCarga && <Alerta tipo="error" titulo={errorCarga} />}
        {!secciones && !errorCarga && (
          <div className="flex items-center gap-3 text-[14px] text-texto-2">
            <Spinner claro={false} /> Cargando secciones…
          </div>
        )}
        {secciones && !opciones.length && (
          <Alerta tipo="info" titulo={`No hay otras secciones activas de ${actual?.grado ?? "este grado"}`}>
            {MENSAJE_OTRO_GRADO}. Crea otra sección del grado en «Grados y secciones» para poder trasladar.
          </Alerta>
        )}
        <div role="radiogroup" aria-label="Sección de destino" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {opciones.map((s) => (
            <TarjetaSeccion
              key={s.id}
              seccion={s}
              elegida={destino === s.id}
              deshabilitada={s.vacantes.completo}
              onElegir={() => setDestino(s.id)}
            />
          ))}
        </div>
        {errores.seccionDestinoId && <p className="text-[13px] text-rojo-oscuro">{errores.seccionDestinoId}</p>}
      </div>
      <Campo
        etiqueta="Fecha efectiva"
        obligatorio
        type="date"
        value={fecha}
        min={detalle.historialSecciones.at(-1)?.fechaInicio ?? detalle.fechaMatricula}
        max={detalle.anio.fechaFin}
        error={errores.fecha}
        onChange={(e) => setFecha(e.target.value)}
      />
      <Campo
        etiqueta="Motivo (opcional)"
        maxLength={200}
        placeholder="Por ejemplo: reorganización de secciones"
        value={motivo}
        error={errores.motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <Alerta tipo="info" titulo="El historial se conserva">
        {`Lo registrado en ${actual?.nombre ?? "la sección actual"} hasta la fecha efectiva se conserva. Desde esa fecha, ` +
          "sus registros de notas y asistencia se asignan a la nueva sección."}
      </Alerta>
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}

// ---------- M-18 · Retirar estudiante (US57) ----------

/** Vista previa del efecto en el cronograma; el backend aplica la misma regla y además conserva las cuotas con pagos. */
function efectoRetiro(detalle: DetalleMatricula, fecha: string) {
  const cuotas = detalle.cronograma.cuotas.filter((c) => c.estado !== "ANULADO");
  const seAnulan = cuotas.filter((c) => c.estado === "PENDIENTE" && fecha && c.fechaVencimiento > fecha);
  const seConservan = cuotas.filter((c) => !seAnulan.includes(c));
  // en céntimos enteros, sin pasar por float
  const centimos = (monto: string) => {
    const [enteros, decimales = "0"] = monto.split(".");
    return Number(enteros) * 100 + Number(decimales.padEnd(2, "0").slice(0, 2));
  };
  const suma = (lista: typeof cuotas) => {
    const total = lista.reduce((t, c) => t + centimos(c.monto), 0);
    return soles(`${Math.trunc(total / 100)}.${String(total % 100).padStart(2, "0")}`);
  };
  return { seAnulan, seConservan, totalConservado: suma(seConservan) };
}

export function ModalRetiro({
  detalle,
  onCerrar,
  onRetirado,
}: {
  detalle: DetalleMatricula;
  onCerrar: () => void;
  onRetirado: (d: DetalleMatricula) => void;
}) {
  const [fecha, setFecha] = useState(hoyEnLima());
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const responsable = detalle.apoderados.find((a) => a.esResponsablePago);
  const efecto = efectoRetiro(detalle, fecha);

  async function retirar() {
    if (!motivo) {
      setErrores({ motivo: MENSAJE_SIN_MOTIVO_RETIRO });
      return;
    }
    setErrores({});
    setGeneral(null);
    setEnviando(true);
    try {
      const d = await api<DetalleMatricula>(`/matricula/matriculas/${detalle.matriculaId}/retirar`, {
        method: "POST",
        body: { fecha, motivo, detalle: texto.trim() || null },
      });
      onRetirado(d);
    } catch (err) {
      const r = separarErrores(err);
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-retiro"
      titulo="Retirar estudiante"
      subtitulo={`${detalle.estudiante?.nombreCompleto ?? ""} · ${detalle.seccion?.nombre ?? ""} · matrícula ${detalle.anio.anio}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="peligro" icono="icon-retiro-blanco" onClick={retirar} cargando={enviando}>
            Registrar retiro
          </Boton>
        </>
      }
    >
      <CabeceraEstudiante
        detalle={detalle}
        linea={`Matriculado el ${fechaDia(detalle.fechaMatricula)} · Responsable del pago: ${responsable?.nombreCompleto ?? "—"}`}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Campo
            etiqueta="Fecha de retiro"
            obligatorio
            type="date"
            value={fecha}
            min={detalle.fechaMatricula}
            max={detalle.anio.fechaFin}
            error={errores.fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <p className="text-[13px] text-texto-3">Desde la fecha de matrícula hasta el fin del año académico.</p>
        </div>
        <Selector
          etiqueta="Motivo del retiro"
          obligatorio
          valor={motivo}
          error={errores.motivo}
          ayuda="Traslado, motivos económicos, motivos de salud u otro."
          onCambiar={setMotivo}
        >
          <option value="">Elige el motivo</option>
          {MOTIVOS_RETIRO.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.texto}
            </option>
          ))}
        </Selector>
      </div>
      <Campo
        etiqueta="Detalle (opcional)"
        maxLength={300}
        placeholder="Por ejemplo: la familia se muda a otra ciudad"
        value={texto}
        error={errores.detalle}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="overflow-hidden rounded-lg border border-borde text-[13px]">
        <p className="border-b border-borde bg-fondo px-3 py-2 font-semibold text-texto-2">
          Efecto en el cronograma de cobros
        </p>
        {efecto.seAnulan.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 border-b border-borde px-3 py-2">
            <span className="text-texto-2">{`Se anula · ${c.concepto.toLowerCase()} (vence ${diaMes(c.fechaVencimiento)})`}</span>
            <span className="font-semibold text-texto">{soles(c.monto)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-texto-2">
            {efecto.seConservan.length === 1
              ? "Se conserva · 1 cuota pagada, vencida o anterior al retiro"
              : `Se conservan · ${efecto.seConservan.length} cuotas pagadas, vencidas o anteriores al retiro`}
          </span>
          <span className="font-semibold text-texto">{efecto.totalConservado}</span>
        </div>
      </div>
      <Alerta tipo="info" titulo={`Se liberará 1 vacante en ${detalle.seccion?.nombre ?? "la sección"}`}>
        La matrícula pasa a «Retirado». Sus notas, asistencia y pagos se conservan, y el retiro queda en la bitácora de
        auditoría.
      </Alerta>
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}

// ---------- Ficha de matrícula en PDF (US20) ----------

/** Descarga la ficha con los datos actuales; los errores (datos pendientes) se muestran en `onError`. */
export function BotonFicha({
  matriculaId,
  onError,
}: {
  matriculaId: string;
  onError: (mensaje: string | null) => void;
}) {
  const [generando, setGenerando] = useState(false);

  async function generar() {
    setGenerando(true);
    onError(null);
    try {
      await descargar(`/matricula/matriculas/${matriculaId}/ficha`, "ficha-matricula.pdf");
    } catch (e) {
      onError(alertaError(e));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Boton variante="secundario" icono="icon-pdf" onClick={generar} cargando={generando}>
      Generar ficha PDF
    </Boton>
  );
}

// ---------- Historial de secciones del detalle ----------

export function HistorialSecciones({ detalle }: { detalle: DetalleMatricula }) {
  if (detalle.historialSecciones.length < 2 && !detalle.retiro) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-semibold text-texto">Historial de secciones</p>
      <ol className="flex flex-col gap-1 text-[13px]">
        {detalle.historialSecciones.map((t) => (
          <li
            key={`${t.seccionId}-${t.fechaInicio}`}
            className="flex flex-wrap justify-between gap-2 rounded-lg border border-borde px-3 py-2"
          >
            <span className="font-semibold text-texto">{t.seccion}</span>
            <span className="text-texto-2">
              {`${fechaDia(t.fechaInicio)} – ${t.fechaFin ? fechaDia(t.fechaFin) : "hoy"}${t.motivo ? ` · ${t.motivo}` : ""}`}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[12px] text-texto-3">{`Estado actual: ${NOMBRE_ESTADO[detalle.estado]}`}</p>
    </div>
  );
}
