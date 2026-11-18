// horarios/domain: reglas puras de la asistencia de alumnos (US35 toma diaria, DO-03; US36 plazo de corrección, M-20;
// US45 resumen mensual del apoderado, AP-03; US52 «Mi asistencia» del alumno, AL-04). Las fechas viajan como texto
// «AAAA-MM-DD» en la hora de Lima y los meses, como «AAAA-MM».
import { erroresAsistencia as E, type AlumnoSinMarcar } from "./errores";
import { DIAS, type Dia } from "./tipos";

export const ESTADOS_ASISTENCIA = ["PRESENTE", "TARDANZA", "FALTA", "FALTA_JUSTIFICADA"] as const;
export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number];

/** Nombres del Product Backlog (US35): la falta se muestra como «Ausente» y la falta justificada, como «Justificado». */
export const NOMBRE_ESTADO_ASISTENCIA: Record<EstadoAsistencia, string> = {
  PRESENTE: "Presente",
  TARDANZA: "Tardanza",
  FALTA: "Ausente",
  FALTA_JUSTIFICADA: "Justificado",
};

export interface Rango {
  fechaInicio: string;
  fechaFin: string;
}

const MS_POR_HORA = 3_600_000;
const MS_POR_DIA = 24 * MS_POR_HORA;
const aInstante = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);
const aFecha = (instante: Date) => instante.toISOString().slice(0, 10);
const contiene = (r: Rango, fecha: string) => r.fechaInicio <= fecha && fecha <= r.fechaFin;

/** Día de clases (lunes a viernes) de una fecha, o null si es sábado o domingo. */
export function diaDeClases(fecha: string): Dia | null {
  const numero = aInstante(fecha).getUTCDay(); // 0 es domingo y 6, sábado
  return numero >= 1 && numero <= 5 ? DIAS[numero - 1] : null;
}

/** «Álvarez Torres, Camila»: como se ordena y se lee la lista de la clase (DO-03). */
export const nombreDeLista = (p: { nombres: string; apellidos: string }) => `${p.apellidos}, ${p.nombres}`;

// ---------- US35 · Clases de hoy ----------

export const MOTIVOS_SIN_CLASES = ["FIN_DE_SEMANA", "SIN_ANIO_EN_CURSO", "FUERA_DE_BIMESTRE", "SIN_CLASES"] as const;
export type MotivoSinClases = (typeof MOTIVOS_SIN_CLASES)[number];

export const MENSAJE_SIN_CLASES: Record<MotivoSinClases, string> = {
  FIN_DE_SEMANA: "Hoy no hay clases: es fin de semana.",
  SIN_ANIO_EN_CURSO: "No hay un año escolar en curso: todavía no se registra asistencia.",
  FUERA_DE_BIMESTRE: "Hoy no hay clases: la fecha está fuera de los bimestres del año escolar.",
  SIN_CLASES: "No tienes clases programadas para hoy en el horario publicado.",
};

/**
 * Por qué una fecha no tiene clases, o null si es un día lectivo: lunes a viernes, con un año en curso y dentro de
 * uno de sus bimestres. `bimestres` es null si no hay año en curso.
 */
export function motivoDiaNoLectivo(fecha: string, bimestres: Rango[] | null): MotivoSinClases | null {
  if (!diaDeClases(fecha)) return "FIN_DE_SEMANA";
  if (!bimestres) return "SIN_ANIO_EN_CURSO";
  if (!bimestres.some((b) => contiene(b, fecha))) return "FUERA_DE_BIMESTRE";
  return null;
}

/** La asistencia se registra el mismo día de la clase: ni fechas futuras ni días pasados (US35). */
export function verificarFechaDeRegistro(fecha: string, hoy: string) {
  if (fecha > hoy) throw E.fechaFutura();
  if (fecha < hoy) throw E.soloDiaActual();
}

// ---------- US35 · Lista de la clase ----------

export interface MarcaDeAsistencia {
  matriculaId: string;
  /** null: el docente aún no marcó al alumno. */
  estado: EstadoAsistencia | null;
  observacion: string | null;
}

export interface MarcaCompleta extends MarcaDeAsistencia {
  estado: EstadoAsistencia;
}

/** Alumnos de la lista que no tienen un estado en las marcas recibidas. */
export function alumnosSinMarcar(alumnos: AlumnoSinMarcar[], marcas: MarcaDeAsistencia[]): AlumnoSinMarcar[] {
  const marcados = new Set(marcas.filter((m) => m.estado !== null).map((m) => m.matriculaId));
  return alumnos.filter((a) => !marcados.has(a.matriculaId));
}

/**
 * Valida la lista antes de guardarla: solo alumnos de la clase y todos con estado. Si falta alguno responde
 * «Existen alumnos sin estado de asistencia registrado» y dice cuáles (US35, criterio 3).
 */
export function verificarListaCompleta(alumnos: AlumnoSinMarcar[], marcas: MarcaDeAsistencia[]): MarcaCompleta[] {
  const deLaClase = new Set(alumnos.map((a) => a.matriculaId));
  const recibidos = new Set(marcas.map((m) => m.matriculaId));
  if (marcas.some((m) => !deLaClase.has(m.matriculaId)) || recibidos.size !== marcas.length) {
    throw E.alumnoFueraDeLaClase();
  }
  const faltantes = alumnosSinMarcar(alumnos, marcas);
  if (faltantes.length) throw E.asistenciaIncompleta(faltantes);
  return marcas as MarcaCompleta[];
}

export interface ResumenDeSesion {
  presentes: number;
  tardanzas: number;
  ausentes: number;
  justificados: number;
  sinMarcar: number;
}

/** Contadores de la cabecera de la lista (DO-03): «20 presentes · 2 tardanzas · 1 ausentes · …». */
export function resumenDeSesion(estados: (EstadoAsistencia | null)[]): ResumenDeSesion {
  const cuenta = (e: EstadoAsistencia | null) => estados.filter((x) => x === e).length;
  return {
    presentes: cuenta("PRESENTE"),
    tardanzas: cuenta("TARDANZA"),
    ausentes: cuenta("FALTA"),
    justificados: cuenta("FALTA_JUSTIFICADA"),
    sinMarcar: cuenta(null),
  };
}

// ---------- US36 · Plazo de corrección ----------

/** Instante hasta el que el docente puede corregir un registro: `plazoHoras` después de haberlo guardado. */
export function limiteDeCorreccion(registradoEn: Date, plazoHoras: number): Date {
  return new Date(registradoEn.getTime() + plazoHoras * MS_POR_HORA);
}

/** ¿Sigue abierto el plazo? Justo en el límite todavía se puede corregir. */
export function dentroDelPlazo(registradoEn: Date, plazoHoras: number, ahora: Date): boolean {
  return ahora.getTime() <= limiteDeCorreccion(registradoEn, plazoHoras).getTime();
}

/** Pasado el plazo: «El plazo para modificar esta asistencia ha expirado (24 horas)» (US36, criterio 2). */
export function verificarPlazoDeCorreccion(registradoEn: Date, plazoHoras: number, ahora: Date) {
  if (!dentroDelPlazo(registradoEn, plazoHoras, ahora)) throw E.plazoVencido(plazoHoras);
}

export interface RegistroGuardado {
  id: string;
  matriculaId: string;
  estado: EstadoAsistencia;
  observacion: string | null;
}

export interface Correccion {
  registro: RegistroGuardado;
  estado: EstadoAsistencia;
  observacion: string | null;
}

/**
 * Compara la lista recibida con lo ya guardado: qué registros son nuevos y cuáles cambian de estado o de
 * observación. Los que quedan igual no se tocan, así no figuran como corregidos.
 */
export function cambiosDeAsistencia(
  guardados: RegistroGuardado[],
  marcas: MarcaCompleta[],
): { nuevos: MarcaCompleta[]; correcciones: Correccion[] } {
  const porMatricula = new Map(guardados.map((g) => [g.matriculaId, g]));
  const nuevos: MarcaCompleta[] = [];
  const correcciones: Correccion[] = [];
  for (const marca of marcas) {
    const registro = porMatricula.get(marca.matriculaId);
    if (!registro) nuevos.push(marca);
    else if (registro.estado !== marca.estado || registro.observacion !== marca.observacion) {
      correcciones.push({ registro, estado: marca.estado, observacion: marca.observacion });
    }
  }
  return { nuevos, correcciones };
}

export interface EdicionDeSesion {
  /** La lista ya se guardó al menos una vez. */
  registrada: boolean;
  /** Hasta cuándo puede corregirla el docente; null si aún no la registra. */
  editableHasta: Date | null;
  /** El docente puede guardar ahora: registrar por primera vez (solo el día de la clase) o corregir en plazo. */
  editable: boolean;
  /** Por qué se muestra en solo lectura, con el mensaje para el docente; null si es editable. */
  motivoSoloLectura: string | null;
}

/**
 * Qué puede hacer el docente con una sesión: registrarla el día de la clase y corregirla hasta `plazoHoras` después
 * del registro; luego queda en solo lectura con el mensaje del backlog (US36, criterio 2).
 */
export function edicionDeSesion(
  sesion: { fecha: string; registradaEn: Date | null },
  plazoHoras: number,
  ahora: Date,
  hoy: string,
): EdicionDeSesion {
  if (!sesion.registradaEn) {
    const esHoy = sesion.fecha === hoy;
    return {
      registrada: false,
      editableHasta: null,
      editable: esHoy,
      motivoSoloLectura: esHoy ? null : E.soloDiaActual().message,
    };
  }
  const enPlazo = dentroDelPlazo(sesion.registradaEn, plazoHoras, ahora);
  return {
    registrada: true,
    editableHasta: limiteDeCorreccion(sesion.registradaEn, plazoHoras),
    editable: enPlazo,
    motivoSoloLectura: enPlazo ? null : E.plazoVencido(plazoHoras).message,
  };
}

/** La corrección del administrador debe cambiar algo: el estado o la observación (M-20). */
export function verificarCorreccion(
  actual: RegistroGuardado,
  nueva: { estado: EstadoAsistencia; observacion: string | null },
) {
  if (actual.estado === nueva.estado && actual.observacion === nueva.observacion) throw E.sinCambios();
}

// ---------- US45 · Estado del día ----------

export const ESTADOS_DIA = ["PRESENTE", "TARDANZA", "AUSENTE", "JUSTIFICADO"] as const;
export type EstadoDia = (typeof ESTADOS_DIA)[number];

const ESTADO_DIA_DE_CLASE: Record<EstadoAsistencia, EstadoDia> = {
  PRESENTE: "PRESENTE",
  TARDANZA: "TARDANZA",
  FALTA: "AUSENTE",
  FALTA_JUSTIFICADA: "JUSTIFICADO",
};

const esFalta = (e: EstadoAsistencia) => e === "FALTA" || e === "FALTA_JUSTIFICADA";

/**
 * Estado de un día a partir de sus clases (al menos una). Es «Ausente» solo si faltó a TODAS las clases del día
 * (US45, criterio 1) y «Justificado» si todas esas faltas están justificadas. Si asistió a alguna, el día cuenta como
 * «Presente», o «Tardanza» si llegó tarde a alguna clase.
 */
export function estadoDelDia(estados: EstadoAsistencia[]): EstadoDia {
  if (estados.every(esFalta)) return estados.includes("FALTA") ? "AUSENTE" : "JUSTIFICADO";
  return estados.includes("TARDANZA") ? "TARDANZA" : "PRESENTE";
}

export interface DiaDeAsistencia {
  fecha: string;
  estado: EstadoDia;
  /** Clases del día con asistencia registrada. */
  clases: number;
}

/** Un estado por día con clases registradas, del más antiguo al más reciente. */
export function diasDeAsistencia(registros: { fecha: string; estado: EstadoAsistencia }[]): DiaDeAsistencia[] {
  const porFecha = new Map<string, EstadoAsistencia[]>();
  for (const r of registros) porFecha.set(r.fecha, [...(porFecha.get(r.fecha) ?? []), r.estado]);
  return [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, estados]) => ({ fecha, estado: estadoDelDia(estados), clases: estados.length }));
}

export interface ResumenDeDias {
  presentes: number;
  tardanzas: number;
  ausentes: number;
  justificados: number;
  diasConClases: number;
  /** Días en que asistió (presente o con tardanza) sobre los días con clases, de 0 a 100; null sin registros. */
  porcentajeAsistencia: number | null;
}

/** Resumen del periodo (AP-03 «Resumen de agosto»): días por estado y porcentaje de asistencia. */
export function resumenDeDias(dias: DiaDeAsistencia[]): ResumenDeDias {
  const cuenta = (e: EstadoDia) => dias.filter((d) => d.estado === e).length;
  const presentes = cuenta("PRESENTE");
  const tardanzas = cuenta("TARDANZA");
  return {
    presentes,
    tardanzas,
    ausentes: cuenta("AUSENTE"),
    justificados: cuenta("JUSTIFICADO"),
    diasConClases: dias.length,
    porcentajeAsistencia: dias.length ? Math.round(((presentes + tardanzas) / dias.length) * 100) : null,
  };
}

export interface ClaseDelRegistro {
  curso: string;
  horaInicio: string;
  /** «L. Campos»; null si ya no se conoce al docente. */
  docente: string | null;
}

export interface RegistroDeClase {
  fecha: string;
  estado: EstadoAsistencia;
  observacion: string | null;
  clase: ClaseDelRegistro;
}

export interface Incidencia {
  fecha: string;
  /** DIA: faltó a todas las clases del día. CLASE: lo ocurrido en una clase concreta. */
  alcance: "DIA" | "CLASE";
  estado: EstadoDia;
  clase: ClaseDelRegistro | null;
  /** Observación del docente (US35, criterio 4); en un día completo, las de sus clases. */
  observacion: string | null;
}

/**
 * Inasistencias, tardanzas y observaciones del periodo, de la más reciente a la más antigua (AP-03 y AL-04). Un día
 * sin asistir a ninguna clase es una sola línea («Ausente todo el día»); si faltó solo a algunas, se listan esas
 * clases. Una clase «Presente» aparece solo si el docente dejó una observación.
 */
export function incidenciasDe(registros: RegistroDeClase[]): Incidencia[] {
  const incidencias: Incidencia[] = [];
  for (const dia of diasDeAsistencia(registros)) {
    const delDia = registros
      .filter((r) => r.fecha === dia.fecha)
      .sort((a, b) => a.clase.horaInicio.localeCompare(b.clase.horaInicio));
    if (dia.estado === "AUSENTE" || dia.estado === "JUSTIFICADO") {
      const observaciones = [...new Set(delDia.flatMap((r) => (r.observacion ? [r.observacion] : [])))];
      incidencias.push({
        fecha: dia.fecha,
        alcance: "DIA",
        estado: dia.estado,
        clase: null,
        observacion: observaciones.join(" · ") || null,
      });
      continue;
    }
    for (const r of delDia) {
      if (r.estado === "PRESENTE" && !r.observacion) continue;
      incidencias.push({
        fecha: r.fecha,
        alcance: "CLASE",
        estado: ESTADO_DIA_DE_CLASE[r.estado],
        clase: r.clase,
        observacion: r.observacion,
      });
    }
  }
  return incidencias.reverse();
}

// ---------- Meses y bimestres ----------

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** «2026-09» → «setiembre». */
export const nombreDelMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1] ?? mes;

/** «2026-09-16» → «2026-09». */
export const mesDe = (fecha: string) => fecha.slice(0, 7);

/** Primer y último día de un mes «AAAA-MM». */
export function rangoDelMes(mes: string): Rango {
  const [anio, numero] = mes.split("-").map(Number);
  return { fechaInicio: `${mes}-01`, fechaFin: aFecha(new Date(Date.UTC(anio, numero, 0))) };
}

export interface Bimestre extends Rango {
  numero: number;
  nombre: string;
}

/**
 * Bimestre al que se acumulan los contadores en una fecha: el que la contiene y, en vacaciones, el último que ya
 * empezó. Antes del primer bimestre, null.
 */
export function bimestreDeReferencia<T extends Bimestre>(bimestres: T[], fecha: string): T | null {
  const empezados = bimestres.filter((b) => b.fechaInicio <= fecha).sort((a, b) => a.numero - b.numero);
  return empezados.find((b) => contiene(b, fecha)) ?? empezados.at(-1) ?? null;
}

/**
 * Días de lunes a viernes dentro de los bimestres: los días de clase del año (no se descuentan feriados). Con `desde`,
 * solo los que caen ese día o después.
 */
export function diasLectivos(bimestres: Rango[], desde?: string): number {
  let total = 0;
  for (const b of bimestres) {
    const inicio = desde && desde > b.fechaInicio ? desde : b.fechaInicio;
    for (let t = aInstante(inicio).getTime(); t <= aInstante(b.fechaFin).getTime(); t += MS_POR_DIA) {
      if (diaDeClases(aFecha(new Date(t)))) total += 1;
    }
  }
  return total;
}

export interface BaseDeInasistencia {
  /** Días de clase que le corresponden al alumno: la base del porcentaje y de los umbrales. */
  lectivos: number;
  /** Desde qué día se cuentan («AAAA-MM-DD»). */
  desde: string;
  /** Se cuentan desde su matrícula porque se matriculó después de que empezaron las clases. */
  desdeMatricula: boolean;
}

/**
 * Base de las inasistencias del alumno (D-11): los días de clase desde su fecha de matrícula (o desde el inicio de
 * las clases si se matriculó antes) hasta el fin del último bimestre. Matriculado el 06/11/2026 con el último bimestre
 * hasta el 15/12/2026, son 28 días. Sin bimestres, 0.
 */
export function baseDeInasistencia(bimestres: Rango[], fechaMatricula: string): BaseDeInasistencia {
  const inicioClases = bimestres.map((b) => b.fechaInicio).sort()[0];
  if (!inicioClases) return { lectivos: 0, desde: fechaMatricula, desdeMatricula: false };
  const desdeMatricula = fechaMatricula > inicioClases;
  const desde = desdeMatricula ? fechaMatricula : inicioClases;
  return { lectivos: diasLectivos(bimestres, desde), desde, desdeMatricula };
}

/** «1 falta», «2 faltas», «0 faltas»: la cantidad con el sustantivo en singular o plural. */
export const cantidad = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export type EstadoCalendario = EstadoDia | "SIN_REGISTRO" | "VACACIONES" | "FUERA_DEL_ANIO";

export interface DiaDelCalendario {
  fecha: string;
  dia: Dia;
  estado: EstadoCalendario;
}

/**
 * Días de lunes a viernes de un mes con su estado (calendario de AP-03). Sin asistencia registrada: «Vacaciones» si
 * la fecha cae entre los bimestres del año, «fuera del año» si no pertenece al año escolar y «sin registro» en un día
 * de clases en el que aún no se tomó asistencia.
 */
export function calendarioDelMes(
  mes: string,
  dias: DiaDeAsistencia[],
  anio: Rango | null,
  bimestres: Rango[],
): DiaDelCalendario[] {
  const registrados = new Map(dias.map((d) => [d.fecha, d.estado]));
  const { fechaInicio, fechaFin } = rangoDelMes(mes);
  const calendario: DiaDelCalendario[] = [];
  for (let t = aInstante(fechaInicio).getTime(); t <= aInstante(fechaFin).getTime(); t += MS_POR_DIA) {
    const fecha = aFecha(new Date(t));
    const dia = diaDeClases(fecha);
    if (!dia) continue;
    let estado: EstadoCalendario = "SIN_REGISTRO";
    if (registrados.has(fecha)) estado = registrados.get(fecha)!;
    else if (!anio || !contiene(anio, fecha)) estado = "FUERA_DEL_ANIO";
    else if (bimestres.length && !bimestres.some((b) => contiene(b, fecha))) estado = "VACACIONES";
    calendario.push({ fecha, dia, estado });
  }
  return calendario;
}

// ---------- US45 y US52 · Umbrales y alertas ----------

export interface Umbrales {
  /** Faltas injustificadas en un mes que activan la alerta mensual (UMBRAL_FALTAS_MES). */
  faltasMes: number;
  /** Fracción de inasistencias del año que activa el aviso previo (UMBRAL_INASISTENCIA_AVISO, 0.15). */
  aviso: number;
  /** Fracción de inasistencias del año que marca el riesgo (UMBRAL_INASISTENCIA, 0.20). */
  riesgo: number;
}

// Los umbrales se comparan en diezmilésimas para no depender del redondeo de los decimales (0.15 × 20 = 3).
const BASE_UMBRAL = 10_000;
const enBase = (umbral: number) => Math.round(umbral * BASE_UMBRAL);

/**
 * ¿Las faltas llegan a la fracción `umbral` de los días de clase que le corresponden al alumno (D-11)? Sin días de
 * clase no hay porcentaje.
 */
export function alcanzaUmbral(faltas: number, lectivos: number, umbral: number): boolean {
  return lectivos > 0 && faltas * BASE_UMBRAL >= enBase(umbral) * lectivos;
}

/** Porcentaje de inasistencias con un decimal: 9 faltas de 120 días → 7.5. Sin días de clase, 0. */
export function porcentajeDeInasistencia(faltas: number, lectivos: number): number {
  return lectivos > 0 ? Math.round((faltas / lectivos) * 1000) / 10 : 0;
}

/**
 * Faltas que todavía no llegan al umbral (D-11): las que el alumno puede sumar sin alcanzarlo. Con 187 días y 20 % el
 * umbral se alcanza en la falta 38 (37,4 días); con 1 falta le quedan 36. Nunca es negativo.
 */
export function faltasAntesDelUmbral(faltas: number, lectivos: number, umbral: number): number {
  // primera cantidad de faltas que alcanza el umbral; la anterior es la última que todavía no llega
  const faltasQueAlcanzan = Math.ceil((enBase(umbral) * lectivos) / BASE_UMBRAL);
  return Math.max(0, faltasQueAlcanzan - 1 - faltas);
}

export type NivelDeRiesgo = "SIN_RIESGO" | "AVISO" | "RIESGO";

/** Nivel de riesgo por inasistencias del año (AL-04): aviso al 15 % y riesgo al 20 %, según los parámetros. */
export function nivelDeRiesgo(faltas: number, lectivos: number, umbrales: Umbrales): NivelDeRiesgo {
  if (alcanzaUmbral(faltas, lectivos, umbrales.riesgo)) return "RIESGO";
  return alcanzaUmbral(faltas, lectivos, umbrales.aviso) ? "AVISO" : "SIN_RIESGO";
}

export interface SituacionAnual {
  /** Días de inasistencia injustificada del año. */
  faltas: number;
  /** Días de clase que le corresponden al alumno: desde su matrícula (o el inicio de clases) hasta el fin del año. */
  lectivos: number;
  /** Desde qué día se cuentan los días de clase («AAAA-MM-DD»). */
  desde: string;
  /** Los días de clase se cuentan desde su matrícula («28 días de clase desde tu matrícula»). */
  desdeMatricula: boolean;
  /** Porcentaje de inasistencias con un decimal (7.5). */
  porcentaje: number;
  nivel: NivelDeRiesgo;
  /** Umbrales en porcentaje: 15 y 20. */
  porcentajeAviso: number;
  porcentajeRiesgo: number;
  /** Faltas que quedan antes de llegar al umbral de riesgo. */
  faltasAntesDelRiesgo: number;
}

const aPorcentaje = (fraccion: number) => Math.round(fraccion * 1000) / 10;

/** Situación del año frente a los umbrales de la institución (barra «Nivel de riesgo» de AL-04). */
export function situacionAnual(faltas: number, base: BaseDeInasistencia, umbrales: Umbrales): SituacionAnual {
  const { lectivos } = base;
  return {
    faltas,
    lectivos,
    desde: base.desde,
    desdeMatricula: base.desdeMatricula,
    porcentaje: porcentajeDeInasistencia(faltas, lectivos),
    nivel: nivelDeRiesgo(faltas, lectivos, umbrales),
    porcentajeAviso: aPorcentaje(umbrales.aviso),
    porcentajeRiesgo: aPorcentaje(umbrales.riesgo),
    faltasAntesDelRiesgo: faltasAntesDelUmbral(faltas, lectivos, umbrales.riesgo),
  };
}

/** Alerta mensual (US45, criterio 2): «Atención: 3 inasistencias injustificadas este mes», o null. */
export function alertaDelMes(faltasInjustificadas: number, umbralFaltasMes: number): string | null {
  if (faltasInjustificadas < umbralFaltasMes) return null;
  return `Atención: ${cantidad(faltasInjustificadas, "inasistencia injustificada", "inasistencias injustificadas")} este mes`;
}

export const TIPOS_AVISO = ["FALTAS_MES", "PORCENTAJE_AVISO", "PORCENTAJE_RIESGO"] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

export interface Aviso {
  tipo: TipoAviso;
  /** «2026-09» para las faltas del mes; «2026» para los porcentajes del año. */
  periodo: string;
  /** Faltas injustificadas del periodo al alcanzar el umbral. */
  faltas: number;
}

export interface SituacionDeFaltas {
  /** Año escolar de la matrícula (2026). */
  anio: number;
  /** Mes de la falta recién registrada («2026-09»). */
  mes: string;
  faltasDelMes: number;
  faltasDelAnio: number;
  /** Días de clase que le corresponden al alumno desde su matrícula (D-11); ver `baseDeInasistencia`. */
  lectivos: number;
}

/** Umbrales que el alumno ya alcanzó con sus faltas injustificadas (US52, criterios 2 y 3). */
export function avisosAlcanzados(s: SituacionDeFaltas, umbrales: Umbrales): Aviso[] {
  const avisos: Aviso[] = [];
  if (s.faltasDelMes >= umbrales.faltasMes) avisos.push({ tipo: "FALTAS_MES", periodo: s.mes, faltas: s.faltasDelMes });
  const delAnio = { periodo: String(s.anio), faltas: s.faltasDelAnio };
  if (alcanzaUmbral(s.faltasDelAnio, s.lectivos, umbrales.aviso)) avisos.push({ tipo: "PORCENTAJE_AVISO", ...delAnio });
  if (alcanzaUmbral(s.faltasDelAnio, s.lectivos, umbrales.riesgo))
    avisos.push({ tipo: "PORCENTAJE_RIESGO", ...delAnio });
  return avisos;
}

/** De los umbrales alcanzados, los que todavía no se avisaron: cada uno se envía una sola vez por periodo. */
export function avisosPendientes(alcanzados: Aviso[], enviados: Pick<Aviso, "tipo" | "periodo">[]): Aviso[] {
  return alcanzados.filter((a) => !enviados.some((e) => e.tipo === a.tipo && e.periodo === a.periodo));
}

/**
 * Avisos nuevos que generan un correo. Si en el mismo registro se alcanzan el aviso previo y el riesgo, se escribe
 * solo por el riesgo (los dos quedan guardados como avisados).
 */
export function avisosConCorreo<T extends Aviso>(nuevos: T[]): T[] {
  const hayRiesgo = nuevos.some((a) => a.tipo === "PORCENTAJE_RIESGO");
  return nuevos.filter((a) => !(hayRiesgo && a.tipo === "PORCENTAJE_AVISO"));
}
