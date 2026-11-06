// comunidad/application: datos del estudiante y de sus apoderados que necesita la matrícula (US18, AD-10).
// El módulo matricula los pide por el index.ts: no lee las tablas de comunidad.
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import { estudiantesMatricula } from "../infrastructure/repositorio";

export interface ApoderadoDelEstudiante {
  /** Id del vínculo: es el «apoderado responsable del pago» de la matrícula. */
  vinculoId: string;
  apoderadoId: string;
  nombreCompleto: string;
  parentesco: string;
  esPrincipal: boolean;
  autorizado: boolean;
  telefono: string | null;
  email: string | null;
}

export interface EstudianteParaMatricula {
  estudianteId: string;
  dni: string;
  nombreCompleto: string;
  gradoIngresoId: string | null;
  activo: boolean;
  /** El principal primero. */
  apoderados: ApoderadoDelEstudiante[];
}

/** Estudiante con sus apoderados vinculados, o null si no existe. */
export async function estudianteParaMatricula(
  estudianteId: string,
  db: Tx | typeof prisma = prisma,
): Promise<EstudianteParaMatricula | null> {
  const e = await estudiantesMatricula.porId(estudianteId, db);
  if (!e) return null;
  return {
    estudianteId: e.id,
    dni: e.persona.dni,
    nombreCompleto: `${e.persona.nombres} ${e.persona.apellidos}`,
    gradoIngresoId: e.gradoIngresoId,
    activo: e.activo && e.persona.activo,
    apoderados: e.vinculosApoderado.map((v) => ({
      vinculoId: v.id,
      apoderadoId: v.apoderado.id,
      nombreCompleto: `${v.apoderado.persona.nombres} ${v.apoderado.persona.apellidos}`,
      parentesco: v.parentesco,
      esPrincipal: v.esPrincipal,
      autorizado: v.autorizado,
      telefono: v.apoderado.persona.telefono,
      email: v.apoderado.persona.email,
    })),
  };
}

export interface EstudianteResumen {
  dni: string;
  nombreCompleto: string;
  gradoIngresoId: string | null;
}

/** Nombre, DNI y grado de ingreso de varios estudiantes (listado de matrículas). */
export async function resumenEstudiantes(ids: string[]): Promise<Record<string, EstudianteResumen>> {
  if (!ids.length) return {};
  const filas = await estudiantesMatricula.porIds(ids);
  return Object.fromEntries(
    filas.map((e) => [
      e.id,
      {
        dni: e.persona.dni,
        nombreCompleto: `${e.persona.nombres} ${e.persona.apellidos}`,
        gradoIngresoId: e.gradoIngresoId,
      },
    ]),
  );
}

/** Ids de los estudiantes que coinciden con «rojas 7845» (nombre, apellido o inicio del DNI). */
export const idsEstudiantesPorBusqueda = (q: string) => estudiantesMatricula.idsPorBusqueda(q);

export interface ApoderadoFicha {
  vinculoId: string;
  dni: string;
  nombreCompleto: string;
  parentesco: string;
  esPrincipal: boolean;
  autorizado: boolean;
  telefono: string | null;
  email: string | null;
}

export interface EstudianteFicha {
  estudianteId: string;
  dni: string;
  nombres: string;
  apellidos: string;
  /** «AAAA-MM-DD» o null. */
  fechaNacimiento: string | null;
  sexo: "FEMENINO" | "MASCULINO" | null;
  direccion: string | null;
  colegioProcedencia: string | null;
  gradoIngreso: string | null;
  apoderados: ApoderadoFicha[];
}

/** Datos actuales del estudiante y de sus apoderados para la ficha de matrícula (US20), o null si no existe. */
export async function estudianteParaFicha(estudianteId: string): Promise<EstudianteFicha | null> {
  const e = await estudiantesMatricula.paraFicha(estudianteId);
  if (!e) return null;
  return {
    estudianteId: e.id,
    dni: e.persona.dni,
    nombres: e.persona.nombres,
    apellidos: e.persona.apellidos,
    fechaNacimiento: e.persona.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
    sexo: e.persona.sexo,
    direccion: e.persona.direccion,
    colegioProcedencia: e.colegioProcedencia,
    gradoIngreso: e.gradoIngreso?.nombre ?? null,
    apoderados: e.vinculosApoderado.map((v) => ({
      vinculoId: v.id,
      dni: v.apoderado.persona.dni,
      nombreCompleto: `${v.apoderado.persona.nombres} ${v.apoderado.persona.apellidos}`,
      parentesco: v.parentesco,
      esPrincipal: v.esPrincipal,
      autorizado: v.autorizado,
      telefono: v.apoderado.persona.telefono,
      email: v.apoderado.persona.email,
    })),
  };
}

export interface NombreUsuario {
  nombreCompleto: string;
  /** «R. Huamán»: inicial del primer nombre y primer apellido, como en la bitácora de AD-11. */
  nombreCorto: string;
}

/** Nombres de los usuarios indicados (por ejemplo, quién registró o anuló un pago, US04). */
export async function nombresDeUsuarios(ids: string[]): Promise<Record<string, NombreUsuario>> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return {};
  const filas = await estudiantesMatricula.nombresDeUsuarios(unicos);
  return Object.fromEntries(
    filas.map((u) => [
      u.id,
      {
        nombreCompleto: `${u.persona.nombres} ${u.persona.apellidos}`,
        nombreCorto: `${u.persona.nombres.trim().charAt(0)}. ${u.persona.apellidos.trim().split(/\s+/)[0]}`,
      },
    ]),
  );
}

export interface EstudianteVinculado {
  estudianteId: string;
  /** Código para pagar en el banco (AP-02 «¿Cómo pagar?»): el DNI del estudiante, solo para su apoderado. */
  dni: string;
  nombres: string;
  apellidos: string;
  parentesco: string;
}

/**
 * Estudiantes activos vinculados a la persona como apoderado activo (US42). El portal del apoderado autoriza cada
 * consulta contra esta lista: un estudiante fuera de ella no se muestra (403).
 */
export async function estudiantesVinculadosAPersona(personaId: string): Promise<EstudianteVinculado[]> {
  const filas = await estudiantesMatricula.vinculadosAPersona(personaId);
  const vistos = new Set<string>();
  return filas.flatMap((v) => {
    if (vistos.has(v.estudiante.id)) return [];
    vistos.add(v.estudiante.id);
    return [
      {
        estudianteId: v.estudiante.id,
        dni: v.estudiante.persona.dni,
        nombres: v.estudiante.persona.nombres,
        apellidos: v.estudiante.persona.apellidos,
        parentesco: v.parentesco,
      },
    ];
  });
}

export interface ResponsableDePago {
  nombreCompleto: string;
  parentesco: string;
  telefono: string | null;
  email: string | null;
}

/** Apoderado responsable de cada vínculo, con su teléfono, en una sola consulta (US24). */
export async function responsablesDeVinculos(ids: string[]): Promise<Record<string, ResponsableDePago>> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return {};
  const filas = await estudiantesMatricula.apoderadosDeVinculos(unicos);
  return Object.fromEntries(
    filas.map((v) => [
      v.id,
      {
        nombreCompleto: `${v.apoderado.persona.nombres} ${v.apoderado.persona.apellidos}`,
        parentesco: v.parentesco,
        telefono: v.apoderado.persona.telefono,
        email: v.apoderado.persona.email,
      },
    ]),
  );
}
