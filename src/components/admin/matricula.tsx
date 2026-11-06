// Piezas de AD-10 Matrícula en sección (US18) y su cronograma (US21): montos del año, tarjetas de sección, resumen
// con el cronograma, listado de matrículas y los modales de detalle y de anulación (M-19).
"use client";

import { useEffect, useState } from "react";
import { Alerta, Badge, Boton, Campo, Icono, Modal, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia } from "@/lib/formato";
import { Avatar } from "./apoderados";
import { BarraOcupacion, Selector, separarErrores, type Grado, type Seccion } from "./grados";
import { alertaError } from "./PortalAdmin";

// ---------- Tipos de la API (docs/api/matricula.md) ----------

export type EstadoMatricula = "EN_PROCESO" | "MATRICULADO" | "RETIRADO" | "ANULADO" | "FINALIZADO";
export type ModalidadPago = "MENSUAL" | "ANUAL";

export interface Cuota {
  id?: string;
  tipo: "MATRICULA" | "PENSION";
  mes: number | null;
  concepto: string;
  monto: string;
  fechaVencimiento: string;
  estado?: "PENDIENTE" | "PAGADO" | "ANULADO";
}

export interface CronogramaPrevisto {
  cuotas: Cuota[];
  total: string;
  extemporanea: boolean;
  pensiones: string | null;
}

export interface ApoderadoDelEstudiante {
  vinculoId: string;
  apoderadoId: string;
  nombreCompleto: string;
  parentesco: string;
  esPrincipal: boolean;
  autorizado: boolean;
  telefono: string | null;
  email: string | null;
}

/** GET /matricula/estudiantes/{id}?anioId= */
export interface SituacionEstudiante {
  estudiante: {
    estudianteId: string;
    dni: string;
    nombreCompleto: string;
    gradoIngresoId: string | null;
    apoderados: ApoderadoDelEstudiante[];
  };
  anio: { id: string; anio: number; estado: string };
  matricula: {
    matriculaId: string;
    estado: EstadoMatricula;
    seccionId: string | null;
    vinculoResponsableId: string | null;
    modalidadPago: ModalidadPago;
    fechaMatricula: string;
  } | null;
  montos: { montoMatricula: string | null; montoPension: string | null };
  cronogramaPrevisto: CronogramaPrevisto | null;
}

export interface MontosAnio {
  anioAcademicoId: string;
  anio: number;
  montoMatricula: string | null;
  montoPension: string | null;
  configurados: boolean;
  sugeridos: { montoMatricula: string | null; montoPension: string | null };
}

export interface MatriculaListada {
  matriculaId: string;
  estudianteId: string;
  estudiante: { nombreCompleto: string; dni: string };
  grado: string | null;
  seccion: { id: string; nombre: string } | null;
  fechaMatricula: string;
  estado: EstadoMatricula;
  modalidadPago: ModalidadPago;
}

export interface DetalleMatricula {
  matriculaId: string;
  estado: EstadoMatricula;
  fechaMatricula: string;
  modalidadPago: ModalidadPago;
  anio: { id: string; anio: number };
  estudiante: { estudianteId: string; nombreCompleto: string; dni: string } | null;
  seccion: { id: string; nombre: string; aula: string | null; tutor: string | null } | null;
  apoderados: (ApoderadoDelEstudiante & { esResponsablePago: boolean })[];
  cronograma: { cuotas: Cuota[]; total: string };
  anulacion: { anuladoEn: string; motivo: string | null } | null;
  pagos: number;
  puedeAnular: boolean;
}

export const MENSAJE_INCOMPLETA = "Complete la sección y el apoderado responsable para confirmar la matrícula";
export const MENSAJE_YA_MATRICULADO = "Este estudiante ya está matriculado en el periodo actual";

export const NOMBRE_ESTADO: Record<EstadoMatricula, string> = {
  EN_PROCESO: "En proceso",
  MATRICULADO: "Matriculado",
  RETIRADO: "Retirado",
  ANULADO: "Anulado",
  FINALIZADO: "Finalizado",
};

const TONO_ESTADO: Record<EstadoMatricula, "verde" | "ambar" | "gris" | "azul"> = {
  EN_PROCESO: "ambar",
  MATRICULADO: "verde",
  RETIRADO: "gris",
  ANULADO: "gris",
  FINALIZADO: "azul",
};

export const MOTIVOS_ANULACION = [
  { valor: "ERROR_DIGITACION", texto: "Se registró por error" },
  { valor: "SOLICITUD_APODERADO", texto: "Solicitud del apoderado" },
  { valor: "OTRO", texto: "Otro motivo" },
] as const;

/** «1700.00» → «S/ 1 700.00» (sin pasar por float). */
export function soles(monto: string) {
  const [enteros, decimales = "00"] = monto.split(".");
  return `S/ ${enteros.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${decimales}`;
}

export const etiquetaSeccion = (s: Pick<Seccion, "nombre" | "grado">) => `${s.grado.numero}° ${s.nombre}`;

export function BadgeEstado({ estado }: { estado: EstadoMatricula }) {
  return (
    <Badge tono={TONO_ESTADO[estado]} punto>
      {NOMBRE_ESTADO[estado]}
    </Badge>
  );
}

// ---------- Montos del año ----------

/** Barra con los montos del año y el botón para editarlos; sin montos, aviso de que no se puede matricular. */
export function BarraMontos({ montos, onEditar }: { montos: MontosAnio; onEditar: () => void }) {
  if (!montos.configurados) {
    return (
      <Alerta tipo="aviso" icono="alerta-warn" titulo={`El año ${montos.anio} no tiene montos de matrícula y pensión`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex-1">
            Configúralos para poder matricular: con ellos se genera el cronograma de pagos.
          </span>
          <Boton variante="secundario" onClick={onEditar}>
            Configurar montos
          </Boton>
        </div>
      </Alerta>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-borde bg-white px-5 py-3 text-[14px]">
      <span className="font-semibold text-texto">Montos {montos.anio}</span>
      <span className="text-texto-2">
        Matrícula <strong className="text-texto">{soles(montos.montoMatricula!)}</strong>
      </span>
      <span className="text-texto-2">
        Pensión mensual <strong className="text-texto">{soles(montos.montoPension!)}</strong>
      </span>
      <button
        type="button"
        onClick={onEditar}
        className="ml-auto flex items-center gap-1.5 font-semibold text-kubo-azul hover:underline"
      >
        <Icono nombre="act-edit" size={16} /> Editar montos
      </button>
    </div>
  );
}

export function ModalMontos({
  montos,
  onCerrar,
  onGuardado,
}: {
  montos: MontosAnio;
  onCerrar: () => void;
  onGuardado: (m: MontosAnio) => void;
}) {
  const [matricula, setMatricula] = useState(montos.montoMatricula ?? montos.sugeridos.montoMatricula ?? "");
  const [pension, setPension] = useState(montos.montoPension ?? montos.sugeridos.montoPension ?? "");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setGeneral(null);
    try {
      const m = await api<MontosAnio>(`/academico/anios/${montos.anioAcademicoId}/montos`, {
        method: "PUT",
        body: { montoMatricula: matricula, montoPension: pension },
      });
      onGuardado(m);
    } catch (e) {
      const r = separarErrores(e, { MONTO_INVALIDO: "montoMatricula" });
      setErrores(r.campos);
      setGeneral(r.general);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="act-edit"
      tonoIcono="azul"
      titulo={`Montos del año ${montos.anio}`}
      subtitulo="Se usan al generar el cronograma de cada matrícula"
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton onClick={guardar} cargando={guardando} icono="check-blanco">
            Guardar montos
          </Boton>
        </>
      }
    >
      {!montos.configurados && montos.sugeridos.montoMatricula && (
        <Alerta tipo="info">Se precargaron los montos generales de la institución. Revísalos antes de guardar.</Alerta>
      )}
      <Campo
        etiqueta="Cuota de matrícula (S/)"
        obligatorio
        inputMode="decimal"
        maxLength={10}
        placeholder="350.00"
        value={matricula}
        error={errores.montoMatricula}
        onChange={(e) => setMatricula(e.target.value)}
      />
      <Campo
        etiqueta="Pensión mensual (S/)"
        obligatorio
        inputMode="decimal"
        maxLength={10}
        placeholder="450.00"
        value={pension}
        error={errores.montoPension}
        onChange={(e) => setPension(e.target.value)}
      />
      <p className="text-[13px] leading-[1.4] text-texto-3">
        Los cambios solo afectan a las matrículas que se confirmen después: los cronogramas ya generados no cambian.
      </p>
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}

// ---------- Secciones del grado ----------

/** Tarjeta de AD-10: «3° B · Aula 205 · Tutora: A. Vega · 28/30 · 2 vacantes». */
export function TarjetaSeccion({
  seccion,
  elegida,
  onElegir,
  deshabilitada,
}: {
  seccion: Seccion;
  elegida: boolean;
  onElegir: () => void;
  deshabilitada?: boolean;
}) {
  const { vacantes } = seccion;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegida}
      disabled={deshabilitada}
      onClick={onElegir}
      className={`flex flex-col gap-3 rounded-lg border p-4 text-left transition disabled:cursor-not-allowed ${
        elegida ? "border-kubo-azul ring-1 ring-kubo-azul" : "border-borde hover:border-kubo-azul/50"
      } ${vacantes.completo ? "bg-fondo" : "bg-white"}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[20px] font-semibold text-texto">{etiquetaSeccion(seccion)}</span>
        {vacantes.completo ? (
          <Icono nombre="icon-lock" size={16} />
        ) : (
          <span
            aria-hidden
            className={`size-4 rounded-full border-2 ${elegida ? "border-[5px] border-kubo-azul" : "border-texto-3"}`}
          />
        )}
      </span>
      <span className="text-[13px] text-texto-3">
        {seccion.aula ? `Aula ${seccion.aula.nombre}` : "Sin aula"}
        {seccion.tutor ? ` · Tutor: ${seccion.tutor.nombreCorto}` : ""}
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <BarraOcupacion ocupados={vacantes.matriculados} total={vacantes.aforo} />
        {vacantes.completo ? (
          <Badge tono="rojo" punto>
            Sin vacantes
          </Badge>
        ) : (
          <Badge tono="verde" punto>
            {`${vacantes.disponibles} vacante${vacantes.disponibles === 1 ? "" : "s"}`}
          </Badge>
        )}
      </span>
    </button>
  );
}

// ---------- Cronograma ----------

export function TablaCronograma({ cuotas, total, conEstado }: { cuotas: Cuota[]; total: string; conEstado?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-fondo p-4 text-[13px]">
      {cuotas.map((c) => (
        <div
          key={c.id ?? `${c.tipo}-${c.mes}`}
          className={`flex flex-wrap justify-between gap-x-3 ${c.estado === "ANULADO" ? "text-texto-3 line-through" : "text-texto-2"}`}
        >
          <span>{c.tipo === "MATRICULA" ? `${c.concepto} (pago único)` : c.concepto}</span>
          <span className="text-texto">
            {soles(c.monto)} · vence {fechaDia(c.fechaVencimiento)}
            {conEstado && c.estado
              ? ` · ${c.estado === "PENDIENTE" ? "Pendiente" : c.estado === "PAGADO" ? "Pagado" : "Anulado"}`
              : ""}
          </span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-borde pt-2 font-semibold text-texto">
        <span>Total</span>
        <span>{soles(total)}</span>
      </div>
    </div>
  );
}

// ---------- Detalle y anulación (M-19) ----------

export function ModalDetalle({
  matriculaId,
  onCerrar,
  onAnular,
}: {
  matriculaId: string;
  onCerrar: () => void;
  onAnular: (d: DetalleMatricula) => void;
}) {
  const [detalle, setDetalle] = useState<DetalleMatricula | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        setDetalle(await api<DetalleMatricula>(`/matricula/matriculas/${matriculaId}`));
      } catch (e) {
        setError(alertaError(e));
      }
    }
    void cargar();
  }, [matriculaId]);

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-eye"
      tonoIcono="azul"
      titulo={detalle?.estudiante?.nombreCompleto ?? "Detalle de la matrícula"}
      subtitulo={
        detalle
          ? `${detalle.seccion?.nombre ?? "Sin sección"} · matrícula ${detalle.anio.anio} · ${NOMBRE_ESTADO[detalle.estado]}`
          : undefined
      }
      pie={
        <>
          {detalle?.puedeAnular && (
            <Boton variante="peligro" icono="icon-ban-blanco" onClick={() => onAnular(detalle)}>
              Anular matrícula
            </Boton>
          )}
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
        </>
      }
    >
      {error && <Alerta tipo="error" titulo={error} />}
      {!detalle && !error && (
        <div className="flex items-center gap-3 text-[14px] text-texto-2">
          <Spinner claro={false} /> Cargando…
        </div>
      )}
      {detalle && (
        <>
          <dl className="grid grid-cols-2 gap-3 text-[14px]">
            <div>
              <dt className="text-texto-3">DNI</dt>
              <dd className="text-texto">{detalle.estudiante?.dni}</dd>
            </div>
            <div>
              <dt className="text-texto-3">Fecha de matrícula</dt>
              <dd className="text-texto">{fechaDia(detalle.fechaMatricula)}</dd>
            </div>
            <div>
              <dt className="text-texto-3">Aula y tutor</dt>
              <dd className="text-texto">
                {detalle.seccion
                  ? `${detalle.seccion.aula ?? "Sin aula"} · ${detalle.seccion.tutor ?? "Sin tutor"}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-texto-3">Modalidad</dt>
              <dd className="text-texto">{detalle.modalidadPago === "ANUAL" ? "Anual" : "Mensual"}</dd>
            </div>
          </dl>
          {detalle.anulacion && (
            <Alerta tipo="info" titulo={`Anulada el ${fechaDia(detalle.anulacion.anuladoEn.slice(0, 10))}`}>
              {detalle.anulacion.motivo}
            </Alerta>
          )}
          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-semibold text-texto">Apoderados</p>
            {detalle.apoderados.map((a) => (
              <div key={a.vinculoId} className="flex items-center gap-3 rounded-lg border border-borde p-3">
                <Avatar nombre={a.nombreCompleto} tono={a.esPrincipal ? "verde" : "azul"} />
                <div className="flex min-w-0 flex-1 flex-col text-[13px]">
                  <span className="font-semibold text-texto">{a.nombreCompleto}</span>
                  <span className="text-texto-3">{a.parentesco}</span>
                </div>
                {a.esPrincipal && <Badge tono="verde">Principal</Badge>}
                {a.esResponsablePago && <Badge tono="azul">Responsable del pago</Badge>}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-semibold text-texto">Cronograma de pagos</p>
            {detalle.cronograma.cuotas.length ? (
              <TablaCronograma cuotas={detalle.cronograma.cuotas} total={detalle.cronograma.total} conEstado />
            ) : (
              <p className="text-[14px] text-texto-2">Aún no tiene cronograma: se genera al confirmar la matrícula.</p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

export function ModalAnular({
  detalle,
  onCerrar,
  onAnulada,
}: {
  detalle: DetalleMatricula;
  onCerrar: () => void;
  onAnulada: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const conPagos = detalle.pagos > 0;

  async function anular() {
    const e: Record<string, string> = {};
    if (!motivo) e.motivo = "Elige el motivo de la anulación";
    if (texto.trim().length < 5) e.detalle = "Describe por qué se anula esta matrícula";
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    setGeneral(null);
    try {
      await api(`/matricula/matriculas/${detalle.matriculaId}/anular`, {
        method: "POST",
        body: { motivo, detalle: texto },
      });
      onAnulada();
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
      icono="act-ban"
      titulo="Anular matrícula"
      subtitulo={`${detalle.estudiante?.nombreCompleto ?? ""} · ${detalle.seccion?.nombre ?? "Sin sección"} · matrícula ${detalle.anio.anio}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="peligro" icono="icon-ban-blanco" onClick={anular} cargando={enviando} disabled={conPagos}>
            Anular matrícula
          </Boton>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-lg border border-borde bg-fondo p-3">
        <Avatar nombre={detalle.estudiante?.nombreCompleto ?? "?"} />
        <div className="flex flex-col text-[13px]">
          <span className="font-semibold text-texto">{detalle.estudiante?.nombreCompleto}</span>
          <span className="text-texto-3">
            {`Matrícula del ${fechaDia(detalle.fechaMatricula)} · estado actual: ${NOMBRE_ESTADO[detalle.estado]}`}
          </span>
        </div>
      </div>
      {conPagos && (
        <Alerta tipo="error" titulo="No se puede anular esta matrícula">
          {`Primero anula los pagos confirmados de esta matrícula (${detalle.pagos}).`}
        </Alerta>
      )}
      <Selector
        etiqueta="Motivo de la anulación"
        obligatorio
        valor={motivo}
        deshabilitado={conPagos}
        error={errores.motivo}
        onCambiar={setMotivo}
      >
        <option value="">Elige el motivo</option>
        {MOTIVOS_ANULACION.map((m) => (
          <option key={m.valor} value={m.valor}>
            {m.texto}
          </option>
        ))}
      </Selector>
      <Campo
        etiqueta="Detalle"
        obligatorio
        maxLength={200}
        placeholder="Describe por qué se anula esta matrícula…"
        value={texto}
        disabled={conPagos}
        error={errores.detalle}
        onChange={(e) => setTexto(e.target.value)}
      />
      <Alerta tipo="info" titulo="Qué ocurre al anular">
        Las cuotas pendientes se anulan, se libera la vacante de la sección y la matrícula pasa a «Anulado». El registro
        no se elimina: queda con el motivo, tu usuario y la fecha en la bitácora de auditoría.
      </Alerta>
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}

// ---------- Filtros del listado ----------

export function FiltrosMatriculas({
  grados,
  secciones,
  estado,
  gradoId,
  seccionId,
  onCambiar,
}: {
  grados: Grado[];
  secciones: Seccion[];
  estado: string;
  gradoId: string;
  seccionId: string;
  onCambiar: (c: { estado?: string; gradoId?: string; seccionId?: string }) => void;
}) {
  const delGrado = secciones.filter((s) => !gradoId || s.grado.id === gradoId);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Selector etiqueta="Estado" oculto valor={estado} onCambiar={(v) => onCambiar({ estado: v })}>
        <option value="">Todos los estados</option>
        {(Object.keys(NOMBRE_ESTADO) as EstadoMatricula[]).map((e) => (
          <option key={e} value={e}>
            {NOMBRE_ESTADO[e]}
          </option>
        ))}
      </Selector>
      <Selector etiqueta="Grado" oculto valor={gradoId} onCambiar={(v) => onCambiar({ gradoId: v, seccionId: "" })}>
        <option value="">Todos los grados</option>
        {grados.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nombre}
          </option>
        ))}
      </Selector>
      <Selector etiqueta="Sección" oculto valor={seccionId} onCambiar={(v) => onCambiar({ seccionId: v })}>
        <option value="">Todas las secciones</option>
        {delGrado.map((s) => (
          <option key={s.id} value={s.id}>
            {etiquetaSeccion(s)}
          </option>
        ))}
      </Selector>
    </div>
  );
}
