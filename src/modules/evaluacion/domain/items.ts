// evaluacion/domain: ítems de evaluación con pesos (bloque M2, DO-04). Cada competencia de un registro puede tener
// ítems con nombre y peso; los pesos suman 100. El docente califica cada ítem con AD, A, B o C y la nota de la
// competencia se calcula con el promedio ponderado de la regla PONDERADO de académico (US12), que el caso de uso
// inyecta como `calcular` para no copiarla. Sin base de datos: los casos de uso les pasan los datos ya cargados.
import { erroresEvaluacion as E, type ImpactoCambioItems } from "./errores";
import type { LogroNota, NotaGuardada } from "./notas";

/** Los pesos de los ítems de una competencia deben sumar exactamente esto para calcular su nota. */
export const PESO_TOTAL_ITEMS = 100;
export const LARGO_MAXIMO_NOMBRE_ITEM = 100;
/** Una competencia con más de 20 ítems no cabe en la grilla de DO-04 ni tiene sentido pedagógico. */
export const MAXIMO_ITEMS_POR_COMPETENCIA = 20;
/** Los pesos se guardan con dos decimales (numeric(5,2)): se suman en centésimas para evitar errores de coma flotante. */
const CENTESIMAS = 100;

/** Función de cálculo de la nota: la de la regla PONDERADO de académico (AD=4 … C=1, redondeo MITAD_HACIA_ARRIBA). */
export type CalcularNota = (valores: LogroNota[], pesos: number[]) => LogroNota;

export interface ItemDeCompetencia {
  id: string;
  competenciaPlanId: string;
  nombre: string;
  peso: number;
  orden: number;
}

export interface CalificacionDeItem {
  itemId: string;
  matriculaId: string;
  valor: LogroNota;
}

const enCentesimas = (peso: number) => Math.round(peso * CENTESIMAS);

/** 33,33 + 33,33 + 33,34 → 100. */
export function sumaDePesos(pesos: number[]): number {
  return pesos.reduce((s, p) => s + enCentesimas(p), 0) / CENTESIMAS;
}

export const pesosCompletos = (pesos: number[]) =>
  pesos.reduce((s, p) => s + enCentesimas(p), 0) === PESO_TOTAL_ITEMS * CENTESIMAS;

/** 90 → «90 %»; 33.5 → «33,5 %». */
export const textoPorcentaje = (valor: number) => `${String(valor).replace(".", ",")} %`;

// ---------- Gestión de ítems de una competencia ----------

export interface ItemPedido {
  /** Ítem que ya existe; sin id se crea. */
  id?: string;
  nombre: string;
  peso: number;
}

export interface ItemPreparado {
  id: string | null;
  nombre: string;
  peso: number;
  /** Posición en la lista pedida (1, 2, 3…): así se reordenan. */
  orden: number;
}

const normalizarNombre = (nombre: string) => nombre.trim().toLocaleLowerCase("es");

/**
 * Valida la lista completa de ítems de una competencia (crear, editar, reordenar y eliminar a la vez): nombres de 1 a
 * 100 caracteres sin repetir, pesos mayores que 0 y hasta 100 con dos decimales, ids que ya sean de la competencia.
 * La suma no tiene que ser 100 para guardar: mientras no lo sea, la competencia queda sin nota y la pantalla lo dice.
 */
export function prepararItems(pedidos: ItemPedido[], actuales: { id: string }[]): ItemPreparado[] {
  if (pedidos.length > MAXIMO_ITEMS_POR_COMPETENCIA) throw E.demasiadosItems(MAXIMO_ITEMS_POR_COMPETENCIA);
  const existentes = new Set(actuales.map((a) => a.id));
  const nombres = new Set<string>();
  const ids = new Set<string>();
  return pedidos.map((p, i) => {
    const nombre = p.nombre.trim();
    if (!nombre) throw E.nombreItemVacio();
    if ([...nombre].length > LARGO_MAXIMO_NOMBRE_ITEM) throw E.nombreItemLargo();
    if (nombres.has(normalizarNombre(nombre))) throw E.nombreItemRepetido(nombre);
    nombres.add(normalizarNombre(nombre));
    const valido = Number.isFinite(p.peso) && p.peso > 0 && p.peso <= PESO_TOTAL_ITEMS;
    if (!valido || Math.abs(p.peso * CENTESIMAS - enCentesimas(p.peso)) > 1e-6) throw E.pesoItemInvalido(nombre);
    if (p.id) {
      if (!existentes.has(p.id) || ids.has(p.id)) throw E.itemAjeno();
      ids.add(p.id);
    }
    return { id: p.id ?? null, nombre, peso: enCentesimas(p.peso) / CENTESIMAS, orden: i + 1 };
  });
}

/** Si el cambio borra calificaciones o quita notas, se pide confirmación (bloque M2, «eliminar pide confirmación»). */
export function verificarConfirmacion(impacto: ImpactoCambioItems, confirmar: boolean) {
  const pierde = impacto.calificacionesBorradas > 0 || impacto.notasQuitadas > 0 || impacto.evidenciasBorradas > 0;
  if (pierde && !confirmar) throw E.confirmarCambioItems(impacto);
}

// ---------- Nota calculada de un alumno ----------

export type MotivoSinNota = "PESOS_INCOMPLETOS" | "ITEMS_PENDIENTES";

export type NotaDeItems =
  | { estado: "CALCULADA"; logro: LogroNota }
  | { estado: "SIN_NOTA"; motivo: MotivoSinNota; mensaje: string; faltan: string[] };

/**
 * Nota de una competencia con ítems para un alumno: sin nota si los pesos no suman 100 o si le falta algún ítem
 * (con el porqué, para la pantalla); si no, el promedio ponderado de sus calificaciones.
 *   notaDeItems([{ nombre: "Práctica", peso: 40 }, { nombre: "Examen", peso: 60 }], { p: "AD", e: "B" }, calcular)
 */
export function notaDeItems(
  items: Pick<ItemDeCompetencia, "id" | "nombre" | "peso">[],
  delAlumno: Map<string, LogroNota>,
  calcular: CalcularNota,
): NotaDeItems {
  const pesos = items.map((i) => i.peso);
  if (!pesosCompletos(pesos)) {
    return {
      estado: "SIN_NOTA",
      motivo: "PESOS_INCOMPLETOS",
      mensaje: `Los pesos de los ítems suman ${textoPorcentaje(sumaDePesos(pesos))}; deben sumar 100 %.`,
      faltan: [],
    };
  }
  const faltan = items.filter((i) => !delAlumno.has(i.id)).map((i) => i.nombre);
  if (faltan.length) {
    return {
      estado: "SIN_NOTA",
      motivo: "ITEMS_PENDIENTES",
      mensaje: `Falta calificar ${faltan.length === 1 ? "el ítem" : "los ítems"}: ${faltan.join(", ")}.`,
      faltan,
    };
  }
  return {
    estado: "CALCULADA",
    logro: calcular(
      items.map((i) => delAlumno.get(i.id)!),
      pesos,
    ),
  };
}

// ---------- Recálculo de las notas de un registro ----------

export interface CambiosPorItems {
  crear: { matriculaId: string; competenciaPlanId: string; logro: LogroNota }[];
  cambiar: { id: string; matriculaId: string; competenciaPlanId: string; anterior: LogroNota; logro: LogroNota }[];
  quitar: { id: string; matriculaId: string; competenciaPlanId: string; anterior: LogroNota }[];
}

/**
 * Qué notas se crean, cambian o quitan para dejar cada competencia con ítems al día (solo esas: una competencia sin
 * ítems se califica directo y su nota no se toca). Se calcula para los alumnos de la lista y las competencias pedidas.
 */
export function recalcularNotas(datos: {
  competenciaPlanIds: string[];
  items: ItemDeCompetencia[];
  matriculaIds: string[];
  calificaciones: CalificacionDeItem[];
  notas: NotaGuardada[];
  calcular: CalcularNota;
}): CambiosPorItems {
  const cambios: CambiosPorItems = { crear: [], cambiar: [], quitar: [] };
  const valor = new Map(datos.calificaciones.map((c) => [`${c.matriculaId}|${c.itemId}`, c.valor]));
  const nota = new Map(datos.notas.map((n) => [`${n.matriculaId}|${n.competenciaPlanId}`, n]));
  for (const competenciaPlanId of new Set(datos.competenciaPlanIds)) {
    const items = datos.items
      .filter((i) => i.competenciaPlanId === competenciaPlanId)
      .sort((a, b) => a.orden - b.orden);
    if (!items.length) continue;
    for (const matriculaId of datos.matriculaIds) {
      const delAlumno = new Map(
        items.flatMap((i): [string, LogroNota][] => {
          const v = valor.get(`${matriculaId}|${i.id}`);
          return v ? [[i.id, v]] : [];
        }),
      );
      const calculada = notaDeItems(items, delAlumno, datos.calcular);
      const actual = nota.get(`${matriculaId}|${competenciaPlanId}`);
      if (calculada.estado === "CALCULADA") {
        if (!actual) cambios.crear.push({ matriculaId, competenciaPlanId, logro: calculada.logro });
        else if (actual.logro !== calculada.logro) {
          cambios.cambiar.push({
            id: actual.id,
            matriculaId,
            competenciaPlanId,
            anterior: actual.logro,
            logro: calculada.logro,
          });
        }
      } else if (actual) {
        cambios.quitar.push({ id: actual.id, matriculaId, competenciaPlanId, anterior: actual.logro });
      }
    }
  }
  return cambios;
}

// ---------- Calificaciones de ítems y notas directas ----------

export interface CalificacionPedida {
  itemId: string;
  matriculaId: string;
  logro: LogroNota;
}

/** Una competencia con ítems no recibe nota directa: su nota se calcula (bloque M2). */
export function verificarSinItems(
  pedidas: { competenciaPlanId: string }[],
  items: Pick<ItemDeCompetencia, "competenciaPlanId">[],
  columnas: Map<string, { columna: number }>,
) {
  const conItems = new Set(items.map((i) => i.competenciaPlanId));
  const directa = pedidas.find((p) => conItems.has(p.competenciaPlanId));
  if (directa) throw E.competenciaConItems(`C${columnas.get(directa.competenciaPlanId)?.columna ?? "?"}`);
}

/** Solo se califican ítems del registro para alumnos de la lista. */
export function verificarCalificaciones(
  pedidas: CalificacionPedida[],
  items: Pick<ItemDeCompetencia, "id">[],
  matriculaIds: string[],
) {
  const deItems = new Set(items.map((i) => i.id));
  const alumnos = new Set(matriculaIds);
  if (pedidas.some((p) => !deItems.has(p.itemId) || !alumnos.has(p.matriculaId))) throw E.notaFueraDelRegistro();
}

export interface CambiosDeCalificaciones {
  nuevas: CalificacionPedida[];
  modificadas: { id: string; anterior: LogroNota; logro: LogroNota; itemId: string; matriculaId: string }[];
  sinCambio: number;
}

/** Separa las calificaciones que se crean, las que cambian y las que ya tenían ese valor. */
export function cambiosDeCalificaciones(
  guardadas: (CalificacionDeItem & { id: string })[],
  pedidas: CalificacionPedida[],
): CambiosDeCalificaciones {
  const actuales = new Map(guardadas.map((c) => [`${c.matriculaId}|${c.itemId}`, c]));
  const cambios: CambiosDeCalificaciones = { nuevas: [], modificadas: [], sinCambio: 0 };
  for (const p of pedidas) {
    const actual = actuales.get(`${p.matriculaId}|${p.itemId}`);
    if (!actual) cambios.nuevas.push(p);
    else if (actual.valor !== p.logro) {
      cambios.modificadas.push({
        id: actual.id,
        anterior: actual.valor,
        logro: p.logro,
        itemId: p.itemId,
        matriculaId: p.matriculaId,
      });
    } else cambios.sinCambio += 1;
  }
  return cambios;
}
