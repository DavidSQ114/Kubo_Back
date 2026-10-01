// identidad/infrastructure: único lugar que consulta usuario, sesion y token_recuperacion.
import { prisma } from "@/platform/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/platform/db/tipos";
import type { EstadoUsuario, Rol } from "../domain/reglas";

type Db = Tx | typeof prisma;

const camposUsuario = {
  id: true,
  personaId: true,
  email: true,
  passwordHash: true,
  estado: true,
  intentosFallidos: true,
  bloqueadoHasta: true,
  debeCambiarPassword: true,
  versionSesion: true,
  ultimoAccesoEn: true,
} as const;

export interface UsuarioFila {
  id: string;
  personaId: string;
  email: string;
  passwordHash: string;
  estado: EstadoUsuario;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
  debeCambiarPassword: boolean;
  versionSesion: number;
  ultimoAccesoEn: Date | null;
}

export const usuarios = {
  porEmail: (email: string, db: Db = prisma) =>
    db.usuario.findUnique({ where: { email }, select: camposUsuario }) as Promise<UsuarioFila | null>,

  porId: (id: string, db: Db = prisma) =>
    db.usuario.findUnique({ where: { id }, select: camposUsuario }) as Promise<UsuarioFila | null>,

  porPersona: (personaId: string, db: Db = prisma) =>
    db.usuario.findUnique({ where: { personaId }, select: camposUsuario }) as Promise<UsuarioFila | null>,

  /** Bloquea la fila del usuario hasta el fin de la transacción (evita carreras en intentos fallidos). */
  async bloquearFila(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${id}::uuid FOR UPDATE`;
  },

  actualizar: (id: string, data: Prisma.UsuarioUncheckedUpdateInput, db: Db = prisma) =>
    db.usuario.update({ where: { id }, data, select: camposUsuario }) as Promise<UsuarioFila>,

  crear: (
    data: { personaId: string; email: string; passwordHash: string; estado: EstadoUsuario; debeCambiarPassword: boolean },
    db: Db = prisma,
  ) => db.usuario.create({ data, select: camposUsuario }) as Promise<UsuarioFila>,
};

export interface SesionConUsuario {
  id: string;
  usuarioId: string;
  rolActivo: Rol;
  versionSesion: number;
  expiraEn: Date;
  revocadaEn: Date | null;
  createdAt: Date;
  usuario: { id: string; personaId: string; email: string; estado: EstadoUsuario; versionSesion: number; debeCambiarPassword: boolean };
}

const selectSesion = {
  id: true,
  usuarioId: true,
  rolActivo: true,
  versionSesion: true,
  expiraEn: true,
  revocadaEn: true,
  createdAt: true,
  usuario: { select: { id: true, personaId: true, email: true, estado: true, versionSesion: true, debeCambiarPassword: true } },
} as const;

export const sesiones = {
  crear: (
    data: { usuarioId: string; refreshTokenHash: string; versionSesion: number; rolActivo: Rol; ipOrigen: string | null; userAgent: string | null; expiraEn: Date },
    db: Db = prisma,
  ) => db.sesion.create({ data, select: { id: true, expiraEn: true } }),

  porId: (id: string, db: Db = prisma) =>
    db.sesion.findUnique({ where: { id }, select: selectSesion }) as Promise<SesionConUsuario | null>,

  porRefreshHash: (refreshTokenHash: string, db: Db = prisma) =>
    db.sesion.findUnique({ where: { refreshTokenHash }, select: selectSesion }) as Promise<SesionConUsuario | null>,

  actualizar: (id: string, data: Prisma.SesionUncheckedUpdateInput, db: Db = prisma) =>
    db.sesion.update({ where: { id }, data, select: { id: true } }),

  revocar: (id: string, db: Db = prisma) =>
    db.sesion.updateMany({ where: { id, revocadaEn: null }, data: { revocadaEn: new Date() } }),

  /** Revoca todas las sesiones activas del usuario, salvo la indicada. */
  revocarTodas: (usuarioId: string, excepto: string | null, db: Db = prisma) =>
    db.sesion.updateMany({
      where: { usuarioId, revocadaEn: null, ...(excepto ? { NOT: { id: excepto } } : {}) },
      data: { revocadaEn: new Date() },
    }),
};

export const tokensRecuperacion = {
  crear: (data: { usuarioId: string; tokenHash: string; expiraEn: Date }, db: Db = prisma) =>
    db.tokenRecuperacion.create({ data, select: { id: true } }),

  revocarPendientes: (usuarioId: string, db: Db = prisma) =>
    db.tokenRecuperacion.updateMany({ where: { usuarioId, usadoEn: null, revocadoEn: null }, data: { revocadoEn: new Date() } }),

  vigente: (tokenHash: string, ahora: Date, db: Db = prisma) =>
    db.tokenRecuperacion.findFirst({
      where: { tokenHash, usadoEn: null, revocadoEn: null, expiraEn: { gt: ahora } },
      select: { id: true, usuarioId: true, expiraEn: true, usuario: { select: { email: true, estado: true } } },
    }),

  marcarUsado: (id: string, db: Db = prisma) =>
    db.tokenRecuperacion.updateMany({ where: { id, usadoEn: null }, data: { usadoEn: new Date() } }),
};
