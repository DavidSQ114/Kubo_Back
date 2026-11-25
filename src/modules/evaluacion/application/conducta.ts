// evaluacion/application: nota de conducta de la tutoría (bloque M3). El tutor o cotutor de la sección registra y
// modifica, por bimestre, la conducta de cada alumno (AD, A, B o C y un comentario opcional) mientras el periodo no
// esté FINALIZADO, con auditoría (REGISTRAR_NOTA_CONDUCTA y MODIFICAR_NOTA_CONDUCTA). La libreta la muestra cuando el
// bimestre está publicado.
import { prisma } from "@/platform/db/prisma";
import { registrarAuditoria } from "@/platform/auditoria";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { tutoriaDelDocente } from "@/modules/academico";
import { nombresDeUsuarios } from "@/modules/comunidad";
import type { Autenticado } from "@/modules/identidad";
import {
  cambiosDeConducta,
  resumenDeConducta,
  verificarAlumnosDeConducta,
  verificarPeriodoDeConducta,
  type ConductaNueva,
} from "../domain/conducta";
import { erroresTutoriaNotas as E } from "../domain/errores";
import type { LogroNota } from "../domain/notas";
import { conductas } from "../infrastructure/conducta";
import { alumnosDeLaTutoria, periodosDeTutoria, type PeriodoDeTutoria } from "./tutoriaComun";

export interface ConductaDeAlumno {
  matriculaId: string;
  nombre: string;
  valor: LogroNota | null;
  comentario: string | null;
  /** Quién la registró o la modificó por última vez y cuándo; null si aún no tiene nota. */
  actualizadaPor: string | null;
  actualizadaEn: string | null;
}

export interface ConductaDeLaSeccion {
  seccion: { id: string; etiqueta: string };
  periodos: PeriodoDeTutoria[];
  periodo: PeriodoDeTutoria;
  /** false si el periodo está FINALIZADO. */
  editable: boolean;
  motivoSoloLectura: string | null;
  alumnos: ConductaDeAlumno[];
  resumen: Record<LogroNota | "SIN_NOTA", number>;
}

/** Conducta de los alumnos de la sección en un bimestre (por defecto, el que está en curso). */
export async function conductaDeLaSeccion(
  auth: Autenticado,
  seccionId: string,
  filtro: { periodoId?: string },
  ahora: Date = new Date(),
): Promise<ConductaDeLaSeccion> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const { periodos, elegido, hoy } = await periodosDeTutoria(t, filtro.periodoId, ahora);
  const alumnos = await alumnosDeLaTutoria(seccionId, elegido, hoy);
  const guardadas = await conductas.delPeriodo(
    elegido.id,
    alumnos.map((a) => a.matriculaId),
  );
  const usuarios = await nombresDeUsuarios(guardadas.map((g) => g.modificadoPorId ?? g.registradoPorId));
  const lista = alumnos.map((a): ConductaDeAlumno => {
    const g = guardadas.find((x) => x.matriculaId === a.matriculaId);
    const por = g ? (g.modificadoPorId ?? g.registradoPorId) : null;
    return {
      matriculaId: a.matriculaId,
      nombre: a.nombre,
      valor: g?.valor ?? null,
      comentario: g?.comentario ?? null,
      actualizadaPor: por ? (usuarios[por]?.nombreCompleto ?? null) : null,
      actualizadaEn: g ? (g.modificadoEn ?? g.createdAt).toISOString() : null,
    };
  });
  const finalizado = elegido.estado === "FINALIZADO";
  return {
    seccion: { id: t.seccion.id, etiqueta: t.seccion.etiqueta },
    periodos,
    periodo: elegido,
    editable: !finalizado,
    motivoSoloLectura: finalizado ? E.periodoFinalizado().message : null,
    alumnos: lista,
    resumen: resumenDeConducta(lista.map((a) => a.valor)),
  };
}

/**
 * Guarda la conducta de varios alumnos de la sección en un bimestre: crea las que faltan y modifica las que cambian,
 * en una transacción con el periodo bloqueado (no se finaliza a la vez) y con auditoría de cada una.
 */
export async function guardarConducta(
  auth: Autenticado,
  seccionId: string,
  periodoId: string,
  datos: { notas: ConductaNueva[] },
  meta: MetaSolicitud,
  ahora: Date = new Date(),
): Promise<ConductaDeLaSeccion & { guardadas: { creadas: number; modificadas: number } }> {
  const t = await tutoriaDelDocente(auth, seccionId);
  const { elegido, hoy } = await periodosDeTutoria(t, periodoId, ahora);
  verificarPeriodoDeConducta(elegido.estado);
  const alumnos = await alumnosDeLaTutoria(seccionId, elegido, hoy);
  verificarAlumnosDeConducta(new Set(alumnos.map((a) => a.matriculaId)), datos.notas);

  const guardadas = await prisma.$transaction(async (tx) => {
    const estado = await conductas.bloquearPeriodo(tx, elegido.id);
    verificarPeriodoDeConducta(estado ?? "");
    const actuales = await conductas.delPeriodo(
      elegido.id,
      datos.notas.map((n) => n.matriculaId),
      tx,
    );
    const { crear, cambiar } = cambiosDeConducta(actuales, datos.notas);
    for (const n of crear) {
      const { id } = await conductas.crear(tx, {
        ...n,
        periodoEvaluacionId: elegido.id,
        registradoPorId: auth.usuarioId,
      });
      await registrarAuditoria(
        tx,
        {
          usuarioId: auth.usuarioId,
          entidad: "nota_conducta",
          entidadId: id,
          accion: "REGISTRAR_NOTA_CONDUCTA",
          nuevo: {
            matriculaId: n.matriculaId,
            periodoId: elegido.id,
            valor: n.valor,
            comentario: n.comentario,
            rol: t.rol,
          },
        },
        meta,
      );
    }
    for (const { guardada, nueva } of cambiar) {
      await conductas.cambiar(tx, guardada.id, {
        valor: nueva.valor,
        comentario: nueva.comentario,
        modificadoPorId: auth.usuarioId,
      });
      await registrarAuditoria(
        tx,
        {
          usuarioId: auth.usuarioId,
          entidad: "nota_conducta",
          entidadId: guardada.id,
          accion: "MODIFICAR_NOTA_CONDUCTA",
          anterior: { valor: guardada.valor, comentario: guardada.comentario },
          nuevo: {
            matriculaId: nueva.matriculaId,
            periodoId: elegido.id,
            valor: nueva.valor,
            comentario: nueva.comentario,
            rol: t.rol,
          },
        },
        meta,
      );
    }
    return { creadas: crear.length, modificadas: cambiar.length };
  });

  return { ...(await conductaDeLaSeccion(auth, seccionId, { periodoId: elegido.id }, ahora)), guardadas };
}

/** Conducta de una matrícula por bimestre (para la libreta y la vista del tutor). */
export async function conductaDeMatricula(
  matriculaId: string,
): Promise<Map<string, { valor: LogroNota; comentario: string | null }>> {
  const filas = await conductas.deMatricula(matriculaId);
  return new Map(filas.map((f) => [f.periodoEvaluacionId, { valor: f.valor, comentario: f.comentario }]));
}
