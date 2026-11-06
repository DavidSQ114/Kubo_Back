// Piezas de AD-05 Reglas de evaluación (US12, RF10): tipos, formulario «Método de consolidación», vista previa del
// cálculo con logros de ejemplo, historial de versiones y el modal que confirma la nueva versión.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alerta, Badge, Boton, Icono, Modal, Spinner, Tarjeta } from "@/components/ui";
import { api } from "@/lib/api";
import { Selector } from "./grados";
import { alertaError } from "./PortalAdmin";

export type Metodo = "MODA" | "PONDERADO";
export type Criterio = "MAYOR_JERARQUIA" | "MENOR_JERARQUIA" | "ULTIMO_REGISTRO";
export type Logro = "AD" | "A" | "B" | "C";

export interface VersionRegla {
  id: string;
  version: number;
  nombre: string;
  metodo: Metodo;
  criterioDesempate: Criterio;
  estado: "VIGENTE" | "ARCHIVADA" | "BORRADOR";
  rigeDesde: { id: string; numero: number; nombre: string } | null;
  aplicadaA: string;
  responsable: string | null;
  creadaEn: string;
}

export interface PeriodoRegla {
  id: string;
  numero: number;
  nombre: string;
  estado: string;
  cerrado: boolean;
}

export interface ReglasDelAnio {
  anio: { id: string; anio: number; estado: string };
  editable: boolean;
  vigente: VersionRegla | null;
  historial: VersionRegla[];
  periodos: PeriodoRegla[];
}

export interface DatosRegla {
  metodo: Metodo;
  criterioDesempate: Criterio;
  rigeDesdeId: string;
}

const LOGROS: Logro[] = ["AD", "A", "B", "C"];

export const NOMBRE_CRITERIO: Record<Criterio, string> = {
  MAYOR_JERARQUIA: "Mayor jerarquía (AD > A > B > C)",
  MENOR_JERARQUIA: "Menor jerarquía (C < B < A < AD)",
  ULTIMO_REGISTRO: "Último registro",
};

const NOMBRE_METODO: Record<Metodo, string> = { MODA: "Moda de los logros", PONDERADO: "Promedio ponderado" };

const TONO_LOGRO: Record<Logro, string> = {
  AD: "bg-[rgba(46,158,107,0.12)] text-verde-oscuro",
  A: "bg-[rgba(74,144,217,0.12)] text-kubo-azul",
  B: "bg-[rgba(232,169,59,0.16)] text-ambar-oscuro",
  C: "bg-[rgba(214,69,69,0.12)] text-rojo-oscuro",
};

export function ChipLogro({ logro }: { logro: Logro }) {
  return (
    <span
      className={`inline-flex min-w-10 items-center justify-center rounded-md px-2 py-1 text-[14px] font-bold ${TONO_LOGRO[logro]}`}
    >
      {logro}
    </span>
  );
}

/** «Bimestre I y II» de los bimestres cerrados, para el aviso «Este cambio no afectará…». */
export function bimestresCerrados(periodos: PeriodoRegla[]) {
  return periodos.filter((p) => p.cerrado);
}

/** Primer bimestre abierto: desde ahí rige por defecto la nueva versión. */
export const primerAbierto = (periodos: PeriodoRegla[]) => periodos.find((p) => !p.cerrado)?.id ?? "";

/** Valores iniciales del formulario: la versión vigente o, sin regla, moda con mayor jerarquía (RF10). */
export function datosIniciales(reglas: ReglasDelAnio): DatosRegla {
  return {
    metodo: reglas.vigente?.metodo ?? "MODA",
    criterioDesempate: reglas.vigente?.criterioDesempate ?? "MAYOR_JERARQUIA",
    rigeDesdeId: primerAbierto(reglas.periodos),
  };
}

const unirNombres = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;

/** «Los bimestres I y II ya están cerrados y conservan la versión con que se calcularon. La nueva versión…» */
export function detalleSinEfecto(reglas: ReglasDelAnio, rigeDesdeId: string) {
  const cerrados = bimestresCerrados(reglas.periodos).map((p) => p.nombre.replace("Bimestre ", ""));
  const desde = reglas.periodos.find((p) => p.id === rigeDesdeId)?.nombre;
  // cada bimestre cerrado conserva la versión que regía cuando se cerró (no necesariamente la vigente)
  const sujeto =
    cerrados.length === 1
      ? `El Bimestre ${cerrados[0]} ya está cerrado y conserva la versión con que se calculó`
      : `Los bimestres ${unirNombres(cerrados)} ya están cerrados y conservan la versión con que se calcularon`;
  return `${sujeto}.${desde ? ` La nueva versión se aplicará desde el ${desde}.` : ""}`;
}

// ---------- Método de consolidación ----------

function OpcionMetodo({
  metodo,
  elegido,
  descripcion,
  deshabilitado,
  onElegir,
}: {
  metodo: Metodo;
  elegido: boolean;
  descripcion: string;
  deshabilitado: boolean;
  onElegir: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border px-4 py-3.5 ${
        elegido ? "border-2 border-kubo-azul bg-[rgba(27,77,137,0.04)]" : "border-borde"
      } ${deshabilitado ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        name="metodo"
        aria-label={NOMBRE_METODO[metodo]}
        checked={elegido}
        disabled={deshabilitado}
        onChange={onElegir}
        className="mt-1 size-4 accent-kubo-azul"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-texto">{NOMBRE_METODO[metodo]}</span>
        <span className="text-[13px] leading-[1.4] text-texto-3">{descripcion}</span>
      </span>
    </label>
  );
}

export function FormularioRegla({
  reglas,
  datos,
  onCambiar,
  onDescartar,
  onGuardar,
}: {
  reglas: ReglasDelAnio;
  datos: DatosRegla;
  onCambiar: (cambios: Partial<DatosRegla>) => void;
  onDescartar: () => void;
  onGuardar: () => void;
}) {
  const bloqueado = !reglas.editable;
  const cerrados = bimestresCerrados(reglas.periodos);
  const abiertos = reglas.periodos.filter((p) => !p.cerrado);
  const sinBimestresAbiertos = reglas.periodos.length > 0 && abiertos.length === 0;
  const vigente = reglas.vigente;
  const sinCambios =
    vigente !== null &&
    vigente.metodo === datos.metodo &&
    (datos.metodo === "PONDERADO" || vigente.criterioDesempate === datos.criterioDesempate);

  return (
    <Tarjeta className="flex flex-col gap-5 p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-fondo">
          <Icono nombre="icon-sliders" size={20} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Método de consolidación</h2>
          <p className="text-[14px] leading-[1.4] text-texto-3">Año académico {reglas.anio.anio}</p>
        </div>
      </div>

      {bloqueado && (
        <Alerta tipo="info" titulo="El año está cerrado">
          Sus reglas se muestran solo como consulta.
        </Alerta>
      )}

      <div role="radiogroup" aria-label="Método de consolidación" className="flex flex-col gap-3">
        <OpcionMetodo
          metodo="MODA"
          elegido={datos.metodo === "MODA"}
          descripcion="Se asigna el logro que más se repite entre las evaluaciones del bimestre."
          deshabilitado={bloqueado}
          onElegir={() => onCambiar({ metodo: "MODA" })}
        />
        <OpcionMetodo
          metodo="PONDERADO"
          elegido={datos.metodo === "PONDERADO"}
          descripcion="Convierte AD=4, A=3, B=2, C=1, aplica los pesos de cada competencia y redondea al logro más cercano (un ,5 sube al logro mayor)."
          deshabilitado={bloqueado}
          onElegir={() => onCambiar({ metodo: "PONDERADO" })}
        />
      </div>

      {datos.metodo === "PONDERADO" ? (
        <Alerta tipo="info" titulo="Los pesos se configuran por curso">
          Indica el peso de cada competencia en{" "}
          <Link href="/admin/cursos" className="font-semibold text-kubo-azul hover:underline">
            Cursos y competencias
          </Link>
          . Si un curso no tiene pesos, todas sus competencias pesan igual.
        </Alerta>
      ) : (
        <Selector
          etiqueta="Criterio de desempate"
          obligatorio
          valor={datos.criterioDesempate}
          deshabilitado={bloqueado}
          ayuda="Se usa cuando dos o más logros tienen la misma frecuencia."
          onCambiar={(v) => onCambiar({ criterioDesempate: v as Criterio })}
        >
          <option value="MAYOR_JERARQUIA">{NOMBRE_CRITERIO.MAYOR_JERARQUIA}</option>
          <option value="MENOR_JERARQUIA">{NOMBRE_CRITERIO.MENOR_JERARQUIA}</option>
        </Selector>
      )}

      {reglas.periodos.length > 0 && (
        <Selector
          etiqueta="Rige desde"
          obligatorio
          valor={datos.rigeDesdeId}
          deshabilitado={bloqueado || sinBimestresAbiertos}
          ayuda="Los bimestres cerrados conservan la versión con que se calcularon."
          onCambiar={(rigeDesdeId) => onCambiar({ rigeDesdeId })}
        >
          {sinBimestresAbiertos && <option value="">No quedan bimestres abiertos</option>}
          {reglas.periodos.map((p) => (
            <option key={p.id} value={p.id} disabled={p.cerrado}>
              {p.nombre}
              {p.cerrado ? " (cerrado)" : ""}
            </option>
          ))}
        </Selector>
      )}
      {reglas.periodos.length === 0 && (
        <p className="text-[13px] leading-[1.4] text-texto-3">
          El año aún no tiene bimestres: la regla regirá desde el inicio del año.
        </p>
      )}

      <div className="flex items-start gap-3 border-t border-borde pt-4">
        <div className="flex flex-1 flex-col gap-0.5">
          <p className="text-[14px] font-semibold text-texto">
            Exigir todas las competencias calificadas antes del cierre
          </p>
          <p className="text-[13px] leading-[1.4] text-texto-3">
            El docente no podrá cerrar el bimestre con registros incompletos. Se configura con el cierre de bimestre
            (US39, Sprint 3).
          </p>
        </div>
        <Icono nombre="icon-lock" size={18} />
      </div>

      {cerrados.length > 0 && !bloqueado && (
        <Alerta tipo="aviso" titulo="Este cambio no afectará los bimestres ya cerrados">
          {detalleSinEfecto(reglas, datos.rigeDesdeId)}
        </Alerta>
      )}

      {!bloqueado && (
        <div className="flex justify-end gap-3">
          <Boton variante="secundario" onClick={onDescartar}>
            Descartar
          </Boton>
          <Boton
            icono="check-blanco"
            onClick={onGuardar}
            disabled={sinCambios || sinBimestresAbiertos}
            title={sinCambios ? "La regla vigente ya usa este método y criterio" : undefined}
          >
            Guardar cambios
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}

// ---------- Vista previa del cálculo ----------

/** Ejemplo ficticio: 4 competencias de Matemática (catálogo del CNEB). */
const EJEMPLO = [
  { codigo: "C1", nombre: "Resuelve problemas de cantidad", logro: "AD" as Logro, peso: "25" },
  { codigo: "C2", nombre: "Resuelve problemas de regularidad, equivalencia y cambio", logro: "A" as Logro, peso: "25" },
  { codigo: "C3", nombre: "Resuelve problemas de forma, movimiento y localización", logro: "AD" as Logro, peso: "25" },
  { codigo: "C4", nombre: "Resuelve problemas de gestión de datos e incertidumbre", logro: "A" as Logro, peso: "25" },
];

interface Simulacion {
  logro: Logro;
  frecuencias: Record<Logro, number>;
  empatados: Logro[];
  promedio: number | null;
}

/** Calcula con POST /academico/reglas/simular: la misma función que usará el cierre del bimestre (US39). */
export function VistaPrevia({ metodo, criterio }: { metodo: Metodo; criterio: Criterio }) {
  const [filas, setFilas] = useState(EJEMPLO);
  const [resultado, setResultado] = useState<{ clave: string; simulacion?: Simulacion; error?: string } | null>(null);
  const ponderado = metodo === "PONDERADO";
  const cuerpo = {
    metodo,
    criterioDesempate: criterio,
    logros: filas.map((f) => f.logro),
    pesos: ponderado ? filas.map((f) => (f.peso.trim() ? Number(f.peso) : null)) : undefined,
  };
  const clave = JSON.stringify(cuerpo);

  useEffect(() => {
    let vigente = true;
    async function calcular() {
      try {
        const simulacion = await api<Simulacion>("/academico/reglas/simular", {
          method: "POST",
          body: JSON.parse(clave),
        });
        if (vigente) setResultado({ clave, simulacion });
      } catch (e) {
        if (vigente) setResultado({ clave, error: alertaError(e) });
      }
    }
    void calcular();
    return () => {
      vigente = false;
    };
  }, [clave]);

  const actual = resultado?.clave === clave ? resultado : null;
  const cambiar = (i: number, cambios: Partial<(typeof EJEMPLO)[number]>) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambios } : f)));

  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Vista previa del cálculo</h2>
        <p className="text-[14px] leading-[1.4] text-texto-3">
          Ejemplo con datos ficticios: cambia los logros{ponderado ? " y los pesos" : ""} para ver el resultado con la
          regla del formulario.
        </p>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[15px] font-semibold text-texto">Estudiante de ejemplo · 3.° B</p>
        <p className="text-[13px] text-texto-3">Matemática · {filas.length} competencias</p>
      </div>
      <div className="flex flex-col divide-y divide-borde">
        {filas.map((f, i) => (
          <div key={f.codigo} className="flex items-center gap-3 py-2">
            <span className="rounded bg-fondo px-2 py-0.5 text-[12px] font-bold text-texto-2">{f.codigo}</span>
            <span className="min-w-0 flex-1 text-[13px] leading-[1.4] text-texto">{f.nombre}</span>
            {ponderado && (
              <input
                type="number"
                min={1}
                aria-label={`Peso de ${f.codigo}`}
                value={f.peso}
                onChange={(e) => cambiar(i, { peso: e.target.value })}
                className="w-16 rounded-md border border-borde px-2 py-1 text-right text-[13px] outline-none focus:border-kubo-azul"
              />
            )}
            <select
              aria-label={`Logro de ${f.codigo}`}
              value={f.logro}
              onChange={(e) => cambiar(i, { logro: e.target.value as Logro })}
              className={`rounded-md px-2 py-1 text-[14px] font-bold outline-none ${TONO_LOGRO[f.logro]}`}
            >
              {LOGROS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {!actual && (
        <div className="flex items-center gap-3 text-[14px] text-texto-2">
          <Spinner claro={false} /> Calculando…
        </div>
      )}
      {actual?.error && <Alerta tipo="error" titulo={actual.error} />}
      {actual?.simulacion && <ResultadoSimulacion simulacion={actual.simulacion} metodo={metodo} criterio={criterio} />}
    </Tarjeta>
  );
}

function ResultadoSimulacion({
  simulacion,
  metodo,
  criterio,
}: {
  simulacion: Simulacion;
  metodo: Metodo;
  criterio: Criterio;
}) {
  const { empatados } = simulacion;
  return (
    <>
      {metodo === "MODA" ? (
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-semibold text-texto">Frecuencia de logros</p>
          {LOGROS.map((l) => (
            <div key={l} className="flex items-center gap-3 text-[14px] text-texto-2">
              <ChipLogro logro={l} />
              {simulacion.frecuencias[l]} {simulacion.frecuencias[l] === 1 ? "competencia" : "competencias"}
            </div>
          ))}
          {empatados.length > 1 && (
            <Alerta tipo="info" titulo={`Empate entre ${unirNombres(empatados)}`}>
              Se aplica el criterio de desempate: gana el logro de {criterio === "MENOR_JERARQUIA" ? "menor" : "mayor"}{" "}
              jerarquía.
            </Alerta>
          )}
        </div>
      ) : (
        <p className="text-[14px] text-texto-2">
          Promedio ponderado:{" "}
          <span className="font-semibold text-texto">
            {simulacion.promedio?.toLocaleString("es-PE", { maximumFractionDigits: 2 })}
          </span>{" "}
          (AD=4, A=3, B=2, C=1). Se redondea al logro más cercano; un ,5 sube al logro mayor.
        </p>
      )}
      <div className="flex items-center justify-between border-t border-borde pt-4">
        <span className="text-[15px] font-semibold text-texto">Logro consolidado del curso</span>
        <ChipLogro logro={simulacion.logro} />
      </div>
    </>
  );
}

// ---------- Historial de versiones ----------

export function HistorialVersiones({ versiones }: { versiones: VersionRegla[] }) {
  return (
    <Tarjeta className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold leading-[1.3] text-texto">Historial de versiones</h2>
        <p className="text-[14px] leading-[1.4] text-texto-3">
          Las reglas se versionan para que los resultados sean reproducibles. Las versiones anteriores son de solo
          lectura.
        </p>
      </div>
      {versiones.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-borde px-6 py-8 text-center">
          <p className="text-[15px] font-semibold text-texto">Aún no hay versiones</p>
          <p className="max-w-[420px] text-[14px] leading-[1.4] text-texto-2">
            Elige el método de consolidación y guárdalo: será la versión 1 de la regla de este año.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde">
          <table className="w-full min-w-[760px] border-collapse bg-white text-left">
            <thead>
              <tr className="border-b border-borde bg-fondo text-[13px] font-semibold leading-[1.4] text-texto-2">
                <th className="px-4 py-3 font-semibold">Versión</th>
                <th className="px-4 py-3 font-semibold">Método</th>
                <th className="px-4 py-3 font-semibold">Desempate</th>
                <th className="px-4 py-3 font-semibold">Aplicada a</th>
                <th className="px-4 py-3 font-semibold">Responsable</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {versiones.map((v) => (
                <tr key={v.id} className="border-b border-borde text-[14px] leading-[1.4] text-texto last:border-b-0">
                  <td className="px-4 py-3 font-semibold">Versión {v.version}</td>
                  <td className="px-4 py-3">{NOMBRE_METODO[v.metodo]}</td>
                  <td className="px-4 py-3">
                    {v.metodo === "MODA" ? NOMBRE_CRITERIO[v.criterioDesempate].split(" (")[0] : "No aplica"}
                  </td>
                  <td className="px-4 py-3">{v.aplicadaA}</td>
                  <td className="px-4 py-3">{v.responsable ?? "—"}</td>
                  <td className="px-4 py-3">
                    {v.estado === "VIGENTE" ? (
                      <Badge tono="verde" punto>
                        Vigente
                      </Badge>
                    ) : (
                      <Badge tono="gris" punto>
                        Archivada
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

// ---------- Confirmar la nueva versión ----------

export function ModalConfirmarRegla({
  reglas,
  datos,
  onCerrar,
  onListo,
}: {
  reglas: ReglasDelAnio;
  datos: DatosRegla;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = (reglas.historial[0]?.version ?? 0) + 1;
  const desde = reglas.periodos.find((p) => p.id === datos.rigeDesdeId)?.nombre;
  const hayCerrados = bimestresCerrados(reglas.periodos).length > 0;

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      await api(`/academico/anios/${reglas.anio.id}/reglas`, {
        method: "POST",
        body: {
          metodo: datos.metodo,
          criterioDesempate: datos.metodo === "MODA" ? datos.criterioDesempate : undefined,
          rigeDesdeId: datos.rigeDesdeId || null,
        },
      });
      onListo(`Se guardó la versión ${version} de la regla de ${reglas.anio.anio}.`);
      onCerrar();
    } catch (e) {
      setError(alertaError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-sliders"
      tonoIcono="azul"
      titulo={`Guardar la versión ${version}`}
      subtitulo="La versión vigente pasará al historial como solo lectura."
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} cargando={enviando} icono="check-blanco">
            Confirmar
          </Boton>
        </>
      }
    >
      <p className="text-[14px] leading-[1.5] text-texto-2">
        <span className="font-semibold text-texto">{NOMBRE_METODO[datos.metodo]}</span>
        {datos.metodo === "MODA" ? ` · desempate: ${NOMBRE_CRITERIO[datos.criterioDesempate]}` : ""}
        {desde ? ` · rige desde el ${desde}.` : " · rige desde el inicio del año."}
      </p>
      {hayCerrados && (
        <Alerta tipo="aviso" titulo="Este cambio no afectará los bimestres ya cerrados">
          {detalleSinEfecto(reglas, datos.rigeDesdeId)}
        </Alerta>
      )}
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}
