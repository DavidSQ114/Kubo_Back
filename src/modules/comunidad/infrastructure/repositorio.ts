// comunidad/infrastructure: consultas de persona y sus perfiles.
// Excepción documentada: las LECTURAS del listado de usuarios incluyen la relación persona.usuario
// (tabla de identidad) para filtrar por estado y correo en una sola consulta paginada.
// Las ESCRITURAS sobre usuario solo las hace identidad.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/tipos";
import type { Rol } from "@/modules/identidad";

type Db = Tx | typeof prisma;

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

  porDni: (dni: string, db: Db = prisma) =>
    db.persona.findUnique({ where: { dni }, select: { id: true, nombres: true, apellidos: true, email: true } }),

  crear: (data: { dni: string; nombres: string; apellidos: string; email: string; telefono?: string | null }, db: Db = prisma) =>
    db.persona.create({ data, select: { id: true, nombres: true, apellidos: true, email: true } }),

  administradorDe: (personaId: string, db: Db = prisma) =>
    db.administrador.findUnique({ where: { personaId }, select: { id: true, activo: true } }),

  crearAdministrador: (data: { personaId: string; cargo?: string | null }, db: Db = prisma) =>
    db.administrador.create({ data, select: { id: true } }),

  reactivarAdministrador: (id: string, cargo: string | null | undefined, db: Db = prisma) =>
    db.administrador.update({ where: { id }, data: { activo: true, ...(cargo ? { cargo } : {}) }, select: { id: true } }),
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
