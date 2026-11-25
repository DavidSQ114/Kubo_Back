// comunidad/application: administración de usuarios (RF46, pantalla AD-06) y registro de administradores y
// coordinadores académicos (bloque M1).
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { ErrorApp } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { asegurarCuenta, enviarBienvenida, type Autenticado, type EstadoUsuario, type Rol } from "@/modules/identidad";
import {
  administradores,
  coordinadores,
  buscarUsuarios,
  contarUsuarios,
  personas,
  rolesActivos,
  type FiltroUsuarios,
} from "../infrastructure/repositorio";

export interface UsuarioListado {
  personaId: string;
  usuarioId: string | null;
  nombreCompleto: string;
  iniciales: string;
  email: string | null;
  dni: string;
  roles: Rol[];
  detalle: string | null;
  estado: EstadoUsuario | "SIN_CUENTA";
  ultimoAccesoEn: Date | null;
}

export async function listarUsuarios(filtro: FiltroUsuarios) {
  const { total, filas } = await buscarUsuarios(filtro);
  const items: UsuarioListado[] = filas.map((p) => ({
    personaId: p.id,
    usuarioId: p.usuario?.id ?? null,
    nombreCompleto: `${p.nombres} ${p.apellidos}`,
    iniciales: `${p.nombres.charAt(0)}${p.apellidos.charAt(0)}`.toUpperCase(),
    email: p.usuario?.email ?? p.email ?? null,
    dni: p.dni,
    roles: rolesActivos(p),
    detalle: p.administrador?.activo
      ? (p.administrador.cargo ?? null)
      : p.coordinador?.activo
        ? (p.coordinador.cargo ?? null)
        : p.docente?.activo
          ? (p.docente.especialidad ?? null)
          : null,
    estado: (p.usuario?.estado as EstadoUsuario | undefined) ?? "SIN_CUENTA",
    ultimoAccesoEn: p.usuario?.ultimoAccesoEn ?? null,
  }));
  return {
    items,
    paginacion: {
      pagina: filtro.pagina,
      tamano: filtro.tamano,
      total,
      paginas: Math.max(1, Math.ceil(total / filtro.tamano)),
    },
  };
}

export const resumenUsuarios = () => contarUsuarios();

export interface DatosPerfilGestion {
  dni: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono?: string | null;
  cargo?: string | null;
}

type PerfilGestion = "ADMINISTRADOR" | "COORDINADOR";

/** Cómo se lee, crea y reactiva cada perfil de gestión, y con qué acción de auditoría se registra. */
const PERFILES_GESTION = {
  ADMINISTRADOR: {
    entidad: "administrador",
    de: personas.administradorDe,
    crear: personas.crearAdministrador,
    reactivar: personas.reactivarAdministrador,
    yaTiene: () => new ErrorApp("YA_ES_ADMINISTRADOR", "Esta persona ya tiene el perfil de Administrador.", 409),
    acciones: { nuevo: "REGISTRAR_ADMINISTRADOR", reactivado: "REACTIVAR_PERFIL_ADMINISTRADOR" },
  },
  COORDINADOR: {
    entidad: "coordinador",
    de: personas.coordinadorDe,
    crear: personas.crearCoordinador,
    reactivar: personas.reactivarCoordinador,
    yaTiene: () => new ErrorApp("YA_ES_COORDINADOR", "Esta persona ya tiene el perfil de Coordinador académico.", 409),
    acciones: { nuevo: "REGISTRAR_COORDINADOR", reactivado: "REACTIVAR_PERFIL_COORDINADOR" },
  },
} as const;

/**
 * Registra un Administrador: reutiliza la persona si el DNI ya existe (RF46), agrega el perfil
 * y crea la cuenta con contraseña temporal si aún no tiene (RF43). Todo en una transacción.
 */
export const registrarAdministrador = (
  admin: Autenticado,
  datos: DatosPerfilGestion,
  urlBase: string,
  meta: MetaSolicitud,
) => registrarPerfilGestion("ADMINISTRADOR", admin, datos, urlBase, meta);

/**
 * Registra un Coordinador académico (bloque M1) igual que un Administrador: persona reutilizada por DNI, perfil
 * nuevo o reactivado, cuenta con contraseña temporal y correo de activación. Auditoría REGISTRAR_COORDINADOR.
 */
export const registrarCoordinador = (
  admin: Autenticado,
  datos: DatosPerfilGestion,
  urlBase: string,
  meta: MetaSolicitud,
) => registrarPerfilGestion("COORDINADOR", admin, datos, urlBase, meta);

async function registrarPerfilGestion(
  tipo: PerfilGestion,
  admin: Autenticado,
  datos: DatosPerfilGestion,
  urlBase: string,
  meta: MetaSolicitud,
) {
  const config = PERFILES_GESTION[tipo];
  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const existente = await personas.porDni(datos.dni, tx);
      const persona =
        existente ??
        (await personas.crear(
          {
            dni: datos.dni,
            nombres: datos.nombres,
            apellidos: datos.apellidos,
            email: datos.email,
            telefono: datos.telefono ?? null,
          },
          tx,
        ));

      const perfil = await config.de(persona.id, tx);
      if (perfil?.activo) throw config.yaTiene();
      if (perfil) await config.reactivar(perfil.id, datos.cargo, tx);
      else await config.crear({ personaId: persona.id, cargo: datos.cargo ?? null }, tx);

      const cuenta = await asegurarCuenta(tx, { personaId: persona.id, email: datos.email });

      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: config.entidad,
          entidadId: persona.id,
          accion: perfil ? config.acciones.reactivado : config.acciones.nuevo,
          nuevo: { personaId: persona.id, cargo: datos.cargo ?? null, cuentaCreada: cuenta.creada },
        },
        meta,
      );
      return { persona, personaExistia: Boolean(existente), cuenta };
    });
  } catch (e) {
    if (esDuplicado(e, "email")) {
      throw new ErrorApp("EMAIL_EN_USO", "Ese correo ya está registrado en otra cuenta.", 409);
    }
    throw e;
  }

  const { persona, personaExistia, cuenta } = resultado;
  let correoEnviado = false;
  if (cuenta.passwordTemporal) {
    correoEnviado = await enviarBienvenida({
      email: cuenta.email,
      nombres: persona.nombres,
      passwordTemporal: cuenta.passwordTemporal,
      urlBase,
    });
  }
  return {
    personaId: persona.id,
    usuarioId: cuenta.usuarioId,
    nombreCompleto: `${persona.nombres} ${persona.apellidos}`,
    email: cuenta.email,
    personaExistia,
    cuentaCreada: cuenta.creada,
    correoEnviado,
    // Se muestra una sola vez al administrador por si el correo no llega. No se guarda en ningún lugar.
    passwordTemporal: cuenta.passwordTemporal,
  };
}

export interface ContactoAdministrador {
  administradorId: string;
  nombres: string;
  email: string;
}

/** Personas de los administradores activos: destinatarios de las notificaciones internas (US55). */
export async function personasDeAdministradores(): Promise<string[]> {
  return (await administradores.personas()).map((a) => a.personaId);
}

/** Administradores activos con correo. */
export async function contactosDeAdministradores(): Promise<ContactoAdministrador[]> {
  const filas = await administradores.contactos();
  return filas.flatMap((a) =>
    a.persona.email ? [{ administradorId: a.id, nombres: a.persona.nombres, email: a.persona.email }] : [],
  );
}

export interface ContactoCoordinador {
  coordinadorId: string;
  nombres: string;
  email: string;
}

/** Personas de los coordinadores activos: reciben las notificaciones internas académicas (US55, bloque M1). */
export async function personasDeCoordinadores(): Promise<string[]> {
  return (await coordinadores.personas()).map((c) => c.personaId);
}

/** Coordinadores activos con correo: a quién avisar de un registro consolidado (US39) o una rectificación (US41). */
export async function contactosDeCoordinadores(): Promise<ContactoCoordinador[]> {
  const filas = await coordinadores.contactos();
  return filas.flatMap((c) =>
    c.persona.email ? [{ coordinadorId: c.id, nombres: c.persona.nombres, email: c.persona.email }] : [],
  );
}
