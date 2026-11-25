// DO-04 · «Ítems» de una competencia (bloque M2): el docente agrega, edita, reordena y elimina los ítems de evaluación
// con su nombre y su peso, con el total visible («100 %» en verde u otro valor en rojo). Se guarda la lista completa;
// si el cambio borra calificaciones o deja alumnos sin nota, el servidor pide confirmación y aquí se explica qué se
// pierde antes de confirmar.
"use client";

import { useState } from "react";
import { mensajeError } from "@/components/portal";
import { Alerta, Boton, Icono, Modal } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { cantidad } from "@/lib/formato";
import { porcentaje, type CompetenciaDeRegistro, type RegistroDeNotas } from "./notas";

const LARGO_MAXIMO_NOMBRE = 100;
const MAXIMO_ITEMS = 20;
const PESO_TOTAL = 100;
const CENTESIMAS = 100;

interface Fila {
  /** Clave estable para React: el id del ítem o una temporal para los nuevos. */
  clave: string;
  id?: string;
  nombre: string;
  peso: string;
}

interface Impacto {
  itemsEliminados: string[];
  calificacionesBorradas: number;
  notasQuitadas: number;
  evidenciasBorradas: number;
}

export interface ItemsGuardados extends RegistroDeNotas {
  itemsGuardados: {
    creados: number;
    editados: number;
    eliminados: number;
    impacto: Impacto;
    recalculo: { calculadas: number; cambiadas: number; quitadas: number };
  };
}

const sumaEnCentesimas = (filas: Fila[]) =>
  filas.reduce((s, f) => s + Math.round((Number(f.peso.replace(",", ".")) || 0) * CENTESIMAS), 0);

/** Lo que se pierde, en una frase por tipo. */
function textosDeImpacto(i: Impacto) {
  return [
    i.itemsEliminados.length > 0 &&
      `Se eliminan ${i.itemsEliminados.map((n) => `«${n}»`).join(", ")} con ${cantidad(i.calificacionesBorradas, "calificación", "calificaciones")}.`,
    i.notasQuitadas > 0 &&
      `${cantidad(i.notasQuitadas, "alumno queda", "alumnos quedan")} sin nota en la competencia hasta completar sus ítems y que los pesos sumen 100 %.`,
    i.evidenciasBorradas > 0 &&
      `Se borran ${cantidad(i.evidenciasBorradas, "evidencia", "evidencias")} adjuntas a esas notas.`,
  ].filter(Boolean) as string[];
}

export function ModalItems({
  registro,
  competencia,
  columna,
  onCerrar,
  onGuardado,
}: {
  registro: RegistroDeNotas;
  competencia: CompetenciaDeRegistro;
  /** «C1». */
  columna: string;
  onCerrar: () => void;
  onGuardado: (nuevo: ItemsGuardados) => void;
}) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    competencia.items.map((i) => ({ clave: i.id, id: i.id, nombre: i.nombre, peso: String(i.peso) })),
  );
  const [nuevas, setNuevas] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [impacto, setImpacto] = useState<Impacto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const total = sumaEnCentesimas(filas);
  const completo = total === PESO_TOTAL * CENTESIMAS;
  const calificadas = new Map(competencia.items.map((i) => [i.id, i.calificaciones]));

  function cambiar(clave: string, campo: "nombre" | "peso", valor: string) {
    setImpacto(null);
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  }
  function mover(indice: number, paso: -1 | 1) {
    setImpacto(null);
    setFilas((fs) => {
      const copia = [...fs];
      [copia[indice], copia[indice + paso]] = [copia[indice + paso], copia[indice]];
      return copia;
    });
  }
  function agregar() {
    setImpacto(null);
    setNuevas((n) => n + 1);
    setFilas((fs) => [...fs, { clave: `nueva-${nuevas}`, nombre: "", peso: "" }]);
  }
  function quitar(clave: string) {
    setImpacto(null);
    setFilas((fs) => fs.filter((f) => f.clave !== clave));
  }

  function validar(): string | null {
    const nombres = new Set<string>();
    for (const f of filas) {
      const nombre = f.nombre.trim();
      if (!nombre) return "Escribe el nombre de cada ítem.";
      if (nombre.length > LARGO_MAXIMO_NOMBRE) return "El nombre de un ítem admite como máximo 100 caracteres.";
      if (nombres.has(nombre.toLowerCase())) return `Hay dos ítems con el nombre «${nombre}».`;
      nombres.add(nombre.toLowerCase());
      const peso = Number(f.peso.replace(",", "."));
      if (!(peso > 0 && peso <= PESO_TOTAL)) return `El peso de «${nombre}» debe ser mayor que 0 y hasta 100.`;
    }
    return null;
  }

  async function guardar(confirmar: boolean) {
    const problema = validar();
    setError(problema);
    if (problema) return;
    setGuardando(true);
    try {
      const nuevo = await api<ItemsGuardados>(
        `/evaluacion/registros/${registro.asignacionId}/bimestres/${registro.bimestre.id}/competencias/${competencia.competenciaPlanId}/items`,
        {
          method: "PUT",
          body: {
            items: filas.map((f) => ({
              ...(f.id ? { id: f.id } : {}),
              nombre: f.nombre.trim(),
              peso: Number(f.peso.replace(",", ".")),
            })),
            confirmar,
          },
        },
      );
      onGuardado(nuevo);
    } catch (e) {
      if (e instanceof ApiError && e.codigo === "CONFIRMAR_CAMBIO_ITEMS") setImpacto(e.detalles as unknown as Impacto);
      else setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      icono="icon-sliders"
      tonoIcono="azul"
      titulo={`Ítems de ${columna}`}
      subtitulo={competencia.nombre}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          {impacto ? (
            <Boton icono="check-blanco" cargando={guardando} onClick={() => guardar(true)}>
              Confirmar y guardar
            </Boton>
          ) : (
            <Boton icono="check-blanco" cargando={guardando} onClick={() => guardar(false)}>
              Guardar ítems
            </Boton>
          )}
        </>
      }
    >
      <p className="text-[13px] leading-[1.4] text-texto-2">
        Califica la competencia por partes (prácticas, exposiciones, examen…). Su nota se calcula sola con el promedio
        ponderado (AD = 4, A = 3, B = 2, C = 1) cuando los pesos suman 100 % y el alumno tiene todos los ítems
        calificados. Sin ítems, la competencia se califica directo.
      </p>
      {filas.length === 0 ? (
        <p className="rounded-lg bg-fondo px-3 py-4 text-center text-[14px] text-texto-2">
          Esta competencia no tiene ítems: se califica directo en el registro.
        </p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Ítems de la competencia">
          {filas.map((f, i) => (
            <li key={f.clave} className="flex flex-wrap items-end gap-2 rounded-lg border border-borde p-2.5">
              <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-[12px] font-medium text-texto-2">
                Nombre del ítem {i + 1}
                <input
                  value={f.nombre}
                  maxLength={LARGO_MAXIMO_NOMBRE}
                  onChange={(e) => cambiar(f.clave, "nombre", e.target.value)}
                  placeholder="Ej.: Práctica calificada 1"
                  className="h-10 rounded-lg border border-borde bg-white px-3 text-[14px] font-normal text-texto outline-none focus:border-kubo-azul"
                />
              </label>
              <label className="flex w-[92px] flex-col gap-1 text-[12px] font-medium text-texto-2">
                Peso (%)
                <input
                  value={f.peso}
                  inputMode="decimal"
                  onChange={(e) => cambiar(f.clave, "peso", e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-lg border border-borde bg-white px-3 text-right text-[14px] font-normal text-texto outline-none focus:border-kubo-azul"
                />
              </label>
              <div className="flex items-center gap-1 pb-0.5">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => mover(i, -1)}
                  aria-label={`Subir ${f.nombre || `ítem ${i + 1}`}`}
                  className="rounded-md p-2 hover:bg-fondo disabled:opacity-30"
                >
                  <Icono nombre="act-arriba" size={16} />
                </button>
                <button
                  type="button"
                  disabled={i === filas.length - 1}
                  onClick={() => mover(i, 1)}
                  aria-label={`Bajar ${f.nombre || `ítem ${i + 1}`}`}
                  className="rounded-md p-2 hover:bg-fondo disabled:opacity-30"
                >
                  <Icono nombre="act-abajo" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => quitar(f.clave)}
                  aria-label={`Eliminar ${f.nombre || `ítem ${i + 1}`}`}
                  className="rounded-md p-2 hover:bg-fondo"
                >
                  <Icono nombre="act-trash" size={16} />
                </button>
              </div>
              {f.id && (calificadas.get(f.id) ?? 0) > 0 && (
                <p className="basis-full text-[12px] text-texto-3">
                  {cantidad(calificadas.get(f.id)!, "alumno calificado", "alumnos calificados")}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Boton variante="secundario" icono="icon-plus-gris" onClick={agregar} disabled={filas.length >= MAXIMO_ITEMS}>
          Agregar ítem
        </Boton>
        {filas.length > 0 && (
          <p className="flex items-center gap-2 text-[14px] font-semibold text-texto" aria-live="polite">
            Total de pesos
            <span
              className={`rounded-full px-2.5 py-0.5 text-[14px] font-bold ${completo ? "bg-verde/15 text-verde-oscuro" : "bg-rojo/10 text-rojo-oscuro"}`}
            >
              {porcentaje(total / CENTESIMAS)}
            </span>
          </p>
        )}
      </div>
      {filas.length > 0 && !completo && (
        <Alerta tipo="aviso" titulo="Los pesos deben sumar 100 %">
          Puedes guardar así y completarlos luego, pero mientras no sumen 100 % la competencia queda sin nota para todos
          los alumnos.
        </Alerta>
      )}
      {impacto && (
        <Alerta tipo="error" titulo="Confirma el cambio: se perderán datos">
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            {textosDeImpacto(impacto).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Alerta>
      )}
      {error && <Alerta tipo="error" titulo={error} />}
    </Modal>
  );
}
