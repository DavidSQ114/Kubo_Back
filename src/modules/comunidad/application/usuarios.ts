// comunidad/application: administración de usuarios (RF46, pantalla AD-06) y registro de administradores.
import { prisma } from "@/platform/db/prisma";
import { esDuplicado } from "@/platform/db/tipos";
import { registrarAuditoria } from "@/platform/auditoria";
import { ErrorApp } from "@/platform/http/errores";
import type { MetaSolicitud } from "@/platform/http/ruta";
import { asegurarCuenta, enviarBienvenida, type Autenticado, type EstadoUsuario, type Rol } from "@/modules/identidad";
import {
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

/**
 * Registra un Administrador: reutiliza la persona si el DNI ya existe (RF46), agrega el perfil
 * y crea la cuenta con contraseña temporal si aún no tiene (RF43). Todo en una transacción.
 */
export async function registrarAdministrador(
  admin: Autenticado,
  datos: {
    dni: string;
    nombres: string;
    apellidos: string;
    email: string;
    telefono?: string | null;
    cargo?: string | null;
  },
  urlBase: string,
  meta: MetaSolicitud,
) {
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

      const perfil = await personas.administradorDe(persona.id, tx);
      if (perfil?.activo) {
        throw new ErrorApp("YA_ES_ADMINISTRADOR", "Esta persona ya tiene el perfil de Administrador.", 409);
      }
      if (perfil) await personas.reactivarAdministrador(perfil.id, datos.cargo, tx);
      else await personas.crearAdministrador({ personaId: persona.id, cargo: datos.cargo ?? null }, tx);

      const cuenta = await asegurarCuenta(tx, { personaId: persona.id, email: datos.email });

      await registrarAuditoria(
        tx,
        {
          usuarioId: admin.usuarioId,
          entidad: "administrador",
          entidadId: persona.id,
          accion: perfil ? "REACTIVAR_PERFIL_ADMINISTRADOR" : "REGISTRAR_ADMINISTRADOR",
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
