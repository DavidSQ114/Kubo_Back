// comunidad/infrastructure: consultas de persona y sus perfiles (administrador, docente, apoderado, estudiante) y vínculos.
// Excepción documentada: las LECTURAS del listado de usuarios incluyen la relación persona.usuario
// (tabla de identidad) para filtrar por estado y correo en una sola consulta paginada, y la búsqueda por DNI
// (D-07) lee el correo de la cuenta cuando la persona no tiene uno propio. Los nombres de los responsables de pagos
// (US04) se leen de usuario → persona.
// Las ESCRITURAS sobre usuario solo las hace identidad.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { Rol } from "@/modules/identidad";

type Db = Tx | typeof prisma;

export interface DatosPersonaNueva {
  dni: string;
  nombres: string;
  apellidos: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  fechaNacimiento?: Date | null;
  sexo?: "FEMENINO" | "MASCULINO" | null;
}

/** Relación de Persona que representa cada rol. */
export const RELACION_POR_ROL = {
  ADMINISTRADOR: "administrador",
  DOCENTE: "docente",
  APODERADO: "apoderado",
  ALUMNO: "estudiante",
} as const satisfies Record<Rol, string>;

const selectPerfiles = {
  administrador: { select: { activo: true, cargo: true } },
  docente: { select: { activo: true, especialidad: true } },
  apoderado: { select: { activo: true } },
  estudiante: { select: { activo: true } },
} as const;

/** Busca por cada palabra en nombres, apellidos o el inicio del DNI («rojas 4012»). */
function busquedaPersona(q: string | undefined): Prisma.PersonaWhereInput {
  const terminos = (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    AND: terminos.map((t) => ({
      OR: [
        { nombres: { contains: t, mode: "insensitive" as const } },
        { apellidos: { contains: t, mode: "insensitive" as const } },
        { dni: { startsWith: t } },
      ],
    })),
  };
}

interface PerfilesFila {
  administrador: { activo: boolean; cargo?: string | null } | null;
  docente: { activo: boolean; especialidad?: string | null } | null;
  apoderado: { activo: boolean } | null;
  estudiante: { activo: boolean } | null;
}

export function rolesActivos(p: PerfilesFila): Rol[] {
  const roles: Rol[] = [];
  if (p.administrador?.activo) roles.push("ADMINISTRADOR");
  if (p.docente?.activo) roles.push("DOCENTE");
  if (p.apoderado?.activo) roles.push("APODERADO");
  if (p.estudiante?.activo) roles.push("ALUMNO");
  return roles;
}

export const personas = {
  conPerfiles: (personaId: string, db: Db = prisma) =>
    db.persona.findUnique({
      where: { id: personaId },
      select: { id: true, nombres: true, apellidos: true, activo: true, ...selectPerfiles },
    }),

  porIds: (ids: string[], db: Db = prisma) =>
    db.persona.findMany({ where: { id: { in: ids } }, select: { id: true, nombres: true, apellidos: true } }),

  /** Persona del DNI con sus perfiles y el correo de su cuenta (D-07). */
  detallePorDni: (dni: string, db: Db = prisma) =>
    db.persona.findUnique({
      where: { dni },
      select: {
        id: true,
        dni: true,
        nombres: true,
        apellidos: true,
        email: true,
        usuario: { select: { email: true } },
        ...selectPerfiles,
      },
    }),

  porDni: (dni: string, db: Db = prisma) =>
    db.persona.findUnique({
      where: { dni },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        telefono: true,
        direccion: true,
        fechaNacimiento: true,
        sexo: true,
      },
    }),

  crear: (data: DatosPersonaNueva, db: Db = prisma) =>
    db.persona.create({ data, select: { id: true, nombres: true, apellidos: true, email: true } }),

  /** Solo completa datos que la persona no tenía (US15): quien llama decide qué campos con datosFaltantes. */
  completar: (id: string, data: Partial<Omit<DatosPersonaNueva, "dni" | "nombres" | "apellidos">>, db: Db = prisma) =>
    db.persona.update({ where: { id }, data, select: { id: true } }),

  administradorDe: (personaId: string, db: Db = prisma) =>
    db.administrador.findUnique({ where: { personaId }, select: { id: true, activo: true } }),

  crearAdministrador: (data: { personaId: string; cargo?: string | null }, db: Db = prisma) =>
    db.administrador.create({ data, select: { id: true } }),

  reactivarAdministrador: (id: string, cargo: string | null | undefined, db: Db = prisma) =>
    db.administrador.update({
      where: { id },
      data: { activo: true, ...(cargo ? { cargo } : {}) },
      select: { id: true },
    }),

  docenteDe: (personaId: string, db: Db = prisma) =>
    db.docente.findUnique({ where: { personaId }, select: { id: true, activo: true } }),

  crearDocente: (data: { personaId: string; especialidad: string }, db: Db = prisma) =>
    db.docente.create({ data, select: { id: true } }),

  reactivarDocente: (id: string, especialidad: string, db: Db = prisma) =>
    db.docente.update({ where: { id }, data: { activo: true, especialidad }, select: { id: true } }),
};

// ---------- Listado de usuarios (AD-06) ----------

export interface FiltroUsuarios {
  q?: string;
  rol?: Rol;
  estado?: "ACTIVO" | "PENDIENTE_ACTIVACION" | "SUSPENDIDO" | "SIN_CUENTA";
  pagina: number;
  tamano: number;
}

function condicionBusqueda(q: string | undefined): Prisma.PersonaWhereInput {
  const terminos = (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!terminos.length) return {};
  return {
    AND: terminos.map((t) => ({
      OR: [
        { nombres: { contains: t, mode: "insensitive" as const } },
        { apellidos: { contains: t, mode: "insensitive" as const } },
        { dni: { startsWith: t } },
        { email: { contains: t, mode: "insensitive" as const } },
        { usuario: { is: { email: { contains: t, mode: "insensitive" as const } } } },
      ],
    })),
  };
}

function condicionRol(rol: Rol | undefined): Prisma.PersonaWhereInput {
  if (!rol) {
    return {
      OR: (Object.values(RELACION_POR_ROL) as string[]).map((rel) => ({ [rel]: { is: { activo: true } } })),
    } as Prisma.PersonaWhereInput;
  }
  return { [RELACION_POR_ROL[rol]]: { is: { activo: true } } } as Prisma.PersonaWhereInput;
}

function condicionEstado(estado: FiltroUsuarios["estado"]): Prisma.PersonaWhereInput {
  if (!estado) return {};
  if (estado === "SIN_CUENTA") return { usuario: { is: null } };
  return { usuario: { is: { estado } } };
}

export async function buscarUsuarios(f: FiltroUsuarios) {
  const where: Prisma.PersonaWhereInput = {
    AND: [condicionBusqueda(f.q), condicionRol(f.rol), condicionEstado(f.estado)],
  };
  const [total, filas] = await prisma.$transaction([
    prisma.persona.count({ where }),
    prisma.persona.findMany({
      where,
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      skip: (f.pagina - 1) * f.tamano,
      take: f.tamano,
      select: {
        id: true,
        dni: true,
        nombres: true,
        apellidos: true,
        email: true,
        ...selectPerfiles,
        usuario: { select: { id: true, email: true, estado: true, ultimoAccesoEn: true } },
      },
    }),
  ]);
  return { total, filas };
}

export async function contarUsuarios() {
  const conRol = (rel: string) => ({ [rel]: { is: { activo: true } } }) as Prisma.PersonaWhereInput;
  const [administradores, docentes, apoderados, alumnos, suspendidos, todos] = await prisma.$transaction([
    prisma.persona.count({ where: conRol("administrador") }),
    prisma.persona.count({ where: conRol("docente") }),
    prisma.persona.count({ where: conRol("apoderado") }),
    prisma.persona.count({ where: conRol("estudiante") }),
    prisma.persona.count({ where: { usuario: { is: { estado: "SUSPENDIDO" } } } }),
    prisma.persona.count({ where: condicionRol(undefined) }),
  ]);
  return { todos, administradores, docentes, apoderados, alumnos, suspendidos };
}

// ---------- Docentes (tutores de sección US08, asignación de cursos US14) ----------

const selectDocente = {
  id: true,
  activo: true,
  persona: { select: { nombres: true, apellidos: true, activo: true } },
} as const;

export const docentes = {
  activos: (db: Db = prisma) =>
    db.docente.findMany({
      where: { activo: true, persona: { activo: true } },
      orderBy: [{ persona: { apellidos: "asc" } }, { persona: { nombres: "asc" } }],
      select: selectDocente,
    }),

  porIds: (ids: string[], db: Db = prisma) =>
    db.docente.findMany({ where: { id: { in: ids } }, select: selectDocente }),

  porPersona: (personaId: string, db: Db = prisma) =>
    db.docente.findUnique({ where: { personaId }, select: selectDocente }),
};

// ---------- Apoderados (US15) ----------

export interface Pagina {
  q?: string;
  pagina: number;
  tamano: number;
}

const selectApoderado = {
  id: true,
  ocupacion: true,
  persona: { select: { id: true, dni: true, nombres: true, apellidos: true, telefono: true, email: true } },
  _count: { select: { vinculosApoderado: true } },
} as const;

export const apoderados = {
  dePersona: (personaId: string, db: Db = prisma) =>
    db.apoderado.findUnique({
      where: { personaId },
      select: { id: true, activo: true, _count: { select: { vinculosApoderado: true } } },
    }),

  crear: (data: { personaId: string; ocupacion: string }, db: Db = prisma) =>
    db.apoderado.create({ data, select: { id: true } }),

  reactivar: (id: string, ocupacion: string, db: Db = prisma) =>
    db.apoderado.update({ where: { id }, data: { activo: true, ocupacion }, select: { id: true } }),

  /** Apoderados activos (con persona activa) entre los ids. */
  activosPorIds: (ids: string[], db: Db = prisma) =>
    db.apoderado.findMany({
      where: { id: { in: ids }, activo: true, persona: { activo: true } },
      select: selectApoderado,
    }),

  async buscar(f: Pagina) {
    const where: Prisma.ApoderadoWhereInput = { activo: true, persona: { activo: true, ...busquedaPersona(f.q) } };
    const [total, filas] = await prisma.$transaction([
      prisma.apoderado.count({ where }),
      prisma.apoderado.findMany({
        where,
        orderBy: [{ persona: { apellidos: "asc" } }, { persona: { nombres: "asc" } }],
        skip: (f.pagina - 1) * f.tamano,
        take: f.tamano,
        select: selectApoderado,
      }),
    ]);
    return { total, filas };
  },
};

// ---------- Estudiantes (US17) ----------

const selectEstudiante = {
  id: true,
  gradoIngresoId: true,
  persona: { select: { id: true, dni: true, nombres: true, apellidos: true } },
  vinculosApoderado: {
    orderBy: [{ esPrincipal: "desc" }, { createdAt: "asc" }],
    select: {
      parentesco: true,
      esPrincipal: true,
      apoderado: { select: { id: true, persona: { select: { nombres: true, apellidos: true } } } },
    },
  },
} satisfies Prisma.EstudianteSelect;

export const estudiantes = {
  dePersona: (personaId: string, db: Db = prisma) =>
    db.estudiante.findUnique({ where: { personaId }, select: { id: true, activo: true } }),

  crear: (data: { personaId: string; gradoIngresoId: string; colegioProcedencia?: string | null }, db: Db = prisma) =>
    db.estudiante.create({ data, select: { id: true } }),

  reactivar: (id: string, data: { gradoIngresoId: string; colegioProcedencia?: string | null }, db: Db = prisma) =>
    db.estudiante.update({ where: { id }, data: { activo: true, ...data }, select: { id: true } }),

  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM estudiante WHERE id = ${id}::uuid FOR UPDATE`;
  },

  activoPorId: (id: string, db: Db = prisma) =>
    db.estudiante.findFirst({ where: { id, activo: true, persona: { activo: true } }, select: selectEstudiante }),

  activosPorIds: (ids: string[], db: Db = prisma) =>
    db.estudiante.findMany({
      where: { id: { in: ids }, activo: true, persona: { activo: true } },
      select: { id: true },
    }),

  async buscar(f: Pagina) {
    const where: Prisma.EstudianteWhereInput = { activo: true, persona: { activo: true, ...busquedaPersona(f.q) } };
    const [total, filas] = await prisma.$transaction([
      prisma.estudiante.count({ where }),
      prisma.estudiante.findMany({
        where,
        orderBy: [{ persona: { apellidos: "asc" } }, { persona: { nombres: "asc" } }],
        skip: (f.pagina - 1) * f.tamano,
        take: f.tamano,
        select: selectEstudiante,
      }),
    ]);
    return { total, filas };
  },
};

// ---------- Vínculos estudiante–apoderado (US15, US17) ----------

export const vinculos = {
  deEstudiante: (estudianteId: string, db: Db = prisma) =>
    db.vinculoApoderado.findMany({
      where: { estudianteId },
      select: { id: true, apoderadoId: true, esPrincipal: true },
    }),

  crear: (
    data: { estudianteId: string; apoderadoId: string; parentesco: string; esPrincipal: boolean; autorizado: boolean },
    db: Db = prisma,
  ) => db.vinculoApoderado.create({ data, select: { id: true } }),

  quitarPrincipal: (id: string, db: Db = prisma) =>
    db.vinculoApoderado.update({ where: { id }, data: { esPrincipal: false }, select: { id: true } }),
};

// ---------- Lecturas para la matrícula (US18): las pide el módulo matricula por el index.ts ----------

const selectEstudianteMatricula = {
  id: true,
  activo: true,
  gradoIngresoId: true,
  persona: { select: { dni: true, nombres: true, apellidos: true, activo: true } },
  vinculosApoderado: {
    orderBy: [{ esPrincipal: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      parentesco: true,
      esPrincipal: true,
      autorizado: true,
      apoderado: {
        select: { id: true, persona: { select: { nombres: true, apellidos: true, telefono: true, email: true } } },
      },
    },
  },
} satisfies Prisma.EstudianteSelect;

export const estudiantesMatricula = {
  porId: (id: string, db: Db = prisma) =>
    db.estudiante.findUnique({ where: { id }, select: selectEstudianteMatricula }),

  porIds: (ids: string[], db: Db = prisma) =>
    db.estudiante.findMany({
      where: { id: { in: ids } },
      select: { id: true, gradoIngresoId: true, persona: { select: { dni: true, nombres: true, apellidos: true } } },
    }),

  /** Apoderado de varios vínculos, con su teléfono (responsables del pago en el panel de morosidad, US24). */
  apoderadosDeVinculos: (ids: string[], db: Db = prisma) =>
    db.vinculoApoderado.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        parentesco: true,
        apoderado: { select: { persona: { select: { nombres: true, apellidos: true, telefono: true, email: true } } } },
      },
    }),

  /** Nombres de las personas de varios usuarios (responsables de pagos y anulaciones, US04). */
  nombresDeUsuarios: (ids: string[], db: Db = prisma) =>
    db.usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true, persona: { select: { nombres: true, apellidos: true } } },
    }),

  /** Datos completos del estudiante y de sus apoderados para la ficha de matrícula (US20). */
  paraFicha: (id: string, db: Db = prisma) =>
    db.estudiante.findUnique({
      where: { id },
      select: {
        id: true,
        colegioProcedencia: true,
        gradoIngreso: { select: { nombre: true } },
        persona: {
          select: { dni: true, nombres: true, apellidos: true, fechaNacimiento: true, sexo: true, direccion: true },
        },
        vinculosApoderado: {
          orderBy: [{ esPrincipal: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            parentesco: true,
            esPrincipal: true,
            autorizado: true,
            apoderado: {
              select: {
                persona: { select: { dni: true, nombres: true, apellidos: true, telefono: true, email: true } },
              },
            },
          },
        },
      },
    }),

  /** Ids de los estudiantes cuyo nombre, apellido o inicio de DNI coincide con la búsqueda. */
  async idsPorBusqueda(q: string, db: Db = prisma) {
    const filas = await db.estudiante.findMany({ where: { persona: busquedaPersona(q) }, select: { id: true } });
    return filas.map((f) => f.id);
  },
};
