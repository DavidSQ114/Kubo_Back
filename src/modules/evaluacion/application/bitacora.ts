// evaluacion/application: bitácora de notas (US03, AD-16 «Cambios de notas»). Cada nota registrada o cambiada por el
// docente (US37) o por una rectificación aprobada (US41) deja una fila en bitacora_nota dentro de la misma
// transacción; el Administrador la consulta en solo lectura, filtrada por rango de fechas y por docente.
import type { Tx } from "@/platform/db/tipos";
import type { LogroNota } from "../domain/notas";
import {
  columnaDeCompetencia,
  NOMBRE_ORIGEN,
  rangoDeFechas,
  type CompetenciaDeColumna,
  type OrigenCambio,
} from "../domain/rectificacion";
import { bitacora, type EntradaBitacora, type FilaBitacora } from "../infrastructure/repositorio";

/** Lo que tienen en común todos los cambios de una misma operación: quién, curso, sección y bimestre. */
export interface ContextoBitacora {
  usuarioId: string;
  usuarioNombre: string;
  docenteId: string;
  docenteNombre: string;
  anio: number;
  curso: { codigo: string; nombre: string };
  /** «3° B». */
  seccion: string;
  bimestre: { numero: number; nombre: string };
  origen: OrigenCambio;
  solicitudId: string | null;
}

export interface CambioDeNota {
  notaId: string;
  cierreId: string;
  matriculaId: string;
  competenciaPlanId: string;
  /** null si es el primer registro de la nota. */
  anterior: LogroNota | null;
  nuevo: LogroNota;
  /** «Castillo Ramos, Bruno». */
  estudiante: string;
  competencia: CompetenciaDeColumna;
}

export function entradaDeBitacora(ctx: ContextoBitacora, cambio: CambioDeNota): EntradaBitacora {
  return {
    notaId: cambio.notaId,
    cierreId: cambio.cierreId,
    matriculaId: cambio.matriculaId,
    competenciaPlanId: cambio.competenciaPlanId,
    origen: ctx.origen,
    solicitudId: ctx.solicitudId,
    logroAnterior: cambio.anterior,
    logroNuevo: cambio.nuevo,
    usuarioId: ctx.usuarioId,
    usuarioNombre: ctx.usuarioNombre,
    docenteId: ctx.docenteId,
    docenteNombre: ctx.docenteNombre,
    anio: ctx.anio,
    cursoCodigo: ctx.curso.codigo,
    cursoNombre: ctx.curso.nombre,
    seccion: ctx.seccion,
    bimestreNumero: ctx.bimestre.numero,
    bimestreNombre: ctx.bimestre.nombre,
    estudianteNombre: cambio.estudiante,
    competenciaColumna: cambio.competencia.columna,
    competenciaCodigo: cambio.competencia.codigo,
    competenciaNombre: cambio.competencia.nombre,
  };
}

/** Escribe los cambios en la bitácora: se llama dentro de la transacción que cambia las notas (US03). */
export async function registrarEnBitacora(tx: Tx, ctx: ContextoBitacora, cambios: CambioDeNota[]) {
  await bitacora.registrar(
    tx,
    cambios.map((c) => entradaDeBitacora(ctx, c)),
  );
}

// ---------- Consulta del Administrador (AD-16) ----------

export interface FiltroBitacoraNotas {
  /** «AAAA-MM-DD» en Lima. */
  desde?: string;
  hasta?: string;
  /** Id del docente del curso. */
  docenteId?: string;
  pagina: number;
  tamano: number;
}

export interface CambioRegistrado {
  id: string;
  fecha: string;
  origen: OrigenCambio;
  /** «Registro docente» o «Rectificación aprobada». */
  nombreOrigen: string;
  solicitudId: string | null;
  docente: { id: string; nombre: string };
  /** Quién hizo el cambio: el docente o el Administrador que aprobó la rectificación. */
  realizadoPor: { id: string; nombre: string };
  anio: number;
  curso: { codigo: string; nombre: string };
  seccion: string;
  bimestre: { numero: number; nombre: string };
  estudiante: string;
  competencia: { columna: string; codigo: string; nombre: string };
  valorAnterior: LogroNota | null;
  valorNuevo: LogroNota;
}

const vistaCambio = (f: FilaBitacora): CambioRegistrado => ({
  id: f.id,
  fecha: f.createdAt.toISOString(),
  origen: f.origen,
  nombreOrigen: NOMBRE_ORIGEN[f.origen],
  solicitudId: f.solicitudId,
  docente: { id: f.docenteId, nombre: f.docenteNombre },
  realizadoPor: { id: f.usuarioId, nombre: f.usuarioNombre },
  anio: f.anio,
  curso: { codigo: f.cursoCodigo, nombre: f.cursoNombre },
  seccion: f.seccion,
  bimestre: { numero: f.bimestreNumero, nombre: f.bimestreNombre },
  estudiante: f.estudianteNombre,
  competencia: {
    columna: columnaDeCompetencia(f.competenciaColumna),
    codigo: f.competenciaCodigo,
    nombre: f.competenciaNombre,
  },
  valorAnterior: f.logroAnterior,
  valorNuevo: f.logroNuevo,
});

/**
 * Cambios de notas del más reciente al más antiguo, paginados. Si se indican el rango de fechas y el docente, solo
 * salen los que cumplen ambos (US03, criterio 2).
 */
export async function listarBitacoraNotas(f: FiltroBitacoraNotas) {
  const rango = rangoDeFechas(f.desde, f.hasta);
  const { items, total } = await bitacora.listar({
    ...rango,
    docenteId: f.docenteId,
    pagina: f.pagina,
    tamano: f.tamano,
  });
  return {
    items: items.map(vistaCambio),
    paginacion: { pagina: f.pagina, tamano: f.tamano, total, paginas: Math.ceil(total / f.tamano) },
  };
}

/** Docentes con cambios en la bitácora (opciones del filtro «Docente»), por nombre. */
export async function docentesDeBitacora(): Promise<{ id: string; nombre: string }[]> {
  return (await bitacora.docentes())
    .map((d) => ({ id: d.docenteId, nombre: d.docenteNombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
