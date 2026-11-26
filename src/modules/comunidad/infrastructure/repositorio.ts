// comunidad/infrastructure: consultas de persona y sus perfiles (administrador, coordinador, docente, apoderado, estudiante) y vínculos.
// Excepción documentada: las LECTURAS del listado de usuarios incluyen la relación persona.usuario
// (tabla de identidad) para filtrar por estado y correo en una sola consulta paginada, y la búsqueda por DNI
// (D-07) lee el correo de la cuenta cuando la persona no tiene uno propio. Los nombres de los responsables de pagos
// (US04) se leen de usuario → persona.
// Las ESCRITURAS sobre usuario solo las hace identidad (también al editar o eliminar a una persona, US69).
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
  COORDINADOR: "coordinador",
  DOCENTE: "docente",
  APODERADO: "apoderado",
  ALUMNO: "estudiante",
} as const satisfies Record<Rol, string>;

const selectPerfiles = {
  administrador: { select: { activo: true, cargo: true } },
  coordinador: { select: { activo: true, cargo: true } },
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
  coordinador: { activo: boolean; cargo?: string | null } | null;
  docente: { activo: boolean; especialidad?: string | null } | null;
  apoderado: { activo: boolean } | null;
  estudiante: { activo: boolean } | null;
}

export function rolesActivos(p: PerfilesFila): Rol[] {
  const roles: Rol[] = [];
  if (p.administrador?.activo) roles.push("ADMINISTRADOR");
  if (p.coordinador?.activo) roles.push("COORDINADOR");
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
        // bloque M5: los formularios de registro muestran los datos ya registrados en los campos que no se editan
        fechaNacimiento: true,
        sexo: true,
        telefono: true,
        direccion: true,
        usuario: { select: { email: true } },
        ...selectPerfiles,
        apoderado: { select: { activo: true, ocupacion: true } },
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

  coordinadorDe: (personaId: string, db: Db = prisma) =>
    db.coordinador.findUnique({ where: { personaId }, select: { id: true, activo: true } }),

  crearCoordinador: (data: { personaId: string; cargo?: string | null }, db: Db = prisma) =>
    db.coordinador.create({ data, select: { id: true } }),

  reactivarCoordinador: (id: string, cargo: string | null | undefined, db: Db = prisma) =>
    db.coordinador.update({
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
  // lectura sin transacción (bloque M5): en frío, una transacción de solo lectura pasó el límite de 5 s
  const [total, filas] = await Promise.all([
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
        usuario: { select: { id: true, email: true, estado: true, ultimoAccesoEn: true, bloqueadoHasta: true } },
      },
    }),
  ]);
  return { total, filas };
}

export async function contarUsuarios() {
  const conRol = (rel: string) => ({ [rel]: { is: { activo: true } } }) as Prisma.PersonaWhereInput;
  const [administradores, coordinadores, docentes, apoderados, alumnos, suspendidos, todos] = await prisma.$transaction(
    [
      prisma.persona.count({ where: conRol("administrador") }),
      prisma.persona.count({ where: conRol("coordinador") }),
      prisma.persona.count({ where: conRol("docente") }),
      prisma.persona.count({ where: conRol("apoderado") }),
      prisma.persona.count({ where: conRol("estudiante") }),
      prisma.persona.count({ where: { usuario: { is: { estado: "SUSPENDIDO" } } } }),
      prisma.persona.count({ where: condicionRol(undefined) }),
    ],
  );
  return { todos, administradores, coordinadores, docentes, apoderados, alumnos, suspendidos };
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

  /**
   * Personal docente para la asistencia diaria (US32): los activos y, además, los indicados aunque ya no lo estén
   * (tienen registros en la fecha consultada). Con su especialidad, por apellido.
   */
  personal: (incluir: string[], db: Db = prisma) =>
    db.docente.findMany({
      where: { OR: [{ activo: true, persona: { activo: true } }, { id: { in: incluir } }] },
      orderBy: [{ persona: { apellidos: "asc" } }, { persona: { nombres: "asc" } }],
      select: { ...selectDocente, especialidad: true },
    }),

  porPersona: (personaId: string, db: Db = prisma) =>
    db.docente.findUnique({ where: { personaId }, select: selectDocente }),

  /** Nombre y correo de docentes activos (avisos por correo, por ejemplo al publicar un horario, US31). */
  contactos: (ids: string[], db: Db = prisma) =>
    db.docente.findMany({
      where: { id: { in: ids }, activo: true, persona: { activo: true } },
      select: { id: true, persona: { select: { nombres: true, apellidos: true, email: true } } },
    }),

  /** Persona de cada docente activo (destinatarios de las notificaciones internas, US55). */
  personas: (ids: string[], db: Db = prisma) =>
    db.docente.findMany({
      where: { id: { in: ids }, activo: true, persona: { activo: true } },
      select: { id: true, personaId: true },
    }),
};

export const administradores = {
  /** Nombre y correo de los administradores activos (aviso de un registro de notas consolidado, US39). */
  contactos: (db: Db = prisma) =>
    db.administrador.findMany({
      where: { activo: true, persona: { activo: true } },
      select: { id: true, persona: { select: { nombres: true, email: true } } },
    }),

  /** Persona de cada administrador activo (destinatarios de las notificaciones internas, US55). */
  personas: (db: Db = prisma) =>
    db.administrador.findMany({
      where: { activo: true, persona: { activo: true } },
      select: { personaId: true },
    }),
};

export const coordinadores = {
  /** Nombre y correo de los coordinadores activos: reciben los avisos académicos (cierre de notas, rectificaciones). */
  contactos: (db: Db = prisma) =>
    db.coordinador.findMany({
      where: { activo: true, persona: { activo: true } },
      select: { id: true, persona: { select: { nombres: true, email: true } } },
    }),

  /** Persona de cada coordinador activo (destinatarios de las notificaciones internas académicas, US55). */
  personas: (db: Db = prisma) =>
    db.coordinador.findMany({
      where: { activo: true, persona: { activo: true } },
      select: { personaId: true },
    }),
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
    // lectura sin transacción (bloque M5): en frío, una transacción de solo lectura pasó el límite de 5 s
    const [total, filas] = await Promise.all([
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

  /** El estudiante con su persona, activo o no (acceso al portal del alumno, US49). */
  conPersona: (id: string, db: Db = prisma) =>
    db.estudiante.findUnique({
      where: { id },
      select: {
        id: true,
        activo: true,
        persona: { select: { id: true, nombres: true, apellidos: true, email: true, activo: true } },
      },
    }),

  /** Perfil de estudiante activo de la persona en sesión (portal del alumno, US49). */
  activoDePersona: (personaId: string, db: Db = prisma) =>
    db.estudiante.findFirst({
      where: { personaId, activo: true, persona: { activo: true } },
      select: { id: true, persona: { select: { nombres: true, apellidos: true } } },
    }),

  activosPorIds: (ids: string[], db: Db = prisma) =>
    db.estudiante.findMany({
      where: { id: { in: ids }, activo: true, persona: { activo: true } },
      select: { id: true },
    }),

  async buscar(f: Pagina) {
    const where: Prisma.EstudianteWhereInput = { activo: true, persona: { activo: true, ...busquedaPersona(f.q) } };
    // lectura sin transacción (bloque M5): en frío, una transacción de solo lectura pasó el límite de 5 s
    const [total, filas] = await Promise.all([
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

const selectPersonaVinculo = {
  id: true,
  activo: true,
  persona: { select: { id: true, nombres: true, apellidos: true, activo: true } },
} as const;

export const vinculos = {
  /**
   * Vínculos de una persona (D-12): como estudiante, sus apoderados; como apoderado, sus hijos. Activos o no, para
   * que el detalle muestre también los de un perfil ya desactivado.
   */
  dePersona: (personaId: string, db: Db = prisma) =>
    db.vinculoApoderado.findMany({
      where: { OR: [{ estudiante: { personaId } }, { apoderado: { personaId } }] },
      orderBy: [{ esPrincipal: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        parentesco: true,
        esPrincipal: true,
        autorizado: true,
        estudiante: { select: selectPersonaVinculo },
        apoderado: { select: selectPersonaVinculo },
      },
    }),

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

  /** Correo de cada estudiante y de su apoderado principal activo (avisos por inasistencias, US52). */
  contactosDeAsistencia: (ids: string[], db: Db = prisma) =>
    db.estudiante.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        persona: { select: { nombres: true, apellidos: true, email: true } },
        vinculosApoderado: {
          where: { esPrincipal: true, apoderado: { activo: true, persona: { activo: true } } },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { apoderado: { select: { personaId: true, persona: { select: { nombres: true, email: true } } } } },
        },
      },
    }),

  /** Apoderados activos vinculados a varios estudiantes, con su correo (aviso de notas publicadas, US39). */
  apoderadosVinculados: (ids: string[], db: Db = prisma) =>
    db.estudiante.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        personaId: true,
        persona: { select: { nombres: true, apellidos: true } },
        vinculosApoderado: {
          where: { apoderado: { activo: true, persona: { activo: true } } },
          orderBy: { createdAt: "asc" },
          select: { apoderado: { select: { personaId: true, persona: { select: { nombres: true, email: true } } } } },
        },
      },
    }),

  /** Apoderado de varios vínculos, con su teléfono (responsables del pago en el panel de morosidad, US24). */
  apoderadosDeVinculos: (ids: string[], db: Db = prisma) =>
    db.vinculoApoderado.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        parentesco: true,
        apoderado: {
          select: {
            personaId: true,
            persona: { select: { nombres: true, apellidos: true, telefono: true, email: true } },
          },
        },
      },
    }),

  /** Nombres de las personas de varios usuarios (responsables de pagos y anulaciones, US04). */
  nombresDeUsuarios: (ids: string[], db: Db = prisma) =>
    db.usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true, persona: { select: { nombres: true, apellidos: true } } },
    }),

  /**
   * Estudiantes activos vinculados a la persona como apoderado activo (portal del apoderado, US42). Es la base de la
   * autorización: el apoderado solo ve a estos estudiantes.
   */
  vinculadosAPersona: (personaId: string, db: Db = prisma) =>
    db.vinculoApoderado.findMany({
      where: {
        apoderado: { personaId, activo: true, persona: { activo: true } },
        estudiante: { activo: true, persona: { activo: true } },
      },
      orderBy: { createdAt: "asc" },
      select: {
        parentesco: true,
        estudiante: {
          select: { id: true, persona: { select: { dni: true, nombres: true, apellidos: true } } },
        },
      },
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
                personaId: true,
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

// ---------- Edición y baja de personas (US69) ----------

const selectPersonaEdicion = {
  id: true,
  dni: true,
  nombres: true,
  apellidos: true,
  email: true,
  telefono: true,
  direccion: true,
  fechaNacimiento: true,
  sexo: true,
  administrador: { select: { activo: true, cargo: true } },
  coordinador: { select: { activo: true, cargo: true } },
  docente: { select: { id: true, activo: true, especialidad: true } },
  apoderado: { select: { activo: true, ocupacion: true, _count: { select: { vinculosApoderado: true } } } },
  estudiante: {
    select: { id: true, activo: true, colegioProcedencia: true, _count: { select: { vinculosApoderado: true } } },
  },
} satisfies Prisma.PersonaSelect;

export type PersonaEdicion = Prisma.PersonaGetPayload<{ select: typeof selectPersonaEdicion }>;

export interface DatosPersonaEditada {
  dni?: string;
  nombres?: string;
  apellidos?: string;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  fechaNacimiento?: Date | null;
  sexo?: "FEMENINO" | "MASCULINO" | null;
}

export const edicionPersonas = {
  /** Bloquea la fila de la persona: dos ediciones simultáneas no registran un «valor anterior» equivocado. */
  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM persona WHERE id = ${id}::uuid FOR UPDATE`;
  },

  porId: (id: string, db: Db = prisma) => db.persona.findUnique({ where: { id }, select: selectPersonaEdicion }),

  idPorDni: (dni: string, db: Db = prisma) => db.persona.findUnique({ where: { dni }, select: { id: true } }),

  /** Otra persona que ya tiene ese correo (persona.email no es único: se comprueba al editar). */
  otraConEmail: (email: string, exceptoId: string, db: Db = prisma) =>
    db.persona.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, NOT: { id: exceptoId } },
      select: { id: true },
    }),

  actualizar: (id: string, data: DatosPersonaEditada, db: Db = prisma) =>
    db.persona.update({ where: { id }, data, select: { id: true } }),

  actualizarApoderado: (personaId: string, ocupacion: string, db: Db = prisma) =>
    db.apoderado.update({ where: { personaId }, data: { ocupacion }, select: { id: true } }),

  actualizarDocente: (personaId: string, especialidad: string, db: Db = prisma) =>
    db.docente.update({ where: { personaId }, data: { especialidad }, select: { id: true } }),

  actualizarEstudiante: (personaId: string, colegioProcedencia: string | null, db: Db = prisma) =>
    db.estudiante.update({ where: { personaId }, data: { colegioProcedencia }, select: { id: true } }),

  async desactivarPerfil(personaId: string, rol: Rol, db: Db = prisma) {
    const cambio = { where: { personaId }, data: { activo: false }, select: { id: true } } as const;
    if (rol === "ADMINISTRADOR") await db.administrador.update(cambio);
    else if (rol === "COORDINADOR") await db.coordinador.update(cambio);
    else if (rol === "DOCENTE") await db.docente.update(cambio);
    else if (rol === "APODERADO") await db.apoderado.update(cambio);
    else await db.estudiante.update(cambio);
  },

  /** Borra la persona y sus perfiles. Quien llama ya comprobó que no tiene registros en otros módulos. */
  async eliminar(id: string, db: Db = prisma) {
    await db.administrador.deleteMany({ where: { personaId: id } });
    await db.coordinador.deleteMany({ where: { personaId: id } });
    await db.docente.deleteMany({ where: { personaId: id } });
    await db.apoderado.deleteMany({ where: { personaId: id } });
    await db.estudiante.deleteMany({ where: { personaId: id } });
    await db.persona.delete({ where: { id }, select: { id: true } });
  },
};
