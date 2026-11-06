// matricula/domain: reglas puras del traslado de sección (US19, M-05), el retiro del estudiante (US57, M-18), la ficha
// de matrícula en PDF (US20) y la «sección en una fecha» que usarán asistencia y notas. Fechas «AAAA-MM-DD».
import { erroresMatricula as E } from "./errores";
import { NOMBRE_ESTADO_MATRICULA, type EstadoMatricula } from "./matriculas";

// ---------- Traslado de sección (US19) ----------

/** Solo una matrícula «Matriculado» se traslada (una «Retirado» ya no). */
export function verificarTrasladable(estado: EstadoMatricula) {
  if (estado !== "MATRICULADO") throw E.noTrasladable(NOMBRE_ESTADO_MATRICULA[estado]);
}

export interface SeccionParaTraslado {
  id: string;
  anioAcademicoId: string;
  gradoId: string;
  estado: string;
}

/** El destino debe ser otra sección activa del mismo grado y del mismo año. */
export function verificarDestino(origen: SeccionParaTraslado, destino: SeccionParaTraslado) {
  if (destino.id === origen.id) throw E.mismaSeccion();
  if (destino.gradoId !== origen.gradoId || destino.anioAcademicoId !== origen.anioAcademicoId) {
    throw E.trasladoOtroGrado();
  }
  if (destino.estado !== "ACTIVA") throw E.seccionInactiva();
}

/** Se cuenta con la fila de la sección destino bloqueada, igual que en la confirmación (US18). */
export function verificarCupoDestino(matriculados: number, aforo: number) {
  if (matriculados >= aforo) throw E.destinoSinVacantes(matriculados, aforo);
}

/**
 * La fecha efectiva del traslado no puede ser anterior al inicio de su sección actual (el historial vigente) ni
 * posterior al fin del año académico.
 */
export function verificarFechaTraslado(fecha: string, limites: { inicioSeccionActual: string; finAnio: string }) {
  if (fecha < limites.inicioSeccionActual) {
    throw E.fechaTrasladoInvalida("La fecha del traslado no puede ser anterior a su ingreso a la sección actual.");
  }
  if (fecha > limites.finAnio) {
    throw E.fechaTrasladoInvalida("La fecha del traslado no puede ser posterior al fin del año académico.");
  }
}

// ---------- Retiro del estudiante (US57) ----------

export const MOTIVOS_RETIRO = ["TRASLADO", "MOTIVOS_ECONOMICOS", "MOTIVOS_SALUD", "OTRO"] as const;
export type MotivoRetiro = (typeof MOTIVOS_RETIRO)[number];

export const NOMBRE_MOTIVO_RETIRO: Record<MotivoRetiro, string> = {
  TRASLADO: "Traslado a otro colegio",
  MOTIVOS_ECONOMICOS: "Motivos económicos",
  MOTIVOS_SALUD: "Motivos de salud",
  OTRO: "Otro motivo",
};

/** Solo una matrícula «Matriculado» se retira (una «Retirado» no se retira otra vez). */
export function verificarRetirable(estado: EstadoMatricula) {
  if (estado !== "MATRICULADO") throw E.noRetirable(NOMBRE_ESTADO_MATRICULA[estado]);
}

/** Sin motivo: «Seleccione el motivo del retiro». El detalle es opcional. */
export function verificarMotivoRetiro(motivo: MotivoRetiro | null | undefined): MotivoRetiro {
  if (!motivo) throw E.motivoRetiroRequerido();
  return motivo;
}

/** La fecha de retiro no puede ser anterior a la fecha de matrícula ni posterior al fin del año académico. */
export function verificarFechaRetiro(
  fecha: string,
  limites: { fechaMatricula: string; finAnio: string; inicioSeccionActual?: string | null },
) {
  if (fecha < limites.fechaMatricula) {
    throw E.fechaRetiroInvalida("La fecha de retiro no puede ser anterior a la fecha de matrícula.");
  }
  // después de un traslado, el retiro no puede caer antes de su ingreso a la sección actual
  if (limites.inicioSeccionActual && fecha < limites.inicioSeccionActual) {
    throw E.fechaRetiroInvalida("La fecha de retiro no puede ser anterior a su último traslado de sección.");
  }
  if (fecha > limites.finAnio) {
    throw E.fechaRetiroInvalida("La fecha de retiro no puede ser posterior al fin del año académico.");
  }
}

export interface CuotaParaRetiro {
  id: string;
  estado: "PENDIENTE" | "PAGADO" | "ANULADO";
  fechaVencimiento: string;
  /** Pagos no anulados aplicados a la cuota (un pago parcial la deja «Pendiente»). */
  pagos: number;
}

/**
 * US57: se anulan las cuotas «Pendiente» que vencen después de la fecha de retiro. Se conservan las pagadas, las ya
 * vencidas (vencimiento igual o anterior al retiro) y las que tienen algún pago aplicado.
 */
export const cuotasAnulablesPorRetiro = <T extends CuotaParaRetiro>(cuotas: T[], fechaRetiro: string): T[] =>
  cuotas.filter((c) => c.estado === "PENDIENTE" && c.fechaVencimiento > fechaRetiro && c.pagos === 0);

/** «TRASLADO» + detalle → lo que queda en la bitácora. */
export const textoMotivoRetiro = (motivo: MotivoRetiro, detalle?: string | null) =>
  detalle?.trim() ? `${motivo}: ${detalle.trim()}` : motivo;

/**
 * retirado_en es timestamptz: la fecha de retiro se guarda a la medianoche de Lima (UTC−5, sin horario de verano),
 * así se lee como la misma fecha al mostrarla en la hora de Lima.
 */
export const instanteDeRetiro = (fecha: string) => new Date(`${fecha}T05:00:00.000Z`);

// ---------- Sección en una fecha (para asistencia y notas) ----------

export interface TramoSeccion {
  seccionId: string;
  fechaInicio: string;
  /** Primer día en que ya no está en la sección (traslado, retiro o anulación); null si sigue en ella. */
  fechaFin: string | null;
}

/**
 * Sección en la que estaba la matrícula en una fecha, según su historial: el tramo con
 * `fechaInicio <= fecha < fechaFin`. El día de un traslado ya cuenta en la sección destino. null si en esa fecha
 * no estaba en ninguna (antes de matricularse o después del retiro).
 */
export function seccionEnFecha(tramos: TramoSeccion[], fecha: string): string | null {
  const vigentes = tramos.filter((t) => t.fechaInicio <= fecha && (t.fechaFin === null || fecha < t.fechaFin));
  vigentes.sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
  return vigentes[0]?.seccionId ?? null;
}

// ---------- Ficha de matrícula (US20) ----------

/** La ficha es de una matrícula «Matriculado» o, como constancia, «Retirado». */
export function verificarFichaDisponible(estado: EstadoMatricula) {
  if (estado === "EN_PROCESO") throw E.fichaDatosPendientes(["Sección", "Apoderado responsable del pago"]);
  if (estado !== "MATRICULADO" && estado !== "RETIRADO") throw E.fichaNoDisponible(NOMBRE_ESTADO_MATRICULA[estado]);
}

export interface DatosObligatoriosFicha {
  dni?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  fechaNacimiento?: string | null;
  grado?: string | null;
  seccion?: string | null;
  fechaMatricula?: string | null;
  modalidadPago?: string | null;
  apoderados: number;
  responsablePago?: string | null;
}

const OBLIGATORIOS_FICHA: [keyof Omit<DatosObligatoriosFicha, "apoderados">, string][] = [
  ["dni", "DNI del estudiante"],
  ["nombres", "Nombres del estudiante"],
  ["apellidos", "Apellidos del estudiante"],
  ["fechaNacimiento", "Fecha de nacimiento"],
  ["grado", "Grado"],
  ["seccion", "Sección"],
  ["fechaMatricula", "Fecha de matrícula"],
  ["modalidadPago", "Modalidad de pago"],
  ["responsablePago", "Apoderado responsable del pago"],
];

/** Datos obligatorios que faltan para la ficha (vacío si está completa). */
export function pendientesFicha(d: DatosObligatoriosFicha): string[] {
  const pendientes = OBLIGATORIOS_FICHA.filter(([campo]) => !d[campo]?.trim()).map(([, nombre]) => nombre);
  if (d.apoderados < 1) pendientes.push("Apoderados");
  return pendientes;
}

/** US20: con algún dato obligatorio pendiente no se genera el archivo. */
export function verificarFichaCompleta(d: DatosObligatoriosFicha) {
  const pendientes = pendientesFicha(d);
  if (pendientes.length) throw E.fichaDatosPendientes(pendientes);
}
