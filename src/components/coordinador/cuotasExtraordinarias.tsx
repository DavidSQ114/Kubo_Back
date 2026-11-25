// Piezas de «Cuotas extraordinarias» del Coordinador académico (bloque M4): modal para crear un lote con vista previa
// (cantidad de cuotas y total antes de confirmar), detalle del lote con sus cuotas y modal para anular el lote o una
// cuota sin pagar con motivo.
"use client";

import { useState } from "react";
import { Avatar, Buscador, type EstudianteListado } from "@/components/admin/apoderados";
import { Selector, separarErrores, type Grado, type Seccion } from "@/components/admin/grados";
import { alertaError } from "@/components/admin/PortalAdmin";
import { Alerta, Badge, Boton, Campo, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { fechaDia, hoyEnLima, soles } from "@/lib/formato";

// ---------- Tipos de la API (docs/api/matricula.md, «Cuotas extraordinarias») ----------

export type DestinoLote = "ALUMNO" | "SECCION" | "GRADO" | "ANIO";

export const DESTINOS: { valor: DestinoLote; texto: string }[] = [
  { valor: "ALUMNO", texto: "Un alumno" },
  { valor: "SECCION", texto: "Una sección" },
  { valor: "GRADO", texto: "Un grado" },
  { valor: "ANIO", texto: "Todo el año" },
];

export interface LoteListado {
  loteId: string;
  concepto: string;
  monto: string;
  fechaVencimiento: string;
  destino: DestinoLote;
  nombreDestino: string;
  destinoNombre: string;
  estado: "ACTIVO" | "ANULADO";
  creadoEn: string;
  creadoPor: string | null;
  anulacion: { anuladoEn: string; motivo: string | null } | null;
  resumen: { cuotas: number; pendientes: number; pagadas: number; anuladas: number; total: string };
}

export interface AlumnoDelLote {
  matriculaId: string;
  estudianteId: string;
  nombreCompleto: string;
  seccion: string | null;
}

export interface DetalleLote extends LoteListado {
  cuotas: (AlumnoDelLote & { cuotaId: string; estado: "PENDIENTE" | "PAGADO" | "ANULADO"; monto: string })[];
}

interface VistaPrevia {
  concepto: string;
  monto: string;
  fechaVencimiento: string;
  destinoNombre: string;
  cantidad: number;
  total: string;
  alumnos: AlumnoDelLote[];
}

export function BadgeLote({ estado }: { estado: LoteListado["estado"] }) {
  return estado === "ACTIVO" ? (
    <Badge tono="verde" punto>
      Activo
    </Badge>
  ) : (
    <Badge tono="gris" punto>
      Anulado
    </Badge>
  );
}

const NOMBRE_ESTADO_CUOTA = { PENDIENTE: "Pendiente", PAGADO: "Pagado", ANULADO: "Anulado" } as const;
const TONO_ESTADO_CUOTA = { PENDIENTE: "celeste", PAGADO: "verde", ANULADO: "gris" } as const;

// ---------- Nuevo lote con vista previa ----------

export function ModalNuevoLote({
  anioId,
  grados,
  secciones,
  onCerrar,
  onCreado,
}: {
  anioId: string;
  grados: Grado[];
  secciones: Seccion[];
  onCerrar: () => void;
  onCreado: (lote: DetalleLote) => void;
}) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [vencimiento, setVencimiento] = useState(hoyEnLima());
  const [destino, setDestino] = useState<DestinoLote>("SECCION");
  const [destinoId, setDestinoId] = useState("");
  const [alumno, setAlumno] = useState<EstudianteListado | null>(null);
  const [previa, setPrevia] = useState<VistaPrevia | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cuerpo = () => ({
    anioAcademicoId: anioId,
    concepto: concepto.trim(),
    monto: monto.trim(),
    fechaVencimiento: vencimiento,
    destino,
    destinoId: destino === "ANIO" ? null : destino === "ALUMNO" ? (alumno?.estudianteId ?? null) : destinoId || null,
  });

  async function enviar(ruta: string, alTerminar: (r: unknown) => void) {
    const e: Record<string, string> = {};
    if (!concepto.trim()) e.concepto = "Escribe el concepto";
    if (!monto.trim()) e.monto = "Ingresa el monto";
    if (destino !== "ANIO" && !cuerpo().destinoId) e.destinoId = "Elige el destino";
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    setGeneral(null);
    try {
      alTerminar(await api(ruta, { method: "POST", body: cuerpo() }));
    } catch (err) {
      const r = separarErrores(err);
      setErrores(r.campos);
      setGeneral(r.general);
      setPrevia(null);
    } finally {
      setEnviando(false);
    }
  }

  const verPrevia = () => enviar("/matricula/extraordinarias/vista-previa", (r) => setPrevia(r as VistaPrevia));
  const confirmar = () => enviar("/matricula/extraordinarias", (r) => onCreado(r as DetalleLote));

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="nav-wallet-azul"
      tonoIcono="azul"
      titulo={previa ? "Confirmar cuota extraordinaria" : "Nueva cuota extraordinaria"}
      subtitulo={
        previa
          ? "Revisa la cantidad y el total antes de generar las cuotas"
          : "Se genera una cuota por cada alumno matriculado del destino"
      }
      pie={
        previa ? (
          <>
            <Boton variante="secundario" onClick={() => setPrevia(null)} disabled={enviando}>
              Volver
            </Boton>
            <Boton icono="check-blanco" onClick={confirmar} cargando={enviando}>
              {`Generar ${previa.cantidad} cuota${previa.cantidad === 1 ? "" : "s"}`}
            </Boton>
          </>
        ) : (
          <>
            <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton onClick={verPrevia} cargando={enviando}>
              Ver vista previa
            </Boton>
          </>
        )
      }
    >
      {previa ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Dato titulo="Cuotas" valor={String(previa.cantidad)} />
            <Dato titulo="Monto de cada una" valor={soles(previa.monto)} />
            <Dato titulo="Total" valor={soles(previa.total)} destacado />
          </div>
          <p className="text-[14px] text-texto-2">
            {`«${previa.concepto}» · ${previa.destinoNombre} · vence el ${fechaDia(previa.fechaVencimiento)}`}
          </p>
          <ul className="flex max-h-[240px] flex-col divide-y divide-borde overflow-y-auto rounded-lg border border-borde">
            {previa.alumnos.map((a) => (
              <li key={a.matriculaId} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                <span className="font-semibold text-texto">{a.nombreCompleto}</span>
                <span className="text-texto-3">{a.seccion ?? "Sin sección"}</span>
              </li>
            ))}
          </ul>
          <Alerta tipo="info" titulo="Al confirmar">
            Las cuotas aparecen en el estado de cuenta y en el portal del apoderado, que recibe un aviso. No entran en
            el orden de pago: se pagan en cualquier momento, siempre completas.
          </Alerta>
        </>
      ) : (
        <>
          <Campo
            etiqueta="Concepto"
            obligatorio
            maxLength={100}
            placeholder="Por ejemplo, Paseo de fin de año"
            value={concepto}
            error={errores.concepto}
            onChange={(e) => setConcepto(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Monto (S/)"
              obligatorio
              inputMode="decimal"
              maxLength={10}
              placeholder="50.00"
              value={monto}
              error={errores.monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            <Campo
              etiqueta="Vencimiento"
              obligatorio
              type="date"
              min={hoyEnLima()}
              value={vencimiento}
              error={errores.fechaVencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
            />
          </div>
          <Selector
            etiqueta="Destino"
            obligatorio
            valor={destino}
            onCambiar={(v) => {
              setDestino(v as DestinoLote);
              setDestinoId("");
              setAlumno(null);
            }}
          >
            {DESTINOS.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.texto}
              </option>
            ))}
          </Selector>
          {destino === "SECCION" && (
            <Selector
              etiqueta="Sección"
              obligatorio
              valor={destinoId}
              error={errores.destinoId}
              onCambiar={setDestinoId}
            >
              <option value="">Elige la sección</option>
              {secciones.map((s) => (
                <option key={s.id} value={s.id}>{`${s.grado.numero}° ${s.nombre}`}</option>
              ))}
            </Selector>
          )}
          {destino === "GRADO" && (
            <Selector etiqueta="Grado" obligatorio valor={destinoId} error={errores.destinoId} onCambiar={setDestinoId}>
              <option value="">Elige el grado</option>
              {grados.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Selector>
          )}
          {destino === "ALUMNO" &&
            (alumno ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-borde bg-fondo p-3">
                <div className="flex items-center gap-3">
                  <Avatar nombre={alumno.nombreCompleto} />
                  <span className="text-[14px] font-semibold text-texto">{alumno.nombreCompleto}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAlumno(null)}
                  className="text-[14px] font-semibold text-kubo-azul hover:underline"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <Buscador<EstudianteListado>
                  ruta="/comunidad/estudiantes"
                  etiqueta="Alumno"
                  placeholder="Buscar alumno por DNI o nombre"
                  idDe={(e) => e.estudianteId}
                  elegidos={[]}
                  accion="Elegir"
                  onElegir={setAlumno}
                  vacio="No hay alumnos con ese DNI o nombre."
                  fila={(e) => (
                    <span className="flex flex-col text-[13px]">
                      <span className="font-semibold text-texto">{e.nombreCompleto}</span>
                      <span className="text-texto-3">{`DNI ${e.dni}`}</span>
                    </span>
                  )}
                />
                {errores.destinoId && <p className="text-[13px] text-rojo-oscuro">{errores.destinoId}</p>}
              </>
            ))}
        </>
      )}
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}

function Dato({ titulo, valor, destacado = false }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-fondo px-4 py-3">
      <span className="text-[12px] text-texto-3">{titulo}</span>
      <span className={`text-[18px] font-semibold ${destacado ? "text-kubo-azul" : "text-texto"}`}>{valor}</span>
    </div>
  );
}

// ---------- Detalle del lote ----------

export function ModalDetalleLote({
  lote,
  onCerrar,
  onAnularCuota,
}: {
  lote: DetalleLote;
  onCerrar: () => void;
  onAnularCuota: (cuota: DetalleLote["cuotas"][number]) => void;
}) {
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="nav-wallet-azul"
      tonoIcono="azul"
      titulo={lote.concepto}
      subtitulo={`${lote.destinoNombre} · ${soles(lote.monto)} · vence el ${fechaDia(lote.fechaVencimiento)}`}
      pie={
        <Boton variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Cuotas" valor={String(lote.resumen.cuotas)} />
        <Dato titulo="Pagadas" valor={String(lote.resumen.pagadas)} />
        <Dato titulo="Pendientes" valor={String(lote.resumen.pendientes)} />
        <Dato titulo="Total vigente" valor={soles(lote.resumen.total)} destacado />
      </div>
      {lote.anulacion && (
        <Alerta tipo="aviso" titulo="Lote anulado">
          {`El ${fechaDia(lote.anulacion.anuladoEn.slice(0, 10))}: ${lote.anulacion.motivo ?? "sin motivo"}. Las cuotas pagadas se conservan.`}
        </Alerta>
      )}
      <ul className="flex max-h-[320px] flex-col divide-y divide-borde overflow-y-auto rounded-lg border border-borde">
        {lote.cuotas.map((c) => (
          <li key={c.cuotaId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-[13px]">
            <span className="flex flex-col">
              <span className="font-semibold text-texto">{c.nombreCompleto}</span>
              <span className="text-texto-3">{c.seccion ?? "Sin sección"}</span>
            </span>
            <span className="flex items-center gap-3">
              <Badge tono={TONO_ESTADO_CUOTA[c.estado]} punto>
                {NOMBRE_ESTADO_CUOTA[c.estado]}
              </Badge>
              {c.estado === "PENDIENTE" && (
                <Boton variante="secundario" onClick={() => onAnularCuota(c)}>
                  Anular
                </Boton>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ---------- Anular el lote o una cuota ----------

export function ModalAnularExtraordinaria({
  titulo,
  detalle,
  ruta,
  onCerrar,
  onAnulado,
}: {
  titulo: string;
  detalle: string;
  /** «/matricula/extraordinarias/{id}/anular» o «/matricula/cuotas/{id}/anular». */
  ruta: string;
  onCerrar: () => void;
  onAnulado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function anular() {
    if (!motivo.trim()) {
      setError("Escribe el motivo");
      return;
    }
    setEnviando(true);
    setError(null);
    setGeneral(null);
    try {
      await api(ruta, { method: "POST", body: { motivo: motivo.trim() } });
      onAnulado();
    } catch (e) {
      setGeneral(alertaError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="act-ban"
      titulo={titulo}
      subtitulo={detalle}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="peligro" icono="icon-ban-blanco" onClick={anular} cargando={enviando}>
            Anular
          </Boton>
        </>
      }
    >
      <Campo
        etiqueta="Motivo"
        obligatorio
        maxLength={200}
        placeholder="Por ejemplo, actividad cancelada"
        value={motivo}
        error={error ?? undefined}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <p className="text-[13px] text-texto-3">
        Las cuotas sin pagar pasan a «Anulado» y salen de la deuda; las pagadas se conservan. Los apoderados reciben un
        aviso.
      </p>
      {general && <Alerta tipo="error" titulo={general} />}
    </Modal>
  );
}
