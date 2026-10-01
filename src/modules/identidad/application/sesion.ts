// identidad/application: inicio de sesión, perfiles, renovación, cierre y control de acceso (RF01, RF04, RNF01, RNF02).
import { prisma } from "@/platform/db/prisma";
import { parametroNumero } from "@/platform/config/parametros";
import { firmarAcceso, firmarSeleccion, verificarAcceso, verificarSeleccion } from "@/platform/auth/jwt";
import { generarTokenOpaco, hashToken, verificarPassword } from "@/platform/auth/tokens";
import { errores } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { erroresIdentidad as E } from "../domain/errores";
import {
  HORAS_SESION_SIN_RECORDAR,
  expiracionSesion,
  minutosRestantes,
  normalizarEmail,
  puedeIniciarSesion,
  registrarIntentoFallido,
  type Rol,
} from "../domain/reglas";
import { sesiones, usuarios, type UsuarioFila } from "../infrastructure/repositorio";
import { perfilesProvider } from "../puertos";

// ---------- Tipos de salida ----------

export interface TokensSesion {
  acceso: string;
  refresh: string;
  refreshExpiraEn: Date;
  recordar: boolean;
}

export interface ResumenSesion {
  usuario: { id: string; email: string; nombres: string; apellidos: string; nombreCompleto: string; iniciales: string };
  rolActivo: Rol;
  perfiles: Rol[];
  debeCambiarPassword: boolean;
}

export type ResultadoLogin =
  | { tipo: "SESION"; tokens: TokensSesion; sesion: ResumenSesion }
  | { tipo: "SELECCION"; tokenSeleccion: string; perfiles: Rol[]; nombres: string };

/** Usuario autenticado en una solicitud. */
export interface Autenticado {
  usuarioId: string;
  sesionId: string;
  personaId: string;
  email: string;
  rol: Rol;
  debeCambiarPassword: boolean;
}

// ---------- Inicio de sesión ----------

export async function iniciarSesion(
  datos: { email: string; password: string; recordar: boolean },
  meta: MetaSolicitud,
): Promise<ResultadoLogin> {
  const ahora = new Date();
  const u = await usuarios.porEmail(normalizarEmail(datos.email));

  if (!u || u.estado === "DADO_DE_BAJA") {
    await verificarPassword(datos.password, null); // mismo tiempo de respuesta exista o no la cuenta
    throw E.credencialesInvalidas();
  }
  if (u.bloqueadoHasta && u.bloqueadoHasta > ahora) {
    throw E.cuentaBloqueada(minutosRestantes(u.bloqueadoHasta, ahora), u.bloqueadoHasta);
  }

  if (!(await verificarPassword(datos.password, u.passwordHash))) {
    const [maxIntentos, minutosBloqueo] = await Promise.all([
      parametroNumero("MAX_INTENTOS_LOGIN"),
      parametroNumero("MINUTOS_BLOQUEO"),
    ]);
    const resultado = await prisma.$transaction(async (tx) => {
      await usuarios.bloquearFila(tx, u.id);
      const actual = await usuarios.porId(u.id, tx);
      const r = registrarIntentoFallido(actual?.intentosFallidos ?? 0, maxIntentos, minutosBloqueo, ahora);
      await usuarios.actualizar(u.id, { intentosFallidos: r.intentosFallidos, bloqueadoHasta: r.bloqueadoHasta }, tx);
      return r;
    });
    if (resultado.bloqueadoHasta) {
      throw E.cuentaBloqueada(minutosRestantes(resultado.bloqueadoHasta, ahora), resultado.bloqueadoHasta);
    }
    throw E.credencialesInvalidas();
  }

  if (u.estado === "SUSPENDIDO") throw E.cuentaSuspendida();
  if (!puedeIniciarSesion(u.estado)) throw E.credencialesInvalidas();

  const perfiles = await perfilesProvider().perfilesActivos(u.personaId);
  if (perfiles.length === 0) throw E.sinPerfil();

  if (u.intentosFallidos > 0 || u.bloqueadoHasta) {
    await usuarios.actualizar(u.id, { intentosFallidos: 0, bloqueadoHasta: null });
  }

  if (perfiles.length === 1) {
    const tokens = await crearSesion(u, perfiles[0], datos.recordar, meta);
    return { tipo: "SESION", tokens, sesion: await resumen(u, perfiles[0], perfiles) };
  }

  const persona = await perfilesProvider().datosPersona(u.personaId);
  const tokenSeleccion = await firmarSeleccion({ sub: u.id, ver: u.versionSesion, rec: datos.recordar });
  return { tipo: "SELECCION", tokenSeleccion, perfiles, nombres: persona?.nombres ?? "" };
}

/** Segundo paso del login para quien tiene más de un perfil (AC-08). */
export async function seleccionarPerfil(
  datos: { tokenSeleccion: string; rol: Rol },
  meta: MetaSolicitud,
): Promise<{ tokens: TokensSesion; sesion: ResumenSesion }> {
  const claims = await verificarSeleccion(datos.tokenSeleccion);
  if (!claims) throw E.seleccionExpirada();

  const u = await usuarios.porId(claims.sub);
  if (!u || !puedeIniciarSesion(u.estado) || u.versionSesion !== claims.ver) throw E.seleccionExpirada();

  const perfiles = await perfilesProvider().perfilesActivos(u.personaId);
  if (!perfiles.includes(datos.rol)) throw E.perfilNoDisponible();

  const tokens = await crearSesion(u, datos.rol, claims.rec, meta);
  return { tokens, sesion: await resumen(u, datos.rol, perfiles) };
}

/** Cambiar de perfil sin cerrar sesión (RF01). */
export async function cambiarPerfil(auth: Autenticado, rol: Rol): Promise<{ acceso: string; sesion: ResumenSesion }> {
  const perfiles = await perfilesProvider().perfilesActivos(auth.personaId);
  if (!perfiles.includes(rol)) throw E.perfilNoDisponible();
  await sesiones.actualizar(auth.sesionId, { rolActivo: rol });
  const u = await usuarios.porId(auth.usuarioId);
  if (!u) throw E.sesionInvalida();
  const acceso = await firmarAcceso({ sub: auth.usuarioId, sid: auth.sesionId, rol });
  return { acceso, sesion: await resumen(u, rol, perfiles) };
}

// ---------- Renovación y cierre ----------

/** Rota el refresh token y entrega un token de acceso nuevo. */
export async function renovarSesion(refresh: string | null): Promise<TokensSesion> {
  if (!refresh) throw E.sesionInvalida();
  const s = await sesiones.porRefreshHash(hashToken(refresh));
  const ahora = new Date();
  if (
    !s ||
    s.revocadaEn ||
    s.expiraEn <= ahora ||
    !puedeIniciarSesion(s.usuario.estado) ||
    s.versionSesion !== s.usuario.versionSesion
  ) {
    if (s && !s.revocadaEn) await sesiones.revocar(s.id);
    throw E.sesionInvalida();
  }
  const perfiles = await perfilesProvider().perfilesActivos(s.usuario.personaId);
  if (!perfiles.includes(s.rolActivo)) {
    await sesiones.revocar(s.id);
    throw E.sesionInvalida();
  }

  const nuevoRefresh = generarTokenOpaco();
  await sesiones.actualizar(s.id, { refreshTokenHash: hashToken(nuevoRefresh) });
  const recordar = s.expiraEn.getTime() - s.createdAt.getTime() > HORAS_SESION_SIN_RECORDAR * 3_600_000 + 60_000;
  return {
    acceso: await firmarAcceso({ sub: s.usuarioId, sid: s.id, rol: s.rolActivo }),
    refresh: nuevoRefresh,
    refreshExpiraEn: s.expiraEn,
    recordar,
  };
}

export async function cerrarSesion(datos: { tokenAcceso: string | null; refresh: string | null }) {
  const claims = datos.tokenAcceso ? await verificarAcceso(datos.tokenAcceso) : null;
  if (claims) {
    await sesiones.revocar(claims.sid);
    return;
  }
  if (datos.refresh) {
    const s = await sesiones.porRefreshHash(hashToken(datos.refresh));
    if (s) await sesiones.revocar(s.id);
  }
}

// ---------- Control de acceso (cada solicitud) ----------

/**
 * Valida el token de acceso contra la base: sesión vigente, usuario activo y misma versión de sesión.
 * Así una suspensión o un cambio de contraseña invalida las sesiones de inmediato (RF05, RF43, RNF02).
 */
export async function autenticar(
  tokenAcceso: string | null,
  opciones: { roles?: readonly Rol[]; permitirCambioPendiente?: boolean } = {},
): Promise<Autenticado> {
  if (!tokenAcceso) throw errores.noAutenticado();
  const claims = await verificarAcceso(tokenAcceso);
  if (!claims) throw errores.noAutenticado();

  const s = await sesiones.porId(claims.sid);
  if (
    !s ||
    s.usuarioId !== claims.sub ||
    s.revocadaEn ||
    s.expiraEn <= new Date() ||
    !puedeIniciarSesion(s.usuario.estado) ||
    s.versionSesion !== s.usuario.versionSesion
  ) {
    throw E.sesionInvalida();
  }

  const auth: Autenticado = {
    usuarioId: s.usuarioId,
    sesionId: s.id,
    personaId: s.usuario.personaId,
    email: s.usuario.email,
    rol: s.rolActivo,
    debeCambiarPassword: s.usuario.debeCambiarPassword,
  };
  if (auth.debeCambiarPassword && !opciones.permitirCambioPendiente) throw E.cambioPasswordRequerido();
  if (opciones.roles && !opciones.roles.includes(auth.rol)) throw errores.accesoDenegado();
  return auth;
}

export async function obtenerSesion(auth: Autenticado): Promise<ResumenSesion> {
  const u = await usuarios.porId(auth.usuarioId);
  if (!u) throw E.sesionInvalida();
  const perfiles = await perfilesProvider().perfilesActivos(auth.personaId);
  return resumen(u, auth.rol, perfiles);
}

// ---------- Internos ----------

async function crearSesion(u: UsuarioFila, rol: Rol, recordar: boolean, meta: MetaSolicitud): Promise<TokensSesion> {
  const ahora = new Date();
  const refresh = generarTokenOpaco();
  const expiraEn = expiracionSesion(recordar, ahora);
  const sesion = await sesiones.crear({
    usuarioId: u.id,
    refreshTokenHash: hashToken(refresh),
    versionSesion: u.versionSesion,
    rolActivo: rol,
    ipOrigen: meta.ip,
    userAgent: meta.userAgent?.slice(0, 500) ?? null,
    expiraEn,
  });
  await usuarios.actualizar(u.id, { ultimoAccesoEn: ahora });
  const acceso = await firmarAcceso({ sub: u.id, sid: sesion.id, rol });
  return { acceso, refresh, refreshExpiraEn: expiraEn, recordar };
}

async function resumen(u: UsuarioFila, rol: Rol, perfiles: Rol[]): Promise<ResumenSesion> {
  const p = await perfilesProvider().datosPersona(u.personaId);
  const nombres = p?.nombres ?? "";
  const apellidos = p?.apellidos ?? "";
  const iniciales = `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
  return {
    usuario: {
      id: u.id,
      email: u.email,
      nombres,
      apellidos,
      nombreCompleto: `${nombres} ${apellidos}`.trim(),
      iniciales,
    },
    rolActivo: rol,
    perfiles,
    debeCambiarPassword: u.debeCambiarPassword,
  };
}
